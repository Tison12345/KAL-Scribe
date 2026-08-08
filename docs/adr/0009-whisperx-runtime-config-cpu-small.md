# ADR-0009: WhisperX runtime config — small model, CPU, int8 (GPU is a planned upgrade)

- Status: superseded by ADR-0012 (2026-07-07), then by ADR-0017
  (2026-08-09) — the classic WhisperX+Pyannote pipeline this ADR
  configured was removed entirely. This ADR's context/decision remain
  accurate history.
- Date: 2026-07-05
- Context: ADR-0001 already chose WhisperX as the STT provider.
  Milestone 5 needed to pick an actual runtime configuration — model
  size, device, precision — to make it real. A local reference project
  (`C:\transcribe`, a separate, unrelated app on this same machine)
  already runs WhisperX successfully with `WHISPER_MODEL_SIZE=small`,
  `device="cpu"`, `compute_type="int8"`, proven by a cached, working
  model and real transcription output. This machine also has a real
  GPU (RTX 4050, 6GB VRAM) available, but 6GB is tight for WhisperX's
  larger models (e.g. `large-v3`), and GPU (CUDA/torch) setup carries
  real compatibility risk on Windows that CPU inference avoids
  entirely.
- Decision: `python/asr-service` defaults to `WHISPER_MODEL_SIZE=small`,
  `STT_DEVICE=cpu`, `compute_type="int8"` — mirroring the
  proven-working reference config exactly rather than attempting GPU
  inference now. Both `WHISPER_MODEL_SIZE` and `STT_DEVICE` are env
  vars specifically so this can change without a code change later.
  Verified for real: transcribed two genuine test recordings correctly
  (spoken number sequences), end-to-end through the full pipeline
  (record → upload → queue → worker → asr-service → WhisperX), not
  just a unit-level check.
- Consequences: Transcription runs measurably slower than GPU
  inference would (seconds-to-tens-of-seconds per short clip on this
  machine, plus a one-time cost the first time a new language's
  alignment model needs downloading — observed a ~1.2GB download for
  Hindi during testing). Acceptable for MVP/pilot volume per the
  earlier discussion with the user: clinics never run this themselves
  regardless of device choice (§3.2 — `asr-service` is a centrally
  hosted, separately-deployed unit), so this is purely an operating-cost/
  latency tradeoff for whoever hosts it, not a per-clinic requirement.
  **Planned upgrade, not speculative**: once real volume makes the
  doctor-facing latency target in §13 ("draft in under a minute") a
  real constraint rather than a nice-to-have, set `STT_DEVICE=cuda` on
  GPU-provisioned infrastructure — `whisperx_provider.py` already reads
  this from env, so the code doesn't need to change, only the
  deployment target and possibly the model size (`large-v3` becomes
  more viable with real GPU memory).
