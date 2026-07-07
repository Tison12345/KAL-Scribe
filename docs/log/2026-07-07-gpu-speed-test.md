---
date: 2026-07-07
task: gpu-speed-test
---

# GPU speed test: local RTX 4050 vs. CPU, ~6x faster

## What changed

Following up on the same day's headers-timeout fix
(`2026-07-07-headers-timeout-bug-fix.md`), the user asked to optimize
pipeline speed toward a hard clinical-workflow requirement: the
prescription needs to be ready within 5 minutes of the consultation
ending. Discussed the real levers (hosted STT API, GPU, streaming/
incremental transcription) without coding first, per the user's
request. Confirmed this machine already has a real GPU (NVIDIA RTX
4050 Laptop GPU, 6GB VRAM, CUDA 13.1 driver) that ADR-0009 had already
flagged as available-but-unused. Installed the CUDA build of
`torch`/`torchaudio` (2.8.0+cu128, ~3.47GB download) into
`python/asr-service`'s venv, replacing the CPU-only build, and switched
`STT_DEVICE=cuda`/`COMPUTE_TYPE=float16` (see ADR-0012 for the full
decision writeup).

Ran a controlled, direct comparison — the exact same stitched
~7m10s-audio file (the same real recording from the headers-timeout
fix, `dd1a15b6-...`), POSTed straight to `asr-service`'s
`/v1/process-audio` endpoint (bypassing the worker/BullMQ entirely, so
only asr-service's own compute time is measured):

| Config | Time | Output |
|---|---|---|
| CPU (`small`, int8) | 275s (4m35s) | 87 segments, last segment ends 421.4s |
| GPU (`small`, float16, RTX 4050) | **45s** | 92 segments, last segment ends 421.4s (identical cutoff) |

**~6.1x speedup**, identical transcription quality (same content
cutoff point — confirms the missing final ~8s found earlier the same
day is a genuine audio-decode limitation, not a CPU-vs-GPU artifact),
diarization intact on both.

## Files touched

- `python/asr-service/.venv` — CUDA torch/torchaudio installed
  (environment change, not tracked in git).
- `python/asr-service/.env` — `STT_DEVICE=cuda`, added `COMPUTE_TYPE=float16`.
- `python/asr-service/app/stt/whisperx_provider.py` — `COMPUTE_TYPE` is
  now read from env (was hardcoded `"int8"`); updated module docstring.
- `python/asr-service/app/diarization/pyannote_provider.py` —
  `load_diarization_pipeline()` now takes a `device` parameter instead
  of hardcoding `"cpu"`, so diarization runs on GPU too.
- `docs/adr/0012-whisperx-gpu-cuda-float16.md` — new ADR for this
  decision, marks ADR-0009 as superseded.

## Decisions made

- See ADR-0012 for the full decision and its consequences.

## Follow-ups / left undone

- This validates GPU speed on one local development machine, not a
  production hosting decision — self-hosted GPU box vs. hosted GPU/
  serverless vs. a hosted STT API is still open (discussed but
  deliberately not decided, per the user's "talk to me, don't code it
  yet" request earlier in the same conversation).
- `docs/runbooks/performance-benchmarks.md`'s data table is explicitly
  scoped to the CPU-only config and its extrapolation formula — this
  GPU result was deliberately kept out of that table rather than
  conflating two different hardware baselines in one extrapolation.
- Streaming/incremental transcription (processing audio as it's
  recorded, not after) was discussed as the only lever that decouples
  the 5-minute SLA from total consultation length — not built, still
  open if consultations can run long.
