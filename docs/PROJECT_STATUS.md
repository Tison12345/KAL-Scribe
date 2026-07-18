# Project Status

> Rewritten in place after every task — this file always reflects the
> *current* state, not history. For history, see `docs/log/`. For deep
> per-module detail, see `docs/modules/`. For why a decision was made, see
> `docs/adr/`.

**Last updated:** 2026-07-18 — `clinical-ai-single` branch: replaced
BullMQ/Redis with pg-boss (Postgres-native queue) after Redis's
free-tier quota was exhausted twice during testing. No hosted Redis
dependency remains anywhere in this repo. Verified end-to-end against
real Supabase Postgres: job creation, worker pickup, HTTP-based status
reporting, and native retry/dead-letter routing all confirmed working.

## One-paragraph summary

**2026-07-18 (`clinical-ai-single` branch)**: replaced BullMQ + hosted
Upstash Redis with pg-boss, a Postgres-native job queue running on the
same Supabase database this repo already requires — one fewer hosted
service, one fewer quota to exhaust (Redis's free-tier request quota
had been exhausted twice during testing purely from BullMQ's own
chatty heartbeat/retry traffic, `docs/log/2026-07-09-redis-quota-exhausted.md`).
`apps/api` is now the sole queue producer (`QueueModule` wraps a single
producer-only `PgBoss` instance); `workers/clinical-ai-worker` is the
sole consumer, running its own `PgBoss` instance and connecting
directly to `DATABASE_URL` (a narrow, documented exception to
ADR-0010's "worker never touches Postgres directly" rule — pg-boss's
own job tables are queue-engine internals, not this repo's domain
data). Four queues instead of three (each source queue gets its own
dead-letter queue, since a shared DLQ across two different payload
shapes would need a runtime discriminant). The bigger design change:
BullMQ's Redis-backed `QueueEvents` gave apps/api a passive
cross-process event stream for job status; pg-boss has no equivalent,
so the worker now actively reports each transition via a new `PATCH
/clinical-ai/admin/jobs/:id/status` call, extending ADR-0010's
"worker talks to apps/api over HTTP" boundary to status reporting too.
Also decoupled pg-boss's own job id from `consultation_ai_jobs.id` —
the tracking row id now travels inside the job payload itself
(`jobId`), avoiding a reprocessing collision risk that forcing the two
ids to match would have created. `consultation_ai_jobs.bullmq_job_id`
renamed to `queue_job_id`; migration history regenerated as a clean
baseline (no production data exists yet, same convention used for
ADR-0014). Full reasoning in `docs/adr/0015-pg-boss-not-bullmq.md`,
file-by-file summary in `docs/log/2026-07-18-pg-boss-not-bullmq.md`.
**Verified**: full workspace typecheck/build/lint all pass; migration
applied cleanly against real Supabase Postgres; all three processes
(apps/api, the worker, apps/web) restart cleanly with zero Redis
references anywhere in their logs; a real recording pushed through the
actual HTTP endpoints (`start` → `chunks` → `complete`) correctly
enqueued a transcription job via `boss.send()`, the worker picked it up
via `boss.work()`, reported `active` then `failed` over the new status
endpoint (failure was an unrelated pre-existing multi-chunk-fetch path
tripped by the test's single-chunk upload, not a pg-boss defect), and
pg-boss's own retry schedule (`retryDelay: 60`, no application code
re-enqueueing) re-attempted the job on schedule — confirming retry/
backoff works without Redis. **Not yet verified**: a full successful
pipeline run (multi-chunk upload → transcript → extraction → review
draft) through the new queue — this session's live test deliberately
exercised the failure/retry path since that's the part pg-boss changed
most; a happy-path run is still worth doing.

