# kal-scribe

Clinical AI module — automates clinical documentation from
doctor-patient consultation audio. See `docs/architecture.md` for the
full blueprint and `docs/PROJECT_STATUS.md` for the current state of
this repo.

## Prerequisites

- Node.js >= 22
- pnpm 10.x (`corepack enable` will pick up the pinned version from
  `package.json`'s `packageManager` field)

## Getting started

```sh
pnpm install
pnpm build       # builds every app/package
pnpm dev         # runs apps/api and apps/web in watch mode
pnpm lint
pnpm typecheck
pnpm test
```

## Layout

- `apps/api` — NestJS backend (orchestration, domain logic, CMS
  integration adapters)
- `apps/web` — Next.js frontend (recording capture + review UI)
- `packages/types`, `packages/validation`, `packages/config` — shared
  TypeScript, zod schemas, and typed env parsing
- `docs/` — living documentation; see `docs/README.md` for how each doc
  type is maintained

`workers/clinical-ai-worker` and `python/asr-service` are scaffolded in
a later milestone (see `docs/architecture.md` §18).
