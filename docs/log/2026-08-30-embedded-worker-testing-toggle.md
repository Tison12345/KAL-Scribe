---
date: 2026-08-30
task: embedded-worker-testing-toggle
---

# Embedded-worker testing toggle, so a non-technical tester needs only the deployed frontend

## What changed

Added `EMBEDDED_WORKER`, a boolean env var on `apps/api` (default
`false`). When true, `apps/api`'s own process — right after it starts
listening for HTTP requests — also imports `@kal-scribe/clinical-ai-worker`,
which runs that package's existing job-processing loop (both the
transcription and extraction queues) inside the same process, instead
of it needing to be a separately run/deployed service. This exists so
a non-technical teammate testing with a single doctor can use only the
already-deployed Vercel frontend — no terminal, no separate worker
process, no new Render service to provision or pay for. Documented as
`docs/adr/0018`, explicitly as a testing-mode toggle, not a reversal of
`docs/adr/0010`'s decision to keep the worker separate for real
production use.

No changes were needed inside `workers/clinical-ai-worker` itself —
its `main.ts` already runs its full bootstrap as a top-level side
effect on import (it was written to be run directly, not imported, but
that turns out to be the same thing from Node's perspective), so
embedding it needed only: a `main` field on its `package.json` so it's
resolvable as an import target, and an ambient `.d.ts` declaration in
`apps/api` (a side-effect-only import — no named exports are used, and
the worker package was never built with type declarations, since it
was always meant to be a leaf app, not a library).

## Files touched

- `packages/config/src/api-env.ts` — added `EMBEDDED_WORKER` to `ApiEnv`.
- `apps/api/src/main.ts` — after `app.listen()`, conditionally sets `API_BASE_URL` to this process's own resolved port and imports the worker package.
- `apps/api/package.json` — added `@kal-scribe/clinical-ai-worker` as a workspace dependency.
- `workers/clinical-ai-worker/package.json` — added `"main": "dist/main.js"` so it's a resolvable import target.
- `apps/api/src/types/clinical-ai-worker.d.ts` (new) — the ambient module declaration.
- `apps/api/.env.example` — documents the toggle and what it needs.
- `docs/adr/0018-embedded-worker-testing-toggle.md` (new).

## Decisions made

- **`API_BASE_URL` is set programmatically from `apps/api`'s own resolved `PORT`, not a second env var kept in sync by hand.** The worker only ever talks to `apps/api` over HTTP (unchanged — `docs/adr/0010`); when embedded, that just means it's calling itself. Computing the URL from the port `apps/api` actually bound to avoids a class of "forgot to update the second var" bugs.
- **No refactor of the worker's job-processing logic.** The temptation was to rewire it to call NestJS use-cases directly in-process (skipping the HTTP round-trip entirely) — deliberately not done. Keeping the HTTP-call structure intact means the exact same code path runs whether the worker is embedded or standalone, so there's only one implementation to keep correct, and turning the toggle off later requires zero code changes.
- **Left `EMBEDDED_WORKER=false` in the local `.env` after testing**, even though it was set to `true` to verify this — so a plain local `pnpm dev` on `apps/api` doesn't unexpectedly also start hitting Gemini/Groq. Testing the embedded path again means deliberately flipping it back on.

## Follow-ups / left undone

- **Enabling this on the actual deployed Render service** — needs `EMBEDDED_WORKER=true` plus the LLM provider keys added to `apps/api`'s Render environment variables. That's a dashboard step outside what this session can do (no Render CLI/API access configured) — instructions were given to the user instead of done directly.
- This mode was verified with a short, single test recording locally — not load-tested, and not intended to be (single-doctor manual testing is the entire point; this should not be left on for anything beyond that).