**2026-07-15 (`clinical-ai-single` branch)**: moved from "PoC run with
manual test scripts" toward MVP. Removed PGlite and local-disk storage
entirely (not kept as fallbacks) in favor of a real Supabase project
from day one — `apps/api` now requires `DATABASE_URL` and a
`SupabaseStorageAdapter` replaces the deleted local-disk stand-in
behind the same `StorageAdapter` interface. Redesigned the data model:
the old single `consultation_ai_results` table is split into
`consultation_ai_runs` (immutable AI output, versioned with a stable
`run_number`) and `consultation_reviews` (mutable doctor workflow
state), with a new `consultation_ai_sessions` root entity above
recordings (enables multiple recordings per consultation) and
`consultation_ai_audit_log` finally implemented (architecture.md §12
specified it back at the start; never built until now). Every run now
carries provider/model/prompt-version/latency/token/cost/confidence
metadata plus the pre-parse raw response. Renamed the provider
interfaces to job-based names (`ClinicalExtractionProvider`/
`SpeechUnderstandingProvider`, was `LlmProvider`/`AudioTranscriptionProvider`)
and added per-run provider override support (`requestedProvider`) —
`consultation_ai_runs.run_number` was originally motivated by "run this
consultation again against Claude/Groq for comparison," which needed
this to actually be reachable, not just representable in the schema.
Also added ffprobe-based audio metadata capture and a derived
`GetConsultationAnalyticsUseCase` (speaking %/silence %/latency,
computed on read, never cached). Full reasoning in
`docs/adr/0014-mvp-supabase-postgres-and-storage.md`, file-by-file
summary in `docs/log/2026-07-15-mvp-supabase-and-versioned-runs.md`.
**Verified**: migrations applied cleanly against a real Supabase
Postgres instance (session pooler, port 5432); full workspace
build/lint/typecheck all pass. Supabase Storage verified end-to-end
directly against `SupabaseStorageAdapter`'s own calls (signed upload →
real `PUT` → signed read → real `GET` → cleanup), including creating
the `consultation-audio` bucket itself since it didn't exist yet. Along
the way, discovered the project uses Supabase's current-generation API
keys (`sb_secret_...`) rather than the legacy `service_role` JWT —
renamed `SUPABASE_SERVICE_ROLE_KEY` → `SUPABASE_SECRET_KEY` throughout
to match (confirmed as a documented drop-in replacement, same
permissions). **Not yet verified**: a full pipeline run against the new
schema (record → upload → transcribe → extract → review) — only the
schema/migrations/storage adapter were exercised directly so far, not
a live recording through the actual worker/queue.

**2026-07-13 (`clinical-ai-single` branch, diverges from the mainline
summary below)**: new branch testing whether a single Gemini call can
replace transcription+diarization+extraction end-to-end. Built
`GeminiProvider` (`packages/llm-client`) implementing both the existing
extraction interface and a new `AudioTranscriptionProvider` interface;
the worker now skips `python/asr-service` entirely and sends audio
straight to Gemini when `LLM_PROVIDER=gemini`, while `LLM_PROVIDER=groq`
still runs the unmodified classic pipeline — the two are switchable via
one env var, not a rewrite. Model choice: `gemini-2.5-flash` (GA, not a
preview build). Chose to call Gemini's API directly rather than through
OpenRouter after checking OpenRouter's audio support — its unified
schema doesn't expose Gemini's native `responseSchema`/File API, which
would confound a PoC specifically judging Gemini's real capability. One
functional improvement over the classic pipeline: Gemini labels
"Doctor"/"Patient" semantically from what's said rather than "first to
speak = Doctor" turn-order guessing, which required a small guard fix
in the shared labeling heuristic so it doesn't override a correct
semantic label. Full reasoning in `docs/adr/0013-gemini-single-model-poc.md`,
file-by-file summary in `docs/log/2026-07-13-gemini-single-model-poc.md`.
**Verified against a real recording**: reused the existing ~7m19s
digestion-consultation audio already in local storage, called
`GeminiProvider` directly (bypassing the queue — not yet a full
worker/UI click-through). Transcription: 42.3s, 80 correctly
Doctor/Patient-labeled segments. Extraction: 34.6s, schema-conforming on
the first attempt, correct diagnosis/medicines/dosages/follow-up, and
correctly left every physical-exam field null since none were stated
aloud — the same hallucination-avoidance behavior the classic pipeline
required real prompt engineering to achieve, here for free on the first
real test. One unexplained ~40s gap in transcript segment coverage
worth a closer look. Full BullMQ pipeline run + `ReviewDraftPanel`
click-through with this provider still hasn't happened.

