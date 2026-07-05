# Project Status

> Rewritten in place after every task — this file always reflects the
> *current* state, not history. For history, see `docs/log/`. For deep
> per-module detail, see `docs/modules/`. For why a decision was made, see
> `docs/adr/`.

**Last updated:** 2026-07-05 — Milestone 8: Review UI, built and build-verified

## One-paragraph summary

Milestones 1–8 are done. The pipeline now runs all the way from
recording to a **doctor-reviewable, editable AI draft**: record →
upload → queue → transcribe (WhisperX) → diarize (Pyannote) → extract
(Groq-hosted Llama) → a full `ReviewDraftPanel` where every §11 field
is visible, editable, confidence-badged, and risk-flagged, with
autosave and accept/discard against a stub CMS adapter. No AI-suggested
field ever reads as already-authoritative — status badges and
per-section confidence badges make that visible everywhere, not just
once at the top. Build, typecheck, and lint all pass clean across the
whole workspace, including Next.js's own build-time typechecking; the
dev server serves the page without error. Full interactive
verification (recording a real consultation and clicking through
edit/accept/discard) is intentionally left to the user this round, per
their own request.

## What's built

- Milestones 1–7 — see their own log entries (repo scaffold; recording
  capture + consent UI; upload session API + storage; BullMQ queue +
  worker; real WhisperX transcription; Pyannote diarization verified on
  real two-speaker audio at ~60% turn-level accuracy; clinical
  extraction via Groq, verified end-to-end with a real accuracy eval
  harness).
- Milestone 8 — Review UI:
  - **`extraction-confidence.engine.ts`** — new pure domain logic
    (architecture.md §5, §20 principle 7): `getConfidenceLevel`,
    `shouldShowLowConfidenceWarning`.
  - **`cms-integration.adapter.ts` + stub implementation** — the one
    seam into "the rest of the CMS" (architecture.md §16), per §17
    Phase 1: logs the call and returns a realistic fake ref instead of
    calling a real CMS. Only `submitPrescriptionDraft` exists so far —
    the read-only master-list methods belong to Milestone 9, which
    actually consumes them.
  - **`update`/`accept`/`discard` review-draft use-cases + routes** —
    `PATCH :id/extraction` (autosaved doctor edits, stored in a
    separate `edited_extraction` column so the original AI output
    stays auditable), `POST :id/extraction/accept` (calls the CMS stub,
    marks `accepted`, idempotent), `POST :id/extraction/discard`
    (idempotent).
  - **`ReviewDraftPanel`** — the full doctor-facing review screen:
    every §11 field editable (chief complaint, symptoms, history,
    diagnosis, the Medicines/Diet/Lifestyle/Treatments four-part draft,
    advice, follow-up, SOAP note, clinical notes), collapsible
    section cards matching `docs/design/ui-reference.md`'s existing
    patterns exactly, `ConfidenceBadge`/`RiskFlagBanner` throughout,
    accept/discard action bar.
  - **`useReviewDraft`** — polls for the extraction result (mirrors
    `useTranscript`'s reasoning), holds local edit state, autosaves
    800ms after the doctor stops typing (not on every keystroke).
  - **`StringListEditor`** — one shared editor for the six-plus
    `string[]` fields in the schema, instead of near-duplicate
    row-editors per field.

## In progress

- Nothing — Milestone 8's scoped work is complete.

## Not started

- **Live interactive verification** of the Review UI (recording a real
  consultation, editing fields, accepting/discarding a live draft) —
  build/typecheck/lint all pass and the dev server serves the page, but
  the actual click-through is the user's to do this round.
- Milestone 9 (CMS Mapping) and onward — see `docs/architecture.md` §18.
- Real Supabase Storage/Postgres integration — both are local
  stand-ins today (ADR-0007, ADR-0008).
- GPU inference — still deferred, see ADR-0009.
- Audio-level eval fixtures (raw audio → transcription WER) — needs
  real or de-identified audio plus hand-transcribed ground truth.

## Known issues / risks

- **`ReviewDraftPanel`'s medicine/treatment/symptom editors use plain
  text inputs**, not the CMS's actual combobox/master-list-backed
  editors — those don't exist in this standalone repo yet (Milestone 9
  builds the master-list resolution they'd depend on). Matches
  architecture.md §6's "stub until integration" note explicitly.
- **Eval harness has one fixture so far, with one known miss** — a
  "gentle walking" activity recommendation wasn't captured in
  `activityRecommendations` on the first real run (12/13, 92%). Worth
  watching for a pattern across more fixtures before treating it as a
  prompt-quality issue worth fixing.
- **Primary diarization model 403s** — `pyannote/speaker-diarization-3.1`
  fails because its dependency `pyannote/segmentation-3.0` needs its
  own separate gated-terms acceptance (not done). Not blocking — falls
  back to `pyannote/speaker-diarization-community-1`, which works
  (~60% turn-level accuracy, verified Milestone 6).
- **Restart can strand a job's DB status** — unchanged from Milestone
  4, still not fixed.
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
- CMS integration: stubbed (`StubCmsIntegrationAdapter`), logs instead
  of calling a real CMS — architecture.md §17 Phase 1, no ADR needed
  (this is the standalone-phase design already specified, not a new
  choice).

## Next up

- User to verify the Review UI live: record a real consultation, edit
  fields, and click through accept/discard against a genuine draft.
- Milestone 9 (CMS Mapping) per `docs/architecture.md` §18:
  deterministic medicine/treatment mapping (§7 stage 11),
  `match_confidence` scoring, stub `resolveMedicineMasterList`/
  `resolveTreatmentMasterList` fixtures.
