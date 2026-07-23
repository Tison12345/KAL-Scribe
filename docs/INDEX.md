# Documentation Index

Every markdown file in this repo that isn't code, one line each, so a
new reader (human or AI) can find the right file without opening all of
them. If you add a new doc file anywhere in the repo, add one line for
it here in the matching section.

For the *rules* on how each category gets maintained (when to update,
append-only vs. rewrite-in-place, etc.), see `docs/README.md` — this
file is just the map, that one is the rulebook.

## Start here

- [`PROJECT_STATUS.md`](PROJECT_STATUS.md) — one-glance current state:
  what's built, in progress, known issues, next up. **Read this first.**
- [`architecture.md`](architecture.md) — the original blueprint: module
  layout, conventions, data model, provider-abstraction rules. Source
  of truth for structure; changes rarely.
- [`README.md`](README.md) — explains the four doc categories below
  and the rule for when each one changes.
- [`../CLAUDE.md`](../CLAUDE.md) — repo-root AI-agent instructions
  (doc-maintenance rules, coding conventions). Read before doing any
  task in this repo, not just for docs.

## Decision records (`adr/`) — why a specific call was made

One file per non-obvious decision, numbered in creation order. A
superseded ADR stays in place with its `Status:` line updated, not
deleted.

- [`0001-stt-provider-whisperx.md`](adr/0001-stt-provider-whisperx.md) — chose WhisperX as the speech-to-text provider
- [`0002-llm-provider-groq-mvp.md`](adr/0002-llm-provider-groq-mvp.md) — chose Groq-hosted Llama for MVP clinical extraction
- [`0003-object-storage-supabase.md`](adr/0003-object-storage-supabase.md) — chose Supabase Storage as the production object-storage target
- [`0004-audio-retention-90-days.md`](adr/0004-audio-retention-90-days.md) — proposed 90-day audio retention default (legal sign-off still open)
- [`0005-ui-font-manrope.md`](adr/0005-ui-font-manrope.md) — UI font is Manrope, deviating from `ui-guidelines.md`'s original pairing
- [`0006-record-button-level-meter.md`](adr/0006-record-button-level-meter.md) — `RecordButton`'s live level-meter visual design
- [`0007-local-disk-storage-standin.md`](adr/0007-local-disk-storage-standin.md) — local-disk, signed-URL-shaped stand-in for object storage in dev
- [`0008-local-postgres-standin-pglite.md`](adr/0008-local-postgres-standin-pglite.md) — embedded PGlite as the local dev stand-in for Postgres
- [`0009-whisperx-runtime-config-cpu-small.md`](adr/0009-whisperx-runtime-config-cpu-small.md) — **superseded by 0012** — original CPU/`small`/int8 WhisperX config
- [`0010-worker-http-client-not-nestjs-import.md`](adr/0010-worker-http-client-not-nestjs-import.md) — worker calls apps/api over HTTP, not by importing NestJS use-cases
- [`0011-llm-extraction-implementation-choices.md`](adr/0011-llm-extraction-implementation-choices.md) — implementation choices for the clinical-extraction LLM call
- [`0012-whisperx-gpu-cuda-float16.md`](adr/0012-whisperx-gpu-cuda-float16.md) — switched WhisperX to GPU (CUDA/float16), ~6.1x faster than CPU
- [`0013-gemini-single-model-poc.md`](adr/0013-gemini-single-model-poc.md) — clinical-ai-single branch: Gemini called directly (not via OpenRouter), replaces asr-service entirely, model choice, semantic speaker labeling
- [`0014-mvp-supabase-postgres-and-storage.md`](adr/0014-mvp-supabase-postgres-and-storage.md) — removed PGlite/local-disk stand-ins for real Supabase, split consultation_ai_results into versioned runs+reviews, renamed provider interfaces
- [`0015-pg-boss-not-bullmq.md`](adr/0015-pg-boss-not-bullmq.md) — replaced BullMQ/Redis with pg-boss (Postgres-native queue) after repeated Redis quota exhaustion
- [`0016-multilingual-original-text-capture.md`](adr/0016-multilingual-original-text-capture.md) — Kannada/Hindi/Tamil/Malayalam/Sanskrit support: capture original-language text per segment (nullable, provider-dependent), scoped Noto Sans fonts
- [`adr-template.md`](adr/adr-template.md) — shape to copy for a new ADR
- [`README.md`](adr/README.md) — rules for this folder

