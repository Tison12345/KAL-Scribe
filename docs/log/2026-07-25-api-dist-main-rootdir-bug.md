---
date: 2026-07-25
task: api-dist-main-rootdir-bug
---

# Fixed `apps/api`'s `node dist/main.js` — wrong output path

## What changed

Render's `apps/api` deployment built successfully but crashed on start:
`Error: Cannot find module '/opt/render/project/src/apps/api/dist/main.js'`.
Root cause: `apps/api/drizzle.config.ts` lives at the package root, outside
`src/`, and `tsconfig.build.json` (what `nest build` actually uses) had no
explicit `rootDir` — so TypeScript inferred it from the full set of
included files, landing on the package root instead of `src/`. That nests
every compiled file one level deeper than expected: `main.js` ends up at
`dist/src/main.js`, not `dist/main.js`, silently breaking `start:prod`
(`node dist/main`) and any host's `node dist/main.js` start command. Never
noticed before because local dev only ever uses `nest start`/`start:dev`
(in-memory, doesn't touch `dist/`) — this is the first time anything ran
the compiled output directly. `drizzle.config.ts` doesn't need to be
compiled at all — `drizzle-kit` reads `.ts` config files natively via its
own CLI, so excluding it from the build and pinning `rootDir` to `./src`
fixes the path without affecting `db:generate`.

## Files touched

- `apps/api/tsconfig.build.json` — added `"rootDir": "./src"`, excluded
  `drizzle.config.ts`

## Decisions made

- Left `apps/api/tsconfig.json` (used by `typecheck`) untouched — the
  `rootDir` fix only matters for `nest build`'s output layout, and
  `tsc --noEmit` doesn't care about output nesting. Confirmed `typecheck`
  still passes clean.

## Follow-ups / left undone

- Verified locally: deleted `apps/api/dist` and the three workspace
  package `dist/`s, reran the build, confirmed `dist/main.js` now exists
  directly (not `dist/src/main.js`). Not yet verified as a real Render
  deployment — needs to merge to `main` first (made on
  `multilingual-support`, same as the earlier Vercel fix).
- Worth a smoke test of `workers/clinical-ai-worker`'s equivalent
  `tsconfig`/build setup before deploying it — it doesn't have a
  `drizzle.config.ts`-style stray root file today, so it's likely fine,
  but hasn't been explicitly checked against this same class of bug.
