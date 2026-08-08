# ADR-0012: WhisperX runtime — switch to GPU (CUDA, float16)

- Status: superseded by ADR-0017 (2026-08-09) — the classic
  WhisperX+Pyannote pipeline this ADR configured was removed entirely.
  This ADR's context/decision remain accurate history.
- Date: 2026-07-07
- Context: ADR-0009 deliberately stayed on CPU/int8 for MVP, but named
  its own trigger condition explicitly: "once real volume makes the
  doctor-facing latency target in §13 ('draft in under a minute') a
  real constraint rather than a nice-to-have, set `STT_DEVICE=cuda`."
  A real ~7-minute consultation recorded live through the browser took
  4m35s to transcribe+diarize on CPU — workable, but nowhere near
  "under a minute," and a live requirement surfaced independently: the
  clinical workflow needs the prescription ready within 5 minutes of
  the consultation ending, and CPU-only processing time was already
  eating most of that budget on its own before upload/extraction were
  even counted.
- Decision: installed the CUDA build of `torch`/`torchaudio` (2.8.0+cu128,
  matching this machine's RTX 4050's driver) into `python/asr-service`'s
  venv, replacing the CPU-only build. Set `STT_DEVICE=cuda` and added a
  new `COMPUTE_TYPE` env var (`float16`, the standard GPU pairing —
  `int8` was specifically the CPU-friendly choice ADR-0009 made) in
  `python/asr-service/.env`. Made `pyannote_provider.py`'s
  `load_diarization_pipeline()` accept a `device` parameter (was
  hardcoded to `"cpu"`) so diarization runs on GPU too, not just
  transcription. `WHISPER_MODEL_SIZE` stays `small` — this ADR is
  purely the device/precision swap, not a model-size change.
  Verified for real: re-ran the exact same ~7-minute recording
  (`dd1a15b6-...`) directly against the asr-service on both configs for
  a clean comparison — **275s (4m35s) on CPU vs. 45s on GPU, a ~6.1x
  speedup** — with identical output (same segment cutoff point, same
  diarization turn count in the same ballpark, same detected language).
  See `docs/log/2026-07-07-gpu-speed-test.md` for the full comparison.
- Consequences: transcription+diarization now comfortably clears the
  "draft in under a minute" target from architecture.md §13 (45s for a
  7-minute call), which combined with the ~5s extraction step puts the
  full post-recording processing time well inside the 5-minute
  clinical turnaround requirement. This is a local-machine result
  (this laptop's RTX 4050, 6GB VRAM) — it validates the GPU direction
  ADR-0009 already planned, but does **not** by itself decide the
  production hosting question (self-hosted GPU box vs. a hosted
  GPU/serverless provider vs. a hosted STT API) — that's a separate,
  still-open decision. `WHISPER_MODEL_SIZE=small` was kept as-is
  deliberately; 6GB VRAM has headroom for a larger model
  (e.g. `medium`) but that's an accuracy lever, not a speed one, and
  out of scope for this ADR (larger models are slower, not faster —
  see the 2026-07-07 conversation this ADR follows from). Revert
  `STT_DEVICE=cpu` / drop `COMPUTE_TYPE` (or set it to `int8`) to fall
  back to the ADR-0009 config on a machine without a usable GPU —
  `whisperx_provider.py` and `pyannote_provider.py` both still read
  device from env, no code change needed either direction.
- Supersedes: ADR-0009 (`0009-whisperx-runtime-config-cpu-small.md`) —
  that ADR's CPU/int8 decision and its stated GPU trigger condition are
  both still accurate history, just no longer the active config.
