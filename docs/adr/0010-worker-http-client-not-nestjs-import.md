# ADR-0010: `workers/clinical-ai-worker` calls apps/api over HTTP, not by importing NestJS use-cases

- Status: accepted
- Date: 2026-07-05
- Context: architecture.md §5 originally specified that
  `workers/clinical-ai-worker` would *import* `apps/api`'s
  `clinical-ai.module.ts` use-cases directly — a shared NestJS module,
  usable by both the API app and the worker app, each bootstrapped as
  its own deployable process. What was actually built in Milestones
  5-6 instead has the worker as a plain Node/tsx process with its own
  small HTTP client files (`asr-client.ts`, `recording-client.ts`,
  `transcript-client.ts`) that call `apps/api`'s REST endpoints —
  no NestJS import, no shared DI container between the two processes.
  This divergence happened without being flagged as a decision at the
  time it was introduced (Milestone 5), which CLAUDE.md's "flag before
  introducing anything that deviates" rule should have caught then;
  it's being formalized now, at Milestone 7, because the extraction
  job is the next thing that would otherwise silently extend the same
  unflagged pattern.
- Decision: Keep the HTTP-client pattern, including for Milestone 7's
  extraction job — do not rework the worker to import NestJS use-cases
  directly. Reasons:
  1. **Already proven working, twice.** The HTTP pattern has shipped
     and been verified end-to-end across both the transcription
     (Milestone 5) and diarization (Milestone 6) pipelines, against
     real audio, real Redis, and a real (if local-stand-in) database.
     Reworking it now would be revisiting settled, working
     infrastructure for a purity concern, not a functional one.
  2. **Real process isolation.** A plain Node process calling HTTP
     endpoints cannot crash, block, or leak state into `apps/api`'s
     event loop — the exact goal §13 and §5 both state as the reason
     the worker is a separate deployable in the first place ("a stuck
     transcription job must never compete with API request latency").
     Importing NestJS use-cases directly would either require the
     worker to bootstrap its own full Nest application context (real
     startup cost and duplicated DI wiring per worker process) or
     import raw classes and hand-wire their dependencies outside Nest's
     container (fighting the framework), neither of which is free.
  3. **This was already an open decision, not a locked one.**
     Architecture.md §16 already flags exactly this: "`workers/
     clinical-ai-worker` becomes a new worker entrypoint alongside
     however Repo B ends up running its own workers (to be confirmed
     against Repo B's current worker-deployment approach at
     integration time — flagged as an integration-phase task, not
     assumed here)." Keeping the HTTP pattern fills in an
     intentionally-left-open blank; it does not override something §5
     had actually locked down.
- Consequences:
  - `workers/clinical-ai-worker` keeps its own small set of HTTP client
    files talking to `apps/api` (consolidated into one shared internal
    API client as of this same task — see the 2026-07-05 log entry —
    rather than one near-duplicate file per endpoint group).
  - **At Repo B integration, these client files are deleted, not
    migrated** — exactly the same treatment as
    `cms-integration.adapter.ts` (§16, §17 Phase 4). Whatever the
    worker's real invocation pattern ends up being against Repo B
    (direct in-process use-case calls if the worker moves in-process,
    or pointed-at-Repo-B HTTP calls if it stays a separate deployable)
    is a Phase 3 integration decision, made when Repo B's actual
    worker-deployment approach is known — not assumed here.
  - Any future contributor extending the worker (a new job type, a new
    external call) should keep using this same HTTP-client pattern for
    consistency, not silently reintroduce a NestJS import — and should
    treat that as covered by this ADR, not a fresh decision each time.
