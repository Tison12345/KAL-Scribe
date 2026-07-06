---
date: 2026-07-06
task: performance-benchmarks-runbook
---

# Start a performance benchmarks runbook

## What changed

Created `docs/runbooks/performance-benchmarks.md` (the `docs/runbooks/`
folder architecture.md §4 already planned but nothing had used yet) to
track real pipeline timing data points as they come in — starting with
the two real numbers gathered from yesterday's Milestone 8 testing (an
8-second test clip, and a real ~2-minute consultation recording). The
goal: answer "how long will a 10-minute consultation take?" from
actual measurements instead of guessing, using the timing summary
`PipelineProgressTracker` already surfaces in the UI.

Included a rough extrapolation (~2× audio duration for transcription +
diarization on the current CPU-only setup) with explicit caveats that
2 data points isn't a validated curve — the doc is meant to be
appended to over time, not treated as finished.

## Files touched

- `docs/runbooks/performance-benchmarks.md` — new.

## Decisions made

- No new ADR — this is data collection, not a design decision.

## Follow-ups / left undone

- Only 2 data points so far. Add a row every time a real recording
  completes.
