# ADR-0018: `EMBEDDED_WORKER` — run the worker in-process, for single-doctor testing only

- Status: accepted
- Date: 2026-08-30
- Context: A non-technical teammate needs to test the full pipeline
  (record → transcribe → extract → review) end to end, using only the
  deployed Vercel frontend. `workers/clinical-ai-worker` is a
  deliberately separate deployable (docs/adr/0010) — normally someone
  has to run it themselves (a terminal, `pnpm dev`) or it has to be
  deployed as its own paid Render service. Neither is acceptable for
  this: the tester shouldn't need a terminal, and a second Render
  service isn't worth paying for just to support one doctor's manual
  test. At the same time, docs/adr/0010's reasoning for keeping the
  worker separate (a stuck transcription job must never compete with
  `apps/api`'s HTTP request latency; the worker gets deleted, not
  migrated, at CMS integration time) is still correct for real
  production use — this ADR is explicitly not reversing that decision,
  only suspending it behind a flag for this one testing scenario.
- Decision: Add `EMBEDDED_WORKER` (boolean env var, default `false`) to
  `apps/api`'s environment (`packages/config/src/api-env.ts`). When
  true, `apps/api`'s own bootstrap (`main.ts`), right after it starts
  listening for HTTP requests, also imports
  `@kal-scribe/clinical-ai-worker` — which runs that package's existing
  `main()` bootstrap (queue listeners for both the transcription and
  extraction queues) inside the same Node process, instead of it being
  a separate process. `API_BASE_URL` is set to
  `http://localhost:{apps/api's own resolved PORT}` immediately before
  the import, so the embedded worker's HTTP calls (it never touches the
  database directly, per docs/adr/0010 — that's unchanged) land on
  this same process rather than requiring a second, manually-kept-in-
  sync env var.

  No changes were made to `workers/clinical-ai-worker`'s own source —
  its `main.ts` already executes its full bootstrap as a top-level
  side effect on import, so embedding it needed nothing more than
  giving the package a `main` field (`package.json`) and an ambient
  type declaration in `apps/api` (a side-effect-only import, no named
  exports used, and the worker package deliberately isn't built with
  type declarations — it's a leaf app, not a library).

  Practical effect: with `EMBEDDED_WORKER=true` set on `apps/api`'s
  existing Render service (plus the Gemini/Groq keys `apps/api` didn't
  previously need), that one already-deployed, already-paid-for service
  now also processes both job queues. Nothing new is provisioned.
  `workers/clinical-ai-worker` as its own deployable is untouched and
  can still be run/deployed exactly as before.

- Consequences:
  - This is a **testing-mode toggle, not a new architecture**. The flag
    defaults to `false`; the documented separate-worker design
    (docs/adr/0010) remains the intended production shape and is
    unaffected unless this is explicitly turned on.
  - Concurrency isolation is lost while the flag is on: a slow
    transcription now *can* compete with `apps/api`'s own HTTP request
    handling, since they share one process — acceptable for a
    single-doctor manual test, not for real multi-doctor load.
  - `apps/api`'s Render service needs the LLM provider keys added to
    its environment when this is enabled — a real (if small) expansion
    of what that service can do, worth remembering to revert alongside
    the flag if this mode is ever turned off for good.
  - Turning this off later is exactly one env var change, not a code
    change — the embedded-worker code path is dead and harmless when
    `EMBEDDED_WORKER` is unset/false.
