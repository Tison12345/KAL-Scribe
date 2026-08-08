---
date: 2026-08-09
task: remove-classic-whisperx-pipeline
---

# Remove the classic WhisperX+Pyannote pipeline

## What changed

The `python/asr-service` WhisperX+Pyannote path (ADR-0001/0009/0012)
had had no active callers since Gemini became the deployed default for
speech understanding (ADR-0013) — it only remained as an unused
`else` fallback branch in the worker, selected when `SPEECH_PROVIDER`
was unset. Ahead of submitting this repo for review, removed it
entirely rather than leaving unused legacy code in `main`: deleted
`python/asr-service/`, made Gemini the sole, unconditional
speech-understanding provider, and removed every type/env var/DB
column that only existed to make the classic path optional. The
removed code remains fully intact on the independent `classic-pipeline`
git branch, untouched by this change. Full reasoning in
`docs/adr/0017-remove-classic-whisperx-pipeline.md`.

## Files touched

- `python/asr-service/` — deleted entirely
- `packages/llm-client/src/load-provider.ts` — `loadSpeechUnderstandingProvider` always returns Gemini (no `null`, no `SPEECH_PROVIDER` field on `LlmClientEnv`)
- `workers/clinical-ai-worker/src/main.ts` — collapsed the `if (speechProvider) {...} else { processAudio(...) }` branch to straight-line code; removed `sttDevice` from the job-payload destructure and both `SPEECH_PROVIDER: env.SPEECH_PROVIDER` call-site lines
- `workers/clinical-ai-worker/src/internal-api-client.ts` — deleted `processAudio()`, the `undici` `Agent`/timeout constants, and the `SttDevice`/`ProcessAudioResponse` imports
- `workers/clinical-ai-worker/package.json` — removed the now-unused `undici` dependency
- `packages/types/src/transcript-segment.ts` — removed `SpeakerTurn`/`ProcessAudioResponse`; `TranscriptSegment` itself unchanged
- `packages/types/src/consultation-recording.ts`, `clinical-ai-job.ts`, `index.ts` — removed `SttDevice` and every `sttDevice` field/export
- `packages/validation/src/consultation-recording.schema.ts` — removed `sttDevice` from `startRecordingSchema`
- `packages/config/src/worker-env.ts` — removed `ASR_SERVICE_URL`, `SPEECH_PROVIDER`
- `tests/eval/src/run-eval.ts` — removed `SPEECH_PROVIDER` from the env object passed to `loadClinicalExtractionProvider`
- `apps/api/src/infrastructure/database/schema/consultation-recordings.schema.ts` — removed `sttDeviceEnum`/`stt_device` column; new migration `0001_yummy_meggan.sql` drops the column and enum (applies automatically via `runMigrations` on `apps/api` boot)
- `apps/api/src/modules/clinical-ai/application/{complete-upload,get-recording,reprocess-job,start-recording}.use-case.ts` — removed all `sttDevice` plumbing
- `apps/web/src/features/clinical-ai/hooks/useUploadSession.ts` — removed `SttDevice` import and the `sttDevice` param (was already dead at its one call site)
- `workers/clinical-ai-worker/.env.example` — removed `ASR_SERVICE_URL`/`SPEECH_PROVIDER`
- `.gitignore` — removed the stale `python (workers/asr-service...)` block, now dead since no Python exists anywhere in the repo
- `docs/adr/0017-remove-classic-whisperx-pipeline.md` — new; `0001`/`0009`/`0012` marked superseded in place
- `docs/architecture.md` §8, §9, §12 — callouts updated to say the classic path is removed, not just historical
- `docs/modules/clinical-ai-pipeline.md`, `docs/PROJECT_STATUS.md`, `docs/INDEX.md` — updated for the removal

## Decisions made

- Gemini becoming a hard, fail-loud dependency for transcription
  (no fallback if `GEMINI_API_KEY` is unset) was already true in
  practice — nothing in any active deployment left `SPEECH_PROVIDER`
  unset — so this only makes the code honest about an existing
  constraint, not a new production risk.
- `TranscriptSegment.originalText`/`originalLanguage` (ADR-0016) are
  untouched — they were never WhisperX-specific, only their
  now-deleted null-fill-in in the classic branch went away with it.
- `packages/types` and `packages/llm-client`'s compiled `dist/` were
  stale during verification (same class of gap as the 2026-07-09
  incident) — rebuilt both before `pnpm typecheck` passed clean.

## Follow-ups / left undone

- Merging this branch into `main` and pushing — not done as part of
  this task, pending explicit confirmation.
- The DB migration (`0001_yummy_meggan.sql`) has not yet been applied
  against the live Supabase instance — it will run automatically the
  next time `apps/api` boots.
