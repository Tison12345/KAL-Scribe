# ADR-0001: Speech-to-text provider — WhisperX for MVP

- Status: accepted
- Date: 2026-07-04
- Context: The diarization merge (architecture.md §9) is the most
  failure-prone step in the pipeline, and it lives or dies on
  word-level timestamp precision. Raw Whisper timestamps are
  chunk-level and drift; Google STT is weaker on Indian-accented and
  code-switched (English/Malayalam/Hindi) consultation audio without
  heavy custom configuration. Full comparison table in architecture.md
  §8.
- Decision: Use WhisperX for the MVP speech-to-text stage. WhisperX
  adds forced phoneme alignment on top of Whisper's acoustic model,
  giving accurate word-level timestamps — exactly what the
  Pyannote diarization merge (§9) needs. Self-hosted, GPU-backed,
  called from `python/asr-service` behind one internal HTTP contract
  (`POST /v1/process-audio`), never invoked directly from Node.
  Provider selection lives behind `STT_PROVIDER` env var and a common
  `transcribe(audio) -> TranscriptSegment[]` interface per vendor file
  in `python/asr-service/app/stt/` (§8), so swapping vendors later is a
  one-file change, not a rewrite.
- Consequences: Requires GPU-backed hosting for `python/asr-service`
  (deployment/ops cost we wouldn't have with a managed API like Google
  STT). Buys full control over data residency for PHI-bearing audio
  (relevant to §15) and the best available accuracy on code-switched
  clinical speech. Revisit if eval harness (§18, Milestone 7) numbers
  say otherwise once real audio fixtures exist.
