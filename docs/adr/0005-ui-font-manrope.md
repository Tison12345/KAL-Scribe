# ADR-0005: UI font — Manrope, not the Marcellus/Figtree pairing

- Status: accepted
- Date: 2026-07-04
- Context: `docs/design/ui-guidelines.md` (and `architecture.md` §6)
  specify Marcellus for headings and Figtree for body/UI text.
  `docs/design/ui-reference.md` — extracted directly from the live PK
  Protocol Builder screens doctors use today — documents Manrope as
  the actual font loaded in `app/layout.tsx` and applied repo-wide
  (headings and body alike, via `className={manrope.className}` on
  `<body>`), alongside Material Symbols Outlined for icons.
  `ui-reference.md` itself flags this exact situation: "When this file
  and ui-guidelines.md conflict, ask first." Asked; user confirmed the
  Marcellus/Figtree pairing was never actually implemented in the CMS
  app, making `ui-guidelines.md` the stale document on this point, not
  `ui-reference.md`.
- Decision: Every clinical-ai screen loads and uses Manrope only
  (headings and body), the same way the existing PK Protocol Builder
  does, via `next/font` applied at the root layout. The
  Marcellus/Figtree pairing from `ui-guidelines.md` is not used
  anywhere in this repo.
- Consequences: This repo's UI matches the real, currently-shipping
  CMS screens pixel-for-pixel on typography, which is the actual goal
  behind §6's "visual consistency" requirement — truer to that intent
  than literally following the brand doc where it disagrees with
  production. `docs/design/ui-guidelines.md` itself is not edited by
  this ADR (it's a copy kept in sync with the source CMS repo per
  architecture.md §6, not forked/reinvented here) — if it should be
  corrected, that correction belongs upstream in the source CMS repo,
  not in this one. Any future contributor to this repo's UI should
  treat `ui-reference.md` as authoritative over `ui-guidelines.md`
  specifically on font choice.
