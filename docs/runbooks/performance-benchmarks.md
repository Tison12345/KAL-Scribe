# Performance Benchmarks — Pipeline Timing

Living doc, appended (not rewritten) as new real data points come in —
answers questions like "if a consultation is 10 minutes, how long
until the doctor sees a draft?" with actual measurements instead of
guesses. All data comes from `usePipelineProgress`'s timing summary
(architecture.md §13's `consultation_ai_jobs.started_at`/`completed_at`,
docs/log/2026-07-05-milestone-8-pipeline-progress-tracker.md) —
CPU-only WhisperX (`small`, int8) + Pyannote (`community-1`) +
Groq extraction (docs/adr/0009, current known-issues in
PROJECT_STATUS.md).

## Data points

| Date | Audio duration | Upload | Transcription + diarization | Extraction | Total | Notes |
|---|---|---|---|---|---|---|
| 2026-07-05 | 8s | 16s | 14s | 2s | 31s | Short test clip (spoken numbers), uploaded from a pre-recorded file via curl (not a live recording — upload time here reflects script overhead, not real recording pace) |
| 2026-07-05 | ~126s (~2m6s) | 2m9s | 4m9s | 4s | 6m23s | Real ~2-minute fake Ayurvedic consultation dialogue, recorded live through the browser (upload time here roughly tracks how long the doctor was actually speaking, since chunks upload as they're captured — not a pure network/upload-speed number) |
| 2026-07-07 | 431s (~7m11s) | 7m13s | 4m35s | 5s | ~11m53s | Real ~7-minute consultation, recorded live through the browser. First 3 attempts failed at exactly ~300s into transcription — traced to an undici `headersTimeout` bug (docs/log/2026-07-07-headers-timeout-bug-fix.md), not a real processing-time data point; the 4m35s figure is the clean run after the fix. Also surfaced a real WhisperX limitation: the final ~8s of audio produced zero transcript text despite pyannote detecting continued voice activity there — confirmed via isolated re-transcription, not a pipeline bug. |

## Rough extrapolation (2 data points — treat as order-of-magnitude, not a formula)

Transcription + diarization time relative to audio length:
- 8s audio → 14s processing (~1.75×)
- 126s audio → 249s processing (~2×)

Both points cluster around **~2× audio duration** for transcription +
diarization on this CPU-only setup. Naively extrapolating: a
**10-minute (600s) recording ≈ ~20 minutes of transcription +
diarization**, plus a few seconds for extraction, plus however long the
consultation itself took to upload.

**Caveats, explicitly:**
- Only 2 data points — this is not a validated curve. Whisper's
  internal chunking/VAD and Pyannote's clustering cost may not scale
  strictly linearly past some audio length (memory pressure, longer
  speaker-clustering search space, etc.).
- Both runs happened after the CPU pile-up bug fix
  (docs/log/2026-07-05-milestone-8-long-audio-timeout-bug.md) — with a
  cold/contended `asr-service`, real times would be worse.
- GPU inference (docs/adr/0009) is a planned upgrade specifically
  because this CPU-only ~2× ratio will not scale to real clinic volume
  or longer consultations — this table is exactly the evidence that
  decision will eventually need.

**Add a new row every time a real recording completes** (numbers are
already shown in the UI's timing summary once a pipeline run finishes —
no extra work needed to capture them beyond copying them here) so this
table gets more reliable over time instead of staying a 2-point guess.
