---
date: 2026-07-24
task: vercel-build-missing-types-dist
---

# Fixed Vercel deploy failure: `@kal-scribe/types` unresolved

## What changed

First Vercel deployment of `apps/web` failed at `next build` with `Module
not found: Can't resolve '@kal-scribe/types'`. Root cause: `dist/` is
gitignored, so a fresh Vercel clone has no compiled output for
`packages/types`, and Vercel (Root Directory set to `apps/web`) only runs
that app's own `build` script — never `packages/types`' build step. Same
class of bug as the 2026-07-06 CI ordering fix
(`docs/log/2026-07-06-ci-lint-before-build-ordering-fix.md`), different
build system. Fixed by adding a `vercel-build` script to
`apps/web/package.json`, which Vercel automatically prefers over `build`
when present: it builds `@kal-scribe/types` (via pnpm's `...` dependency
filter) before running `next build`.

## Files touched

- `apps/web/package.json` — added `"vercel-build": "cd ../.. && pnpm
  --filter @kal-scribe/web... run build"`

## Decisions made

- Fixed via a committed `vercel-build` script rather than a Vercel
  dashboard Build Command override, so the fix travels with the repo and
  works for anyone re-importing the project, not just the current Vercel
  project's settings.

## Follow-ups / left undone

- Verified locally by deleting `packages/types/dist` and running the new
  script directly (build succeeded). Not yet verified against an actual
  Vercel deployment — this needs to land on `main` (the branch Vercel
  deploys) before that's possible; the fix was made on
  `multilingual-support`.
- `apps/api` still has no deployment target — `NEXT_PUBLIC_API_BASE_URL`
  is unset on Vercel, so the deployed frontend can build but can't reach
  a real backend yet.
