# ADR-0013: Single-model Gemini PoC (clinical-ai-single branch)

- Status: accepted
- Date: 2026-07-13
- Context: `clinical-ai-single` is a new branch testing whether one
  multimodal LLM (Gemini) can replace the whole
  transcribe→diarize→extract pipeline that today spans
  `python/asr-service` (WhisperX+Pyannote) and `packages/llm-client`'s
  `GroqProvider` (text-only extraction). Three implementation questions
  needed answers before writing any code: (1) call Gemini directly or
  through OpenRouter's unified API, (2) does Gemini replace
  `asr-service` or sit alongside it, and (3) which Gemini model.
- Decision:
  1. **Call Google's Gemini API directly, not through OpenRouter.**
     OpenRouter's audio support is new and normalizes every vendor to a
     lowest-common-denominator schema: `input_audio` only accepts
     base64 WAV/MP3 (no File API for long recordings, no `audio/webm`
     — this repo's recordings are stitched as webm), and its
     `response_format` is generic JSON mode, not Gemini's native
     `responseSchema`/`responseMimeType` constrained-output mode. Since
     this branch's entire purpose is judging Gemini's real capability,
     a passthrough layer that might silently degrade results would be
     a confound. `GeminiProvider` (`packages/llm-client/src/
     gemini-provider.ts`) calls `generativelanguage.googleapis.com`
     directly via `fetch`, no SDK — same "no vendor SDK outside the
     provider file" rule `GroqProvider` already follows.
  2. **Gemini replaces `python/asr-service` entirely for transcription,
     rather than being layered on top of it.** The worker
     (`workers/clinical-ai-worker/src/main.ts`) now calls
     `loadAudioTranscriptionProvider(env)` first; when it returns a
     provider (`LLM_PROVIDER=gemini`), the stitched audio goes straight
     to Gemini and the `asr-service` HTTP call is skipped entirely. The
     two-stage BullMQ pipeline (transcription queue → extraction queue)
     and the `TranscriptSegment`/`ClinicalExtraction` types are
     unchanged — only which provider implementation each stage uses
     differs. `LLM_PROVIDER=groq` still runs the classic
     WhisperX+Pyannote+Groq path unmodified, so the two pipelines can
     be A/B compared just by flipping the env var, and neither
     `asr-service` nor `GroqProvider` needed to change.
  3. **`gemini-2.5-flash`**, not `gemini-2.5-pro` or a `-preview` model
     — GA (not preview, so behavior won't shift under this PoC),
     1M-token context, and Google's own docs treat it as the default
     choice for audio-understanding tasks. `gemini-2.5-pro` remains the
     upgrade path if flash's extraction quality proves too weak (higher
     reasoning cost, same interface — a one-line model-string change).
  4. **Gemini labels speakers "Doctor"/"Patient" directly**, not
     generic "Speaker 1"/"Speaker 2" — unlike raw diarization, Gemini
     understands the conversation content (who's asking clinical
     questions vs. describing symptoms) well enough to identify roles
     itself, which is more reliable than the existing
     `labelDoctorAndPatient` heuristic's "first to speak = Doctor"
     guess (wrong whenever the patient speaks first). This required a
     small guard in that shared heuristic
     (`apps/api/.../doctor-patient-labeling.engine.ts`): it now leaves
     segments alone if they're already labeled exactly
     `{"Doctor","Patient"}`, instead of re-guessing and potentially
     flipping a correct semantic labeling. The guard is a no-op for the
     classic pipeline (WhisperX/Pyannote never emit those exact labels).
- Consequences:
  - Adding a third audio-capable vendor later (or swapping back to a
    Whisper+Pyannote+different-LLM combination) is one new file
    implementing `AudioTranscriptionProvider`/`LlmProvider`, selected
    via `LLM_PROVIDER` — no change to the worker's orchestration logic
    beyond the existing branch, matching architecture.md §10's
    provider-independence requirement.
  - `GeminiProvider.transcribeAudio` uses `inline_data` (base64,
    request-body-inline), capped at Gemini's 20MB request limit —
    fine for typical 20-45 min consultations at webm/opus bitrates, but
    **not yet wired to Gemini's File API**, so a long enough recording
    fails loudly (`MAX_INLINE_AUDIO_BYTES` check) rather than silently
    truncating. Switching to the File API is the fix if this trips in
    real testing.
  - Extraction JSON still uses generic `responseMimeType: application/
    json` + zod-validate + one retry (same pattern as `GroqProvider`,
    ADR-0011), not Gemini's `responseSchema` mode — the clinical
    extraction schema is large/deeply nested enough that hand-writing
    an equivalent OpenAPI-subset schema was deferred; the transcription
    step *does* use `responseSchema` since that shape is simple. Worth
    revisiting if extraction JSON conformance turns out to be a real
    problem in testing (unlike transcription, no data point yet either
    way).
  - Nothing in `python/asr-service` was touched — it remains the
    `LLM_PROVIDER=groq` path's provider, fully functional.
