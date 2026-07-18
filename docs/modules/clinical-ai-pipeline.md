---
module: clinical-ai-pipeline (recording capture -> chunking -> upload -> transcription -> extraction -> review)
last_updated: 2026-07-18
---

# Clinical AI Pipeline — end-to-end technical walkthrough

> Rewritten in place as the pipeline changes — this is a *living* doc,
> describing the system **as it actually runs today**, not the
> original plan. For the original design blueprint and rationale, see
> `docs/architecture.md`. For why specific technical choices were made
> (Gemini, Supabase, pg-boss, the extraction schema itself), see
> `docs/adr/0013`–`0015` and `docs/modules/clinical-extraction-schema.md`.
> For the current project state, see `docs/PROJECT_STATUS.md`.

## Purpose

This document is the detailed "how does this actually work" reference:
what's used at each stage, exactly how audio gets chunked/uploaded/
stitched, and exactly how the LLM turns a transcript into a structured
clinical record. It exists because `docs/architecture.md`'s pipeline
sections (§3, §7, §8, §9) describe the *original pre-build design*
and have since been substantially superseded by real implementation
decisions — rather than rewriting that historical document line by
line, this doc is the current, accurate replacement for "how the
pipeline works," cross-referenced from `architecture.md` at each stale
section.

## Tech stack, as actually deployed

| Concern | What's used | Notes |
|---|---|---|
| Frontend | Next.js (`apps/web`) | Recording capture, review UI |
| Backend API | NestJS (`apps/api`) | Recording/upload sessions, job orchestration, all domain logic |
| Background worker | Plain Node/TypeScript (`workers/clinical-ai-worker`) | Separate process — consumes queue jobs, never runs inside `apps/api`'s HTTP server |
| Database | Postgres (Supabase-hosted) via Drizzle ORM | No local dev stand-in — ADR-0014 |
| Object storage | Supabase Storage | Signed upload/read URLs only, browser never gets a permanent URL |
| Job queue | **pg-boss** (Postgres-native) | Not Redis/BullMQ — ADR-0015 |
| Speech understanding (transcription + diarization) | **Google Gemini** (`gemini-2.5-flash` by default), audio-native | One call handles both — ADR-0013 |
| Clinical extraction | **Google Gemini** (`gemini-2.5-flash` by default) | Selected via `EXTRACTION_PROVIDER` |
| Validation | Zod (`packages/validation`) | Every LLM output is schema-validated post-hoc, regardless of vendor "JSON mode" guarantees |

The two provider interfaces (`SpeechUnderstandingProvider`,
`ClinicalExtractionProvider`, `packages/llm-client/src/types.ts`) are
selected independently via `SPEECH_PROVIDER` and `EXTRACTION_PROVIDER`
env vars — a single vendor doesn't have to fill both roles.

## End-to-end flow

```
Doctor clicks Record
  -> useAudioRecorder (browser MediaRecorder) cuts a new
     independently-playable audio segment every 15s
  -> useUploadSession uploads each segment ("chunk") to Supabase
     Storage the moment it's produced, concurrently, via a
     short-lived signed PUT URL apps/api issues per chunk
  -> Doctor clicks Stop -> apps/api finalizes the recording
     (status: uploaded) and enqueues a "transcription" job on pg-boss
  -> workers/clinical-ai-worker picks up the job:
       - fetches every chunk sequentially (stops at the first
         missing/404 chunk) and stitches them into one file with
         ffmpeg (stream-copy concat, no re-encode)
       - sends that stitched audio directly to Gemini, which returns
         a speaker-labeled, timestamped transcript in one call
       - persists the transcript via apps/api, then enqueues an
         "extraction" job
  -> worker picks up the extraction job:
       - fetches the persisted transcript (text, not audio)
       - sends it to the clinical-extraction provider (Gemini or
         Groq) with a detailed prompt describing the exact CMS-shaped
         JSON schema to fill in
       - validates the response against a Zod schema; retries once
         with a corrective message if it doesn't validate
       - persists the result as a new consultation_ai_runs row
         (immutable) + a paired consultation_reviews row (status:
         draft, mutable)
  -> Doctor opens ReviewDraftPanel: sees the AI draft, every field
     visually marked as AI-suggested (never pre-authoritative), edits
     inline, and Accepts or Discards
  -> Accept calls the CMS integration adapter (stubbed until real CMS
     integration, docs/architecture.md §17) to create the real
     prescription record
```

