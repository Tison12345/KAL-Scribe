---
module: clinical-extraction-schema
last_updated: 2026-07-09
---

# Clinical Extraction Schema

> Rewritten in place as the module changes — this is a *living* doc, not a
> log. For the history of how it got this way, see `docs/log/`. For why a
> specific choice was made, see `docs/adr/`.

## Purpose

Defines the exact JSON shape the LLM extraction step (architecture.md
§7 stage 8) produces from a consultation transcript, and that the
review UI (`ReviewDraftPanel`) edits before a doctor accepts it.

## Current shape — diverges materially from architecture.md §11

architecture.md §11 defines a **generic** extraction schema
(`chiefComplaint`, `symptoms[]` with severity/pain-characteristics,
`diagnosis.differentialMentioned`, a SOAP note, generic
`diet.recommendations`/`restrictions`, etc.). That schema was written
before this repo's real integration target — a specific existing
CMS (`C:\KAL-clinic-management-solution`) — had been examined field by
field. As of 2026-07-06, the schema actually implemented in code
(`packages/types/src/clinical-extraction.ts`,
`packages/validation/src/clinical-extraction.schema.ts`) was rebuilt
from scratch against that CMS's own source, and no longer resembles
§11's generic version. **This doc, not §11, is the source of truth for
the extraction schema going forward.**

### Where every field actually comes from

Verified directly against the CMS's source, not derived from memory or
convention:

| Area | CMS source files |
|---|---|
| Case Sheet (complaints, personal history, vitals, gynec) | `app/components/clinical/{ConsultationTab,PresentingConcerns,PersonalHistorySection,GynecologicalHistorySection,ExaminationVitalsSection,FamilyHistorySection}.tsx` |
| Detailed Assessment (Ashtavidha, Srotas, Prakrithi/Dosha/Agni/Ojas/Ama, diagnosis, notes) | `app/components/clinical/{AshtavidhaSection,SrotasSection,ExaminationSection,DiagnosisSection,ClinicalNotesSection}.tsx` |
| Prescription (medicines, treatments, lab tests, diet, lifestyle, follow-up) | `app/components/clinical/{PrescriptionTab,MedicinesSection,TreatmentsSection,TherapyInstructionsFields,LabTestsSection,DietSection,LifestyleSection}.tsx` |
| Underlying DB-level type shapes | `app/lib/types.ts` (`Consultation`, `Prescription`, `PrescriptionMedicine`, `PrescriptionTreatment`, `PersonalHistory`, `FamilyHistory`, `SrotasEntry`, `TherapyInstructions`) |

### Fields deliberately excluded (verified dead in the live form, not an oversight)

Present on the CMS's own TypeScript types but with **zero UI input**
anywhere in the actual rendered form (confirmed by reading every
section component, not just the type file):

- `weightKg`, `heightFt`, `heightIn`, `sysGastrointestinal`,
  `sysRespiratory`, `sysNervous`, `sysMusculoskeletal`,
  `sysOtherFindings`, `sara`, `ayurvedicDiagnosis`, `examinationNotes`,
  `observations` — legacy `Consultation` fields, no longer collected.
- `bpPosition` — found 2026-07-09 to be dead too: `ExaminationVitalsSection.tsx`
  has no input for it at all (only pulse, BP systolic/diastolic,
  temperature). The 2026-07-06 rebuild missed this one because it exists
  on the `Consultation` type and reads like a plausible live field —
  removed from `Vitals` in this pass, corrected the same way as the
  fields above.
- Medicine `quantity` (the number) — only `quantityUnit` has a live
  input.
- Treatment `notes` — no input anywhere in `TreatmentsSection.tsx`.
- Treatment `treatmentType` (`panchakarma`|`general`) — auto-derived
  client-side from whether the treatment name text contains
  "panchakarma"; never a field a doctor picks directly, so not
  something the LLM should try to extract independently either.
- Medicine `consumptionMode` — not a stored field at all; it's a
  formulary-lookup value that seeds `instructions` when a formulary
  medicine is picked in `MedicinesSection.tsx`.

