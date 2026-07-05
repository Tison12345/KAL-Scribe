---
date: 2026-07-05
task: milestone-8-reopen-by-recording-id
---

# Small addition: reopen a recording by `?recordingId=` after a refresh

## What changed

The user refreshed the browser after a real 2-minute recording and
landed back on a blank "Record Consultation" screen — expected, but a
real usability gap: `page.tsx` had no way to view an already-processed
recording's transcript/draft except within the exact browser session
that made it (`useId()`-scoped, no persistence across a reload).

Added a `?recordingId=` query param path: once a recording finishes
uploading, a small "bookmark this to reopen" link appears showing the
`/?recordingId=...` URL. Visiting that URL directly renders the same
`TranscriptViewer`/`ReviewDraftPanel` for that recording, skipping the
record/upload flow entirely.

## Files touched

- `apps/web/src/app/page.tsx` — `ReopenLink`, `ReopenedRecording`
  components; `Home` split into a `Suspense`-wrapped `HomeContent` so
  `useSearchParams()` can read `recordingId`.

## Decisions made

- Not building a real consultation-history/list screen — that's
  real-CMS territory (this repo has no such list to browse, and
  Milestone 8 is scoped to the review screen itself, not navigation
  around it). A directly-shareable URL is the minimal fix for the
  actual gap (losing access after a refresh), not a step toward a
  bigger feature.

## Follow-ups / left undone

- No validation that a pasted/mistyped `recordingId` is a real UUID —
  an invalid one just polls forever showing "Transcribing…"/"Extracting…"
  rather than a clear "not found" state. Minor, not fixed now.
