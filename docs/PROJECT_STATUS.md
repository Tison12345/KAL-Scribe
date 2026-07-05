# Project Status

> Rewritten in place after every task — this file always reflects the
> *current* state, not history. For history, see `docs/log/`. For deep
> per-module detail, see `docs/modules/`. For why a decision was made, see
> `docs/adr/`.

**Last updated:** 2026-07-05 — Milestone 7: Clinical Extraction, complete and verified

## One-paragraph summary

Milestones 1–7 are done. The pipeline now runs all the way from
recording to a persisted, doctor-viewable **AI extraction draft**:
record → upload → queue → worker transcribes (WhisperX) and diarizes
(Pyannote) → persists the transcript → enqueues extraction → worker
calls a real LLM provider (Groq-hosted Llama, via the new
`packages/llm-client`) → persists a full §11-schema `ClinicalExtraction`
in `consultation_ai_results`. Verified twice, for real: `pnpm eval`
scored 12/13 checks (92%) against a hand-written two-speaker
consultation fixture, and the actual worker pipeline was run
end-to-end against real recorded audio, producing a correctly
mostly-empty extraction (the test audio was a spoken number sequence —
no clinical content, no hallucination). Two real bugs were found and
fixed during that verification (a client crash on empty response
bodies, and a resulting duplicate-data risk on retry — see today's log
entry). Also filed docs/adr/0010, formalizing an unflagged Milestone
5/6 deviation (the worker calls apps/api over HTTP, not by importing
NestJS use-cases as architecture.md §5 originally specified) before
extending that same pattern to extraction.

## What's built

- Milestones 1–6 — see their own log entries (repo scaffold; recording
  capture + consent UI; upload session API + storage; BullMQ queue +
  worker; real WhisperX transcription; Pyannote diarization, verified
  on real two-speaker audio at ~60% turn-level accuracy).
