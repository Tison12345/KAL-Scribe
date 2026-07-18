---
date: 2026-07-09
task: extraction-schema-field-audit
---

# Second-pass field audit against the real CMS form (schema 2.0 → 2.1)

## What changed

The user asked for the review UI to match the existing CMS's clinical
form. Before touching UI, re-verified the 2026-07-06 extraction schema
rebuild option-by-option against the CMS's actual source files (not
trusting that rebuild's own "verified field-by-field" claim), and found
several real discrepancies: 5 of the 8 Ashtavidha fields had wrong
option strings (partly matching a pre-2026-06-22 version of the CMS,
partly matching no version at all), Personal History's `bowel` field
was modeled as single-select with invented options instead of the real
8-option multi-select, `exercise` had an invented option, and
`treatments[].oilTempF` was typed as a Fahrenheit number when the live
form actually uses a categorical Ayurvedic-terminology dropdown. Also
found `vitals.bpPosition` is a fully invented field — no such input
exists anywhere in the live form. Fixed all of these across
`packages/types`, `packages/validation`, `packages/llm-client`'s
prompt, and `ReviewDraftPanel.tsx`; bumped `CLINICAL_EXTRACTION_SCHEMA_VERSION`
to `2.1`. Full derivation and reasoning: `docs/modules/clinical-extraction-schema.md`
§"Further corrections found 2026-07-09".

**Note on how this was done**: this edit happened while another Claude
Code session was concurrently active in this same repo. One collision
occurred mid-edit — `packages/types/src/clinical-extraction.ts`'s
`ExtractedTreatment` interface got corrupted into invalid TypeScript
(interleaved fragments from two simultaneous writes to the same lines).
Caught immediately via a live IDE diagnostic, paused, and repaired by
re-reading the file fresh and reconstructing the correct interface
before continuing. No other corruption was found, but every file edited
in this session was re-read immediately before each edit specifically
because of this risk, which caught a few files that had in fact already
been changed by the other session since last read.

## Files touched

- `packages/types/src/clinical-extraction.ts` — bumped schema version to
  2.1; removed `BpPosition` type and `Vitals.bpPosition`; changed
  `ExtractedTreatment.oilTempF` from `number | null` to `string | null`.
- `packages/types/src/index.ts` — removed `BpPosition` from exports.
- `packages/validation/src/clinical-extraction.schema.ts` — removed
  `bpPositionSchema` and `vitalsSchema.bpPosition`; changed
  `treatmentSchema.oilTempF` to `z.string().nullable()`.
- `packages/llm-client/src/prompt.ts` — removed `bpPosition` from the
  vitals JSON shape; corrected Mala/Jivha/Shabda/Sparsha/Akruti and
  Bowel/Exercise canonical option lists; changed `oilTempF`'s described
  type and added its canonical option list; expanded medicine `timing`
  guidance to cover both oral and external-application presets.
- `apps/web/src/features/clinical-ai/components/ReviewDraftPanel.tsx` —
  same option-list corrections applied to the UI; removed the BP
  position dropdown and its import, adjusted the vitals grid from 4 to
  3 columns; replaced the treatment oil-temp number input with a
  select + "Other" free-text pattern (matching Ashtavidha's own escape
  hatch); fixed `PRESSURE_OPTIONS`/`STROKE_OPTIONS` to render proper
  Title Case labels instead of raw stored values.
- `docs/modules/clinical-extraction-schema.md` — added the
  "Further corrections found 2026-07-09" section documenting every
  discrepancy and the root-cause note on why the first pass missed them.

## Decisions made

- Medicine `timing`'s real `consumptionMode`-driven conditional (oral
  vs. external-application preset lists) was **not** fully modeled —
  just combined both preset sets into one suggestion list, since the
  field is free text with suggestions either way, not a strict enum.
  Documented as a known simplification, not silently dropped.
- Treatment `bodyPart`'s real structure (Full Body / Local mode + a
  body-map region picker, `bodyParts: string[]`) was **not** built —
  kept as flat free text. A body-map UI is a much bigger, visual-design
  feature that doesn't naturally map from spoken audio anyway (a doctor
  says "lower back," not a body-map region code) — flagged as a
  deliberate scope limitation, not attempted here.

## Follow-ups / left undone

- `packages/types`' compiled `dist/` output is stale relative to these
  source edits — `apps/web`'s type-check will show stale errors
  referencing the old `oilTempF: number` shape until the workspace is
  rebuilt (`pnpm build` or equivalent). Not done in this pass.
- The `bodyPart`/`bodyParts` mode structure and `consumptionMode`-driven
  timing presets remain open items — see Decisions above.
- Live browser click-through of `ReviewDraftPanel` (already an open item
  from the 2026-07-06 rebuild) still hasn't happened — even more true
  now given this pass's changes to the Ashtavidha dropdowns, bowel
  multi-select, and the new oil-temp select.
