# Documentation

Four kinds of doc, each with its own rule for when it changes:

| File/folder | Updated | Purpose |
|---|---|---|
| `architecture.md` | Rarely — only when the *plan* changes | The original blueprint (copied in from `clinical-ai-architecture.md` at repo setup). Source of truth for structure and conventions. |
| `PROJECT_STATUS.md` | After every task | One-glance current state: what's built, in progress, not started, known issues, next up. |
| `log/` | After every task, append-only | Dated diary of what happened and why. Never edited after the fact. |
| `modules/` | When a module's design meaningfully changes | Living per-module docs — current shape, not history. |
| `adr/` | When a non-obvious decision is made | Why a specific call was made, permanently on record. |

See each subfolder's own `README.md` for the exact convention. The
governing rule for *how* these get maintained lives in this repo's root
`CLAUDE.md` — read that first if you're picking up work here for the first
time.

## Setup step (do this once, at repo creation)

Copy `clinical-ai-architecture.md` from the planning repo into this file's
sibling, `docs/architecture.md`, before starting Milestone 1. Everything
above assumes it is already there.
