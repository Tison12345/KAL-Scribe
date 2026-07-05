---
date: 2026-07-05
task: milestone-8-long-audio-timeout-bug
---

# Real-world bug: long audio caused a CPU/memory pile-up, not a timeout

## What happened

The user recorded a genuine ~2-minute consultation (a fake Ayurvedic
digestive-complaint dialogue) through the web UI — the first real,
multi-minute test of the pipeline; every prior test used ~6-8 second
clips. 35 minutes later, the transcript and extraction endpoints were
still 404ing.

## Root cause

`processAudio()` (`workers/clinical-ai-worker/src/internal-api-client.ts`)
called `python/asr-service` with no explicit fetch timeout, relying on
Node's undici default (~300s headers/body timeout). A 2-minute clip's
real CPU-only WhisperX transcription + Pyannote diarization can
legitimately take longer than that. When the client's fetch gave up,
BullMQ retried the transcription job (exponential backoff) — but
`asr-service` has no request-cancellation mechanism, so the *abandoned*
computation kept running in the background. Each retry piled another
concurrent transcription attempt onto the same CPU, and by the time
this was investigated `asr-service` had burned ~88 minutes of CPU time
and 2.6GB of RAM on stacked, abandoned attempts — compounding the
slowness further with every retry.

The recording actually did succeed eventually, on its own, mid-pile-up
— confirmed correct transcript and a genuinely good extraction
(chief complaint, symptoms, family history, diet, lifestyle, SOAP note
all correctly captured). It was just extremely slow because of the
resource contention, not because anything was fundamentally broken.

## Fix

Added an explicit `AbortSignal.timeout(20 * 60 * 1000)` (20 minutes) to
`processAudio`'s fetch call — generous enough for real multi-minute
consultations on this CPU-only setup (docs/adr/0009), while still
failing predictably rather than silently inheriting whatever Node's
default happens to be. Restarted `asr-service` to release the piled-up
CPU/memory from the abandoned retries.

## Files touched

- `workers/clinical-ai-worker/src/internal-api-client.ts` — explicit
  20-minute timeout on the `processAudio` fetch call.

## Interesting real finding (not a bug)

WhisperX mis-transcribed "Triphala and Avipattikar churna" as "a
trifle," merging two distinct medicines mentioned in the audio into
one garbled entry with combined dosage instructions. This is a genuine
speech-recognition vocabulary limitation (Ayurvedic-specific terms
aren't well-represented in Whisper's training data) — the extraction
step correctly extracted what it was given; the gap is upstream, in
STT accuracy on domain-specific terms. Not fixed here — worth watching
for a pattern across more real consultations before deciding whether
it's worth a mitigation (e.g. Whisper's `initial_prompt` hinting).

## Follow-ups / left undone

- **`asr-service` still has no real request-cancellation mechanism** —
  the 20-minute timeout makes premature retries far less likely, but
  if a request genuinely does get abandoned (timeout, worker crash),
  the Python-side computation still runs to completion wastefully.
  Building real cancellation would mean running WhisperX's blocking
  call in a cancellable executor with the request's disconnect wired
  through — a bigger change, not done here.
- **STT accuracy on Ayurvedic-specific medicine/treatment names** is
  unverified beyond this one example — worth tracking as more real
  consultations are tested.
