---
date: 2026-07-05
task: milestone-4-queue
---

# Milestone 4: Queue

## What changed

Built the BullMQ queue infrastructure per `docs/architecture.md` §18
Milestone 4: `consultation_ai_jobs` table, queue registration in
`apps/api` (producer side), a new `workers/clinical-ai-worker`
workspace member (consumer side, separately deployed per §5), status
sync from BullMQ's own job lifecycle back into Postgres, dead-letter
handling, and a minimal admin endpoint to list/reprocess dead-lettered
jobs. `complete-upload.use-case.ts` now enqueues a transcription job
the moment a recording finalizes (§7 step 4) — the hand-off from
"client concern" to "durable background pipeline."

Unlike Postgres/Storage in Milestones 1–3, there's no local stand-in
for Redis — BullMQ needs a real Redis-compatible server. User set up a
free Upstash Redis instance for this. Verified end-to-end against it,
not just build/lint/test: normal job completion, a deliberately forced
failure through two exhausted retries into dead-letter, and a manual
admin reprocess that successfully re-ran and cleared the job.

## Files touched

- `packages/config/src/{api-env,worker-env}.ts` — `REDIS_URL` added to
  `parseApiEnv`; new `parseWorkerEnv` for the worker.
- `packages/types/src/{clinical-ai-job,clinical-ai-queues}.ts` — job
  types/status, and the shared queue-name/default-job-option constants
  both apps/api and the worker import from, so they can't drift apart.
- `apps/api/src/infrastructure/queues/{redis-connection,queue.module}.ts`
  — new.
- `apps/api/src/infrastructure/database/schema/
  consultation-ai-jobs.schema.ts` + generated migration — new.
- `apps/api/src/modules/clinical-ai/infrastructure/
  {consultation-ai-job.repository.ts,
  clinical-ai-queue-events.service.ts}` — new.
- `apps/api/src/modules/clinical-ai/application/
  {list-dead-letter-jobs,reprocess-job}.use-case.ts`,
  `presentation/admin-clinical-ai.controller.ts` — new.
- `apps/api/src/modules/clinical-ai/application/complete-upload.use-case.ts`
  — now creates a `consultation_ai_jobs` row and enqueues the
  transcription job after finalizing.
- `apps/api/src/main.ts` — `import 'dotenv/config'` added (see
  Decisions — this was a real gap, not new to this milestone).
  `apps/api/package.json` — added `dotenv` too.
- `workers/clinical-ai-worker/**` — new workspace member: `package.json`,
  `tsconfig.json`, `src/main.ts` (stub transcription processor),
  `.env.example`.
- `pnpm-workspace.yaml` — added `workers/*`.
- `apps/api/.env.example`, `workers/clinical-ai-worker/.env.example` —
  `REDIS_URL`, with a note about hosted providers needing `rediss://`.

## Decisions made

- **Worker is a plain BullMQ script, not a NestJS app, for now.**
  Architecture.md §5 says the worker should "import the module's
  use-cases (the module is a shared NestJS module usable by both the
  API app and the worker app)" — but there's no real use-case to share
  yet (Milestone 5 is what adds one: actually calling
  `python/asr-service`). Building a shared-package extraction or
  cross-app NestJS DI setup now, for a stub that does nothing real,
  would be premature. Deliberately deferred; flagged in
  `docs/PROJECT_STATUS.md`'s "Next up" so Milestone 5 has to actually
  decide it, not silently inherit today's shortcut.
- **BullMQ job id doubles as the `consultation_ai_jobs` row id.**
  `bullmq_job_id` (architecture.md §12) is populated with the same
  UUID as the row's own `id`, by construction — makes the
  QueueEvents-based status sync a single `findById`, no separate
  lookup index needed. Still fulfills the column's stated purpose
  ("cross-reference to the BullMQ job for debugging"); it's just
  always equal to `id`, which is arguably more useful for debugging,
  not less.
- **Manual reprocess uses BullMQ's own `job.retry('failed')`**, not a
  remove-and-recreate — the officially supported mechanism for
  re-running a job that's already in a terminal failed state, reusing
  the same job id rather than minting a new one.
- No new ADR filed for the Redis/BullMQ setup itself — §13 already
  specifies this design in enough detail that there was no vendor
  choice or pattern deviation to record, just implementation.

## Follow-ups / left undone

- **Found via testing, not yet fixed**: if `apps/api` restarts while a
  job is actively processing, `ClinicalAiQueueEventsService`'s
  `QueueEvents` listener can miss that job's completion/failure event
  (a fresh connection only sees events from reconnect time onward),
  leaving `consultation_ai_jobs.status` stuck. No reconciliation sweep
  exists to catch this yet. Documented in `docs/PROJECT_STATUS.md`'s
  Known issues rather than fixed in this pass — worth addressing
  before this is relied on in anything resembling production.
- **Found and fixed during testing**: `apps/api` never actually loaded
  a `.env` file — every var added in Milestones 1–3 happened to have a
  working default, so this went unnoticed until `REDIS_URL` (required,
  no fallback) made it impossible to miss. Fixed with `import
  'dotenv/config'` as main.ts's first import (must precede
  `AppModule`'s import, since `EnvModule` calls `parseApiEnv()` at
  class-definition time, not inside `bootstrap()`).
- **Found and fixed during testing**: the worker's `Worker` and
  apps/api's `QueueEvents` both omitted the `prefix` option, silently
  defaulting to BullMQ's own `"bull"` prefix while the producer used
  `BULLMQ_PREFIX` ("kal-scribe") — two different Redis keyspaces, so
  the worker never saw any jobs until this was made consistent.
- **Found during testing**: Upstash (and hosted Redis generally) needs
  `rediss://` (TLS), not `redis://` — using the wrong scheme doesn't
  fail with a clear error, it hangs and then produces repeated
  `ECONNRESET`. Both `.env.example` files now warn about this
  explicitly so the next setup doesn't lose time to it.
- No automated tests added for the new queue/job code — verified
  manually (curl + real Redis + temporarily-shortened retry/backoff
  settings to make the dead-letter path observable in seconds instead
  of the real ~15-minute exponential backoff schedule). The temporary
  test values (`attempts: 2`, `backoff: 500ms`) were reverted to the
  real production values (`attempts: 5`, `backoff: 60_000ms`) before
  finishing.
- Extraction queue is registered (per §13's queue list) but nothing
  enqueues onto it yet, and there's no processor for it — inert until
  Milestone 7 (Clinical Extraction) exists.