**2026-07-09**: a second, more literal pass re-verified the 2026-07-06
extraction schema option-by-option against the CMS's actual source
(rather than trusting that pass's own "verified" claim) and found real
discrepancies: 5 of 8 Ashtavidha option lists were wrong (the CMS
reworked them in a 2026-06-22 commit this repo's schema didn't fully
track), Personal History's `bowel` was single-select with invented
options instead of the real 8-option multi-select, `exercise` had an
invented option, `treatments[].oilTempF` was typed as a Fahrenheit
number when the live form is actually a categorical Ayurvedic-term
dropdown, and `vitals.bpPosition` turned out to be a fully invented
field with no input anywhere in the live form. All fixed across
`packages/types`/`validation`/`llm-client`/`ReviewDraftPanel.tsx`;
schema version bumped to 2.1. One live file collision with the other
concurrently-active session occurred and was caught and repaired
mid-edit — see `docs/log/2026-07-09-extraction-schema-field-audit.md`
for the full account, root-cause note, and the two items deliberately
left unmodeled (medicine `timing`'s `consumptionMode` conditional,
treatment `bodyPart`'s Full-Body/Local/body-map structure).

Milestones 1–8 are done. The pipeline now runs all the way from
recording to a **doctor-reviewable, editable AI draft**: record →
upload → queue → transcribe (WhisperX) → diarize (Pyannote) → extract
(Groq-hosted Llama) → a full `ReviewDraftPanel` where every §11 field
is visible, editable, confidence-badged, and risk-flagged, with
autosave and accept/discard against a stub CMS adapter. No AI-suggested
field ever reads as already-authoritative — status badges and
per-section confidence badges make that visible everywhere, not just
once at the top. `update`/`accept`/`discard` were verified live against
real recordings run through the full pipeline, surfacing and fixing a
real bug (`accept`/`discard` weren't mutually terminal — a discarded
draft could be silently accepted and vice versa, each time actually
calling the stub CMS adapter; both directions now 400 correctly). The
user then ran the **first genuine multi-minute consultation** through
the app (a ~2-minute fake Ayurvedic dialogue) — this surfaced a second,
more serious bug: with no request timeout on the worker's call to
`asr-service`, retries piled up abandoned CPU-bound transcription work
in the background, burning ~88 minutes of CPU time and stalling the
result for 35 minutes even though the recording had actually succeeded
partway through. Fixed with an explicit 20-minute timeout. The
resulting transcript and extraction were both genuinely accurate (see
Known issues for the one real STT limitation this surfaced). That
35-minute stall directly motivated a new **pipeline progress
tracker**: `consultation_ai_jobs` already recorded per-stage
`started_at`/`completed_at`/`status`, just never exposed anywhere —
two new endpoints plus a frontend hook/component now surface a real
stage indicator (uploading → transcribing → extracting → ready, or
failed) and an honest timing summary once done, verified against both
the historical stalled recording and a fresh clean run (~16s upload,
~14s transcription, ~2s extraction for an 8-second clip). Live browser
click-through of `ReviewDraftPanel` itself (not just its backing
endpoints) is still worth a look, though the underlying data is now
confirmed correct end-to-end.

**2026-07-06: the entire extraction schema was rebuilt from scratch**
against the real clinical form, not architecture.md §11's original
generic placeholder. §11 was written before the real CMS integration
target (`C:\KAL-clinic-management-solution`) had been examined field
by field; once it was (reading ~15 actual component files, not just
the CMS's type file), the schema, LLM prompt, review UI, and eval
harness were all rewritten to match the CMS's own field names and
option sets directly — see `docs/modules/clinical-extraction-schema.md`
for the full derivation and every discrepancy found along the way.
Verified twice: the eval harness (11/12, 92% — the one "failure" is a
scorer strictness issue, not a real bug) and a real re-extraction
against the existing digestion-consultation recording, both correctly
leaving every physical-examination field (Ashtavidha/Srotas/Prakrithi/
Dosha/Agni/Ojas) null since none were ever examined aloud — the exact
hallucination the new prompt rule exists to prevent. One real bug
found and fixed: a family-history disease name outside the UI's 7
canonical checkboxes would have been silently invisible in the review
screen (fixed the prompt to route those into the UI's actual "_other"
field instead — though the LLM doesn't 100% reliably comply with this
one rule yet, a documented open item, not a code bug).

## What's built

- Milestones 1–7 — see their own log entries (repo scaffold; recording
  capture + consent UI; upload session API + storage; BullMQ queue +
  worker; real WhisperX transcription; Pyannote diarization verified on
  real two-speaker audio at ~60% turn-level accuracy; clinical
  extraction via Groq, verified end-to-end with a real accuracy eval
  harness).
- Milestone 8 — Review UI:
  - **`extraction-confidence.engine.ts`** — new pure domain logic
    (architecture.md §5, §20 principle 7): `getConfidenceLevel`,
    `shouldShowLowConfidenceWarning`.
  - **`cms-integration.adapter.ts` + stub implementation** — the one
    seam into "the rest of the CMS" (architecture.md §16), per §17
    Phase 1: logs the call and returns a realistic fake ref instead of
    calling a real CMS. Only `submitPrescriptionDraft` exists so far —
    the read-only master-list methods belong to Milestone 9, which
    actually consumes them.
  - **`update`/`accept`/`discard` review-draft use-cases + routes** —
    `PATCH :id/extraction` (autosaved doctor edits, stored in a
    separate `edited_extraction` column so the original AI output
    stays auditable), `POST :id/extraction/accept` (calls the CMS stub,
    marks `accepted`, idempotent), `POST :id/extraction/discard`
    (idempotent).
  - **`ReviewDraftPanel`** — the full doctor-facing review screen,
    rebuilt 2026-07-06 against the real clinical form fields (see
    below) — Case Sheet, Detailed Assessment, Medicines, Treatments,
    Lab Tests/Diet/Lifestyle, collapsible section cards matching
    `docs/design/ui-reference.md`'s existing patterns exactly,
    `ConfidenceBadge`/`RiskFlagBanner` throughout, accept/discard
    action bar.
  - **`useReviewDraft`** — polls for the extraction result (mirrors
    `useTranscript`'s reasoning), holds local edit state, autosaves
    800ms after the doctor stops typing (not on every keystroke).
  - **`StringListEditor`** — one shared editor for the six-plus
    `string[]` fields in the schema, instead of near-duplicate
    row-editors per field.
  - **Verified live against three real recordings run through the full
    pipeline**: `PATCH .../extraction` correctly writes to
    `edited_extraction` without touching the original `extraction`,
    `accept` correctly no-ops on a second call, and — after finding and
    fixing the terminal-state bug below — `discard → accept` and
    `accept → discard` both now correctly 400 instead of silently
    flipping status and re-invoking the CMS stub.
  - **`PipelineProgressTracker` + `usePipelineProgress`** — real
    (not simulated) stage indicator (uploading → transcribing →
    extracting → ready/failed) and an honest per-stage timing summary,
    built on `consultation_ai_jobs`/`consultation_recordings` data the
    system already tracked but never exposed. New `GET :id` and
    `GET :id/jobs` endpoints back it. Directly motivated by the
    35-minute stall — answers "is this stuck or just slow" without
    guessing. Deliberately does not fake fine-grained % progress within
    a stage (architecture.md §19 files real-time transcription as a
    future enhancement, not MVP).
- **2026-07-06 — Real clinical form schema rebuild** (supersedes
  architecture.md §11): `ClinicalExtraction` now mirrors the actual CMS
  (`C:\KAL-clinic-management-solution`) field-for-field — Case Sheet
  (complaints, personal history, family history, gynec, vitals),
  Detailed Assessment (Ashtavidha Pariksha, Srotas Pariksha, Prakrithi/
  Dosha/Agni/Ojas/Ama, diagnosis, notes), and Prescription (medicines
  with a real dosage grid, treatments with real therapy fields,
  dietEat/dietAvoid, lifestyleMaintain/lifestyleAvoid, followUpValue/Unit).
  See `docs/modules/clinical-extraction-schema.md` for the full
  derivation, every discrepancy found while verifying against the CMS's
  actual component code (not just its type file), and the two explicit
  scope decisions made (excluding `emotionalMakeup`, including Family
  History from a different CMS tab). Verified via `pnpm eval` (11/12)
  and a real re-extraction against an existing recording — both
  correctly left every physical-examination field null since none were
  stated aloud, confirming the new "never infer exam findings" prompt
  rule works on genuine speech, not just the eval fixture.

## In progress

- **`clinical-ai-single` branch**: pg-boss migration (ADR-0015) done
  and verified against real Supabase Postgres (job creation, worker
  pickup, HTTP status reporting, retry/backoff all confirmed on a real
  failure path). Remaining: a full *successful* pipeline run (record →
  multi-chunk upload → transcribe → extract → review) through the new
  queue — this session verified the failure/retry path deliberately,
  not yet a clean happy-path run through the new sessions/runs/reviews
  tables end-to-end.
- Otherwise nothing on the mainline pipeline — Milestone 8's scoped work
  (including the terminal-state fix) is complete.

## Not started

- **Live browser click-through** of the Review UI (actually using
  `ReviewDraftPanel` — typing edits, clicking Accept/Discard) — the
  backing endpoints are now verified directly, but the UI itself
  hasn't been driven interactively. Left to the user.
- Milestone 9 (CMS Mapping) and onward — see `docs/architecture.md` §18.
- Real Supabase Storage/Postgres integration — both are local
  stand-ins today (ADR-0007, ADR-0008).
- GPU inference — still deferred, see ADR-0009.
- Audio-level eval fixtures (raw audio → transcription WER) — needs
  real or de-identified audio plus hand-transcribed ground truth.

## Known issues / risks

- **2026-07-09, same day, three more incidents**: (1) local PGlite
  database corrupted by an ad-hoc script opening a second concurrent
  connection to `.data/pglite` while the live api server had it open
  — PGlite is single-process-only, unlike a real Postgres server;
  recovered by moving the corrupted dir aside
  (`.data/pglite-corrupted-2026-07-09`) and letting migrations
  recreate an empty one, which meant losing all local recording
  history (raw audio in `.data/storage/` was untouched). (2) Groq's
  free-tier 12,000 TPM limit was hit repeatedly on a 7-minute
  consultation's extraction call (~6,700-7,600 tokens/attempt, rapid
  BullMQ retries kept re-consuming the same per-minute budget) —
  swapped `GROQ_MODEL` to `llama-3.1-8b-instant` (much higher token
  ceiling, but confirmed less reliable on synthesis-heavy fields like
  diagnosis/notes — see next item). (3) `modernDiagnosis`/
  `clinicalNotes` coming back null/empty led to relaxing the
  diagnosis prompt rule and making clinical notes genuinely mandatory
  (schema `.min(1)` + retry-with-feedback), which in turn surfaced an
  unrelated pre-existing bug: `ConsultationAiResultRepository
  .findByRecordingId()` had no `ORDER BY`, so a recording with more
  than one extraction attempt could non-deterministically return a
  stale result — fixed with `ORDER BY created_at DESC`. Full account:
  `docs/log/2026-07-09-redis-quota-exhausted.md`,
  `docs/log/2026-07-09-diagnosis-notes-mandatory-and-stale-extraction-bug.md`.
- **`packages/types`' compiled `dist/` was stale as of 2026-07-09,
  now rebuilt** — the source-level `oilTempF`/`bpPosition` fixes above
  weren't reflected in the compiled output apps/api and the worker
  actually import at runtime until `pnpm --filter @kal-scribe/types
  --filter @kal-scribe/validation --filter @kal-scribe/llm-client
  build` ran and both were restarted. Same class of gap as the
  2026-07-06 CI ordering bug below — `nest --watch`/`tsx watch` only
  rewatch their own app's source, never a workspace dependency's
  `dist/`, so a schema change in `packages/types` silently doesn't
  reach a running dev server until an explicit rebuild + restart.
- **Upstash Redis free-tier request quota exhausted (2026-07-09) —
  resolved 2026-07-18 by removing Redis entirely**
  (`docs/adr/0015-pg-boss-not-bullmq.md`); rest of this entry kept for
  history, no longer an active risk.
  `apps/api` and the worker both started failing to even authenticate
  to Redis (`ERR max requests limit exceeded. Limit: 500000, Usage:
  500006`). Redis is what backs the BullMQ job queue connecting "a
  recording finished uploading" (apps/api enqueues) to "go transcribe
  it" (the worker consumes) — every job add/heartbeat/retry/completion
  is one or more real Redis commands, and BullMQ is chatty by design.
  Web/API/asr-service all still respond to plain HTTP (not everything
  looked broken), but any *new* recording would silently never process
  since the queue itself can't be written to. Root cause: cumulative
  usage across many days of testing, repeated retries from earlier
  bugs, the frontend's `usePipelineProgress` polling (recall the
  "2867 requests" observation from a much earlier session), and a
  stretch where duplicate worker/api processes were briefly running
  simultaneously (docs/log/2026-07-07-headers-timeout-bug-fix.md),
  each holding its own Redis connection. User is creating a fresh
  Upstash instance; `REDIS_URL` needs updating in both `apps/api/.env`
  and `workers/clinical-ai-worker/.env` once ready. No local-Redis
  dev stand-in exists yet (unlike Postgres/storage, ADR-0007/0008) —
  worth considering so dev/test traffic stops burning a shared cloud
  quota at all.
- **CI build order fixed (2026-07-06)**: `.github/workflows/ci.yml` ran
  `lint` before `build`, so `@kal-scribe/types`/`@kal-scribe/validation`
  (typed via `dist/index.d.ts`) had no `dist/` yet on a fresh checkout,
  making apps/api's imports resolve to `any` and tripping 84
  `@typescript-eslint/no-unsafe-*` errors. Reordered to build first;
  verified `pnpm build && pnpm lint` passes clean workspace-wide. See
  `docs/log/2026-07-06-ci-lint-before-build-ordering-fix.md`.
- **Headers-timeout bug fixed (2026-07-07)**: the Milestone 8
  20-minute `AbortSignal` timeout on the worker's asr-service call
  never actually worked for a real multi-minute consultation — undici's
  own `headersTimeout`/`bodyTimeout` (300s default, independent of any
  `AbortSignal`) killed the connection first every time. Reproduced
  directly (`UND_ERR_HEADERS_TIMEOUT` at 304s) and fixed by dispatching
  through a dedicated undici `Agent` with both raised to 20 minutes.
  Verified against a real ~7-minute recording: transcription completed
  in 4m36s, extraction in 5s, full draft persisted. See
  `docs/log/2026-07-07-headers-timeout-bug-fix.md`.
- **WhisperX silently dropped the final ~8s of that same real recording**
  — the transcript's last segment ended at 421s against 430s of actual
  audio. Isolated the missing tail and re-ran it directly against
  asr-service: pyannote diarization still detected 7 speaker turns of
  voice activity in that window, but Whisper produced zero transcript
  segments for it even in isolation — not a pipeline bug, a genuine STT
  decode failure on that stretch of audio (too quiet/trailing/unclear).
  Same class of issue as the "Triphala" mishearing below: the review UI
  is the safety net for exactly this.
- **`asr-service` has no request-cancellation mechanism** — the
  20-minute timeout (now genuinely working, see above) makes premature
  retries far less likely, but if a request is genuinely abandoned
  (timeout, worker crash), the Python-side computation still runs to
  completion wastefully rather than being cancelled. Real fix would
  need WhisperX's blocking call running in a cancellable executor wired to
  the request's disconnect — bigger change, not done.
- **STT accuracy on Ayurvedic-specific medicine names is unverified
  beyond one example** — WhisperX mis-heard "Triphala and Avipattikar
  churna" as "a trifle" in the first real multi-minute test, merging
  two medicines into one garbled entry. Not a bug in this repo's
  extraction logic (it correctly extracted what it was given) — an
  upstream STT vocabulary limitation worth watching for a pattern.
- **`ReviewDraftPanel` itself hasn't been clicked through in a real
  browser since its 2026-07-06 rebuild** — verified via a real
  extraction against a real transcript at the data layer (API responses
  inspected directly), and the UI code builds/lints clean, but the new
  Ashtavidha dropdowns, Srotas normal/disturbed toggles, family history
  matrix, and medicine dosage grid haven't been visually clicked
  through in an actual browser session yet.
- **`ReviewDraftPanel`'s medicine/treatment editors use plain text/number
  inputs**, not the CMS's actual formulary-search/master-list-backed
  editors (`MedicineNameInput`/`TreatmentNameInput`'s live Supabase
  search) — those don't exist in this standalone repo yet (Milestone 9
  builds the master-list resolution they'd depend on). Matches
  architecture.md §6's "stub until integration" note explicitly.
- **Eval harness has one fixture so far** — rewritten against the new
  schema, currently 11/12 (92%); the one "failure" is the scorer being
  stricter than necessary (LLM said `followUpValue: 14,
  followUpUnit: "days"` for a stated "two weeks" — exactly equivalent,
  just a different valid unit), not a real extraction bug. Worth more
  fixtures before drawing conclusions about prompt quality either way.
- **LLM doesn't 100% reliably route non-canonical family-history
  diseases into the `"_other"` field** — the prompt explicitly
  instructs this (so the review UI's fixed 7-checkbox table doesn't
  silently hide anything), but a same-day retest still produced a
  free-text disease key instead. Documented as an open LLM-compliance
  gap, not a code bug — the schema/validation correctly accept either
  shape either way.
- **Primary diarization model now active, real before/after comparison
  done** — `asr-service` now loads `speaker-diarization-3.1` with no
  403 (gated terms accepted for it and its `segmentation-3.0`
  dependency), replacing the `community-1` fallback the ~60% Milestone
  6 baseline was measured on. Re-ran the exact same Milestone 6
  two-speaker audio directly against the upgraded model: 13/15
  transcript segments matched exactly, 2 changed, and both changes
  correctly reassigned a misattributed line to the right speaker.
  One data point — worth another real test to confirm this holds.
- **Restart can strand a job's DB status** — unchanged from Milestone
  4, still not fixed.
- **Local stand-ins, not real infra**, still true for Postgres/Storage
  (ADR-0007, ADR-0008) — unchanged from Milestone 3.
- **ffmpeg is a new, undeclared operational dependency** — unchanged
  from Milestone 6, still not reflected in any Dockerfile/deployment
  tooling.
- Two decisions from Milestone 1 remain open pending legal/compliance
  input: cloud LLM data handling (ADR-0002) and the 90-day retention
  default (ADR-0004).
- **CPU-only transcription+diarization runs ~2× audio duration**
  (e.g. ~4m for a ~2min recording) — only 2 real data points so far,
  tracked in `docs/runbooks/performance-benchmarks.md`. This is the
  concrete evidence ADR-0009's planned GPU upgrade will eventually need
  to act on. **Update (2026-07-07): GPU upgrade tested, ~6.1x faster**
  — see Key decisions below.

## Key decisions in effect

- STT provider: WhisperX — `docs/adr/0001-stt-provider-whisperx.md`
- WhisperX runtime: **now GPU (CUDA, float16)** on this machine (RTX
  4050) — same 7-minute recording went from 4m35s (CPU) to 45s (GPU),
  a ~6.1x speedup, comfortably clearing architecture.md §13's "draft
  in under a minute" target — `docs/adr/0012-whisperx-gpu-cuda-float16.md`,
  `docs/log/2026-07-07-gpu-speed-test.md`. Supersedes the CPU/int8
  config in `docs/adr/0009-whisperx-runtime-config-cpu-small.md`
  (kept as the fallback for machines without a GPU). Production
  hosting (self-host GPU vs. hosted GPU/serverless vs. hosted STT API)
  is still an open question — this only validates local speed.
- LLM provider (MVP extraction): Groq-hosted Llama, verified working —
  `docs/adr/0002-llm-provider-groq-mvp.md`,
  `docs/adr/0011-llm-extraction-implementation-choices.md`
- Object storage (production target): Supabase Storage —
  `docs/adr/0003-object-storage-supabase.md`
- Audio retention: 90 days (proposed default) —
  `docs/adr/0004-audio-retention-90-days.md`
- UI font: Manrope, not the Marcellus/Figtree pairing in
  `ui-guidelines.md` — `docs/adr/0005-ui-font-manrope.md`
- RecordButton level-meter visual design —
  `docs/adr/0006-record-button-level-meter.md`
- Object storage (local dev stand-in): local disk, signed-URL-shaped —
  `docs/adr/0007-local-disk-storage-standin.md`
- Postgres (local dev stand-in): embedded PGlite —
  `docs/adr/0008-local-postgres-standin-pglite.md`
- Queue: **pg-boss (Postgres-native), not BullMQ/Redis** — runs on the
  same `DATABASE_URL` as everything else, no hosted Redis dependency
  remains — `docs/adr/0015-pg-boss-not-bullmq.md`. Supersedes the
  BullMQ/Upstash-Redis line this entry used to have.
- Diarization: Pyannote — now running the **primary**
  `speaker-diarization-3.1` model (gated-terms access granted
  2026-07-06, including its `segmentation-3.0` dependency), replacing
  the `community-1` fallback that earlier's ~60% turn-level accuracy
  number was measured on. Re-verified against the exact same Milestone
  6 two-speaker audio: 13/15 segments matched, 2 changed, both changes
  correct reassignments. No ADR filed; this is the vendor
  architecture.md §9 already specifies, not a new choice.
- Worker calls apps/api over HTTP, not by importing NestJS use-cases —
  `docs/adr/0010-worker-http-client-not-nestjs-import.md`.
- CMS integration: stubbed (`StubCmsIntegrationAdapter`), logs instead
  of calling a real CMS — architecture.md §17 Phase 1, no ADR needed
  (this is the standalone-phase design already specified, not a new
  choice).
- Extraction schema: rebuilt against the real clinical form
  (`C:\KAL-clinic-management-solution`), superseding architecture.md
  §11's original placeholder, **now at version 2.1 as of 2026-07-09**
  after a second audit pass corrected several option-string/type
  mismatches the initial rebuild missed — `docs/modules/clinical-extraction-schema.md`
  is now the authoritative reference, no ADR needed (this corrects an
  earlier draft to match the actual integration target, not a new
  design choice).

## Next up

- User to click through the Review UI live in a browser against its
  2026-07-06 rebuild: record a real consultation, verify the Ashtavidha/
  Srotas/family-history/medicine-dosage-grid UI renders and edits
  correctly, and accept/discard against a genuine draft (the backing
  endpoints and data shape are already verified — this is the visual/
  interaction layer on top).
- Milestone 9 (CMS Mapping) per `docs/architecture.md` §18:
  deterministic medicine/treatment mapping (§7 stage 11),
  `match_confidence` scoring, stub `resolveMedicineMasterList`/
  `resolveTreatmentMasterList` fixtures.
