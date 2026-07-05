---
date: 2026-07-04
task: milestone-2-chunk-playback-correction
---

# Correction: chunk playback dev tool removed, underlying capture fixed but unconfirmed

## What changed

Corrects the 2026-07-04 milestone-2-recording entry, which stated the
recording feature was "verified working" without qualifying that
chunk *audio playback* specifically was never actually confirmed.

While adding a dev-only "listen to captured chunks" affordance
(requested to visually/audibly inspect what `useAudioRecorder` was
producing), found and fixed two real bugs in the capture logic itself:

1. `useAudioRecorder` used `MediaRecorder.start(chunkIntervalMs)`
   (timeslice mode). In timeslice mode, one continuous MediaRecorder
   emits periodic blobs that are fragments of a single encoded
   stream — only the first fragment carries the container header, so
   later fragments are not independently decodable/playable files.
   This directly contradicts architecture.md §7 step 1's requirement
   that a chunk survive on its own if a later one fails. Fixed by
   stopping and restarting a fresh `MediaRecorder` on the same mic
   stream every interval instead, so each chunk is a genuinely
   complete, independent file.
2. No explicit `mimeType` was passed to `MediaRecorder`. Fixed by
   picking the best supported `audio/*` type explicitly
   (`pickSupportedAudioMimeType`), since an unspecified type can
   default to something ambiguous/video-flavored that playback paths
   reject.

Even after both fixes, chunk playback in the ad-hoc dev `<audio>`
list still didn't work in manual browser testing. Rather than keep
debugging a feature that was never part of Milestone 2's actual scope,
removed the dev-only playback list entirely and kept the plain
chunk-count/size text. The two underlying fixes above are kept — they
were real correctness improvements regardless of whether the
particular playback UI worked.

## Files touched

- `apps/web/src/features/clinical-ai/hooks/useAudioRecorder.ts` — the
  two fixes above (segment-based recording instead of timeslice;
  explicit audio mimeType).
- `apps/web/src/app/page.tsx` — removed `ChunkPlaybackList` and its
  object-URL-cache machinery; back to a plain "N chunks captured" line.

## Decisions made

- Chose not to keep chasing in-browser chunk playback as a debugging
  goal. It's not part of Milestone 2's deliverables (`useAudioRecorder`,
  `RecordButton`, consent UX per architecture.md §18) — it was a
  self-initiated convenience for manual inspection. Real end-to-end
  validation of chunk integrity belongs to Milestone 3, once there's an
  actual upload path and ASR service to process a chunk through.

## Follow-ups / left undone

- **Chunk audio integrity is unconfirmed.** Do not assume captured
  chunks are known-good playable audio files. First thing to check in
  Milestone 3: does a captured chunk survive a round trip through
  actual upload + external tooling (e.g. downloading one and opening
  it in a standalone media player, or feeding it to the ASR service)?
  If chunks are still bad at that point, it needs real investigation
  then, since it will block transcription.
