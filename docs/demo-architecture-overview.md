# Kal-Scribe — Architecture, Setup & Models (Demo Reference)

_Snapshot as of 2026-07-09/10, for presenting the current build. This is a
point-in-time reference — for the living, continuously-updated picture see
`docs/PROJECT_STATUS.md`; for the original architectural blueprint see
`docs/architecture.md`._

## What this is

Kal-Scribe automates clinical documentation from doctor-patient consultation
audio: record → transcribe → diarize (who said what) → extract structured
clinical fields via an LLM → doctor reviews/edits/accepts the AI draft
before anything becomes part of the real record.

## System components

| Component | Tech | Role | Port (local dev) |
|---|---|---|---|
| `apps/web` | Next.js 16 | Recording capture UI + doctor review UI | 3000 |
| `apps/api` | NestJS 11 | Orchestration, domain logic, REST API, BullMQ producer | 3001 |
| `workers/clinical-ai-worker` | Node/tsx, BullMQ consumer | Runs transcription + extraction jobs in the background | — (no HTTP port) |
| `python/asr-service` | FastAPI | Speech-to-text + diarization microservice | 8787 |
| `packages/types` | TypeScript | Shared types across api/web/worker | — |
| `packages/validation` | Zod | Request/response schemas, shared with types | — |
| `packages/config` | TypeScript | Typed env parsing | — |
| `packages/llm-client` | TypeScript | LLM provider abstraction (currently Groq) + extraction prompt | — |

## Data stores

| Store | Local dev | Production target |
|---|---|---|
| Relational DB | Embedded PGlite (`apps/api/.data/pglite`, file-based, no server) | Real Postgres (Supabase) |
| Object storage (audio) | Local disk (`apps/api/.data/storage`) | Supabase Storage |
| Job queue | Redis (hosted, Upstash — no local stand-in) | Same, real Upstash/Redis instance |

## End-to-end flow

1. **Record** — doctor confirms patient consent, records audio in the
   browser; audio chunks upload to `apps/api` as they're captured (not
   after the fact).
2. **Complete** — on stop, `apps/api` finalizes the recording and enqueues
   a **transcription** job onto Redis/BullMQ.
3. **Transcribe + diarize** — `workers/clinical-ai-worker` picks up the
   job, fetches and stitches the audio chunks, and POSTs the audio to
   `python/asr-service`, which runs:
   - **WhisperX** (`small` model) for speech-to-text
   - **Pyannote** (`speaker-diarization-3.1`) for "who spoke when"
4. **Persist transcript** — the worker saves the speaker-labeled
   transcript via `apps/api`, then enqueues an **extraction** job.
5. **Extract clinical data** — the worker sends the transcript to the
   configured LLM (currently Groq), which returns a structured JSON
   object matching the clinic's real clinical form fields (schema
   version 2.1) — diagnosis, medicines, symptoms, personal history, etc.
6. **Review** — the doctor sees a review draft (`ReviewDraftPanel`) with
   every AI-suggested field visually marked as AI-derived and
   confidence-scored. Nothing reaches the patient record until the
   doctor explicitly accepts it. The doctor can edit any field first —
   edits are stored separately from the original AI output for
   auditability.

## Models currently in use

| Stage | Model | Device | Why |
|---|---|---|---|
| Speech-to-text | WhisperX `small` | GPU (CUDA, float16) by default; CPU (int8) fallback, selectable per-recording via a frontend toggle | GPU is ~6x faster than CPU on this machine (RTX 4050) — see ADR-0012 |
| Diarization | Pyannote `speaker-diarization-3.1` | Same device as transcription | Best available primary model (vs. the `community-1` fallback) |
| Clinical extraction | Groq — **`meta-llama/llama-4-scout-17b-16e-instruct`** | Cloud (Groq API) | Chosen after comparing three models head-to-head on the same real transcript — see comparison below |

### Why Llama 4 Scout, specifically

Two earlier models were tried and rejected for real reasons, not just cost:

- **`llama-3.3-70b-versatile`** — best raw quality of the three, but its
  free-tier limit (12,000 tokens/minute) is barely enough for a single
  extraction call on a ~7-minute consultation (~6,700-7,600 tokens),
  leaving no room for retries — repeatedly hit `429 rate_limit_exceeded`
  in testing.
- **`llama-3.1-8b-instant`** — much higher daily request allowance, but
  measurably less reliable on synthesis-heavy fields (diagnosis summary,
  clinical notes) — same audio, same model, different runs produced
  inconsistent results (a diagnosis field correctly filled one run, empty
  the next; a medicine caught one run, missed the next).
- **`meta-llama/llama-4-scout-17b-16e-instruct`** — a newer model
  generation (Llama 4), **30,000 tokens/minute** (2.5x more headroom than
  70B), and produced the best result of all three on the same test
  transcript: a clean diagnosis term, all medicines mentioned in the
  audio captured, full confidence scores, and zero rate-limit issues.

## Real-world performance (measured, not estimated)

For a real ~7-minute consultation recording, on this machine:

| Stage | CPU | GPU |
|---|---|---|
| Transcription + diarization | ~4m35s | **~45s-1m20s** |
| Extraction (LLM) | ~3-5s | ~3-5s (model-independent) |

## Key design principles

- **No AI-derived content is ever authoritative** — every AI-suggested
  field is visually distinguished (confidence badges, risk flags) until
  the doctor explicitly accepts it.
- **Provider abstraction everywhere** — STT provider, diarization
  provider, and LLM provider are all swappable via a single env var
  with no code changes to the calling code (already used today: WhisperX
  device swap, three different Groq models).
- **Validate at every boundary** — every request/response is validated
  against a Zod schema derived from the same source as the TypeScript
  types.

## Known limitations (honest, current)

- GPU-mode diarization has shown real speaker-misattribution issues on
  fast back-and-forth dialogue — CPU mode has been more reliable for
  diarization accuracy specifically, at the cost of speed.
- A small percentage of unusual Ayurvedic medicine names get
  mis-transcribed by WhisperX (an STT limitation, not an extraction bug)
  — the doctor review step exists specifically to catch this before
  anything is finalized.
- This is a local development environment (all four services running on
  one machine) — not yet deployed to real infrastructure.
