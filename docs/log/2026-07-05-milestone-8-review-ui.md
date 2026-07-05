---
date: 2026-07-05
task: milestone-8-review-ui
---

# Milestone 8: Review UI

## What changed

Built the doctor-facing review screen for the AI extraction draft
(architecture.md §6, §7 stage 12): a full `ReviewDraftPanel` covering
every §11 field (chief complaint, symptoms, history, diagnosis, the
Medicines/Diet/Lifestyle/Treatments four-part draft, advice, follow-up,
SOAP note, clinical notes), each editable, with confidence badges and
risk-flag banners so no AI-suggested field reads as already-authoritative
(CLAUDE.md's "no silent AI authority" rule). Backed by new
`update`/`accept`/`discard` endpoints in apps/api, a stub
`cms-integration.adapter.ts` (architecture.md §17 Phase 1 — logs
instead of calling a real CMS), and a small pure domain engine
(`extraction-confidence.engine.ts`) for the "is this confident enough
to not warn" business rule.

Edits autosave (800ms debounce after the doctor stops typing) into a
separate `edited_extraction` column, never overwriting the original AI
`extraction` — so the two stay comparable for audit and future
model-quality evaluation, per architecture.md §12's own reasoning for
that column split.

Verified: full workspace build (`pnpm -r build`), typecheck, and lint
all pass clean, including Next.js's own stricter build-time
typechecking. The dev server serves the page without error. Full
interactive verification (recording a real consultation, editing
fields, accepting/discarding against a live draft) is left to the user
per their own request — this milestone's automated verification covers
correctness of the build, not a live click-through.

## Files touched

- `apps/api/src/modules/clinical-ai/domain/extraction-confidence.engine.ts`
  — new, pure (`getConfidenceLevel`, `shouldShowLowConfidenceWarning`).
- `apps/api/src/modules/clinical-ai/infrastructure/
  {cms-integration.adapter.ts,stub-cms-integration.adapter.ts}` — new;
  the one seam into "the rest of the CMS" (architecture.md §16), stub
  implementation per §17 Phase 1.
- `apps/api/src/modules/clinical-ai/infrastructure/
  consultation-ai-result.repository.ts` — added `update()`.
- `apps/api/src/modules/clinical-ai/application/
  {consultation-ai-result.mapper,update-review-draft,
  accept-review-draft,discard-review-draft}.use-case.ts` — new;
  `get-extraction-result.use-case.ts` simplified to use the new shared
  mapper.
- `apps/api/src/modules/clinical-ai/presentation/clinical-ai.controller.ts`
  — three new routes: `PATCH :id/extraction`, `POST :id/extraction/accept`,
  `POST :id/extraction/discard`.
- `packages/types/src/consultation-ai-result.ts` — `UpdateReviewDraftRequest`,
  `AcceptReviewDraftRequest`.
- `packages/validation/src/clinical-extraction.schema.ts` —
  `updateReviewDraftSchema`, `acceptReviewDraftSchema`.
- `apps/web/src/features/clinical-ai/components/
  {ConfidenceBadge,RiskFlagBanner,SoapNoteView,StringListEditor,
  ReviewDraftPanel}.tsx` — new.
- `apps/web/src/features/clinical-ai/hooks/useReviewDraft.ts` — new;
  polls for the extraction result, holds local edit state, debounced
  autosave, accept/discard actions.
- `apps/web/src/features/clinical-ai/services/recording.service.ts` —
  `getExtraction`/`updateReviewDraft`/`acceptReviewDraft`/
  `discardReviewDraft` added; new `patchJson` helper.
- `apps/web/src/app/page.tsx` — `ReviewDraftPanel` wired in below
  `TranscriptViewer`; dev-preview label bumped to Milestone 8.

## Decisions made

- **`cms-integration.adapter.ts` only implements `submitPrescriptionDraft`
  for now** — `fetchConsultationContext`/`resolveMedicineMasterList`/
  `resolveTreatmentMasterList` (§17 Phase 1) belong to Milestone 9 (CMS
  Mapping), which is what actually consumes them. Adding unused methods
  now would be speculative.
- **`submitPrescriptionDraft` takes the full `ClinicalExtraction`, not a
  dedicated `PrescriptionMappingResult`** — the deterministic
  medicine/treatment master-list mapping step (§7 stage 11) is
  Milestone 9's job. Passing the richer shape today costs nothing and
  doesn't need revisiting when M9 adds the mapping step in front of
  this same call.
- **String-array fields (history, diet, advice, etc.) share one
  `StringListEditor` component** rather than six near-duplicate
  row-editors — same reasoning as Milestone 7's client-file
  consolidation.
- **Accept/discard are idempotent** (matching `CompleteUploadUseCase`'s
  established pattern) — re-accepting an already-accepted draft
  returns its existing state instead of re-submitting to the CMS a
  second time.

## Follow-ups / left undone

- **No live interactive verification yet** — build/typecheck/lint all
  pass and the dev server serves the page, but recording a real
  consultation and clicking through edit/accept/discard against a live
  draft hasn't been done (left to the user, per their request).
- **`ReviewDraftPanel`'s array-of-object editors (medicines, treatments,
  symptoms) use plain text inputs**, not the CMS's actual
  combobox/master-list-backed editors — those don't exist in this
  standalone repo yet (Milestone 9 builds the master-list resolution
  they'd depend on). Matches architecture.md §6's "building against a
  stub... until integration" note.
- Milestone 9 (CMS Mapping) is next per architecture.md §18: deterministic
  medicine/treatment mapping, `match_confidence` scoring, stub master-list
  fixtures.
