---
date: 2026-07-06
task: ci-lint-before-build-ordering-fix
---

# CI: fix lint running before workspace packages are built

## What changed

The GitHub Actions build (triggered by the `@kal-scribe/types` integration
commit) failed lint with 84 errors in `apps/api`, all
`@typescript-eslint/no-unsafe-*` on values typed from `@kal-scribe/types`/
`@kal-scribe/validation` (e.g. `body.transcriptId` on `EnqueueExtractionJobRequest`
reported as "cannot be resolved"). Root cause: both packages publish types via
`"types": "./dist/index.d.ts"`, but CI ran `pnpm lint` before `pnpm build` —
on a fresh checkout there's no `dist/` yet, so those imports resolve to
unknown/`any` and eslint's type-aware rules flag every usage. The types
themselves were correct all along; reordered `.github/workflows/ci.yml` to
run `build` before `lint`/`typecheck`. Verified locally: `pnpm build` then
`pnpm lint` across the whole workspace passes clean (previously reproduced
the same 84 errors when linting `apps/api` against a clean/no-dist state).

## Files touched

- `.github/workflows/ci.yml` — moved the `Build` step ahead of `Lint` and
  `Typecheck`.

## Decisions made

- No ADR — this is a CI ordering bug fix, not a design choice; the
  standard convention (build workspace deps before lint/typecheck) applies.

## Follow-ups / left undone

- None. Any future workspace package that exposes types via a built `dist/`
  will hit the same issue if a lint/typecheck step is added ahead of build.
