---
date: 2026-07-06
task: primary-diarization-model-activated
---

# Primary Pyannote model (speaker-diarization-3.1) now active

## What changed

The user accepted Hugging Face's gated-model terms for both
`pyannote/speaker-diarization-3.1` and its dependency
`pyannote/segmentation-3.0` (the second one was the actual blocker —
`-3.1` itself was already accessible, but it internally depends on
`segmentation-3.0`, which needs its own separate acceptance).
Restarted `asr-service` and confirmed via the startup log: `-3.1` now
loads with no 403, replacing the `community-1` fallback that
Milestone 6's ~60% turn-level accuracy number was measured against.

Verified the pipeline still runs cleanly on a single-speaker test clip
post-upgrade (no crash, correct single-speaker output).

Also ran a real before/after accuracy comparison: re-stitched the
original ~60-second real two-speaker recording from Milestone 6
(recording `5ed0f4ab-...`, an interview-style Q&A, 4 chunks still on
disk) and sent the exact same audio directly to the upgraded
`asr-service`, comparing raw speaker labels against the transcript
already persisted from the old `community-1` run. Of 15 transcript
segments, 13 matched exactly; 2 changed — both changes reassigned a
line to the interviewer/host that had previously been misattributed to
the guest ("What is the meaning of life?" and "Oh, that would be a
good start."), and both reassignments are the contextually correct
read (they're the host stating/reacting to their own question, not
something a guest would say mid-answer). Real, if small-sample,
evidence the upgrade is a genuine improvement, not just a different
set of mistakes.

## Files touched

- None — this was a Hugging Face account permission change, not a
  code change. `python/asr-service/app/diarization/pyannote_provider.py`'s
  existing fallback-list logic already tries `-3.1` first; it simply
  succeeds now instead of falling through.

## Decisions made

- None — no code/design decision, just an external permission that
  was already anticipated by the existing fallback-list code.

## Follow-ups / left undone

- Only one before/after data point (13/15 segments unchanged, 2
  corrected) — worth another real two-speaker test on fresh audio to
  confirm the improvement holds generally, not just on this one clip.
