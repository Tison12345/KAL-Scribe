---
date: 2026-08-12
task: transcription-token-tracking
---

# Track transcription token usage, matching extraction

## What changed

`GeminiProvider.transcribeAudio()` was discarding Gemini's
`usageMetadata` from every transcription response, even though
`extractClinicalData()` already captured and persisted the same field
for extraction. Found this while manually querying
`consultation_ai_runs` to answer "how many tokens has this project
used" — extraction's numbers were all there, transcription's weren't
recorded anywhere at all. Added the same capture pattern extraction
already used: `SpeechUnderstandingMetadata` gained
`inputTokens`/`outputTokens`/`totalTokens`, populated from
`promptTokenCount`/`candidatesTokenCount`/`totalTokenCount`, threaded
through the worker, `apps/api`, and a new migration.

## Files touched

- `packages/llm-client/src/types.ts` — `SpeechUnderstandingMetadata` gained the three token fields
- `packages/llm-client/src/gemini-provider.ts` — `transcribeAudio()` now captures `usage` from `generate()` (was discarding it) and populates the new metadata fields
- `packages/types/src/consultation-transcript.ts` — `ConsultationTranscript`/`CreateTranscriptRequest` gained the three fields
- `packages/validation/src/consultation-transcript.schema.ts` — `createTranscriptSchema` gained the three fields
- `apps/api/src/infrastructure/database/schema/consultation-transcripts.schema.ts` — three new nullable integer columns; migration `0002_green_quasimodo.sql`
- `apps/api/src/modules/clinical-ai/application/create-transcript.use-case.ts` — passes the three fields through to the repository
- `apps/api/src/modules/clinical-ai/application/get-transcript.use-case.ts`, `relabel-transcript-speakers.use-case.ts` — include the three fields in the returned `ConsultationTranscript`
- `workers/clinical-ai-worker/src/main.ts` — reads `result.metadata.inputTokens/outputTokens/totalTokens` and passes them into `createTranscript()`

## Decisions made

- Mirrored `ClinicalExtractionMetadata`'s existing token-field pattern
  exactly (same field names, same nullable-until-reported semantics)
  rather than inventing a new shape — consistency with an established
  precedent already in the codebase.
- Did not add `estimatedCostUsd` to the transcription side — extraction
  already leaves this `null` everywhere with a documented follow-up
  ("needs a maintained pricing table"), so adding a half-finished cost
  field to transcription too would just duplicate that same gap twice.

## Follow-ups / left undone

- Not yet verified against a live recording (migration hasn't run
  against a real transcription job yet — applies automatically on the
  next `apps/api` boot, same as every other migration in this repo).
- `estimatedCostUsd` remains unbuilt for both transcription and
  extraction — still needs a maintained per-model pricing table.
