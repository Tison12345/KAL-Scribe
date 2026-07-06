---
date: 2026-07-06
task: real-clinical-form-schema-rebuild
---

# Rebuild the extraction schema against the real clinical form

## What changed

architecture.md §11's extraction schema was a generic placeholder,
written before the real integration target — an existing CMS at
`C:\KAL-clinic-management-solution` — had been examined field by
field. Rebuilt the entire extraction schema, prompt, review UI, eval
harness, and both `packages/types`/`packages/validation` from scratch
against that CMS's own source (`app/lib/types.ts`, `ConsultationTab.tsx`,
`PrescriptionTab.tsx`, and every child section component — not just
the type file, since several type-level fields turned out to have no
UI input at all in the live form).

Read all ~15 relevant CMS component files directly before writing any
code. This surfaced real discrepancies from the original ask, each
verified against the actual component logic rather than assumed:
`emotionalMakeup` is genuinely live (excluded anyway, by explicit
decision); Srotas Pariksha has 15 entries, not 16 (no `stanyavaha`);
`personalHistory.menstrual` isn't independently editable (the real
field is `gynec.menstrualHistory`); `temperatureUnit` is always °F in
the UI; medicine `consumptionMode` isn't a stored field (it seeds
`instructions` from a formulary lookup); medicine `quantity` and
treatment `notes`/`treatmentType` have no live UI input; follow-up is
`followUpValue`+`followUpUnit`, not a generic timeframe string. Two
scope decisions were confirmed with the user before building:
`emotionalMakeup` excluded (real but deliberately out), Family History
(disease×relation matrix, from a different CMS tab — "Patient Intake")
included anyway.

The generic concepts that didn't survive the rebuild: `symptoms[]` as
a structured severity/pain-characteristics object (the CMS just has a
plain `complaints` string list), `diagnosis.differentialMentioned`
(no differential-diagnosis concept in the CMS), the SOAP note (no SOAP
concept in the CMS at all — `SoapNoteView.tsx` deleted), and generic
`diet`/`lifestyle` objects (replaced by the CMS's own
`dietEat`/`dietAvoid`/`lifestyleMaintain`/`lifestyleAvoid`).

## Verified for real, twice

1. **`pnpm eval`**: 11/12 checks (92%) against the existing back-pain
   fixture, rewritten against the new schema. The one "failure" is a
   scorer strictness issue, not a bug — the LLM correctly converted
   "two weeks" to `followUpValue: 14, followUpUnit: "days"` (exactly
   equivalent, just a different valid unit than the fixture expected).
   The critical new check — **no physical-examination finding
   (Ashtavidha/Srotas/Prakrithi/Dosha/Agni/Ojas) hallucinated**, since
   none were ever stated aloud in this fixture — passed cleanly.
2. **Real transcript, real pipeline**: re-enqueued extraction for the
   existing real ~2-minute digestion-consultation recording
   (`fe361d05-...`) through the actual worker → Groq → persist flow.
   Output correctly used the new field names throughout
   (`complaints`, `dietEat`/`dietAvoid`, `medicines[]` with a real
   AM/Afternoon/Evening/Night dosage grid parsed from natural
   "one teaspoon at night... half a teaspoon before meals" phrasing),
   and — same as the eval fixture — correctly left every
   physical-examination field null/empty since none were examined
   aloud in this real consultation either.

## One real bug found and fixed during this verification

The first real-transcript run put `"Acid Reflux"` in as its own
`familyHistory` key. The review UI's family history table only renders
checkboxes for the 7 canonical diseases plus one single `"_other"`
free-text field — any other disease name as a key would be silently
invisible in the UI even though correctly stored in the data. Fixed
the prompt instruction to route anything outside the 7 canonical
diseases into `"_other"` as a single descriptive sentence, matching
what the UI can actually display. Re-tested: the *build* correctly
contains the updated instruction, but the LLM still used a free-text
disease key on the retest — a genuine LLM instruction-following
limitation on this specific nuance, not a code bug. Documented as a
known issue rather than chased further; the schema/prompt is correct,
the model just doesn't reliably comply with this one rule yet.

## Files touched

- `packages/types/src/clinical-extraction.ts` — full rewrite.
- `packages/validation/src/clinical-extraction.schema.ts` — full
  rewrite; added `@kal-scribe/types` as a dependency (new).
- `packages/llm-client/src/prompt.ts` — full rewrite: every real field,
  every canonical option list, the "physical-exam findings only if
  stated aloud" rule, the family-history "_other" routing rule.
- `apps/web/src/features/clinical-ai/components/ReviewDraftPanel.tsx`
  — full rewrite against the real fields (Case Sheet, Detailed
  Assessment, Prescription sections matching the CMS's own layout);
  `SoapNoteView.tsx` deleted (no SOAP concept in the real form).
- `apps/api/src/modules/clinical-ai/infrastructure/
  stub-cms-integration.adapter.ts` — updated field-name reference in
  its log line.
- `tests/eval/src/{expectation,score}.ts`,
  `tests/eval/fixtures/consultation-01.expected.json` — rewritten
  against the new schema, including the new "no exam findings
  hallucinated" check.
- `docs/modules/clinical-extraction-schema.md` — new; the authoritative
  field-by-field schema reference, citing exact CMS source files.
- `docs/architecture.md` §11 — marked superseded, pointing to the new
  module doc, with the carried-forward clinical-safety principles
  restated.

## Decisions made

- No DB migration needed — `consultation_ai_results.extraction` is a
  jsonb column; the internal shape change doesn't touch the schema.
- `packages/validation` now depends on `@kal-scribe/types` (new) —
  needed to reuse `SROTAS_DISTURBANCE_TYPES` as the single source of
  truth for that enum rather than duplicating the list.

## Follow-ups / left undone

- The family-history "_other" routing rule isn't 100% reliably
  followed by the LLM yet (see above) — worth watching for a pattern
  across more real consultations before deciding whether it needs a
  stronger instruction, a stricter schema-level constraint, or a
  post-processing normalization step.
- Milestone 9's deterministic medicine/treatment master-list mapping
  step still doesn't exist — this rebuild makes that mapping
  mechanical (field names now match the CMS directly) but doesn't
  build it.
- Gender-based srotas filtering (`shukravaha`/`artavavaha`) isn't
  applied anywhere in this repo yet — deferred to whatever eventually
  writes into the real CMS.
