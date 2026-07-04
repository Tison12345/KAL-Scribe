# Clinical AI Module — Repository Instructions

## What this is

Standalone Clinical AI repository — automates clinical documentation from
doctor-patient consultation audio (transcription, speaker diarization,
structured clinical extraction, doctor review). Built to be copied into
`KAL_CMS` (Repo B) once mature. Full architecture reference:
`docs/architecture.md` (copy of `clinical-ai-architecture.md` from the
planning phase — treat it as the source of truth for structure and
conventions; update it in place if a real decision diverges from it).

## Documentation maintenance — read this before finishing any task

This repo maintains living documentation in `docs/`. **After completing any
task** (a feature, a fix, a milestone, a schema change, a provider swap —
anything that changes what the repo does or how it's built):

1. Update `docs/PROJECT_STATUS.md` in place so it reflects the current state.
   Do not let it go stale — this file is the one-glance summary someone
   (including a future you, or a future AI session with no memory of this
   one) reads first.
2. Add one dated entry to `docs/log/` for the task, using
   `docs/log/_template.md` as the shape. Never edit a past log entry —
   append a new one instead, even to correct something (note the correction
   in the new entry).
3. If the task materially changed a specific module or service's design
   (not just its implementation detail), update the matching file in
   `docs/modules/`. If no file exists yet for that module, create one using
   `docs/modules/_template.md`.
4. If the task involved a non-obvious decision (choosing between two
   approaches, picking a vendor, deviating from `docs/architecture.md`),
   write it up as a new file in `docs/adr/` using `docs/adr/adr-template.md`.

**This applies automatically, without being asked.** The user may also
explicitly say "update the docs" at any point mid-task — do that
immediately when asked, not just at task end.

Keep every one of these updates **short**. `PROJECT_STATUS.md` in
particular should stay skimmable — a paragraph of "what changed" and a
bullet list of "what's next," not a re-explanation of the whole system.

## Rules

- Follow `docs/architecture.md` and its referenced conventions (Repo B's
  module/feature layering, naming patterns, provider-abstraction
  requirements) — flag before introducing anything that deviates from it.
- Before building any UI component, read `docs/design/ui-guidelines.md` and
  `docs/design/ui-reference.md` first (see `docs/architecture.md` §6 "Visual
  consistency with the existing CMS" and §20 principle 11). This module's
  screens must look like part of the existing CMS, not a separate product —
  same colors, fonts, tone, and component patterns. Never introduce a new
  color, font, or UI pattern without recording it as an ADR first.
- Never hardcode credentials — always use environment variables.
- Validate all input at every module/service boundary (see
  `docs/architecture.md` §20).
- No AI-derived clinical content reaches the doctor as already-authoritative
  — every AI-suggested field must be visually distinguishable until the
  doctor explicitly accepts it.
- Write readable code with comments only on non-obvious logic.
