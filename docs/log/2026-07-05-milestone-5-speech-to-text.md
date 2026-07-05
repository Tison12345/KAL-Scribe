---
date: 2026-07-05
task: milestone-5-speech-to-text
---

# Milestone 5: Speech-to-Text

## What changed

Built `python/asr-service` — the first Python code in the repo — and
wired the full automated pipeline (record → upload → queue → worker)
to call it for real transcription, replacing Milestone 4's stub
processor. Verified end-to-end on genuine recorded test audio (spoken
number sequences), with the transcribed text matching what was
actually said, through the real automated pipeline (start-recording →
upload → complete-upload auto-enqueues → worker auto-processes), not a
manual shortcut.

Before writing any code, audited a separate, unrelated local project
(`C:\transcribe`) that already runs WhisperX successfully on this
machine, to learn a proven-working config rather than guessing at
package versions or device settings. Mirrored its exact versions
(`whisperx==3.8.6`, `torch==2.8.0`, `torchaudio==2.8.0`) and runtime
config (`small` model, CPU, `int8`), skipping what's irrelevant to us
(YouTube download, diarization — the latter is Milestone 6's job).

## Files touched

- `python/asr-service/` — new: `pyproject.toml`, `app/main.py`
  (FastAPI, `POST /v1/process-audio`), `app/stt/base.py`
  (`SttProvider` interface, architecture.md §8/§20 principle 3),
  `app/stt/whisperx_provider.py` (real implementation), `app/schemas/
  process_audio.py` (Pydantic, mirrors `packages/types`), `.env.example`.
  Python 3.12 venv at `python/asr-service/.venv` (gitignored, already
  covered by Milestone 1's `.gitignore`).
- `packages/types/src/transcript-segment.ts` — `TranscriptSegment`,
  `ProcessAudioResponse`.
- `packages/types/src/consultation-recording.ts` —
  `RequestChunkReadResponse` added.
- `apps/api/src/modules/clinical-ai/application/
  request-chunk-read.use-case.ts` — new; `clinical-ai.controller.ts` —
  new `GET :id/chunks/:sequence/read-url` route;
  `clinical-ai.module.ts` — registered.
- `packages/config/src/worker-env.ts` — added `API_BASE_URL`,
  `ASR_SERVICE_URL`.
- `workers/clinical-ai-worker/src/{asr-client,recording-client}.ts` —
  new; `main.ts` — real `processTranscriptionJob`, replacing the M4
  stub.
- `docs/adr/0009-whisperx-runtime-config-cpu-small.md` — new.

## Decisions made

- **Transcription only reads chunk 0 of a recording, not all chunks.**
  Multiple chunks would need to be stitched into one continuous audio
  file (real audio concatenation via ffmpeg, not simple byte
  concatenation — each chunk is its own complete, independent
  container per Milestone 2's design). Building that now would have
  expanded this milestone's scope substantially for something our
  current test recordings don't even exercise (they're all short
  enough to be one chunk). Deliberately deferred and clearly
  documented in `docs/PROJECT_STATUS.md` as a real functional gap, not
  silently limited.
- **`asr-service`-calling logic lives directly in the worker, not a
  shared package or an `asr-service.adapter.ts` inside apps/api.**
  Architecture.md §5 places `asr-service.adapter.ts` in apps/api's
  module and describes the module as "shared" between apps/api and the
  worker — but apps/api itself never calls `asr-service` directly
  today (only the pipeline, via the worker, does), so there's nothing
  to actually share yet. Same reasoning as Milestone 4's "worker stays
  a plain script" decision. If apps/api ever needs to call
  `asr-service` directly (e.g. an admin "retry transcription"
  endpoint), that's the point to extract this into a shared package —
  not before.
- **Worker fetches audio via signed URL from apps/api, not direct disk
  access.** Reused Milestone 3's `createReadUrl` (built then, unused
  until now) rather than having the worker reach into
  `STORAGE_LOCAL_DIR` directly — keeps the local-disk-vs-real-Supabase
  storage abstraction intact; swapping to real Supabase Storage later
  needs zero worker changes.
- **Transcript is logged, not persisted**, for this milestone — the
  `consultation_transcripts` table (§12) is explicitly Milestone 6
  scope, alongside diarization. Throwing away a correctly-computed
  transcript felt wrong, so it's at least logged in full rather than
  discarded silently, but no database row exists for it yet.
- **CPU + `small` model, not GPU**, per ADR-0009 — discussed with the
  user first (real GPU exists on this machine but is modest, 6GB VRAM;
  clinics never run this themselves regardless, since it's a centrally
  hosted service, so the GPU question is purely an operating
  cost/latency tradeoff for whoever hosts it, deferrable to whenever
  volume actually demands it). `STT_DEVICE` and `WHISPER_MODEL_SIZE`
  are both env vars specifically so the eventual switch needs no code
  change.

## Follow-ups / left undone

- **Multi-chunk stitching** — the clearest, most important gap. A
  consultation longer than ~15 seconds (i.e. any real one) will only
  have its first chunk transcribed today. Needs ffmpeg-based
  concatenation (ffmpeg is available on this dev machine, not yet
  wired into the pipeline).
- **Transcript persistence** — Milestone 6's `consultation_transcripts`
  table doesn't exist yet; today's real transcript output is logged,
  not stored.
- **Diarization** — no speaker identification yet; every segment is
  labeled `"Speaker 1"` as a placeholder, per architecture.md §9 being
  explicitly Milestone 6 scope, not this one.
- **No automated tests** for the new Python code or the worker's new
  HTTP-calling logic — verified manually (direct `curl` to
  `asr-service`, then the full automated pipeline via the real API).
- The alignment model download behavior (large, on-demand, per new
  language) is worth knowing about operationally but isn't optimized —
  a production deployment should probably pre-warm common languages'
  alignment models rather than let the first real request in a new
  language eat a multi-minute cold start.
