---
date: 2026-07-18
task: pg-boss-not-bullmq
---

# Replace BullMQ/Redis with pg-boss

## What changed

The queue layer that had run on BullMQ + a hosted Upstash Redis
instance since Milestone 4 is now pg-boss, a Postgres-native job queue
that runs on the same Supabase database this repo already requires
(ADR-0014) — no separate hosted service, no separate quota. This was
prompted by Redis's free-tier request quota getting exhausted twice
during testing purely from BullMQ's own chatty heartbeat/retry traffic,
which made clear this was a structural mismatch for a low-traffic
standalone repo rather than a one-off. Full reasoning in
`docs/adr/0015-pg-boss-not-bullmq.md`.

## Files touched

- `apps/api/package.json`, `workers/clinical-ai-worker/package.json` — removed `@nestjs/bullmq`/`bullmq`/`ioredis`, added `pg-boss`
- `apps/api/src/infrastructure/queues/queue.module.ts` — rewritten: single producer-only `PgBoss` instance (token `PG_BOSS`), idempotent `createQueue()` for all 4 queues on boot
- `apps/api/src/infrastructure/queues/redis-connection.ts` — deleted
- `apps/api/src/modules/clinical-ai/infrastructure/clinical-ai-queue-events.service.ts` — deleted (no pg-boss equivalent to BullMQ's cross-process `QueueEvents`)
- `apps/api/src/modules/clinical-ai/application/update-job-status.use-case.ts` — new: backs the worker's status-reporting HTTP call
- `apps/api/src/modules/clinical-ai/presentation/admin-clinical-ai.controller.ts` — new `PATCH :id/status` route
- `apps/api/src/modules/clinical-ai/application/{complete-upload,enqueue-extraction-job,reprocess-job}.use-case.ts` — inject `PG_BOSS`, call `boss.send()` instead of `@InjectQueue`
- `workers/clinical-ai-worker/src/main.ts` — rewritten: own `PgBoss` instance, `boss.work()` handlers per queue, DLQ consumers, status HTTP calls wrapping each job
- `workers/clinical-ai-worker/src/internal-api-client.ts` — new `updateJobStatus()` helper
- `apps/api/src/infrastructure/database/schema/consultation-ai-jobs.schema.ts` — `bullmq_job_id` → `queue_job_id`
- `packages/types/src/clinical-ai-job.ts` — `bullmqJobId` → `queueJobId`; both job payload types gained a `jobId` field (the tracking row id, decoupled from pg-boss's own job id); new `UpdateJobStatusRequest`
- `packages/types/src/clinical-ai-queues.ts` — 4 queue names (was 3, shared DLQ); `DEFAULT_QUEUE_JOB_OPTIONS` in pg-boss shape (`retryLimit`/`retryBackoff`/`retryDelay`); removed `BULLMQ_PREFIX`
- `packages/validation/src/clinical-ai-job.schema.ts` — new `updateJobStatusSchema`
- `packages/config/src/{api-env,worker-env}.ts` — removed `REDIS_URL`; worker gained `DATABASE_URL` (pg-boss connects directly — a narrow, documented exception to ADR-0010)
- `apps/api/.env(.example)`, `workers/clinical-ai-worker/.env(.example)` — `REDIS_URL` removed
- `apps/api/src/infrastructure/database/migrations/0000_red_tarot.sql` — regenerated clean baseline (no incremental ALTER — no production data exists yet)
- `docs/architecture.md` §13 — rewritten for pg-boss

## Decisions made

- Job-id decoupling: pg-boss's own job id is stored as informational
  (`queue_job_id`); the tracking row id travels in the payload
  (`jobId`) instead, avoiding a collision risk on reprocessing that
  forcing the ids to match would have created. Full reasoning in
  ADR-0015 point 4.
- Four queues instead of three (separate DLQ per source queue) —
  ADR-0015 point 2.
- Status sync moved from passive Redis pub/sub to the worker actively
  `PATCH`-ing apps/api at each transition — ADR-0015 point 3.

## Follow-ups / left undone

- `ReprocessJobUseCase` only supports `jobType: 'transcription'` —
  extraction reprocessing needs `transcriptId`/`requestedProvider`
  retained on the job row, not stored today.
- pg-boss has no direct equivalent to BullMQ's job `priority` option in
  use here yet — not a real problem at current traffic, flagged in
  architecture.md §13 as a backlog item if it becomes one.
- End-to-end verification used a real recording but a synthetic
  single-chunk upload (this repo's actual recording flow uploads
  multiple sequential chunks) — the transcription job failed on an
  unrelated pre-existing multi-chunk fetch path, which incidentally
  gave a clean opportunity to verify pg-boss's retry/backoff and
  dead-letter routing work correctly on a real failure rather than a
  manufactured one. A full multi-chunk, successful pipeline run through
  the new queue (recording → transcript → extraction → review draft)
  is still worth doing, though the queue plumbing itself — the part
  this migration actually changed — is now verified.
