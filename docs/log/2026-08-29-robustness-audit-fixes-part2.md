---
date: 2026-08-29
task: robustness-audit-fixes-part2
---

# Second pass at production-readiness audit fixes

## What changed

Continuation of `2026-08-29-robustness-audit-fixes.md` (same day, same
branch, same underlying audit) — worked through the rest of the
readiness doc's §1 list that didn't need a new decision or a legal
sign-off. Fixed: CORS (was fully open, now restricted via a new
`WEB_APP_ORIGIN` env var, falling back to permissive localhost-only for
local dev); E5 (the worker's pg-boss instance was the only one of the
three connection pools still holding an extra un-disabled LISTEN/NOTIFY
connection — disabled it, reclaiming headroom against Supabase's
15-connection cap); E3 (extraction jobs had no idempotency at all —
added the same self-healing "did this specific job already complete"
check D5 added for transcription, so a retried extraction job no longer
silently creates an extra billable run); E8 (transcription now tracks
`model`/`prompt_version` per transcript, threaded through the whole
stack from `GeminiProvider` to the DB and back out, matching what
extraction already had); E4 (content-hash audio deduplication — the
worker now hashes stitched audio and checks for an existing transcript
from byte-identical audio before calling Gemini, reusing it instead of
re-transcribing and re-billing); and E2, partially (added a real
chunks table and a confirm-on-actual-upload-success endpoint, so chunk
state is a genuine server-side row instead of purely implicit —
stopped short of building an actual resume-on-reload UX, which needs
its own frontend design pass).

E7 (retention/deletion policy) was deliberately left alone — `ADR-0004`
already documents the 90-day default as an explicit placeholder pending
legal/compliance sign-off, and implementing deletion logic without that
sign-off isn't a call this pass should make. Structured logging was
also deliberately left alone — it's genuinely the largest remaining
item (dozens of call sites, real decisions about log levels/redaction)
and rushing it into an already-large pass risked doing it badly.

## Files touched

- `workers/clinical-ai-worker/src/main.ts` — E3's idempotency guard on `processExtractionJob`; E4's dedup check + reuse path in `processTranscriptionJob`; E5's `useListenNotify: false`; E8's `model`/`promptVersion` extraction from the transcription result.
- `workers/clinical-ai-worker/src/internal-api-client.ts` — added `computeAudioHash()`, `findDuplicateTranscript()`.
- `apps/api/src/main.ts` — CORS restricted via `WEB_APP_ORIGIN`.
- `packages/config/src/api-env.ts` — added `WEB_APP_ORIGIN` (optional).
- `apps/api/.env.example` — documented the new var.
- `packages/llm-client/src/gemini-provider.ts` — added `TRANSCRIPTION_PROMPT_VERSION`; `transcribeAudio()`'s metadata now reports `model`/`promptVersion`.
- `packages/llm-client/src/types.ts` — `SpeechUnderstandingMetadata` gained `model`/`promptVersion`.
- `packages/types/src/consultation-transcript.ts` — `ConsultationTranscript`/`CreateTranscriptRequest` gained `model`/`promptVersion`; new `DuplicateTranscriptResponse`, `RecordingChunk` types (in `consultation-recording.ts`).
- `packages/validation/src/consultation-transcript.schema.ts`, `consultation-recording.schema.ts` — matching zod fields.
- `apps/api/src/infrastructure/database/schema/consultation-transcripts.schema.ts` — `model`/`prompt_version` columns.
- `apps/api/src/infrastructure/database/schema/consultation-recordings.schema.ts` — `audio_hash` column.
- `apps/api/src/infrastructure/database/schema/consultation-recording-chunks.schema.ts` (new) — the E2 chunks table.
- `apps/api/src/infrastructure/database/migrations/0004_blue_rumiko_fujikawa.sql`, `0005_rare_micromax.sql`, `0006_lively_doctor_spectrum.sql` (+ meta) — additive migrations for the above.
- `apps/api/src/modules/clinical-ai/application/create-transcript.use-case.ts`, `get-transcript.use-case.ts`, `relabel-transcript-speakers.use-case.ts` — thread `model`/`promptVersion` through.
- `apps/api/src/modules/clinical-ai/application/find-duplicate-transcript.use-case.ts`, `confirm-chunk-upload.use-case.ts`, `list-recording-chunks.use-case.ts` (new) — E4/E2's new use-cases.
- `apps/api/src/modules/clinical-ai/infrastructure/consultation-recording.repository.ts` — `findByAudioHash()`.
- `apps/api/src/modules/clinical-ai/infrastructure/consultation-recording-chunk.repository.ts` (new).
- `apps/api/src/modules/clinical-ai/presentation/clinical-ai.controller.ts`, `clinical-ai.module.ts` — new routes/providers wired in.
- `apps/web/src/features/clinical-ai/services/recording.service.ts` — `confirmChunkUpload()`; `postJson()` now handles empty response bodies.
- `apps/web/src/features/clinical-ai/hooks/useUploadSession.ts` — calls `confirmChunkUpload()` (best-effort) after a chunk PUT succeeds.
- `docs/modules/kal-scribe-integration-readiness.md` — status updated to match.

## Decisions made

- **E3's fix checks "did this specific job (by id) already complete," not "does any run exist for this recording."** Runs are deliberately multi-valued by design (Run 1 vs Run 2 for provider comparison) — the broader check would have incorrectly blocked legitimate re-runs.
- **E4's dedup reuses the transcript but still runs a fresh extraction.** Only the transcription/diarization call (the one operating on raw audio) is skipped; re-running extraction on a reused transcript is unchanged. Explicitly scoped this way — extraction-result reuse would compound with E3's run-versioning in ways worth a separate decision, not bundled into this fix.
- **E4's reused transcript is tagged `dedup-reuse:<original provider>`** in `sttProvider`, with token counts recorded as `0` and `rawResponse` pointing at the original transcript id — so it's honestly distinguishable from a real fresh transcription in the data, not silently indistinguishable.
- **E2 stopped at the server-side tracking table, not a full resume UX.** A real "resume this recording after a browser refresh" experience needs the frontend to load confirmed-chunk state on reopen and reconcile it against the local `MediaRecorder`'s own state — a genuine UX design question, not a backend tightening. Building the backend piece now (while leaving it unused by any resume flow yet) is still a real, valid step forward per the original finding.
- **`confirmChunkUpload`'s failure is swallowed (logged, not thrown).** By the time it's called, the actual audio bytes are already safely in storage — treating this tracking call as load-bearing would make a doctor re-upload real audio over a failure in a purely-observational call.

## Follow-ups / left undone

- E2's resume-on-reload UX (frontend design work).
- E7 (retention/deletion policy) — blocked on legal/compliance sign-off, `ADR-0004`.
- Structured logging (Pino/nestjs-pino) — the single largest remaining item from the original audit.
- `estimated_cost_usd` (needs a maintained per-model pricing table) and linking runs to a git commit SHA — both low-priority, noted but not started.
- §2.3 (uniqueness constraint on `consultation_session_ref`) — needs a real intent decision from whoever owns that product question.
- §2.1 (retyping ref columns from `text` to `uuid`) — deliberately deferred to whenever kal-scribe's own auth work starts.
- The rest of §3's field-by-field CMS schema diff (vitals, `personal_history`, medicines, treatments).
- D1–D4 (no authentication/authorization anywhere) — the single largest risk from the original audit, its own track, untouched by design.