Every stage's status (`queued -> active -> completed | failed |
dead_letter`) is tracked per-job in `consultation_ai_jobs` and surfaced
live in the UI via `PipelineProgressTracker`/`usePipelineProgress` — a
doctor watching the screen sees real stage transitions, not a fake
progress bar.

---

## 1. Recording and chunking (browser)

**File:** `apps/web/src/features/clinical-ai/hooks/useAudioRecorder.ts`

The browser's native `MediaRecorder` API is used directly (no
third-party recorder library). Mimetype is picked in priority order —
`audio/webm;codecs=opus` → `audio/webm` → `audio/ogg;codecs=opus` →
`audio/mp4` — using the first one `MediaRecorder.isTypeSupported()`
accepts; in Chromium this resolves to **`audio/webm;codecs=opus`**.
The mimetype is always set explicitly because Chromium can otherwise
default an audio-only stream to `video/webm`, which breaks `<audio>`
playback later.

### Why chunking doesn't use `MediaRecorder`'s built-in `timeslice` mode

Calling `recorder.start(timesliceMs)` looks like the obvious way to
get periodic chunks, but only the *first* emitted blob in that mode
carries the WebM container header — every later periodic blob is a
raw fragment of one continuous encoded stream, not an independently
decodable file. Since a chunk must be a genuinely standalone-playable
file (so an upload failure partway through a recording never corrupts
anything already uploaded), the hook instead:

1. Starts a **fresh `MediaRecorder` instance** on the same live
   `MediaStream` for each segment (`beginSegment`).
2. Sets a timer for the chunk interval; when it fires, calls `.stop()`
   on the current recorder — which flushes one complete,
   independently-decodable file via `ondataavailable` — and
   immediately starts a new `MediaRecorder` on the same stream, so
   capture is continuous with no audible gap between segments.

**Chunk interval: 15 seconds** (`DEFAULT_CHUNK_INTERVAL_MS = 15_000`),
purely time-based (a timer), not a byte-size threshold — overridable
via the hook's `chunkIntervalMs` option. The 15s figure is chosen so a
crash or connectivity drop loses at most one chunk's worth of audio,
not the whole consultation.

Each chunk (`AudioChunk`) carries a monotonically increasing
`sequence` number (`0, 1, 2, ...`), the audio `Blob`, and a
`recordedAt` timestamp. The sequence number is the contract the rest
of the pipeline depends on for reassembly and for detecting "end of
recording" (see §3 below).

Pause/resume keeps the microphone stream and `AudioContext` alive
(just stops the active `MediaRecorder` segment) so resuming doesn't
re-prompt for mic permission. A live level meter (RMS of a Web Audio
`AnalyserNode`'s time-domain samples) runs off the same stream,
unrelated to chunking itself.

## 2. Upload (browser → Supabase Storage, direct)

**Files:** `apps/web/src/features/clinical-ai/hooks/useUploadSession.ts`,
`.../services/recording.service.ts`,
`apps/api/.../application/request-chunk-upload.use-case.ts`,
`apps/api/.../infrastructure/supabase-storage.adapter.ts`

`useUploadSession` watches the chunk array `useAudioRecorder` produces
and uploads every new chunk **independently and concurrently** the
moment it appears — one chunk's failure never blocks another, and a
failed chunk can be retried individually.

Per chunk:

1. Browser calls `POST /clinical-ai/recordings/:id/chunks` with
   `{ sequence }`. `RequestChunkUploadUseCase` validates the recording
   is in `recording`/`uploading` status (transitioning to `uploading`
   on the first chunk), builds a deterministic storage key —
   `recordings/{recordingId}/chunk-{sequence, zero-padded to 6}.webm`
   — and asks `SupabaseStorageAdapter.createUploadTarget()` for a
   signed upload URL (Supabase's `createSignedUploadUrl`, 15-minute
   expiry). Returns `{ uploadUrl, method: 'PUT', expiresAt }`.
2. The browser does **`fetch(uploadUrl, { method: 'PUT', body: blob
   })`** straight to Supabase Storage — `apps/api` never sees or
   proxies the audio bytes. This is the signed-URL model
   (`docs/architecture.md` §14): the API's only job is issuing
   short-lived, scoped URLs.

When the doctor stops recording (and every chunk has finished
uploading), the browser calls `POST /clinical-ai/recordings/:id/complete`
with the total duration. `CompleteUploadUseCase` is **idempotent** (a
retried request against an already-`uploaded`/`processed` recording is
a no-op returning current state — this is what stops a duplicate
transcription job from ever being enqueued), sets `storageKey =
recordings/{recordingId}/` (the *folder*, not a stitched file —
stitching happens later, worker-side), and enqueues a `transcription`
job on pg-boss carrying `{ jobId, recordingId, storageKey, sttDevice }`.

## 3. Worker-side fetch + stitch

**File:** `workers/clinical-ai-worker/src/internal-api-client.ts`,
function `fetchAndStitchRecordingAudio`

The worker doesn't know how many chunks a recording has — it finds
out by **fetching sequentially and stopping at the first gap**:

```
for (let sequence = 0; ; sequence++) {
  const audio = await fetchChunkAudio(apiBaseUrl, recordingId, sequence);
  if (audio === null) break;   // <- "no more chunks" signal
  ...
}
```

`fetchChunkAudio` calls `GET /clinical-ai/recordings/:id/chunks/:sequence/read-url`.
If that chunk doesn't exist, `RequestChunkReadUseCase` returns a real
HTTP **404** (translated from Supabase's "object not found" storage
error via a dedicated `StorageObjectNotFoundError` — see
`docs/adr/0015`'s consequences section for the bug this fixed), and
the worker's HTTP helper (`getJson`) returns `null` on any 404 rather
than throwing. A 404 on either the read-URL request *or* the
subsequent signed-URL download both mean "no more chunks" — this is
the entire "how many chunks are there" mechanism: no chunk count is
ever transmitted or stored anywhere, contiguous sequence numbers
starting at 0 are the only source of truth.

Each fetched chunk is written to a temp directory
(`kal-scribe-stitch-*`) as `chunk-000000.webm`, `chunk-000001.webm`,
etc. If there's exactly one chunk, it's used as-is (no ffmpeg needed).
If there's more than one, the worker writes an ffmpeg concat-demuxer
list file and runs:

```
ffmpeg -f concat -safe 0 -i concat-list.txt -c copy stitched.webm
```

**`-c copy`** — stream-copy concatenation, no re-encoding. This is
valid because every chunk in a recording was produced by the same
`MediaRecorder`/Opus session with identical codec parameters. The
whole temp work directory (including all individual chunk files and
the stitched output) is deleted in a `finally` block once the worker
is done reading it, whether transcription succeeded or failed.

## 4. Transcription (speech understanding)

**File:** `workers/clinical-ai-worker/src/main.ts` (`processTranscriptionJob`),
`packages/llm-client/src/gemini-provider.ts`

`GeminiProvider.transcribeAudio()` is called directly on the stitched
buffer — **no separate STT or diarization service runs at all**. The
audio is sent as inline base64 bytes in a single Gemini
`generateContent` call:

```json
{ "inline_data": { "mime_type": "audio/webm", "data": "<base64>" } }
```

alongside a short instruction to transcribe and diarize. This call
uses Gemini's native `responseSchema` (JSON-schema-constrained
output) — the schema requires each segment to have a `speaker` field
constrained to the enum `["Doctor", "Patient"]`, so Gemini itself
enforces the two-speaker labeling shape, not a post-hoc heuristic.
Gemini labels speakers **semantically** (who's asking clinical
questions vs. answering them), not by turn-order guessing.

Capped at **19MB** of inline audio (`MAX_INLINE_AUDIO_BYTES`, Gemini's
hard `inline_data` limit is 20MB — the code leaves headroom and throws
rather than silently truncating a longer recording; Gemini's File API
for larger audio isn't implemented yet, a known follow-up).

The result — a `TranscriptSegment[]` of `{ speaker, text, start, end }`
— is persisted via `POST /clinical-ai/recordings/:id/transcript` as a
`consultation_transcripts` row, along with `languageDetected`,
`isMultilingual`/`isCodeSwitched`, the raw provider response, and
transcription latency (`sttProvider`/`diarizationProvider` are both
recorded as `"gemini/{model}"`, since one model does both jobs). The
worker then immediately enqueues the `extraction` job for the same
recording.

## 5. Clinical extraction

**Files:** `packages/llm-client/src/gemini-provider.ts` (`extractClinicalData`),
`packages/llm-client/src/prompt.ts`, `packages/types/src/clinical-extraction.ts`,
`packages/validation/src/clinical-extraction.schema.ts`

This is a **separate, later call** — it happens during
`processExtractionJob`, a different queue job than transcription, and
it operates on the **persisted transcript text**, not the raw audio.
Even Gemini, which is perfectly capable of understanding audio
directly, is never given the audio again at this stage — extraction is
always text-in/JSON-out.

### The prompt

`buildExtractionPrompt(segments)` renders the transcript as plain text,
one line per segment: `[index] [mm:ss–mm:ss] Speaker: text` — the
bracketed index is what the model references back in
`transcriptReference.segmentsUsed`, since transcript segments have no
separate stable id. The system message instructs the model to act as
"a clinical documentation assistant... you never fabricate clinical
facts, and you follow the requested JSON shape exactly," followed by a
long, explicit schema-instructions block that mirrors the real CMS
form's field names and controlled-vocabulary option lists directly
(dosha combinations, agni's fixed 4-value set, bowel/bladder/sleep/
appetite/exercise/addiction option sets, medicine dosage units,
treatment stroke-direction/pressure/oil-temperature categories, etc.)
— see `docs/modules/clinical-extraction-schema.md` for the full
field-by-field derivation against the actual CMS source.

**The extraction call does not use Gemini's native `responseSchema`**
(unlike the transcription call above) — only `responseMimeType:
"application/json"` is set; the large `ClinicalExtraction` shape is
enforced entirely through prompt instructions, then validated
post-hoc with Zod. `GroqProvider` follows the identical pattern with
Groq's generic JSON mode. The reasoning, stated directly in the code:
vendor structured-output guarantees vary in strength per model, so
"valid JSON" is trusted from the API, but "matches our schema" is
never assumed — it's checked explicitly every time.

### Hallucination-avoidance rules (in the prompt's own stated priority order)

1. **Never infer physical-exam findings.** Every Ashtavidha Pariksha
   field, Srotas Pariksha, Prakrithi, Dosha, Aama, Agni, Ojas — all of
   these may only be populated if the doctor states the finding out
   loud (e.g. "pulse shows Vata Pitta"). Never derived from symptoms
   or context alone.
2. **`modernDiagnosis` is conservative by design** — it's shown
   directly to the patient, so it's populated only if the doctor names
   or clearly characterizes the condition, never inferred from
   symptoms with no doctor framing.
3. **`medicines[].matchConfidence` is always `null` from the LLM** —
   filled later by a separate deterministic fuzzy-match step against
   the CMS's medicine master list, never guessed by the model.
4. **`gynec` stays `null`** unless the patient is clearly female *and*
   something gynecological was actually discussed — never inferred
   from voice/gender alone.
5. **`familyHistory`** is `null` if nothing was mentioned; only 7
   canonical disease keys are allowed, anything else routes into a
   single `"_other"` key rather than inventing new keys.
6. Arrays default to `[]` (never `null`); nullable scalars default to
   `null` (never `""`) when unstated.
7. **`clinicalNotes` must always be non-empty** (2–4 sentences) — the
   one field required to never be empty, even when everything else is
   sparse, since it's the doctor-only working note.

`EXTRACTION_PROMPT_VERSION` is persisted per run
(`consultation_ai_runs.prompt_version`) so a prompt wording change is
measurable, not silent.

### Confidence

`aiConfidence` (`overall: 0–1`, `perField: Record<string, 0–1>`,
`lowConfidenceReason: string | null`) is **self-reported by the
model** — there's no separate deterministic confidence-scoring pass.
This is deliberately kept distinct from `matchConfidence` (see rule 3
above): `aiConfidence` answers "did the model understand the
consultation," `matchConfidence` answers "does this free-text medicine
name match our formulary" — two different questions, only one of
which the LLM is trusted to answer. `riskFlags` gives the model an
explicit outlet (`incomplete_info`, `possible_medicine_conflict`,
`red_flag_symptom`, `other`, each with a severity) to flag uncertainty
rather than silently guessing to fill a field.

### Validation and retry

Both providers implement the same pattern:

1. Call the LLM, `JSON.parse` the response text.
2. Overwrite `transcriptReference.consultationTranscriptId`
   server-side — never trust the model to echo the id back correctly.
3. Validate against `clinicalExtractionSchema` (Zod) with
   `.safeParse()`.
4. **On parse or validation failure: exactly one retry.** The failed
   response plus a corrective message — *"That JSON did not match the
   required schema: {error}. Return the corrected, complete JSON
   object only."* — is appended to the conversation and resent.
5. If the retry also fails validation, the call **throws** — no
   infinite loop. This becomes a job failure that pg-boss's own
   retry/backoff/dead-letter mechanism (`docs/architecture.md` §13)
   takes over from there.
6. `retryCount` and `hadValidationRetry` are recorded on the resulting
   `consultation_ai_runs` row, so a validation retry is auditable, not
   silently absorbed.

### Persistence

A successful extraction creates two rows **transactionally**: an
immutable `consultation_ai_runs` row (the AI's raw output, provider/
model/prompt-version/latency/token/cost metadata, the pre-parse raw
response) and a paired `consultation_reviews` row (`status: 'draft'`,
mutable doctor workflow state — edits go into a separate
`edited_extraction` column so the original AI output is never
overwritten). `run_number` increments per recording, so re-running
extraction against a different provider for comparison produces a new
run rather than replacing the old one — see `docs/adr/0014`.

## 6. Review and accept

**Files:** `apps/web/src/features/clinical-ai/components/ReviewDraftPanel.tsx`,
`.../hooks/useReviewDraft.ts`

The doctor sees the joined "latest run + its review" as a flat
`ReviewDraft`, with per-section confidence badges and risk-flag
banners so no AI-suggested field ever reads as already-authoritative.
Edits autosave (800ms debounce) into `edited_extraction`, never
touching the original `extraction`. Accept calls the CMS integration
adapter (currently stubbed — `docs/architecture.md` §16–17) to create
the real prescription record and marks the review `accepted`;
Discard marks it `discarded`. Both are mutually terminal (a discarded
draft can't later be accepted and vice versa).

## Open questions / known gaps

- Gemini's inline-audio 19MB cap means very long recordings will fail
  transcription outright — Gemini's File API (for larger uploads)
  isn't implemented yet.
- `medicines[].matchConfidence`'s deterministic fuzzy-match step
  against the CMS medicine master list isn't built yet (Milestone 9,
  `docs/architecture.md` §18) — the field is always `null` today.
- No live browser click-through test exists for the chunked-recording
  → review flow beyond manual testing described in `docs/log/`.