- Milestone 7 — Clinical Extraction:
  - **§11 schema finalized** — `packages/types/src/clinical-extraction.ts`
    (TS) and `packages/validation/src/clinical-extraction.schema.ts`
    (zod) mirror architecture.md §11 field-for-field; this same zod
    schema validates both the LLM's raw output and apps/api's
    persistence boundary — one schema, not two.
  - **`packages/llm-client`** — new shared workspace package: the LLM
    provider abstraction (architecture.md §10). `LlmProvider` interface,
    `GroqProvider` (JSON mode + zod-validate + one retry-with-feedback,
    since structured-output guarantees vary per vendor/model),
    `loadLlmProvider()` (env-var-driven selection, mirrors
    `asr-service`'s `_load_provider`). Shared (not duplicated) between
    the worker and the eval harness — see docs/adr/0010, 0011.
  - **`consultation_ai_results`** — new Drizzle schema + migration
    (matches architecture.md §12 exactly), repository, and three new
    use-cases/routes: `enqueue-extraction-job`, `create-extraction-result`,
    `get-extraction-result` (`POST :id/enqueue-extraction`,
    `POST/GET :id/extraction`).
  - **Worker wiring** — `workers/clinical-ai-worker/src/main.ts` now
    runs two `Worker`s (transcription, extraction). Transcription
    enqueues extraction right after persisting the transcript;
    extraction fetches the transcript, calls the LLM provider, persists
    the result. Includes an idempotency guard (skip if a transcript
    already exists) added after a real retry scenario exposed the need
    for one.
  - **`internal-api-client.ts`** — the worker's three near-duplicate
    HTTP client files (`asr-client.ts`/`recording-client.ts`/
    `transcript-client.ts`) consolidated into one, alongside the new
    extraction-related calls.
  - **`tests/eval`** — new workspace member, a real accuracy harness
    (not a stub): one hand-written two-speaker fixture + hand-labeled
    expectations, scored via `pnpm eval` against the real configured
    LLM provider. 12/13 checks passing on first real run.
  - **docs/adr/0010** — formalizes the worker-calls-apps/api-over-HTTP
    pattern (a Milestone 5/6 deviation from architecture.md §5 that
    went unflagged until now) as the deliberate approach for
    extraction too, including what happens to these client files at
    Repo B integration (deleted, not migrated — architecture.md §16
    already anticipated this exact ADR).
  - **docs/adr/0011** — records the single-pass extraction+SOAP choice,
    the JSON-mode+validate+retry strategy, and why the LLM provider
    abstraction lives in `packages/llm-client` rather than
    `apps/api/infrastructure/`.

## In progress

- Nothing — Milestone 7's scoped work is complete.

## Not started

- Milestone 8 (Review UI) and onward — see `docs/architecture.md` §18.
  Milestone 7 deliberately only built enough persistence/retrieval
  (`GET .../extraction`) to verify the pipeline works, not the actual
  doctor-facing review/edit/accept flow.
- Real Supabase Storage/Postgres integration — both are local
  stand-ins today (ADR-0007, ADR-0008).
- GPU inference — still deferred, see ADR-0009.
- Audio-level eval fixtures (raw audio → transcription WER) — needs
  real or de-identified audio plus hand-transcribed ground truth, a
  content task independent of the harness code built this milestone.

## Known issues / risks

- **Eval harness has one fixture so far, with one known miss** — a
  "gentle walking" activity recommendation wasn't captured in
  `activityRecommendations` on the first real run (12/13, 92%). Worth
  watching for a pattern across more fixtures before treating it as a
  prompt-quality issue worth fixing — one data point isn't enough yet.
- **Primary diarization model 403s** — `pyannote/speaker-diarization-3.1`
  fails because its dependency `pyannote/segmentation-3.0` needs its
  own separate gated-terms acceptance (not done). Not blocking — falls
  back to `pyannote/speaker-diarization-community-1`, which works
  (~60% turn-level accuracy, verified Milestone 6).
- **Restart can strand a job's DB status** — unchanged from Milestone
  4, still not fixed. (Milestone 7's own idempotency guard reduces one
  concrete instance of this — a retry after a false-failure now
  self-heals instead of straying — but the general risk for other
  failure modes is unchanged.)
- **Local stand-ins, not real infra**, still true for Postgres/Storage
  (ADR-0007, ADR-0008) — unchanged from Milestone 3.
- **ffmpeg is a new, undeclared operational dependency** — unchanged
  from Milestone 6, still not reflected in any Dockerfile/deployment
  tooling.
- Two decisions from Milestone 1 remain open pending legal/compliance
  input: cloud LLM data handling (ADR-0002) and the 90-day retention
  default (ADR-0004).

## Key decisions in effect

- STT provider: WhisperX — `docs/adr/0001-stt-provider-whisperx.md`
- LLM provider (MVP extraction): Groq-hosted Llama, verified working —
  `docs/adr/0002-llm-provider-groq-mvp.md`,
  `docs/adr/0011-llm-extraction-implementation-choices.md`
- Object storage (production target): Supabase Storage —
  `docs/adr/0003-object-storage-supabase.md`
- Audio retention: 90 days (proposed default) —
  `docs/adr/0004-audio-retention-90-days.md`
- UI font: Manrope, not the Marcellus/Figtree pairing in
  `ui-guidelines.md` — `docs/adr/0005-ui-font-manrope.md`
- RecordButton level-meter visual design —
  `docs/adr/0006-record-button-level-meter.md`
- Object storage (local dev stand-in): local disk, signed-URL-shaped —
  `docs/adr/0007-local-disk-storage-standin.md`
- Postgres (local dev stand-in): embedded PGlite —
  `docs/adr/0008-local-postgres-standin-pglite.md`
- Redis: real hosted Upstash instance (no local stand-in exists for
  BullMQ) — see `apps/api/.env.example` / `workers/
  clinical-ai-worker/.env.example`.
- WhisperX runtime: `small` model, CPU, int8 — GPU is a planned
  upgrade, not built — `docs/adr/0009-whisperx-runtime-config-cpu-small.md`
- Diarization: Pyannote, verified on real two-speaker audio (~60%
  turn-level accuracy) — running on the `speaker-diarization-community-1`
  fallback model (no ADR filed; this is the vendor architecture.md §9
  already specifies, not a new choice).
- Worker calls apps/api over HTTP, not by importing NestJS use-cases —
  `docs/adr/0010-worker-http-client-not-nestjs-import.md`.

## Next up

- Milestone 8 (Review UI) per `docs/architecture.md` §18:
  `ReviewDraftPanel`, `ConfidenceBadge`, `RiskFlagBanner`,
  `SoapNoteView`, edit state management (`useReviewDraft`),
  accept/discard flow against the stub CMS adapter.