## Task log (`log/`) — dated diary, append-only, chronological

Never edited after the fact — a correction is a new entry, not an edit
to an old one.

- [`2026-07-04-milestone-1-repository-setup.md`](log/2026-07-04-milestone-1-repository-setup.md) — pnpm workspace scaffold: apps/api, apps/web, shared packages
- [`2026-07-04-milestone-2-recording.md`](log/2026-07-04-milestone-2-recording.md) — client-side audio recording capture (consent UX, `useAudioRecorder`, `RecordButton`)
- [`2026-07-04-milestone-2-chunk-playback-correction.md`](log/2026-07-04-milestone-2-chunk-playback-correction.md) — correction: chunk audio playback wasn't actually verified in the prior entry
- [`2026-07-05-milestone-3-storage.md`](log/2026-07-05-milestone-3-storage.md) — upload session API, resumable chunk upload, `consultation_recordings` table
- [`2026-07-05-milestone-4-queue.md`](log/2026-07-05-milestone-4-queue.md) — BullMQ queue infra, `consultation_ai_jobs` table, `workers/clinical-ai-worker` scaffold
- [`2026-07-05-milestone-5-speech-to-text.md`](log/2026-07-05-milestone-5-speech-to-text.md) — real WhisperX transcription wired end-to-end
- [`2026-07-05-milestone-6-speaker-diarization.md`](log/2026-07-05-milestone-6-speaker-diarization.md) — Pyannote diarization integrated
- [`2026-07-05-milestone-6-diarization-verified.md`](log/2026-07-05-milestone-6-diarization-verified.md) — diarization verified for real with a genuine `HF_TOKEN`, two bugs found and fixed
- [`2026-07-05-milestone-7-clinical-extraction.md`](log/2026-07-05-milestone-7-clinical-extraction.md) — clinical entity extraction via Groq, verified with an accuracy eval harness
- [`2026-07-05-milestone-8-review-ui.md`](log/2026-07-05-milestone-8-review-ui.md) — doctor-facing `ReviewDraftPanel`, accept/discard/update use-cases
- [`2026-07-05-milestone-8-terminal-state-fix.md`](log/2026-07-05-milestone-8-terminal-state-fix.md) — bug fix: accept/discard weren't mutually terminal
- [`2026-07-05-milestone-8-long-audio-timeout-bug.md`](log/2026-07-05-milestone-8-long-audio-timeout-bug.md) — first pass at the long-audio timeout bug (later found incomplete, see 2026-07-07 entry)
- [`2026-07-05-milestone-8-reopen-by-recording-id.md`](log/2026-07-05-milestone-8-reopen-by-recording-id.md) — `?recordingId=` URL param to reopen a recording after a page refresh
- [`2026-07-05-milestone-8-pipeline-progress-tracker.md`](log/2026-07-05-milestone-8-pipeline-progress-tracker.md) — real (not simulated) per-stage pipeline progress indicator
- [`2026-07-06-performance-benchmarks-runbook.md`](log/2026-07-06-performance-benchmarks-runbook.md) — started `docs/runbooks/performance-benchmarks.md`
- [`2026-07-06-primary-diarization-model-activated.md`](log/2026-07-06-primary-diarization-model-activated.md) — switched from the `community-1` diarization fallback to the primary `speaker-diarization-3.1` model
- [`2026-07-06-real-clinical-form-schema-rebuild.md`](log/2026-07-06-real-clinical-form-schema-rebuild.md) — extraction schema rebuilt field-for-field against the real CMS form
- [`2026-07-06-ci-lint-before-build-ordering-fix.md`](log/2026-07-06-ci-lint-before-build-ordering-fix.md) — fixed CI running lint before build, causing spurious `no-unsafe-*` errors
- [`2026-07-07-headers-timeout-bug-fix.md`](log/2026-07-07-headers-timeout-bug-fix.md) — real root cause of the long-audio timeout bug: undici's `headersTimeout`, not the `AbortSignal`
- [`2026-07-07-gpu-speed-test.md`](log/2026-07-07-gpu-speed-test.md) — GPU vs. CPU timing comparison, ~6.1x speedup (see ADR-0012)
- [`2026-07-09-extraction-schema-field-audit.md`](log/2026-07-09-extraction-schema-field-audit.md) — second-pass field audit against the real CMS form, schema 2.0 → 2.1
- [`2026-07-09-redis-quota-exhausted.md`](log/2026-07-09-redis-quota-exhausted.md) — stale `packages/types` dist rebuilt; Upstash Redis free-tier quota exhausted, blocking the job queue
- [`2026-07-09-diagnosis-notes-mandatory-and-stale-extraction-bug.md`](log/2026-07-09-diagnosis-notes-mandatory-and-stale-extraction-bug.md) — relaxed diagnosis/made clinical-notes mandatory; fixed a stale-extraction-result query bug found along the way
- [`2026-07-13-gemini-single-model-poc.md`](log/2026-07-13-gemini-single-model-poc.md) — clinical-ai-single branch: `GeminiProvider` wired in for both transcription and extraction, not yet tested against a real recording
- [`2026-07-15-mvp-supabase-and-versioned-runs.md`](log/2026-07-15-mvp-supabase-and-versioned-runs.md) — real Supabase Postgres/Storage, versioned AI runs/reviews/sessions schema, renamed provider interfaces
- [`2026-07-18-pg-boss-not-bullmq.md`](log/2026-07-18-pg-boss-not-bullmq.md) — replaced BullMQ/Redis with pg-boss, worker now reports job status over HTTP instead of Redis pub/sub
- [`2026-07-18-multilingual-kannada-hindi-tamil-malayalam-sanskrit.md`](log/2026-07-18-multilingual-kannada-hindi-tamil-malayalam-sanskrit.md) — Kannada/Hindi/Tamil/Malayalam/Sanskrit support: original-text capture per segment, language badge + toggle UI, new eval fixtures, fixed a latent score.ts bug
- [`2026-07-24-vercel-build-missing-types-dist.md`](log/2026-07-24-vercel-build-missing-types-dist.md) — fixed first Vercel deploy failure: added `apps/web`'s `vercel-build` script so `@kal-scribe/types` builds before `next build`
- [`_template.md`](log/_template.md) — shape to copy for a new log entry
- [`README.md`](log/README.md) — rules for this folder

