---
date: 2026-07-05
task: milestone-3-storage
---

# Milestone 3: Storage

## What changed

Built the upload session API and resumable chunk upload per
`docs/architecture.md` §18 Milestone 3: `consultation_recordings`
table (Drizzle + migrations), the `clinical-ai` NestJS module's first
real content (domain/application/infrastructure/presentation layers),
a `StorageAdapter` interface with a local-disk stand-in, and the
frontend's `useUploadSession` hook + `UploadProgress` UI wired into the
existing recording flow. No Supabase project exists yet (user chose to
build against local stand-ins rather than set one up first this pass)
— Postgres and object storage are both local stand-ins behind the real
production interfaces, so wiring in real Supabase later is an env var
change plus one new adapter class, not a redesign.

Verified end-to-end in a real browser, not just build/lint/test:
recorded audio, watched the upload-progress panel move through
"Uploading" to "Recording saved," and independently confirmed on disk
that the uploaded chunk is a genuinely complete, valid WebM file
(correct EBML header bytes), not a corrupt fragment.

## Files touched

- `packages/config/src/api-env.ts` — `parseApiEnv`: PORT, DATABASE_URL,
  PGLITE_DATA_DIR, STORAGE_DRIVER, STORAGE_LOCAL_DIR,
  STORAGE_SIGNED_URL_SECRET (dev-only insecure default, required in
  production).
- `packages/types/src/consultation-recording.ts`,
  `packages/validation/src/consultation-recording.schema.ts` — shared
  types and zod schemas for the three request/response boundaries.
- `apps/api/src/infrastructure/database/{schema,client,
  database.module}.ts`, `drizzle.config.ts`, generated migration —
  `consultation_recordings` table matching architecture.md §12 exactly;
  dual driver (real Postgres via DATABASE_URL, or embedded PGlite).
- `apps/api/src/infrastructure/env/env.module.ts` — parses/validates
  env once at boot, exported as `API_ENV` for DI.
- `apps/api/src/modules/clinical-ai/**` — new module:
  `domain/consultation-recording.entity.ts` (status-transition rules),
  three use-cases, `consultation-recording.repository.ts`,
  `storage.adapter.ts` + `local-disk-storage.adapter.ts`,
  `clinical-ai.controller.ts` + `local-storage.controller.ts`,
  `clinical-ai.module.ts`.
- `apps/api/src/shared/zod-validation.pipe.ts` — validates every
  controller body against a zod schema before it reaches a use-case.
- `apps/api/src/main.ts` — CORS (dev-permissive), raw-body middleware
  for the storage stand-in's upload endpoint, PORT now read from
  validated env.
- `apps/api/nest-cli.json` — asset-copy config for migrations (used
  for a true `nest build`/production run; dev mode resolves migrations
  from `src/` directly instead, see Decisions).
- `apps/web/src/lib/env.ts`,
  `apps/web/src/features/clinical-ai/{services/recording.service.ts,
  hooks/useUploadSession.ts,components/UploadProgress.tsx}` — calls
  the API, uploads chunks to their signed URLs, tracks per-chunk
  status with retry.
- `apps/web/src/app/page.tsx` — wires `useUploadSession` alongside the
  existing recorder; auto-finalizes once every chunk has uploaded.
- `docs/adr/0007-local-disk-storage-standin.md`,
  `0008-local-postgres-standin-pglite.md` — new.

## Decisions made

- **Built against local stand-ins for both Postgres and object
  storage**, per explicit user choice — asked before starting since
  this needed real infrastructure input, not assumed. See ADR-0007/8.
- **PGlite over Docker Compose Postgres** — Docker isn't available in
  this dev environment; PGlite (real Postgres compiled to WASM) needs
  neither Docker nor a native install and swaps for real Postgres via
  one env var. Not an architecture.md deviation for production (still
  targets real Postgres everywhere else), just the local-dev mechanism
  — logged as ADR-0008 rather than silently assumed.
- **`CompleteUploadUseCase` made idempotent**, found and fixed during
  manual API verification (via curl, before the browser test): calling
  complete-upload twice with different `durationSeconds` was
  overwriting an already-finalized recording's data. Architecture.md
  §14 says a finalized recording is immutable, so a repeat call (e.g.
  a retried request after a lost response) now returns the existing
  state unchanged instead of reprocessing whatever that particular
  call happened to send.
- **Migrations resolved from `src/` via `process.cwd()`, not
  `__dirname`-relative `dist/`**, found and fixed during dev-server
  verification: `nest start --watch`'s `deleteOutDir` wipes `dist/` on
  every restart, and the asset-copy step copying migrations into
  `dist/` isn't guaranteed to finish before the app tries to migrate,
  causing an intermittent "can't find migrations" crash on cold start.
  Since migrations are static `.sql`/`.json`, not compiled code,
  reading them straight from `src/` sidesteps the race entirely in dev
  and prod alike. `nest-cli.json`'s asset-copy config is kept anyway,
  as correct behavior for a hypothetical future deploy that only ships
  `dist/`.
- **`.data/` excluded from apps/api's tsconfig**, found and fixed
  during dev-server verification: PGlite's own database-file writes
  under `apps/api/.data/pglite` were being picked up by the TS watch
  compiler as source changes, triggering a restart loop that
  occasionally raced with `deleteOutDir` and crashed
  (`Cannot find module dist/main`).
- **Explicit audio `mimeType` was already fixed in Milestone 2's
  correction pass** and carried through here unchanged — flagged
  again only because it's exactly the kind of thing that would have
  resurfaced as a real upload-integrity bug in this milestone if it
  hadn't already been caught.

## Follow-ups / left undone

- Real Supabase Storage/Postgres integration is not built — both
  remain local stand-ins. Swapping in real credentials is an env var
  change (`DATABASE_URL`, and a future `STORAGE_DRIVER=supabase` +
  adapter class), not a redesign, but the actual swap work is
  unstarted.
- Audio stitching (chunks → one continuous file) deliberately not
  built here — deferred to Milestone 4/5, whichever actually consumes
  the merged audio. `storage_key` currently points at the recording's
  chunk folder.
- No automated tests added for the new use-cases/repository/adapter —
  verified manually via curl and a real browser session only. The
  domain layer (`assertValidStatusTransition`) and use-cases are
  written to be unit-testable with plain data/fake repositories per
  architecture.md §20 principle 7, but that test suite isn't written
  yet.
- CORS is fully permissive (`app.enableCors()` with no origin
  restriction) — fine for local dev with two localhost ports, flagged
  in code as a TODO before any real deployment.
