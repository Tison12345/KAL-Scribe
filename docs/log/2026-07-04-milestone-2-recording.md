---
date: 2026-07-04
task: milestone-2-recording
---

# Milestone 2: Recording

## What changed

Built the client-side audio recording capture flow per
`docs/architecture.md` §18 Milestone 2: consent-confirmation UX,
`useAudioRecorder`, and `RecordButton`, inside
`apps/web/src/features/clinical-ai/`. Also added Tailwind CSS v4 to
`apps/web` (not set up in Milestone 1) since `docs/design/
ui-reference.md`'s entire component catalog is Tailwind-based, wired
in the Manrope font + Material Symbols Outlined icons + full color
token set, and replaced the Next.js starter homepage with a
dev-preview page that hosts the feature standalone (no real
consultation screen exists yet — per §17 Phase 1, everything upstream
of the CMS integration adapter is built and demoed standalone first).
Verified manually in a real browser per the project's UI-testing rule,
not just via typecheck/lint/build.

## Files touched

- `apps/web/src/features/clinical-ai/providers/ClinicalSessionProvider.tsx`
  — new. Scopes `sessionRef` + per-session consent state.
- `apps/web/src/features/clinical-ai/components/ConsentConfirmation.tsx`
  — new. Explicit, non-preset, per-session consent gate (§15).
- `apps/web/src/features/clinical-ai/hooks/useAudioRecorder.ts` — new.
  `MediaRecorder` capture chunked into 15s segments (§7 step 1), Web
  Audio `AnalyserNode`-driven level meter.
- `apps/web/src/features/clinical-ai/components/RecordButton.tsx` —
  new. Presentational only (receives state/callbacks as props, per
  §6's documented hooks/components split) — start/pause/resume/stop +
  level meter (ADR-0006).
- `apps/web/src/app/page.tsx` — replaced the create-next-app starter
  content with a dev-preview host for the above.
- `apps/web/src/app/layout.tsx` — Manrope via `next/font/google`,
  Material Symbols Outlined via `<link>` (matches how the real CMS
  loads it — `docs/design/ui-reference.md` §7).
- `apps/web/src/app/globals.css` — `@import "tailwindcss"`, the full
  color-token map from `ui-reference.md` §1, `.material-symbols-outlined`
  defaults, `fadeIn` keyframe.
- `apps/web/postcss.config.mjs` — new, Tailwind v4 PostCSS plugin.
- `apps/web/package.json` — added `tailwindcss`, `@tailwindcss/postcss`.
- Removed now-unused create-next-app starter assets:
  `page.module.css`, `public/{next,vercel,globe,file,window}.svg`.
- `docs/adr/0005-ui-font-manrope.md`,
  `docs/adr/0006-record-button-level-meter.md` — new.

## Decisions made

- **Font conflict, resolved with user input.** `ui-guidelines.md` says
  Marcellus/Figtree; `ui-reference.md` (extracted from the actual live
  PK Protocol Builder screens) uses Manrope. `ui-reference.md` itself
  says to ask when the two conflict — asked, user confirmed
  `ui-guidelines.md` is the stale document here (Marcellus/Figtree was
  never actually implemented). Recorded as ADR-0005.
- **Level meter visual design**, recorded as ADR-0006 per §6's explicit
  instruction that anything not covered by the existing guidelines
  needs a documented, minimal-extension design rather than silent
  invention: a single horizontal bar, primary-color fill, only visible
  while actively recording/paused.
- **Added Tailwind CSS v4 to `apps/web`**, not flagged as an ADR — this
  isn't a new visual pattern or independent decision, it's the
  mechanism required to reproduce `ui-reference.md`'s already-mandated,
  entirely-Tailwind-based component catalog. M1 had scaffolded the app
  with `--no-tailwind`, which turned out to be a mistake surfaced by
  actually needing to follow the design system.
- **`RecordButton` is presentational, not hook-calling** — followed
  §6's documented convention literally ("components stay dumb — they
  receive state and callbacks from hooks") rather than the more common
  React pattern of a component calling its own hook. `useAudioRecorder`
  is called by the page-level container instead.
- **Chunks stay in memory, untouched by this milestone** — no upload
  logic was added, since that's explicitly Milestone 3's scope, not
  this one. `useAudioRecorder` exposes chunks via its return value for
  a future consumer to pick up.

## Follow-ups / left undone

- **Real bug caught during manual browser verification, fixed in this
  same task**: `globals.css` had an unlayered CSS reset
  (`* { margin: 0; padding: 0 }`) that silently overrode every
  Tailwind utility class — Tailwind v4 wraps its utilities in cascade
  layers, and unlayered CSS always wins over layered CSS regardless of
  specificity. Symptom was a fully broken, edge-to-edge, overlapping
  layout on first browser check. Fixed by moving the reset into
  `@layer base` and dropping what Tailwind's own preflight already
  covers. Also caught in the same pass: `display=optional` on the
  Material Symbols `<link>` (added to satisfy an ESLint suggestion)
  caused icons to render as literal fallback text
  ("verified_user", "mic") instead of glyphs — `optional` is wrong for
  an icon font whose only fallback is unreadable text; switched to
  `display=block` with the lint rule explicitly suppressed and
  commented why.
- Recording chunks are not persisted anywhere beyond the open tab —
  expected and fine for this milestone, but worth remembering that a
  browser crash/refresh before Stop currently loses the whole
  recording (no partial-chunk durability until Milestone 3's upload
  exists).
- No automated test coverage added for the new hook/components yet
  (manual browser verification only) — `useAudioRecorder` is written
  to be testable with fake `MediaRecorder`/`AudioContext` per §20
  principle 7, but writing that test suite wasn't done in this pass.
