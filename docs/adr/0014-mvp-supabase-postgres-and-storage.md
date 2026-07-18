# ADR-0014: MVP data model — real Supabase Postgres/Storage, versioned AI runs, generic provider naming

- Status: accepted
- Date: 2026-07-15
- Context: Moving `clinical-ai-single` from "PoC run with manual test
  scripts" to "MVP" surfaced that local dev had been running on two
  stand-ins always documented as temporary — embedded PGlite
  (ADR-0008) and local-disk storage (ADR-0007) — plus a data-model gap:
  the single `consultation_ai_results` table conflated an immutable AI
  output with a doctor's mutable review state, had no capacity for
  re-running extraction against a different provider for comparison,
  and captured no cost/latency/confidence/audio metadata anywhere.
  Four decisions were needed together, not sequentially, since they
  touch the same tables and call sites.
- Decision:
  1. **Remove PGlite and local-disk storage entirely, not keep as a
     fallback.** `apps/api/src/infrastructure/database/client.ts` now
     requires `DATABASE_URL` (no branch, no `@electric-sql/pglite`
     dependency) — ADR-0008's own text already scoped this exact swap
     as "requires no code change, only an env var." `SupabaseStorageAdapter`
     replaces `LocalDiskStorageAdapter`/`LocalStorageController` (deleted,
     not just unregistered) behind the unchanged `StorageAdapter`
     interface — ADR-0007's own text scoped this as "one new class plus
     one DI registration." Both local stand-ins are gone from the
     codebase now, per explicit direction to run against real
     infrastructure from day one, even in local dev.
  2. **Split `consultation_ai_results` into `consultation_ai_runs`
     (immutable AI output) + `consultation_reviews` (mutable doctor
     workflow state)**, and introduce `consultation_ai_sessions` as a
     new root entity above `consultation_recordings` (enabling multiple
     recordings per consultation — pause/resume — and multiple runs per
     recording). `consultation_ai_sessions` is deliberately *not* named
     `consultation_sessions` — this repo owns zero CMS concepts
     (architecture.md §16's zero-FK rule), and a literally-named
     `consultation_sessions` table risked being mistaken for the CMS's
     own session/appointment record at Repo B integration time. Each
     run gets a stable `run_number` (1, 2, 3...) and carries
     provider/model/prompt-version/temperature/latency/token/cost/
     confidence metadata plus the pre-parse raw provider response —
     what actually makes "run this recording again against a different
     provider for comparison" a real, queryable operation instead of
     just an idea. `consultation_ai_audit_log` (architecture.md §12
     already specified this table; it was never implemented) is
     implemented now as the append-only event log for session/consent/
     review lifecycle events. No `final_prescription` table — the CMS
     still owns that record, referenced only by the existing opaque
     `accepted_cms_prescription_ref` string.
  3. **Rename the provider interfaces**: `LlmProvider` →
     `ClinicalExtractionProvider`, `AudioTranscriptionProvider` →
     `SpeechUnderstandingProvider` (packages/llm-client) — job-based
     names, not model-kind names, since "LLM" was never accurate for
     the speech side and both interfaces will eventually have
     non-LLM implementations (Whisper, Google STT for speech; this
     already applies today). Not a pure rename: both methods now return
     a `{ result, metadata }` envelope so the new run/transcript
     metadata columns have somewhere to come from at the source. The
     single `LLM_PROVIDER` env var splits into `EXTRACTION_PROVIDER`/
     `SPEECH_PROVIDER` (one var conflated two roles a single vendor
     can't always both fill), and `loadClinicalExtractionProvider`
     takes an optional `providerOverride` — plumbed through
     `ExtractionJobPayload.requestedProvider` — so a specific run can
     target a specific vendor without redeploying.
  4. **Gemini-only for MVP deployment** (reconfirming, not re-deciding
     — see ADR-0013): `python/asr-service` isn't part of the MVP
     deployment path, removing the GPU-hosting requirement from this
     phase's infra footprint. Its code and the `SPEECH_PROVIDER` unset
     → classic-pipeline fallback both stay in the repo; only the
     deployed default changes.
- Consequences:
  - Migration history was regenerated clean (`0000_fast_master_mold.sql`)
    rather than built as incremental ALTERs against the old 4-table
    shape — no production data existed yet, and landing this alongside
    the PGlite removal meant there was no reason to generate two
    consecutive "clean baseline" migrations.
  - `ReviewDraft` (packages/types) is a new flat DTO joining the latest
    run + its review, preserving the API shape `ReviewDraftPanel.tsx`/
    `useReviewDraft.ts` already consumed — those needed type-import
    renames only, not a rewrite.
  - `raw_response` (on both `consultation_transcripts` and
    `consultation_ai_runs`) re-opens architecture.md §15's still-open
    column-level-encryption question with a larger surface (verbatim
    patient speech, stored twice) — not solved here, already an open
    decision before this change, not a new gap introduced by it.
  - `consultation_ai_jobs` is unchanged — it already answers "persist
    every pipeline stage's status," runs/reviews/transcripts are the
    per-stage *data*, not a redesign of status tracking.
  - Analytics (`GetConsultationAnalyticsUseCase`) are computed on read
    from existing columns, not cached — speaking/silence percentages
    would go stale the moment `RelabelTranscriptSpeakersUseCase` runs
    if stored instead.
