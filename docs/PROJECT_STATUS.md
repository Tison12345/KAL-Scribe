# Project Status

> Rewritten in place after every task — this file always reflects the
> *current* state, not history. For history, see `docs/log/`. For deep
> per-module detail, see `docs/modules/`. For why a decision was made, see
> `docs/adr/`.

**Last updated:** 2026-07-04 — Milestone 1: Repository setup

## One-paragraph summary

Repo is scaffolded per `docs/architecture.md` §4/§18 Milestone 1: a pnpm
workspace with bootstrapped `apps/api` (NestJS) and `apps/web` (Next.js)
skeletons, `packages/{types,validation,config}` scaffolds, and CI. No
clinical-ai domain code exists yet — no recording, storage, queue, ASR,
LLM, or review-UI logic. `workers/clinical-ai-worker` and
`python/asr-service` are not created yet (later milestones).

## What's built

- Root pnpm workspace: `pnpm-workspace.yaml`, root `package.json`
  (`build`/`dev`/`lint`/`typecheck`/`test` scripts fanning out via
  `pnpm -r`), `tsconfig.base.json`, shared `.gitignore`/`.prettierrc`,
  fallback root `eslint.config.mjs` for packages that don't ship their
  own.
- `apps/api` — NestJS 11 skeleton (default health-check
  controller/service only, no `modules/clinical-ai` yet), its own
  `eslint.config.mjs`, Jest unit + e2e test scaffolding wired and
  passing.
- `apps/web` — Next.js 16 (App Router, TypeScript, no Tailwind)
  skeleton, default starter page untouched (UI work is a later
  milestone per explicit instruction — read `docs/design/` first when
  that starts).
- `packages/types`, `packages/validation`, `packages/config` — each has
  `package.json` + `tsconfig.json` (extending the root base config) +
  a placeholder `src/index.ts`. No real types/schemas/env-parsing yet —
  those land with the milestones that need them.
- CI: `.github/workflows/ci.yml` — install (frozen lockfile), lint,
  typecheck, build, test, on push to `main` and on PRs.
- Verified end-to-end: `pnpm install`, `pnpm build`, `pnpm lint`,
  `pnpm typecheck`, `pnpm test` all pass clean across every workspace
  member.
- `docs/adr/0001`–`0004` seeded, capturing the decisions
  architecture.md already made: STT provider (WhisperX), LLM provider
  for MVP extraction (Groq/Llama, with the cloud-vs-local PHI question
  explicitly left open pending legal review), object storage (Supabase
  Storage), and the default 90-day audio retention window (flagged as
  proposed, not compliance-reviewed).

## In progress

- Nothing — Milestone 1 is complete.

## Not started

- Milestone 2 (Recording): `useAudioRecorder`, `RecordButton`, chunked
  capture, consent UX.
- Milestones 3–10 (Storage, Queue, STT, Diarization, Extraction, Review
  UI, CMS Mapping, Integration) — see `docs/architecture.md` §18.
- `workers/clinical-ai-worker` and `python/asr-service` don't exist yet
  (introduced at Milestones 4 and 5 respectively).

## Known issues / risks

- None currently. Two open decisions are intentionally left
  unresolved rather than defaulted silently: the cloud-vs-local LLM
  data-handling question (ADR-0002) and the 90-day retention default
  (ADR-0004) both need legal/compliance sign-off before this module
  handles real PHI.

## Key decisions in effect

- STT provider: WhisperX — `docs/adr/0001-stt-provider-whisperx.md`
- LLM provider (MVP extraction): Groq-hosted Llama —
  `docs/adr/0002-llm-provider-groq-mvp.md`
- Object storage: Supabase Storage —
  `docs/adr/0003-object-storage-supabase.md`
- Audio retention: 90 days (proposed default) —
  `docs/adr/0004-audio-retention-90-days.md`

## Next up

- Milestone 2 (Recording) per `docs/architecture.md` §18: build
  `useAudioRecorder`, `RecordButton`, chunked client-side capture, and
  the consent-confirmation UX (§15) inside
  `apps/web/src/features/clinical-ai/`. Read `docs/design/
  ui-guidelines.md` and `ui-reference.md` first, per §6/§20.