**`emotionalMakeup` (Manasika Bhava) is a deliberate exception**: it
*is* genuinely live in `ExaminationTab.tsx` (a real multi-select —
Shoka/Chinta/Bhaya/Krodha/Lobha/Mada/Dvesha + Other), but is excluded
from this schema by explicit product decision (2026-07-06), not
because it's unused.

### Corrections made vs. the original ask that started this rebuild

A few details initially assumed while planning this rebuild turned out
to be wrong once checked against the actual component code — corrected
here rather than silently:

- **Srotas Pariksha has 15 entries, not 16** — no `stanyavaha` exists
  in `SrotasSection.tsx`'s own list. `shukravaha` and `artavavaha` are
  gender-filtered (male-only / female-only) in the CMS UI, so only
  ~14 apply to any one patient — this schema still models all 15 keys
  since it doesn't know patient gender from audio alone; gender
  filtering is left to whatever downstream mapping step actually
  writes into the CMS.
- **`personalHistory.menstrual` is not independently editable** —
  `PersonalHistorySection.tsx`'s real field list is 8 fields (bowel,
  bladder, sleep, appetite, diet, eatingOut, addiction, exercise), not
  9. The real editable menstrual data lives under `gynec.menstrualHistory`.
- **`temperatureUnit` is always °F** in the live form, despite the
  type allowing `"C"|"F"` — no toggle exists in
  `ExaminationVitalsSection.tsx`.
- **Follow-up is `followUpValue` (number) + `followUpUnit`
  (`days`|`weeks`|`months`)**, not a generic timeframe string.
- Ashtavidha (8 fields) and Personal History (8 fields) each have a
  real "Other" free-text escape hatch in the live UI — modeled as
  plain strings with a canonical option list, not strict enums.
  Prakrithi, Dosha, Agni, and Ojas have **no** "Other" escape hatch —
  modeled the same way as plain strings for consistency, but the LLM
  prompt states these are a fixed set.

### Further corrections found 2026-07-09 (schema bumped to 2.1)

A second, more literal pass (re-reading `AshtavidhaSection.tsx`,
`PersonalHistorySection.tsx`, and `therapy-instructions-format.ts`
option-by-option, and checking `git log` for recent changes to the CMS's
own source) found several places where the 2026-07-06 rebuild's option
lists didn't actually match the live CMS, despite that pass's own claim
of field-by-field verification. Corrected here, `packages/types`,
`packages/validation`, `packages/llm-client/src/prompt.ts`, and
`ReviewDraftPanel.tsx` all updated to match:

- **Mala, Jivha, Shabda, Sparsha, and Akruti option strings were wrong.**
  The CMS reworked `AshtavidhaSection.tsx`'s options in a 2026-06-22
  commit (`git log`: "Rework Ashtavidha Pariksha fields..."); this
  schema's Mala/Jivha/Shabda options matched an *older*, pre-rework
  version, and Sparsha/Akruti didn't match any version found in the
  CMS's git history at all. Corrected to the current live options: Mala
  and Akruti are now `"Prakritam (Normal)"`/`"Vikritam (Abnormal)"` (same
  binary shape as Mutra/Drik, not a 4-option scale); Jivha and Shabda use
  a `"Prakritam"`/`"Vikritam - ..."` prefix pattern; Sparsha is 4 options
  (Ushna/Sheeta/Ruksha/Snigdha), not 6.
- **`personalHistory.bowel` was single-select with invented options.**
  The live `PersonalHistorySection.tsx` has Bowel as **multi-select**
  with 8 real options (Less than 3x/week, Ranges between 3x/week to
  3x/day, More than 3x/day, Normal Formed, Hard/Constipated, Soft/Loose,
  Mucus present, Blood present) — not the 4-option single-select
  ("Normal"/"Hard/Constipated"/"Soft/Loose"/"Irregular") this schema
  previously modeled. `multi: false` → `multi: true` in `ReviewDraftPanel`.
- **`personalHistory.exercise` had an invented option** —
  "Yoga/Pranayama Only" does not exist in the live 6-option list. Removed.
