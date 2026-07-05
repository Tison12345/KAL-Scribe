---
date: 2026-07-05
task: milestone-8-pipeline-progress-tracker
---

# Pipeline progress tracker + timing summary

## What changed

Added a real (not simulated) progress tracker to the frontend,
directly motivated by the earlier 35-minute stall — the doctor had no
way to tell "is this stuck or just slow." Built entirely on data the
system already tracked but never exposed: `consultation_ai_jobs`
already records `started_at`/`completed_at` and `status`
(`queued`/`active`/`completed`/`dead_letter`) per job type
(transcription, extraction); `consultation_recordings` already has
`created_at`/`updated_at`. Two new read-only endpoints expose this,
and the frontend polls them to derive a stage (`uploading → queued →
transcribing → extracting → ready`, or `failed`) and, once ready, a
per-stage timing summary line.

Deliberately did not build fine-grained in-progress percentage (e.g.
"43% transcribed") — WhisperX's core transcription step has no
practical progress-callback hook to report incremental completion
without deeper internals work or chunked/streaming transcription
(architecture.md §19 files real-time transcription as a future
enhancement, not MVP). A fake time-based progress bar was considered
and rejected — it would be guessing, not reporting truth, which sits
poorly with this being a clinical tool.

Verified against two real recordings: the historical stalled one
(confirmed the endpoints return correct structure, though its own
transcription timing is still polluted by the earlier pile-up bug —
BullMQ's `started_at` reflects the last retry attempt, not a clean
single-attempt duration) and a fresh clean run (upload ~16s,
transcription ~14s, extraction ~2s, total ~31s for an 8-second clip —
sane, real numbers).

## Files touched

- `apps/api/src/modules/clinical-ai/infrastructure/consultation-ai-job.repository.ts`
  — added `findByRecordingId`.
- `apps/api/src/modules/clinical-ai/application/{get-recording,
  list-recording-jobs}.use-case.ts` — new.
- `apps/api/src/modules/clinical-ai/presentation/clinical-ai.controller.ts`
  — `GET :id` (recording), `GET :id/jobs` (job list) added.
- `apps/web/src/features/clinical-ai/services/recording.service.ts` —
  `getRecording`, `getRecordingJobs`.
- `apps/web/src/features/clinical-ai/hooks/usePipelineProgress.ts` —
  new; polls both endpoints, derives stage + timing.
- `apps/web/src/features/clinical-ai/components/PipelineProgressTracker.tsx`
  — new; step indicator while processing, timing summary line once
  ready, error state on dead-letter.
- `apps/web/src/app/page.tsx` — tracker wired into both the live
  recording flow and the reopened-by-`?recordingId=` flow.

## Decisions made

- **No fine-grained % progress** — see "What changed" above. Staged
  progress (which job is active) plus honest after-the-fact timing is
  the right scope for what the underlying pipeline can actually
  report today.
- **`GET :id/jobs` is a new doctor-facing endpoint, distinct from the
  admin dead-letter list** — same underlying table, different
  audience/purpose (progress visibility vs. ops reprocessing).

## Follow-ups / left undone

- Historical jobs whose `started_at` was overwritten by a later retry
  attempt (like the stalled recording from earlier today) will show a
  misleadingly long "transcription time" if ever viewed again — this
  is a read of already-recorded history, not something worth
  backfilling/correcting.
- No UI surfaces the admin reprocess action from the doctor-facing
  progress tracker's `failed` state — a doctor seeing a dead-lettered
  job today would need someone with admin access to reprocess it.
