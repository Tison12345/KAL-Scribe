---
date: 2026-07-05
task: milestone-6-diarization-verified
---

# Milestone 6 follow-up: Diarization verified for real, two bugs fixed

## What changed

The user obtained a Hugging Face token and added `HF_TOKEN` to
`python/asr-service/.env`. Turning it on exposed two real bugs that had
been invisible until now, both fixed:

1. `asr-service` never loaded `.env` at all (no `python-dotenv` call
   anywhere) — harmless before now because `WHISPER_MODEL_SIZE`/
   `STT_DEVICE`'s defaults happened to match, but `HF_TOKEN` would
   never have been read.
2. `speaker_turns` extraction assumed `DiarizationPipeline(...)`
   returns a pyannote `Annotation` (`.itertracks()`); the installed
   whisperx version actually returns a pandas DataFrame. Every
   diarization call was crashing and being silently swallowed by a
   bare `except`, so every segment silently fell back to the
   single-speaker placeholder. Fixed the extraction to iterate the
   DataFrame (matching whisperx's own `assign_word_speakers`
   implementation), and replaced the silent `except: pass` with a
   logged exception so a broken diarization setup is observable again
   in the future.

Verified for real: re-sent an existing test clip through the fixed
`asr-service` and got genuine `SPEAKER_00` labels with populated,
correctly-timed `speaker_turns` — not the `"Speaker 1"` placeholder.

Also discovered: the primary model (`pyannote/speaker-diarization-3.1`)
still 403s because its dependency `pyannote/segmentation-3.0` needs its
own separate gated-terms acceptance, which the user hasn't done. Not
blocking — the code's documented fallback,
`pyannote/speaker-diarization-community-1`, loads and works correctly.

## Files touched

- `python/asr-service/app/main.py` — added `load_dotenv()` before any
  env var is read.
- `python/asr-service/pyproject.toml` — added `python-dotenv` as an
  explicit dependency (was present only transitively before).
- `python/asr-service/app/stt/whisperx_provider.py` — fixed
  `speaker_turns` extraction to iterate the DataFrame `diarize_result`
  actually returns; replaced the silent `except: diarized = False`
  with a logged exception.
- `python/asr-service/.env` — created (didn't exist before); has
  `HF_TOKEN` set by the user.
- `python/asr-service/.env.example` — documented the new `HF_TOKEN` var.

## Decisions made

- No new ADR — this is bug-fixing already-decided architecture
  (Pyannote per architecture.md §9, ADR referenced in Milestone 6's
  log), not a new vendor or design decision.

## Follow-ups / left undone

- **Still not verified against genuine multi-speaker audio** — the
  clip used to confirm the fix has one speaker counting numbers, which
  proves the pipeline runs and returns real (not placeholder) speaker
  labels, but not that it correctly separates two distinct speakers.
  Next real test: a recording with two people actually talking.
- If the primary model is ever wanted over the fallback, the user
  needs to additionally accept gated terms at
  huggingface.co/pyannote/segmentation-3.0.
