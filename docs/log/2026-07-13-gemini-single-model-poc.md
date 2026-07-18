---
date: 2026-07-13
task: gemini-single-model-poc
---

# Wire up Gemini as a single-model pipeline (clinical-ai-single branch)

## What changed

New branch, new goal: test whether one multimodal LLM (Gemini) can do
transcription, diarization, and clinical extraction in place of the
existing WhisperX+Pyannote+Groq pipeline. Investigated OpenRouter as an
alternative access path first (it does support Gemini audio input now)
but chose to call Google's Gemini API directly instead — see ADR-0013
for the full reasoning. Built `GeminiProvider`, a new provider
implementing both the existing `LlmProvider` interface (clinical
extraction, same contract as `GroqProvider`) and a new
`AudioTranscriptionProvider` interface (audio → speaker-labeled
transcript, replacing `python/asr-service` for this pipeline mode).
Wired it into the worker so `LLM_PROVIDER=gemini` skips the
`asr-service` HTTP call entirely and routes audio straight to Gemini,
while `LLM_PROVIDER=groq` keeps running the classic pipeline unchanged.

**Verified against a real recording** (not simulated): reused the
existing ~7m19s digestion-consultation recording already sitting in
local storage (`apps/api/.data/storage/recordings/13ce5a3b-...`, the
same one referenced in the 2026-07-07 headers-timeout log entry),
stitched via ffmpeg exactly like `fetchAndStitchRecordingAudio` does,
and ran `GeminiProvider.transcribeAudio` + `.extractClinicalData`
directly against it with a throwaway script (not committed). Result:
transcription in 42.3s, 80 correctly Doctor/Patient-labeled segments
with second-level timestamps, extraction in 34.6s producing a
schema-conforming, clinically coherent draft on the first attempt (no
retry needed) — correct chief complaints, correct
`modernDiagnosis: "Hyperacidity; Constipation"` (the doctor did state
this aloud, so populating it is correct per the schema's clinical-safety
rule), all three prescribed medicines with correct dosages/timing/
duration, every physical-examination field (`ashtavidhaPariksha` etc.)
correctly left null since the doctor never stated an exam finding aloud
in this consultation, and `followUpValue: 3, followUpUnit: "days"`
matching "come back to me in three days." One oddity: a ~40s gap in
segment coverage around 60s-100s in the transcript with no obvious
silence to explain it — worth another pass to determine if Gemini
dropped audio there or the source recording genuinely had a gap.

## Files touched

- `packages/llm-client/src/gemini-provider.ts` — new: `GeminiProvider`,
  calls `generativelanguage.googleapis.com` directly (no SDK).
- `packages/llm-client/src/types.ts` — added `AudioTranscriptionProvider`/
  `AudioTranscriptionRequest`/`AudioTranscriptionResult`.
- `packages/llm-client/src/load-provider.ts` — `loadLlmProvider` now
  accepts `LLM_PROVIDER=gemini`; new `loadAudioTranscriptionProvider`
  (returns null for providers that can't do audio, e.g. Groq).
- `packages/llm-client/src/index.ts` — exported the new types/provider.
- `packages/llm-client/package.json` — added `@types/node` (needed for
  the `Buffer` type in the new audio-request interface).
- `packages/config/src/worker-env.ts` — added `GEMINI_API_KEY`/
  `GEMINI_MODEL`.
- `workers/clinical-ai-worker/src/main.ts` — transcription stage tries
  `loadAudioTranscriptionProvider` first, falls back to the existing
  `asr-service` call when it returns null; extraction stage passes the
  new env vars through.
- `apps/api/src/modules/clinical-ai/domain/doctor-patient-labeling.engine.ts`
  — guard added so the "first to speak = Doctor" heuristic doesn't
  overwrite segments Gemini already labeled semantically (see
  ADR-0013 point 4).
- `workers/clinical-ai-worker/.env` / `.env.example` — `GEMINI_API_KEY`/
  `GEMINI_MODEL=gemini-2.5-flash` added; `.env`'s `LLM_PROVIDER` set to
  `gemini`.
- `docs/adr/0013-gemini-single-model-poc.md` — new ADR covering all four
  non-obvious calls made this task.

## Decisions made

- All captured in ADR-0013 (direct API vs. OpenRouter, replace vs.
  layer onto `asr-service`, model choice, semantic speaker labeling) —
  promoted there rather than left here since they're significant enough
  to matter for the branch's future direction.
- Extraction retains the existing generic JSON-mode + zod-validate +
  retry pattern (not Gemini's `responseSchema`) since the clinical
  extraction schema is large enough that hand-writing an equivalent
  OpenAPI-subset schema felt premature before knowing if it's even
  needed — transcription's simpler shape does use `responseSchema`.

## Follow-ups / left undone

- **Not yet run through the actual BullMQ worker/queue pipeline** — the
  verification above called `GeminiProvider` directly against a
  stitched file, bypassing the queue, `createTranscript`,
  `persistExtractionResult`, and the review UI entirely. Those code
  paths are unchanged from the working classic pipeline, but a genuine
  recording → upload → queue → `ReviewDraftPanel` click-through with
  `LLM_PROVIDER=gemini` hasn't happened yet.
- The ~40s unexplained gap in transcript segment coverage (60s-100s)
  noted above is worth investigating — could be a genuine silence in
  the source recording or Gemini dropping audio, unknown which yet.
- Gemini's File API (for recordings over the ~19MB inline-audio safety
  cap) isn't implemented — `GeminiProvider.transcribeAudio` fails
  loudly instead, per ADR-0013.
- The API key pasted into chat mid-session while listing available
  models should be rotated once testing wraps up (it's in `.env`, which
  is git-ignored, but it was also visible in conversation history).
