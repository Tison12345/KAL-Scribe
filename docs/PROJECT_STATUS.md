# Project Status

> Rewritten in place after every task — this file always reflects the
> *current* state, not history. For history, see `docs/log/`. For deep
> per-module detail, see `docs/modules/`. For why a decision was made, see
> `docs/adr/`.

**Last updated:** 2026-07-06 — Extraction schema rebuilt against the
real clinical form (not architecture.md §11's original placeholder),
verified against real recordings

## One-paragraph summary

Milestones 1–8 are done. The pipeline now runs all the way from
recording to a **doctor-reviewable, editable AI draft**: record →
upload → queue → transcribe (WhisperX) → diarize (Pyannote) → extract
(Groq-hosted Llama) → a full `ReviewDraftPanel` where every §11 field
is visible, editable, confidence-badged, and risk-flagged, with
autosave and accept/discard against a stub CMS adapter. No AI-suggested
field ever reads as already-authoritative — status badges and
per-section confidence badges make that visible everywhere, not just
once at the top. `update`/`accept`/`discard` were verified live against
real recordings run through the full pipeline, surfacing and fixing a
real bug (`accept`/`discard` weren't mutually terminal — a discarded
draft could be silently accepted and vice versa, each time actually
calling the stub CMS adapter; both directions now 400 correctly). The
user then ran the **first genuine multi-minute consultation** through
the app (a ~2-minute fake Ayurvedic dialogue) — this surfaced a second,
more serious bug: with no request timeout on the worker's call to
`asr-service`, retries piled up abandoned CPU-bound transcription work
in the background, burning ~88 minutes of CPU time and stalling the
result for 35 minutes even though the recording had actually succeeded
partway through. Fixed with an explicit 20-minute timeout. The
resulting transcript and extraction were both genuinely accurate (see
Known issues for the one real STT limitation this surfaced). That
35-minute stall directly motivated a new **pipeline progress
tracker**: `consultation_ai_jobs` already recorded per-stage
`started_at`/`completed_at`/`status`, just never exposed anywhere —
two new endpoints plus a frontend hook/component now surface a real
stage indicator (uploading → transcribing → extracting → ready, or
failed) and an honest timing summary once done, verified against both
the historical stalled recording and a fresh clean run (~16s upload,
~14s transcription, ~2s extraction for an 8-second clip). Live browser
click-through of `ReviewDraftPanel` itself (not just its backing
endpoints) is still worth a look, though the underlying data is now
confirmed correct end-to-end.

**2026-07-06: the entire extraction schema was rebuilt from scratch**
against the real clinical form, not architecture.md §11's original
generic placeholder. §11 was written before the real CMS integration
target (`C:\KAL-clinic-management-solution`) had been examined field
by field; once it was (reading ~15 actual component files, not just
the CMS's type file), the schema, LLM prompt, review UI, and eval
harness were all rewritten to match the CMS's own field names and
option sets directly — see `docs/modules/clinical-extraction-schema.md`
for the full derivation and every discrepancy found along the way.
Verified twice: the eval harness (11/12, 92% — the one "failure" is a
scorer strictness issue, not a real bug) and a real re-extraction
against the existing digestion-consultation recording, both correctly
leaving every physical-examination field (Ashtavidha/Srotas/Prakrithi/
Dosha/Agni/Ojas) null since none were ever examined aloud — the exact
hallucination the new prompt rule exists to prevent. One real bug
found and fixed: a family-history disease name outside the UI's 7
canonical checkboxes would have been silently invisible in the review
screen (fixed the prompt to route those into the UI's actual "_other"
field instead — though the LLM doesn't 100% reliably comply with this
one rule yet, a documented open item, not a code bug).

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
  - **`ReviewDraftPanel`** — the full doctor-facing review screen,
    rebuilt 2026-07-06 against the real clinical form fields (see
    below) — Case Sheet, Detailed Assessment, Medicines, Treatments,
    Lab Tests/Diet/Lifestyle, collapsible section cards matching
    `docs/design/ui-reference.md`'s existing patterns exactly,
    `ConfidenceBadge`/`RiskFlagBanner` throughout, accept/discard
    action bar.
  - **`useReviewDraft`** — polls for the extraction result (mirrors
    `useTranscript`'s reasoning), holds local edit state, autosaves
    800ms after the doctor stops typing (not on every keystroke).
  - **`StringListEditor`** — one shared editor for the six-plus
    `string[]` fields in the schema, instead of near-duplicate
    row-editors per field.
  - **Verified live against three real recordings run through the full
    pipeline**: `PATCH .../extraction` correctly writes to
    `edited_extraction` without touching the original `extraction`,
    `accept` correctly no-ops on a second call, and — after finding and
    fixing the terminal-state bug below — `discard → accept` and
    `accept → discard` both now correctly 400 instead of silently
    flipping status and re-invoking the CMS stub.
  - **`PipelineProgressTracker` + `usePipelineProgress`** — real
    (not simulated) stage indicator (uploading → transcribing →
    extracting → ready/failed) and an honest per-stage timing summary,
    built on `consultation_ai_jobs`/`consultation_recordings` data the
    system already tracked but never exposed. New `GET :id` and
    `GET :id/jobs` endpoints back it. Directly motivated by the
    35-minute stall — answers "is this stuck or just slow" without
    guessing. Deliberately does not fake fine-grained % progress within
    a stage (architecture.md §19 files real-time transcription as a
    future enhancement, not MVP).
- **2026-07-06 — Real clinical form schema rebuild** (supersedes
  architecture.md §11): `ClinicalExtraction` now mirrors the actual CMS
  (`C:\KAL-clinic-management-solution`) field-for-field — Case Sheet
  (complaints, personal history, family history, gynec, vitals),
  Detailed Assessment (Ashtavidha Pariksha, Srotas Pariksha, Prakrithi/
  Dosha/Agni/Ojas/Ama, diagnosis, notes), and Prescription (medicines
  with a real dosage grid, treatments with real therapy fields,
  dietEat/dietAvoid, lifestyleMaintain/lifestyleAvoid, followUpValue/Unit).
  See `docs/modules/clinical-extraction-schema.md` for the full
  derivation, every discrepancy found while verifying against the CMS's
  actual component code (not just its type file), and the two explicit
  scope decisions made (excluding `emotionalMakeup`, including Family
  History from a different CMS tab). Verified via `pnpm eval` (11/12)
  and a real re-extraction against an existing recording — both
  correctly left every physical-examination field null since none were
  stated aloud, confirming the new "never infer exam findings" prompt
  rule works on genuine speech, not just the eval fixture.

## In progress

- Nothing — Milestone 8's scoped work (including the terminal-state
  fix) is complete.

## Not started

- **Live browser click-through** of the Review UI (actually using
  `ReviewDraftPanel` — typing edits, clicking Accept/Discard) — the
  backing endpoints are now verified directly, but the UI itself
  hasn't been driven interactively. Left to the user.
- Milestone 9 (CMS Mapping) and onward — see `docs/architecture.md` §18.
- Real Supabase Storage/Postgres integration — both are local
  stand-ins today (ADR-0007, ADR-0008).
- GPU inference — still deferred, see ADR-0009.
- Audio-level eval fixtures (raw audio → transcription WER) — needs
  real or de-identified audio plus hand-transcribed ground truth.

## Known issues / risks

- **CI build order fixed (2026-07-06)**: `.github/workflows/ci.yml` ran
  `lint` before `build`, so `@kal-scribe/types`/`@kal-scribe/validation`
  (typed via `dist/index.d.ts`) had no `dist/` yet on a fresh checkout,
  making apps/api's imports resolve to `any` and tripping 84
  `@typescript-eslint/no-unsafe-*` errors. Reordered to build first;
  verified `pnpm build && pnpm lint` passes clean workspace-wide. See
  `docs/log/2026-07-06-ci-lint-before-build-ordering-fix.md`.
- **Headers-timeout bug fixed (2026-07-07)**: the Milestone 8
  20-minute `AbortSignal` timeout on the worker's asr-service call
  never actually worked for a real multi-minute consultation — undici's
  own `headersTimeout`/`bodyTimeout` (300s default, independent of any
  `AbortSignal`) killed the connection first every time. Reproduced
  directly (`UND_ERR_HEADERS_TIMEOUT` at 304s) and fixed by dispatching
  through a dedicated undici `Agent` with both raised to 20 minutes.
  Verified against a real ~7-minute recording: transcription completed
  in 4m36s, extraction in 5s, full draft persisted. See
  `docs/log/2026-07-07-headers-timeout-bug-fix.md`.
- **WhisperX silently dropped the final ~8s of that same real recording**
  — the transcript's last segment ended at 421s against 430s of actual
  audio. Isolated the missing tail and re-ran it directly against
  asr-service: pyannote diarization still detected 7 speaker turns of
  voice activity in that window, but Whisper produced zero transcript
  segments for it even in isolation — not a pipeline bug, a genuine STT
  decode failure on that stretch of audio (too quiet/trailing/unclear).
  Same class of issue as the "Triphala" mishearing below: the review UI
  is the safety net for exactly this.
- **`asr-service` has no request-cancellation mechanism** — the
  20-minute timeout (now genuinely working, see above) makes premature
  retries far less likely, but if a request is genuinely abandoned
  (timeout, worker crash), the Python-side computation still runs to
  completion wastefully rather than being cancelled. Real fix would
  need WhisperX's blocking call running in a cancellable executor wired to
  the request's disconnect — bigger change, not done.
- **STT accuracy on Ayurvedic-specific medicine names is unverified
  beyond one example** — WhisperX mis-heard "Triphala and Avipattikar
  churna" as "a trifle" in the first real multi-minute test, merging
  two medicines into one garbled entry. Not a bug in this repo's
  extraction logic (it correctly extracted what it was given) — an
  upstream STT vocabulary limitation worth watching for a pattern.
- **`ReviewDraftPanel` itself hasn't been clicked through in a real
  browser since its 2026-07-06 rebuild** — verified via a real
  extraction against a real transcript at the data layer (API responses
  inspected directly), and the UI code builds/lints clean, but the new
  Ashtavidha dropdowns, Srotas normal/disturbed toggles, family history
  matrix, and medicine dosage grid haven't been visually clicked
  through in an actual browser session yet.
- **`ReviewDraftPanel`'s medicine/treatment editors use plain text/number
  inputs**, not the CMS's actual formulary-search/master-list-backed
  editors (`MedicineNameInput`/`TreatmentNameInput`'s live Supabase
  search) — those don't exist in this standalone repo yet (Milestone 9
  builds the master-list resolution they'd depend on). Matches
  architecture.md §6's "stub until integration" note explicitly.
- **Eval harness has one fixture so far** — rewritten against the new
  schema, currently 11/12 (92%); the one "failure" is the scorer being
  stricter than necessary (LLM said `followUpValue: 14,
  followUpUnit: "days"` for a stated "two weeks" — exactly equivalent,
  just a different valid unit), not a real extraction bug. Worth more
  fixtures before drawing conclusions about prompt quality either way.
- **LLM doesn't 100% reliably route non-canonical family-history
  diseases into the `"_other"` field** — the prompt explicitly
  instructs this (so the review UI's fixed 7-checkbox table doesn't
  silently hide anything), but a same-day retest still produced a
  free-text disease key instead. Documented as an open LLM-compliance
  gap, not a code bug — the schema/validation correctly accept either
  shape either way.
- **Primary diarization model now active, real before/after comparison
  done** — `asr-service` now loads `speaker-diarization-3.1` with no
  403 (gated terms accepted for it and its `segmentation-3.0`
  dependency), replacing the `community-1` fallback the ~60% Milestone
  6 baseline was measured on. Re-ran the exact same Milestone 6
  two-speaker audio directly against the upgraded model: 13/15
  transcript segments matched exactly, 2 changed, and both changes
  correctly reassigned a misattributed line to the right speaker.
  One data point — worth another real test to confirm this holds.
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
- **CPU-only transcription+diarization runs ~2× audio duration**
  (e.g. ~4m for a ~2min recording) — only 2 real data points so far,
  tracked in `docs/runbooks/performance-benchmarks.md`. This is the
  concrete evidence ADR-0009's planned GPU upgrade will eventually need
  to act on. **Update (2026-07-07): GPU upgrade tested, ~6.1x faster**
  — see Key decisions below.

## Key decisions in effect

- STT provider: WhisperX — `docs/adr/0001-stt-provider-whisperx.md`
- WhisperX runtime: **now GPU (CUDA, float16)** on this machine (RTX
  4050) — same 7-minute recording went from 4m35s (CPU) to 45s (GPU),
  a ~6.1x speedup, comfortably clearing architecture.md §13's "draft
  in under a minute" target — `docs/adr/0012-whisperx-gpu-cuda-float16.md`,
  `docs/log/2026-07-07-gpu-speed-test.md`. Supersedes the CPU/int8
  config in `docs/adr/0009-whisperx-runtime-config-cpu-small.md`
  (kept as the fallback for machines without a GPU). Production
  hosting (self-host GPU vs. hosted GPU/serverless vs. hosted STT API)
  is still an open question — this only validates local speed.
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
- Diarization: Pyannote — now running the **primary**
  `speaker-diarization-3.1` model (gated-terms access granted
  2026-07-06, including its `segmentation-3.0` dependency), replacing
  the `community-1` fallback that earlier's ~60% turn-level accuracy
  number was measured on. Re-verified against the exact same Milestone
  6 two-speaker audio: 13/15 segments matched, 2 changed, both changes
  correct reassignments. No ADR filed; this is the vendor
  architecture.md §9 already specifies, not a new choice.
- Worker calls apps/api over HTTP, not by importing NestJS use-cases —
  `docs/adr/0010-worker-http-client-not-nestjs-import.md`.
- CMS integration: stubbed (`StubCmsIntegrationAdapter`), logs instead
  of calling a real CMS — architecture.md §17 Phase 1, no ADR needed
  (this is the standalone-phase design already specified, not a new
  choice).
- Extraction schema: rebuilt against the real clinical form
  (`C:\KAL-clinic-management-solution`), superseding architecture.md
  §11's original placeholder — `docs/modules/clinical-extraction-schema.md`
  is now the authoritative reference, no ADR needed (this corrects an
  earlier draft to match the actual integration target, not a new
  design choice).

## Next up

- User to click through the Review UI live in a browser against its
  2026-07-06 rebuild: record a real consultation, verify the Ashtavidha/
  Srotas/family-history/medicine-dosage-grid UI renders and edits
  correctly, and accept/discard against a genuine draft (the backing
  endpoints and data shape are already verified — this is the visual/
  interaction layer on top).
- Milestone 9 (CMS Mapping) per `docs/architecture.md` §18:
  deterministic medicine/treatment mapping (§7 stage 11),
  `match_confidence` scoring, stub `resolveMedicineMasterList`/
  `resolveTreatmentMasterList` fixtures.
