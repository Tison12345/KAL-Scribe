---
date: 2026-07-04
task: milestone-1-repository-setup
---

# Milestone 1: Repository setup

## What changed

Scaffolded the repo per `docs/architecture.md` §4 and §18 Milestone 1:
a pnpm workspace with `apps/api` (NestJS 11) and `apps/web` (Next.js
16) skeletons, `packages/{types,validation,config}` scaffolds, shared
root TypeScript/ESLint/Prettier config, and a GitHub Actions CI
workflow. No clinical-ai domain code was added — this milestone is
purely "the repo exists, builds, lints, and tests cleanly," per
the roadmap's own scope for M1.

## Files touched

- `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`,
  `.gitignore`, `.prettierrc`, `eslint.config.mjs`, `README.md` — root
  workspace scaffolding.
- `apps/api/**` — generated via `@nestjs/cli new` (skip-git,
  skip-install), then integrated: renamed package to
  `@kal-scribe/api`, added `typecheck` script, `tsconfig.json` extends
  the root base config, fixed one floating-promise lint warning in
  `main.ts` (`void bootstrap()`).
- `apps/web/**` — generated via `create-next-app` (App Router,
  TypeScript, no Tailwind, skip-install), then integrated: renamed
  package to `@kal-scribe/web`, added `typecheck` script, `tsconfig.json`
  extends the root base config; removed the nested
  `pnpm-workspace.yaml`/`.gitignore` it generated (folded the one
  meaningful setting — `ignoredBuiltDependencies` — into the root
  `pnpm-workspace.yaml`). Kept the framework-generated `CLAUDE.md`/
  `AGENTS.md` in `apps/web/` as-is — they document real Next.js 16
  breaking-changes guidance relevant to later UI milestones. Left the
  default starter page/UI completely untouched, per instruction — UI
  work starts at Milestone 2/8 and requires reading `docs/design/`
  first.
- `packages/types/`, `packages/validation/`, `packages/config/` — each
  a minimal `package.json` + `tsconfig.json` (extends root base) +
  placeholder `src/index.ts` (`export {}`). No real types/schemas/env
  logic yet — intentionally deferred to the milestones that need them,
  per the "don't build features beyond what's needed" rule.
- `.github/workflows/ci.yml` — install (`--frozen-lockfile`), lint,
  typecheck, build, test on push to `main` and on PRs.
- `docs/adr/0001-stt-provider-whisperx.md`,
  `0002-llm-provider-groq-mvp.md`, `0003-object-storage-supabase.md`,
  `0004-audio-retention-90-days.md` — seeded per CLAUDE.md/§18's
  instruction to seed ADRs for decisions architecture.md already made.
- `docs/PROJECT_STATUS.md` — rewritten to reflect current state.

## Decisions made

- Used the official `@nestjs/cli` and `create-next-app` generators
  (with `--skip-git --skip-install`) rather than hand-authoring
  `package.json`/config files from scratch, to get framework-correct
  defaults (tsconfig shape, eslint flat config, jest config) that
  match what each framework's own tooling expects, then integrated the
  output into the workspace. This isn't a deviation from
  architecture.md — the resulting folder shape matches §4/§5/§6
  exactly — just the mechanism used to produce boilerplate faster and
  more reliably than hand-writing it.
- Pinned root shared devDependencies (`eslint`, `@eslint/js`,
  `typescript-eslint`, `typescript`) to the same versions
  `@nestjs/cli` generated for `apps/api`, rather than the latest
  available (e.g. ESLint 10, TypeScript 6.0.3), to keep one consistent
  toolchain version across the workspace and avoid an untested
  major-version jump for tooling nothing depends on yet. Revisit when
  a real reason to upgrade shows up.
- No ADR needed for either of the above — these are build-tooling
  mechanics, not architecture decisions per §20 principle 8's test
  ("does this follow Repo B's actual current convention, or did I
  introduce something new because it was easier?" — answer: no new
  convention introduced).

## Follow-ups / left undone

- `workers/clinical-ai-worker` and `python/asr-service` are not
  scaffolded — they're introduced at Milestones 4 and 5 per §18, not
  M1.
- No root README existed before this task; added a short one (install/
  build/lint/typecheck/test commands, layout pointer) since it wasn't
  explicitly requested but is normal repo-setup hygiene — flagged here
  in case that scope call is unwanted.
- ADR-0002 (LLM provider) and ADR-0004 (retention window) both
  explicitly note an open sub-decision needing legal/compliance input
  before production PHI handling — not resolved in this task, and not
  meant to be; just made visible rather than silently assumed.
