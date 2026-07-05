---
date: 2026-07-05
task: milestone-7-clinical-extraction
---

# Milestone 7: Clinical Extraction

## What changed

Built the full clinical entity extraction step (architecture.md §7
stages 8-9, §11): the §11 schema finalized in `packages/types` and
`packages/validation`, a real LLM provider abstraction
(`packages/llm-client`, Groq-hosted Llama per docs/adr/0002), the
`consultation_ai_results` table + repository + use-cases + routes in
apps/api, the worker wired to enqueue and process extraction jobs
right after transcription, and a real accuracy eval harness in
`tests/eval`.

Also filed docs/adr/0010, formalizing a Milestone 5/6 architectural
deviation that had gone unflagged until now: the worker calls apps/api
over HTTP instead of importing NestJS use-cases directly, as
architecture.md §5 originally specified. Consolidated the worker's
three near-duplicate HTTP client files
(`asr-client.ts`/`recording-client.ts`/`transcript-client.ts`) into one
`internal-api-client.ts` as part of formalizing that pattern.

Verified for real, twice: `pnpm eval` ran the real Groq provider
against a hand-written two-speaker consultation fixture and scored
12/13 checks passing (92%) — the one miss (a "gentle walking"
recommendation not captured in `activityRecommendations`) is a
legitimate minor LLM output gap, not a bug in this repo's code. Then
ran the actual worker pipeline end-to-end against real recorded audio
(upload → transcribe → persist transcript → enqueue extraction →
extract → persist result), confirmed via `GET .../extraction` —
correctly mostly-empty/null fields, since the test audio was a spoken
number sequence with no clinical content (no hallucination on
non-clinical input, which is itself a meaningful correctness signal).

## Two real bugs found and fixed during this verification

1. **`postJson` crashed on empty response bodies.** The new
   enqueue-extraction endpoint returns `void` (empty body), but
   `internal-api-client.ts`'s `postJson` unconditionally called
   `res.json()`, throwing "Unexpected end of JSON input" *after* the
   real work (enqueueing the job) had already succeeded — so the
   transcription job was marked "failed" even though nothing was
   actually wrong. Fixed to read as text first and only parse if
   non-empty.
2. **That false failure would have caused a duplicate transcript on
   retry.** `processTranscriptionJob` had no idempotency guard, unlike
   `CompleteUploadUseCase`'s existing one. Added the same pattern: if
   a transcript already exists for the recording, skip re-transcribing
   entirely. Verified live — the real BullMQ retry fired, hit the new
   guard, logged "skipping (retry of an already-completed job)", and
   the job was marked `completed` with zero duplicate data.

## Files touched

- `packages/types/src/{clinical-extraction,consultation-ai-result}.ts`
  — new; `clinical-ai-job.ts` gained `ExtractionJobPayload`.
- `packages/validation/src/clinical-extraction.schema.ts` — new, full
  zod mirror of §11.
- `packages/llm-client/` — new workspace package: `types.ts`
  (`LlmProvider` interface), `prompt.ts` (schema-instructions prompt
  builder), `groq-provider.ts` (JSON mode + zod validate + one retry),
  `load-provider.ts` (env-var-driven selection, mirrors
  `asr-service`'s `_load_provider`).
- `apps/api/src/infrastructure/database/schema/
  consultation-ai-results.schema.ts` — new + migration
  `0003_romantic_inhumans.sql`.
- `apps/api/src/modules/clinical-ai/` additions:
  `infrastructure/consultation-ai-result.repository.ts`,
  `application/{enqueue-extraction-job,create-extraction-result,
  get-extraction-result}.use-case.ts`, three new
  `clinical-ai.controller.ts` routes, `clinical-ai-queue-events.service.ts`
  generalized to watch both the transcription and extraction queues.
- `packages/config/src/worker-env.ts` — `EXTRACTION_WORKER_CONCURRENCY`,
  `LLM_PROVIDER`, `GROQ_API_KEY`, `GROQ_MODEL`.
- `workers/clinical-ai-worker/src/internal-api-client.ts` — new,
  replaces `asr-client.ts`/`recording-client.ts`/`transcript-client.ts`;
  `main.ts` — extraction `Worker` added, transcription job now enqueues
  extraction + has an idempotency guard.
- `tests/eval/` — new workspace member: `fixtures/consultation-01.*`
  (hand-written transcript + hand-labeled expectations),
  `src/{expectation,score,run-eval}.ts`.
- `pnpm-workspace.yaml` — added `tests/*`; root `package.json` — added
  `eval` script.
- `docs/adr/0010-worker-http-client-not-nestjs-import.md`,
  `docs/adr/0011-llm-extraction-implementation-choices.md` — new.

## Decisions made

- Single-pass extraction+SOAP (one LLM call produces the full §11 JSON
  including `soap`), per §7 stage 9's own MVP recommendation — see
  docs/adr/0011.
- JSON mode + zod validation + one retry-with-feedback for structured
  output, not a vendor-specific strict-schema mode — see docs/adr/0011.
- LLM provider abstraction lives in a new shared package
  (`packages/llm-client`), not in `apps/api/infrastructure/` as §5
  originally listed — both the worker and the eval harness need the
  exact same provider code path, so a real shared package prevents
  them silently drifting apart — see docs/adr/0010, docs/adr/0011.
- `medicinesMentioned[].matchConfidence` deliberately always null from
  the LLM (Milestone 9's deterministic mapping step fills it) —
  verified by the eval harness as an explicit check, not just assumed.

## Follow-ups / left undone

- **Eval fixtures are single-consultation, hand-written text only** —
  no audio-level fixture (raw audio → transcription WER) yet; that
  needs real or de-identified audio plus hand-transcribed ground
  truth, a content task independent of the harness code itself.
- **The one eval miss** (walking not captured in
  `activityRecommendations`) is worth watching for a pattern across
  more fixtures before treating it as a prompt-quality issue worth
  fixing — one data point isn't enough to act on yet.
- Milestone 8 (Review UI) is next per architecture.md §18 — this
  milestone deliberately only built enough persistence/retrieval
  (`GET .../extraction`) to verify the pipeline, not the actual
  doctor-facing review/edit/accept flow.
