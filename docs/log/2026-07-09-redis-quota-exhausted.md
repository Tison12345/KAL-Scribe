---
date: 2026-07-09
task: redis-quota-exhausted
---

# Stale packages/types dist rebuilt; Upstash Redis quota exhausted

## What changed

Asked to "run the project" after a concurrent session had bumped the
clinical extraction schema to 2.1 (`packages/types`/`validation`/
`llm-client` source changes, `docs/PROJECT_STATUS.md`'s own note
already flagged `dist/` as stale). Rebuilt those three packages and
restarted `apps/api` and the worker to pick up the change — `nest
--watch`/`tsx watch` only rewatch their own app's source, never a
workspace dependency's compiled `dist/`, so this doesn't happen
automatically (same class of gap as the 2026-07-06 CI ordering bug).

While restarting, found a real, unrelated blocker: Upstash Redis
returned `ERR max requests limit exceeded. Limit: 500000, Usage:
500006` on every command, including auth. Web/API/asr-service still
answered plain HTTP fine, but BullMQ (which Redis backs) couldn't be
written to, so any new recording would silently never get transcribed.
User is creating a fresh Upstash instance instead of waiting for reset
or upgrading the current one.

## Files touched

- `docs/PROJECT_STATUS.md` — known issues updated: stale-dist entry
  marked resolved, new Redis-quota entry added.

## Decisions made

- None yet — user is creating a new Upstash Redis instance. `REDIS_URL`
  will need updating in `apps/api/.env` and
  `workers/clinical-ai-worker/.env` once it exists, followed by an
  api+worker restart.

## Follow-ups / left undone

- Update `REDIS_URL` in both `.env` files once the new Upstash
  instance exists, then restart `apps/api` and the worker.
- No local-Redis dev stand-in exists (unlike Postgres/storage,
  ADR-0007/0008) — dev/test traffic hits the same shared cloud quota
  as everything else. Worth a local Redis (e.g. via a lightweight
  Docker container or an embedded alternative) if this keeps recurring.
