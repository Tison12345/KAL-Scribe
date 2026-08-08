# ADR-0017: Remove the classic WhisperX+Pyannote pipeline entirely

- Status: accepted
- Date: 2026-08-09
- Context: The pipeline has run two parallel speech-understanding
  paths since Milestone 5: `python/asr-service` (FastAPI + WhisperX +
  Pyannote, ADR-0001/0009/0012) and, once Gemini's audio-native
  transcription+diarization landed (ADR-0013), a Gemini path selected
  via `SPEECH_PROVIDER`. Gemini has been the deployed default for some
  time; the classic path had no active callers, no scheduled
  maintenance, and existed only as an unused fallback branch
  (`workers/clinical-ai-worker/src/main.ts`'s `else` branch when
  `loadSpeechUnderstandingProvider` returned `null`). The user is
  submitting this repo for review and explicitly wants no unused
  legacy pipeline code in `main` — a separate `classic-pipeline` git
  branch already preserves the removed code in full, independent of
  any change here, so nothing is lost by deleting it from the active
  branch.
- Decision: Delete `python/asr-service/` entirely and remove every
  code path, type, config var, and DB column that only existed to
  support it or to make it optional:
  - `packages/llm-client/src/load-provider.ts`'s
    `loadSpeechUnderstandingProvider` now always returns a Gemini
    provider (no `null` return, no `SPEECH_PROVIDER` selector — Gemini
    is the only implementation of `SpeechUnderstandingProvider` today).
  - `workers/clinical-ai-worker/src/main.ts`'s `if (speechProvider) {
    ... } else { processAudio(...) }` branch collapses to
    straight-line code; the `sttDevice` job-payload field and the
    `processAudio`/asr-service HTTP client
    (`internal-api-client.ts`) are gone.
  - `SttDevice`, `SpeakerTurn`, and `ProcessAudioResponse` are removed
    from `packages/types`; `sttDevice` is removed from
    `ConsultationRecording`, `StartRecordingRequest`,
    `TranscriptionJobPayload`, the validation schema, and the four
    `apps/api` use-cases that plumbed it through.
  - `consultation_recordings.stt_device` (and its `stt_device` pg enum)
    is dropped via a new migration
    (`0001_yummy_meggan.sql`) — this is a real schema change, not just
    a type change, since the column already exists on the live DB.
  - `ASR_SERVICE_URL` and `SPEECH_PROVIDER` are removed from
    `packages/config/src/worker-env.ts` and both `.env.example` files.
- Consequences:
  - Gemini is now a hard dependency for transcription — there is no
    fallback if `GEMINI_API_KEY` is unset (same "fail loudly" posture
    `loadClinicalExtractionProvider` already had for `groq`/`gemini`).
    This was already true in practice (nothing configured
    `SPEECH_PROVIDER` unset in any active deployment), just not
    reflected in the code's own types until now.
  - The `stt_device` migration must run before/alongside this deploy
    (`runMigrations` already runs automatically on `apps/api` boot —
    `database.module.ts` — no manual step needed beyond starting the
    service).
  - `TranscriptSegment` itself, and its `originalText`/`originalLanguage`
    fields from ADR-0016, are unchanged — they were never
    WhisperX-specific, only their now-deleted null-fill-in in the
    classic branch went away with it.
  - The classic pipeline's full history and code remain recoverable
    from the `classic-pipeline` git branch, untouched by this change.
  - ADR-0001, ADR-0009, and ADR-0012 are marked superseded by this ADR
    (status line updated in place, content otherwise left as accurate
    history — same convention ADR-0012 already used when it superseded
    ADR-0009).
