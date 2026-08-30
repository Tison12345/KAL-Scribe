---
date: 2026-08-29
task: robustness-audit-fixes
---

# First pass at production-readiness audit fixes

## What changed

A full read-only production-readiness audit was run against `main` (13
areas: idempotency, chunking, failure handling, queues, usage tracking,
token limits, caching, storage, observability, model/prompt
versioning, database, security, plus a final scored assessment —
38/100, dominated by a system-wide missing authentication/authorization
gap that's tracked separately and deliberately not touched here). This
entry covers the first pass of fixes taken from that audit's cheapest,
highest-value findings, on branch `robustness/audit-fixes`.

Fixed a real, previously undiscovered bug (D5): if the worker died (or
its own HTTP call to apps/api failed) between persisting a transcript
and enqueueing the extraction job, a retry would see the transcript
already existed and report the job "completed" — silently stalling the
pipeline with a transcript but no extraction, and no failure signal
anywhere. Also removed a PHI-in-logs issue (D7: full verbatim
transcript text was logged to stdout on every successful
transcription) and added request timeouts to both LLM providers (E1:
neither Gemini nor Groq calls had any timeout at all, so a hung request
held a worker concurrency slot indefinitely). Separately, added a
`facility_id` column to `consultation_ai_sessions` as a structural
convention (§2.2 of the integration-readiness doc) to keep a future CMS
merge smaller, unrelated to the audit's risk findings.

## Files touched

- `workers/clinical-ai-worker/src/main.ts` — D5: `processTranscriptionJob`'s idempotency guard now checks whether an extraction job was actually enqueued (not just whether a transcript exists) and self-heals by enqueueing it if not. D7: replaced the full-transcript-text log line with a shape-only summary.
- `workers/clinical-ai-worker/src/internal-api-client.ts` — added `listRecordingJobs()`, used by the D5 fix.
- `packages/llm-client/src/gemini-provider.ts` — E1: added `AbortSignal.timeout(120_000)` to the `generate()` fetch call, with a clear timeout error message.
- `packages/llm-client/src/groq-provider.ts` — E1: same timeout treatment for `callAndValidate()`.
- `apps/api/src/infrastructure/database/schema/consultation-ai-sessions.schema.ts` — added nullable `facility_id uuid` column, no FK yet.
- `apps/api/src/infrastructure/database/migrations/0003_last_warpath.sql` (+ meta) — the additive migration for the above.
- `docs/modules/kal-scribe-integration-readiness.md` (new) — copy of the CMS-side robustness/integration-readiness plan this pass worked from, kept in sync manually; canonical copy lives on the CMS side (`KAL-clinic-management-solution/context/dev-notes/`).

## Decisions made

- **D5's fix is a self-healing retry check, not the single-transaction approach the readiness doc originally proposed.** Functionally equivalent for this failure mode (an extraction job either exists or it doesn't — checking and enqueueing on retry closes the gap without needing a new "extraction pending" status or a cross-service transaction, which isn't really available anyway since apps/api and the worker talk over HTTP, not a shared DB transaction).
- **Left §2.1 (retyping `doctorIdRef`/etc. from `text` to `uuid`) and §2.3 (a uniqueness constraint on `consultation_session_ref`) undone rather than guessing.** §2.1's premise didn't hold against real data (`doctorIdRef: "test-doctor"` is the actual convention, not an isolated fixture) — retyping now would break that convention without a real answer yet for what a doctor ID should look like before auth work happens. §2.3's "one AI session per consultation" intent is stated but unconfirmed — a doctor discarding and restarting, or reopening for a follow-up, might be a legitimate reason for two sessions against one ref.
- **§2.4 and §2.5 (facility-configurable vocabulary, Panchakarma boundary) needed no code change** — checked directly against `packages/validation/src/clinical-extraction.schema.ts` and confirmed both were already correctly modeled.

## Follow-ups / left undone

- §2.3's uniqueness constraint — blocked on confirming real intent, not implemented.
- §2.1's `text`→`uuid` retype — deliberately deferred to whenever kal-scribe's own auth work starts.
- The rest of §1 from the readiness doc: E2 (chunk-level DB tracking / resumable transcription), E3 (extraction-stage idempotency), E4 (content-hash audio dedup), E5 (Supabase connection-pool headroom), CORS (currently fully open), E7 (retention/deletion policy — `deleted_at` exists but is never written), E8 (transcription-stage model/prompt-version tracking), and structured logging (Pino/nestjs-pino with a correlation ID).
- D1–D4 (no authentication/authorization anywhere in `apps/api`, RLS disabled, admin endpoints unprotected) — the single largest risk from the audit, explicitly out of scope for this pass and tracked as its own track in the readiness doc.
- The rest of the §3 field-by-field CMS schema diff (vitals, `personal_history`, medicines, treatments) — only the newly-flagged `agni`/`ojas`/`vyaadhi`/`srotas_pariksha` columns were spot-checked this pass.