- **`treatments[].oilTempF` was the wrong type entirely.** Despite the
  field name, the live form's oil temperature is categorical —
  `therapy-instructions-format.ts`'s `OIL_TEMP_OPTIONS`: "Mrudu Ushna" |
  "Sukoshna" | "Ushnathara" | "Other: free text" — not a Fahrenheit number.
  Changed `oilTempF: number | null` → `string | null` across
  `packages/types`, `packages/validation`, the LLM prompt, and
  `ReviewDraftPanel` (now a select + free-text "Other", same pattern as
  Ashtavidha's escape hatch).
- **`vitals.bpPosition` was a fully invented field** — confirmed dead the
  same way as the fields in the "deliberately excluded" list above;
  moved there instead of staying a modeled field. Removed the `BpPosition`
  type, the `Vitals.bpPosition` field, its zod schema, its prompt
  mention, and its UI dropdown entirely.
- **Minor label/option polish**: `strokeDirection` labels corrected to
  match `therapy-instructions-format.ts`'s exact casing ("With"/"Against
  the hair", not lowercase "with"/"against"); `pressure` now renders
  proper "High"/"Medium"/"Low" labels instead of the raw lowercase
  stored value; medicine `timing` suggestions now include the
  external-application presets ("Early Morning", "Bedtime") alongside
  the oral ones, since the live form shows one set or the other
  depending on `consumptionMode` and this field is free text with
  suggestions either way (see open item below — the full
  `consumptionMode`-driven conditional isn't modeled, just both preset
  sets offered together).

**Root-cause note, not just a fix log:** the 2026-07-06 pass's stated
methodology ("verified directly against the CMS's source, not derived
from memory or convention") was sound in principle but not followed
literally enough in practice for every option string — several of the
above read as plausible Ayurvedic terminology reconstructed from general
knowledge rather than transcribed character-for-character from the
actual file. The lesson for future passes on this doc: when a source
file is claimed as "read," the specific strings taken from it should be
checked against that file's current `git show`/content at the moment of
writing, not just once at the start of a large rebuild.

### Out-of-scope-but-related: Family History lives in a different tab

The disease × relation matrix (`FamilyHistorySection.tsx`) actually
renders inside the CMS's **Patient Intake** tab, not Examination or
Prescription. Included in this schema anyway by explicit decision
(2026-07-06) since it's real, relevant clinical data — but if the CMS
adds more Patient-Intake-only fields later (presenting concern
duration, past illnesses, allergies, supplemental medicines), those
are a separate follow-up, not assumed to be in scope here.

## Interfaces / contracts it exposes or depends on

- `ClinicalExtraction` (`packages/types`) / `clinicalExtractionSchema`
  (`packages/validation`) — the canonical shape, validated at the LLM
  output boundary (`packages/llm-client`) and the `apps/api` persistence
  boundary (same schema, one source of truth).
- `packages/llm-client/src/prompt.ts` — encodes every field, every
  canonical option list, and the "physical-exam findings only if
  stated aloud" rule as plain-English instructions to the LLM.
- `apps/web/src/features/clinical-ai/components/ReviewDraftPanel.tsx`
  — the doctor-facing editor for this exact shape.
- `medicines[].matchConfidence` is reserved for Milestone 9's
  deterministic medicine-master-list mapping step — the LLM always
  leaves it `null`.

## Open questions / known gaps

- The deterministic mapping step (architecture.md §7 stage 11,
  Milestone 9) that would resolve `medicines[].medicineName` /
  `treatments[].treatmentName` against the CMS's actual formulary and
  treatment-type master lists doesn't exist yet — this schema is
  shaped to make that mapping mechanical later, but the mapping itself
  is unbuilt.
- Gender-based srotas filtering (`shukravaha`/`artavavaha`) isn't
  applied anywhere in this repo — deferred to whatever eventually
  writes extraction data into the real CMS's `Consultation` row.
  `emotionalMakeup`'s exclusion and the Family-History-from-a-different-tab
  inclusion were both explicit product decisions on 2026-07-06 — worth
  revisiting if the CMS's live form changes again.
