# ADR-0015: Replace BullMQ/Redis with pg-boss (Postgres-native queue)

- Status: accepted
- Date: 2026-07-18
- Context: The queue layer (architecture.md §13, established in
  Milestone 4) ran on BullMQ backed by a hosted Upstash Redis instance,
  chosen originally to mirror Repo B's existing pattern exactly. In
  practice this repo's traffic is nowhere near Repo B's — one shared
  free-tier Redis quota (500,000 requests) was exhausted mid-testing on
  2026-07-09 purely from BullMQ's own chatty per-job heartbeat/retry
  traffic plus a stretch of duplicate worker/api processes each holding
  their own connection (`docs/log/2026-07-09-redis-quota-exhausted.md`).
  A second occurrence during this same phase of testing (same root
  cause: BullMQ polls/heartbeats continuously even when idle) made clear
  this was a structural fit problem for a low-traffic standalone repo,
  not a one-off. Two options were considered: pay for a larger Redis
  tier, or drop Redis as a dependency entirely by moving the queue onto
  the Postgres database this repo already requires (real Supabase
  Postgres as of ADR-0014). Chose the latter — one fewer hosted service,
  one fewer quota to exhaust, and pg-boss (a mature, actively maintained
  Postgres-native job queue) covers everything this repo's queue usage
  actually needs: named queues, retries with backoff, and dead-letter
  routing.
- Decision:
  1. **pg-boss replaces BullMQ + `@nestjs/bullmq` + `ioredis` entirely**
     — no dual-support period, no fallback. `apps/api`'s `QueueModule`
     (`apps/api/src/infrastructure/queues/queue.module.ts`) now
     provides a single `PgBoss` instance (token `PG_BOSS`) constructed
     with `connectionString: DATABASE_URL` — the same Postgres database
     everything else in this repo already talks to, no new
     infrastructure. `apps/api` is producer-only (`supervise: false,
     schedule: false` — it never calls `.work()`, so it doesn't need
     pg-boss's maintenance loops); `workers/clinical-ai-worker` runs its
     own separate `PgBoss` instance with default supervision, since it's
     the only process that actually consumes jobs.
  2. **Four queues, not three.** The old shape was
     `transcription`/`extraction`/one shared `dead-letter` queue.
     pg-boss's native `deadLetter` option routes a job to a *named*
     queue after exhausting retries, and a shared DLQ across two very
     different job payload shapes (`TranscriptionJobPayload` vs.
     `ExtractionJobPayload`) would need a runtime type discriminant to
     process correctly. Simpler to give each source queue its own dead
     letter queue: `clinical-ai.transcription` →
     `clinical-ai.transcriptionDeadLetter`, `clinical-ai.extraction` →
     `clinical-ai.extractionDeadLetter`. `createQueue()` is `ON CONFLICT
     DO NOTHING` internally (confirmed by reading pg-boss's own
     generated SQL), so calling it unconditionally on every process
     boot is safe and requires no separate "did I already create this"
     tracking.
  3. **Status reporting moves from Redis pub/sub to HTTP push.**
     BullMQ's `QueueEvents` gave apps/api a cross-process, Redis-backed
     event stream to learn "job X started/completed/failed" without the
     worker calling back explicitly. pg-boss has no equivalent
     cross-process event bus — jobs live in Postgres tables the worker
     process touches directly, and there is no BullMQ-style side
     channel for a *different* process (apps/api) to subscribe to. The
     fix: the worker now explicitly calls a new endpoint, `PATCH
     /clinical-ai/admin/jobs/:id/status` (`UpdateJobStatusUseCase`),
     at each transition (`active` on pickup, `completed` on success,
     `failed` with the error message on a thrown error) — the same
     "worker talks to apps/api over HTTP, never touches Postgres domain
     tables directly" boundary this repo already committed to in
     ADR-0010, just extended to status reporting instead of only
     job-completion payloads. `ClinicalAiQueueEventsService` (the old
     `QueueEvents` listener) is deleted, not adapted.
  4. **Job-id decoupling.** BullMQ's job id had historically been forced
     to equal `consultation_ai_jobs.id` (the tracking row), which is
     natural when the queue and the row share the same producer-chosen
     key. pg-boss assigns its own job id on `send()`, and forcing it to
     match our row id risks a collision on reprocessing — a
     dead-lettered job's original pg-boss row can still exist under the
     same `(queue name, id)` primary key when a fresh attempt is sent.
     Resolved by decoupling the two entirely: pg-boss's own id is stored
     as an informational `queue_job_id` column (renamed from
     `bullmq_job_id`), and the *payload* itself now carries the actual
     tracking id (`TranscriptionJobPayload.jobId` /
     `ExtractionJobPayload.jobId` — both new fields), so status
     reporting always targets the correct row regardless of how many
     times pg-boss's internal id churns across retries or manual
     reprocessing.
  5. **Worker now holds `DATABASE_URL`, a narrow exception to
     ADR-0010's "worker never touches Postgres directly" rule.**
     pg-boss's own job tables are queue-engine internals (its `pgboss`
     schema), not this repo's domain tables — the worker connecting to
     Postgres to run `boss.work()` is not the worker reading/writing
     `consultation_*` tables, which still happens exclusively through
     HTTP calls into apps/api. `REDIS_URL` is removed from both
     `packages/config`'s `apiEnvSchema`/`workerEnvSchema` entirely.
- Consequences:
  - No hosted Redis service in this repo's infrastructure footprint at
    all anymore — one fewer quota, one fewer credential, one fewer
    thing to provision when standing up a new environment.
  - `consultation_ai_jobs.status` was previously kept in sync by BullMQ
    event listeners (`completed`, `failed`, `stalled`) inside apps/api,
    reacting passively to Redis events. It's now kept in sync by the
    worker actively reporting its own state over HTTP — a small
    inversion of control, but one that removes an entire class of
    "Redis pub/sub message lost or apps/api wasn't listening" failure
    mode, at the cost of one extra HTTP round-trip per status
    transition (negligible next to transcription/extraction latency).
  - `ReprocessJobUseCase` only supports `jobType: 'transcription'` for
    now — extraction reprocessing would need `consultation_ai_jobs` to
    retain `transcriptId`/`requestedProvider` to reconstruct the
    original payload, which isn't stored today. Documented as a
    follow-up, not a milestone gate (dead-lettered extraction jobs are
    rare and can be manually re-triggered via a fresh `enqueue-extraction`
    call in the meantime).
  - Migration history was regenerated as a clean baseline
    (`0000_red_tarot.sql`) rather than an incremental `ALTER` for the
    `bullmq_job_id` → `queue_job_id` rename — consistent with this
    repo's established pre-launch convention (no production data exists
    yet) already used once for ADR-0014.
  - Verified end-to-end against a real Supabase Postgres instance and a
    real recording upload: `complete` → `boss.send()` → worker `work()`
    pickup → `PATCH .../status` reporting `active` then `failed` (the
    test's audio only had one chunk, tripping an unrelated pre-existing
    multi-chunk fetch path — not a pg-boss defect) → confirmed the
    worker retrying on pg-boss's own schedule (`retryDelay: 60`) without
    any code re-enqueueing it manually, proving pg-boss's native
    retry/backoff and `deadLetter` routing works without a Redis-backed
    scheduler. Full retry-exhaustion → dead-letter-queue-consumer
    confirmation in `docs/log/2026-07-18-pg-boss-not-bullmq.md`.
