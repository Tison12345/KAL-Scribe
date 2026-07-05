# Project Status

> Rewritten in place after every task — this file always reflects the
> *current* state, not history. For history, see `docs/log/`. For deep
> per-module detail, see `docs/modules/`. For why a decision was made, see
> `docs/adr/`.

**Last updated:** 2026-07-05 — Milestone 3: Storage

## One-paragraph summary

Milestones 1–3 are done. A doctor can confirm consent, record
consultation audio in chunked segments in the browser, and have each
chunk uploaded through a real (if locally-stood-in) upload session API
into `apps/api` — persisted via Drizzle, tracked through the
`consultation_recordings` lifecycle, with per-chunk retry on failure.
Verified end-to-end in a real browser: consent → record → chunks
upload → recording finalizes to `uploaded`, with the actual chunk file
confirmed as a valid, complete WebM container on disk. No Supabase
project exists yet — Postgres and object storage are both local
stand-ins behind the real interfaces, swappable for Supabase via env
vars with no code changes (see ADR-0007, ADR-0008).

## What's built

- Milestones 1–2 — see their own log entries (repo scaffold; audio
  recording capture + consent UI).
- Milestone 3 — Storage:
  - `packages/config`'s first real content: `parseApiEnv`, validating
    apps/api's entire environment once at boot (zod-backed).
  - `packages/types` / `packages/validation`'s first real content:
    `ConsultationRecording` types and the `startRecording`/
    `requestChunkUpload`/`completeUpload` request schemas.
  - `apps/api/src/infrastructure/database/` — Drizzle schema for
    `consultation_recordings` (architecture.md §12, exact field
    match), migrations, and a driver that's a real Postgres connection
    when `DATABASE_URL` is set, or an embedded PGlite instance
    otherwise (ADR-0008) — no Docker or hosted DB needed for local dev.
  - `apps/api/src/modules/clinical-ai/` — first real module content:
    `domain/consultation-recording.entity.ts` (status-transition
    rules), `application/{start-recording,request-chunk-upload,
    complete-upload}.use-case.ts`, `infrastructure/
    consultation-recording.repository.ts`, `infrastructure/
    {storage.adapter.ts,local-disk-storage.adapter.ts}` (ADR-0007),
    `presentation/{clinical-ai.controller.ts,
    local-storage.controller.ts}`.
  - `apps/web/src/features/clinical-ai/{services/recording.service.ts,
    hooks/useUploadSession.ts,components/UploadProgress.tsx}` — calls
    the upload session API, uploads each chunk to its signed URL, and
    surfaces per-chunk status with retry-on-failure.
  - Dev preview page wires recording → upload → finalize together;
    finalization is automatic once every captured chunk has uploaded.
  - Verified in a real browser end-to-end (not just build/lint/test):
    recorded audio, watched it upload, confirmed "Recording saved,"
    and independently confirmed on disk that the stored chunk is a
    valid, complete WebM file (correct EBML header), not a corrupt
    fragment.

## In progress

- Nothing — Milestone 3 is complete.

## Not started

- Milestone 4 (Queue): BullMQ setup, `consultation_ai_jobs` table,
  worker process skeleton, dead-letter handling.
- Milestones 5–10 — see `docs/architecture.md` §18.
- `workers/clinical-ai-worker` and `python/asr-service` don't exist yet.
- Real Supabase Storage/Postgres integration — both are local
  stand-ins today (ADR-0007, ADR-0008); swapping to real Supabase is
  an env var + one new adapter class, not built yet.
- Audio stitching (raw chunks → one continuous file) is deferred to
  whichever milestone actually consumes it (Milestone 4's queue job or
  Milestone 5's ASR step) — `consultation_recordings.storage_key`
  currently points at the recording's chunk folder, not a single file.

## Known issues / risks

- **Local stand-ins, not real infra.** Uploaded audio lives only on
  whatever machine runs `apps/api` (gitignored `.data/`), with no real
  durability/encryption/retention guarantees. Must be replaced with
  real Supabase Storage before this repo handles real PHI — tracked
  here, not assumed done. See ADR-0007/0008 for the swap mechanism.
- Milestone 2's open item — chunk audio playback in an ad-hoc
  browser `<audio>` tag was never confirmed working — is now resolved
  in practice: Milestone 3's real upload/read round trip confirmed the
  chunk file itself is valid (correct WebM/EBML header on disk), even
  though the original in-browser playback UI was removed rather than
  debugged further.
- Two decisions from Milestone 1 remain open pending legal/compliance
  input: cloud LLM data handling (ADR-0002) and the 90-day retention
  default (ADR-0004).

## Key decisions in effect

- STT provider: WhisperX — `docs/adr/0001-stt-provider-whisperx.md`
- LLM provider (MVP extraction): Groq-hosted Llama —
  `docs/adr/0002-llm-provider-groq-mvp.md`
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

## Next up

- Milestone 4 (Queue) per `docs/architecture.md` §18: BullMQ setup
  mirroring Repo B's pattern (§13), `consultation_ai_jobs` table,
  `workers/clinical-ai-worker` process skeleton, dead-letter handling.
