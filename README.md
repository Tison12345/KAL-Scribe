# kal-scribe — Clinical AI Module

Automates clinical documentation from doctor–patient consultation
audio: record → chunked upload → transcribe + diarize → LLM-extract a
structured clinical record → doctor reviews and accepts an editable
draft. Built as a standalone repo so it can be developed and evaluated
independently, then copied into the main KAL clinic-management system
once mature (see `docs/architecture.md` §16–17).

For the full technical walkthrough — how audio chunking works, how
transcription and diarization happen, exactly how the LLM extracts a
clinical record, and how it's all wired together end to end — see
**[`docs/modules/clinical-ai-pipeline.md`](docs/modules/clinical-ai-pipeline.md)**.
For the one-glance "what state is this repo in" summary, see
[`docs/PROJECT_STATUS.md`](docs/PROJECT_STATUS.md). For the original
design blueprint and every non-obvious decision made since, see
[`docs/architecture.md`](docs/architecture.md) and
[`docs/adr/`](docs/adr/).

## What's actually running today

- **Speech understanding + clinical extraction: Google Gemini**
  (`gemini-2.5-flash` by default) — one model call transcribes and
  diarizes audio directly (no separate STT/diarization service in the
  default path), and a second call extracts a structured clinical
  record from the resulting transcript. See ADR-0013.
- **Database + object storage: Supabase** (Postgres + Storage). No
  local dev stand-in — every environment talks to a real Supabase
  project. See ADR-0014.
- **Job queue: pg-boss**, running on the same Postgres database —
  no Redis, no separate queue service. See ADR-0015.
- **Classic pipeline (WhisperX + Pyannote + Groq) still exists** as an
  alternate path (`python/asr-service`, `GROQ_*`/`SPEECH_PROVIDER`
  unset) but is not the default deployment target.

## Prerequisites

- Node.js >= 22
- pnpm 10.x (`corepack enable` picks up the pinned version from
  `package.json`'s `packageManager` field)
- `ffmpeg` and `ffprobe` on `PATH` — the worker uses them to stitch
  uploaded audio chunks and read audio metadata
- A Supabase project (Postgres + a private Storage bucket) — see
  `apps/api/.env.example`
- A Gemini API key (free tier at [aistudio.google.com/apikey](https://aistudio.google.com/apikey))
  for the default pipeline

## Getting started

```sh
pnpm install
pnpm build       # builds every app/package (packages must build before apps/api's typecheck resolves their types)
pnpm typecheck
pnpm lint
```

Copy each process's `.env.example` to `.env` and fill in real values
(Supabase connection string, Supabase Storage credentials, Gemini API
key — see each file's comments for exactly what's required):

```sh
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
cp workers/clinical-ai-worker/.env.example workers/clinical-ai-worker/.env
```

This repo runs as **three separate processes**, each started
independently (there is no single root command that starts all
three — `pnpm dev` at the root only runs packages that define a `dev`
script, which `apps/api` doesn't):

```sh
# terminal 1 — API (NestJS), also applies pending DB migrations on boot
pnpm --filter @kal-scribe/api start:dev

# terminal 2 — background worker (transcription + extraction jobs)
pnpm --filter @kal-scribe/clinical-ai-worker dev

# terminal 3 — web frontend (Next.js)
pnpm --filter @kal-scribe/web dev
```

Then open `http://localhost:3000`.

## Layout

- `apps/api` — NestJS backend: recording/upload session API, job
  orchestration (pg-boss producer), all `consultation_*` domain logic,
  CMS integration seam
- `apps/web` — Next.js frontend: recording capture UI (chunked
  `MediaRecorder`), doctor review/edit UI
- `workers/clinical-ai-worker` — separate Node process that consumes
  pg-boss jobs: fetches + stitches uploaded chunks, calls the
  speech-understanding provider, calls the clinical-extraction
  provider, reports status back to `apps/api` over HTTP
- `python/asr-service` — FastAPI service running WhisperX (STT) +
  Pyannote (diarization); only used when `SPEECH_PROVIDER` is unset
- `packages/types`, `packages/validation`, `packages/config` — shared
  TypeScript types, zod schemas, and typed env parsing
- `packages/llm-client` — provider-abstracted clients for speech
  understanding and clinical extraction (`GeminiProvider`,
  `GroqProvider`)
- `tests/eval` — accuracy eval harness (not unit tests) that runs
  extraction against fixed transcript fixtures and scores field
  accuracy
- `docs/` — living documentation; see
  [`docs/README.md`](docs/README.md) for how each doc type is
  maintained, and [`docs/INDEX.md`](docs/INDEX.md) for a one-line map
  of every doc file in the repo

## Useful commands

```sh
pnpm build              # build every app/package
pnpm typecheck           # typecheck every app/package
pnpm lint                # lint every app/package
pnpm test                # unit tests
pnpm eval                # clinical-extraction accuracy eval (tests/eval)
pnpm --filter @kal-scribe/api db:generate   # generate a Drizzle migration after a schema change
```