## Module docs (`modules/`) — living design docs, current shape only

Rewritten in place, not appended — for history of *how* a module got
to its current shape, see the log entries above instead.

- [`clinical-ai-pipeline.md`](modules/clinical-ai-pipeline.md) — detailed, current-state technical walkthrough: tech stack, chunking mechanics, upload, worker stitching, transcription, LLM extraction, review/accept — the accurate replacement for architecture.md §3/§7/§8/§9's pre-build design
- [`clinical-extraction-schema.md`](modules/clinical-extraction-schema.md) — the `ClinicalExtraction` schema's field-by-field derivation from the real CMS form
- [`_template.md`](modules/_template.md) — shape to copy for a new module doc
- [`README.md`](modules/README.md) — rules for this folder

## Design reference (`design/`)

- [`ui-guidelines.md`](design/ui-guidelines.md) — colors, fonts, tone, component patterns to match the existing CMS
- [`ui-reference.md`](design/ui-reference.md) — concrete existing-CMS screen/component reference

## Runbooks (`runbooks/`)

- [`performance-benchmarks.md`](runbooks/performance-benchmarks.md) — real pipeline timing data points (CPU-only baseline + extrapolation); GPU numbers live in ADR-0012/the 2026-07-07 log entry instead, kept separate since it's a different hardware baseline

## Presentation reference (point-in-time snapshots, not living docs)

- [`demo-architecture-overview.md`](demo-architecture-overview.md) — architecture, setup, and models currently in use (2026-07-09/10 snapshot), written for showing to a non-engineer stakeholder
- `demo-architecture-diagram.html` — companion Mermaid diagram (self-contained, Mermaid.js inlined for offline/CSP-safe viewing) of the same architecture, open directly in a browser

## Elsewhere in the repo

- [`../README.md`](../README.md) — repo root: what this project is, prerequisites, `pnpm` getting-started commands, folder layout
- [`../CLAUDE.md`](../CLAUDE.md) — repo-root AI-agent instructions (see "Start here" above)
- `../apps/api/README.md` — NestJS/`create-nest-app` boilerplate, not custom content
- `../apps/web/README.md` — Next.js/`create-next-app` boilerplate, not custom content
- `../apps/web/AGENTS.md` — Next.js-generated agent rules note (points AI tools at `node_modules/next/dist/docs/` for this Next.js version's API changes)
- `../apps/web/CLAUDE.md` — one line, re-points to `AGENTS.md` above
