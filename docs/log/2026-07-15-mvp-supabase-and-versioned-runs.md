---
date: 2026-07-15
task: mvp-supabase-and-versioned-runs
---

# PoC → MVP: real Supabase Postgres/Storage + versioned AI runs

## What changed

Moved off both local-dev stand-ins (PGlite, local-disk storage) onto a
real Supabase project, and redesigned the data model so AI extraction
is versioned per-run with full provider/cost/confidence metadata
instead of one table conflating the AI's output with the doctor's
review state. Also renamed the LLM provider abstraction to job-based
names (`ClinicalExtractionProvider`/`SpeechUnderstandingProvider`) and
added per-run provider selection, audio-metadata capture via ffprobe,
a derived analytics endpoint, and audit-log wiring for the review
lifecycle. Full reasoning in `docs/adr/0014-mvp-supabase-postgres-and-storage.md`.
**Verified against real infra**: migrations applied cleanly against a
real Supabase Postgres instance; Storage verified end-to-end
(`createSignedUploadUrl` → real `PUT` → `createSignedUrl` → real `GET`
→ cleanup), including creating the `consultation-audio` private bucket
itself via the SDK since it didn't exist yet. Also discovered the
user's project only had Supabase's current-generation API keys
(`sb_publishable_...`/`sb_secret_...`, not the legacy JWT-based
`anon`/`service_role` pair) — renamed `SUPABASE_SERVICE_ROLE_KEY` →
`SUPABASE_SECRET_KEY` throughout (`packages/config`,
`SupabaseStorageAdapter`, `.env`/`.env.example`) to match; confirmed via
Supabase's own docs that `sb_secret_...` is a documented drop-in
replacement for `service_role` with `createClient`, same permissions.

## Files touched

- `apps/api/src/infrastructure/database/client.ts` — PGlite branch
  removed entirely, `DATABASE_URL` required.
- `apps/api/src/infrastructure/database/schema/` — `consultation-ai-sessions.schema.ts`
  (new), `consultation-recordings.schema.ts` (session FK, audio
  metadata columns), `consultation-transcripts.schema.ts` (language/
  raw-response/latency columns), `consultation-ai-runs.schema.ts` (new,
  replaces `consultation-ai-results.schema.ts`), `consultation-reviews.schema.ts`
  (new), `consultation-ai-audit-log.schema.ts` (new, implements
  architecture.md §12's previously-unbuilt table).
- `apps/api/src/modules/clinical-ai/infrastructure/supabase-storage.adapter.ts`
  (new) — `local-disk-storage.adapter.ts`/`local-storage.controller.ts`
  deleted.
- `apps/api/src/modules/clinical-ai/infrastructure/` — new
  `consultation-ai-session.repository.ts`, `consultation-ai-run.repository.ts`
  (insert-only, transactional run+review creation), `consultation-review.repository.ts`,
  `consultation-ai-audit-log.repository.ts`; `consultation-ai-result.repository.ts`
  deleted.
- `apps/api/src/modules/clinical-ai/application/` — every use-case
  touching the old `consultation_ai_results` updated for the run/review
  split (`create-extraction-result`, `get-extraction-result`,
  `update-review-draft`, `accept-review-draft`, `discard-review-draft`);
  new `list-consultation-runs`, `get-consultation-run`,
  `get-consultation-analytics`, `update-recording-audio-metadata`
  use-cases; `start-recording`/`get-recording` updated for the new
  session hierarchy; audit-log calls added at consent/session-start/
  run-created/draft-edited/draft-accepted/draft-discarded.
- `apps/api/src/modules/clinical-ai/presentation/clinical-ai.controller.ts`
  — new `GET .../runs`, `GET .../runs/:runId`, `GET .../analytics`,
  `PATCH .../audio-metadata` routes; existing extraction routes return
  `ReviewDraft` instead of the old `ConsultationAiResult`.
- `packages/types/src/` — `consultation-ai-session.ts`, `consultation-ai-run.ts`,
  `consultation-review.ts` (new, includes the `ReviewDraft` DTO),
  `consultation-ai-audit-log.ts` (new); `consultation-recording.ts`/
  `consultation-transcript.ts` extended; `consultation-ai-result.ts`
  deleted.
- `packages/validation/src/` — `createExtractionResultSchema` gains
  provider/model split + metadata fields; `createTranscriptSchema`
  gains language/raw-response fields; new `updateRecordingAudioMetadataSchema`.
- `packages/llm-client/src/` — `types.ts` (interfaces renamed +
  metadata envelopes), `load-provider.ts` (renamed functions,
  `providerOverride` param, `EXTRACTION_PROVIDER`/`SPEECH_PROVIDER`
  split), `gemini-provider.ts`/`groq-provider.ts` (implement renamed
  interfaces, capture latency/tokens/retry/raw-response — Gemini also
  now reports `codeSwitched`), `prompt.ts` (new `EXTRACTION_PROMPT_VERSION`).
- `packages/config/src/worker-env.ts` — `LLM_PROVIDER` split into
  `EXTRACTION_PROVIDER`/`SPEECH_PROVIDER`; `api-env.ts` — `DATABASE_URL`
  required, `PGLITE_DATA_DIR`/`STORAGE_DRIVER`/`STORAGE_LOCAL_DIR`/
  `STORAGE_SIGNED_URL_SECRET` removed, `SUPABASE_URL`/
  `SUPABASE_SECRET_KEY`/`SUPABASE_STORAGE_BUCKET` added.
- `workers/clinical-ai-worker/src/main.ts`/`internal-api-client.ts` —
  updated for renamed providers + `requestedProvider`; new
  `getAudioMetadata` (ffprobe) + `updateRecordingAudioMetadata` call.
- `apps/web/src/features/clinical-ai/` — `ReviewDraftPanel.tsx`/
  `useReviewDraft.ts`/`recording.service.ts` updated for `ReviewDraft`;
  panel header now shows `Run {n} · {provider}/{model}`.
- Migration history regenerated clean: `0000_fast_master_mold.sql`
  (7 tables) replaces the previous 5 PGlite-only migrations.

## Decisions made

- All four non-obvious calls (stand-in removal, run/review split +
  session naming, provider renaming + per-run selection, Gemini-only
  deployment scope) captured in ADR-0014 rather than here.
- `tests/eval/src/run-eval.ts` had a pre-existing typecheck break
  (missing `GEMINI_API_KEY`/`GEMINI_MODEL` in a `loadLlmProvider` call
  from the prior session's Gemini work) — fixed as part of this task
  since it blocked a clean workspace-wide typecheck, then updated again
  for the provider rename.

## Follow-ups / left undone

- Full pipeline (record → upload → transcribe → extract → review) not
  yet run against the new schema end-to-end — only migrations were
  verified directly; no live recording has gone through
  `consultation_ai_sessions`/`consultation_ai_runs`/`consultation_reviews`
  yet.
- `estimatedCostUsd` is always `null` in both providers — needs a
  maintained per-model pricing table for Groq/Gemini, deliberately not
  guessed.
- Gemini's File API for audio over the ~19MB inline-request cap —
  still not addressed (ADR-0013's original follow-up).
- Column-level encryption for clinical jsonb data (architecture.md
  §15) — still undecided, now covers a larger surface (`raw_response`
  on two tables) per ADR-0014's consequences.
