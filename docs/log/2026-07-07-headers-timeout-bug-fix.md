---
date: 2026-07-07
task: headers-timeout-bug-fix
---

# Fix: asr-service calls were dying at 300s regardless of the 20-minute timeout

## What changed

A real ~7-minute test consultation, recorded live through the browser,
reliably failed transcription after exactly 3 retries, always with
`fetch failed` from the worker. The Milestone 8 long-audio timeout fix
(docs/log/2026-07-05-milestone-8-long-audio-timeout-bug.md) had added
`signal: AbortSignal.timeout(20 * 60 * 1000)` to the worker's call to
python/asr-service, on the theory that Node's default fetch agent gives
up at 300s. That diagnosis was right, but the fix was incomplete:
`AbortSignal` only aborts a request early: it does nothing to undici's
own, separate `headersTimeout`/`bodyTimeout` connection-level settings
(300s each by default), which fire independently and are what actually
killed the connection. Confirmed by reproducing outside BullMQ
entirely — a plain Node script POSTing the same audio directly to
asr-service failed at 304s with `UND_ERR_HEADERS_TIMEOUT`, `cause:
HeadersTimeoutError`. Since python/asr-service blocks its single event
loop for the whole transcribe+diarize duration before sending any
response bytes, any recording needing more than ~300s of processing
(roughly anything over ~2.5 minutes of audio, given the ~2x CPU-only
ratio) was always going to hit this — the "fix" never actually worked
for a real multi-minute consultation, only for the short test clips
used to verify it at the time.

Real fix: Node's global `fetch` has no way to override undici's
built-in timeouts (the `Agent` class isn't exposed through it). Added
`undici` as an explicit dependency of workers/clinical-ai-worker and
switched `processAudio()` to undici's own `fetch`/`FormData`, dispatched
through a dedicated `Agent` with `headersTimeout`/`bodyTimeout` both
raised to the same 20-minute ceiling as the `AbortSignal`. Verified by
reprocessing the same real recording (`dd1a15b6-...`) through the
now-fixed worker: transcription completed in 4m36s, extraction in 5s,
full `ClinicalExtraction` persisted successfully.

Also fixed during this session, as a side effect of debugging: found
and killed several duplicate `nest start --watch` / `tsx watch`
process trees for apps/api and the worker that had accumulated from
repeated dev-server restarts — these were racing for port 3001 and
intermittently dropping connections (`ECONNRESET`), which is what
first misled the investigation before the real 300s headers-timeout
cause was isolated.

## Files touched

- `workers/clinical-ai-worker/package.json` — added `undici` as an
  explicit dependency.
- `workers/clinical-ai-worker/src/internal-api-client.ts` — `processAudio()`
  now uses undici's own `fetch`/`FormData`/`Agent` (not the global
  ones) so `headersTimeout`/`bodyTimeout` can be raised to 20 minutes.

## Decisions made

- No ADR — this is a bug fix (the original timeout fix was incomplete),
  not a new design choice.

## Follow-ups / left undone

- `docs/PROJECT_STATUS.md`'s "known issues" entry for the 20-minute
  timeout has been corrected to point here instead of claiming the
  original fix worked.
- The underlying architectural gap this timeout papers over —
  asr-service has no request-cancellation, so a genuinely abandoned
  request still burns CPU to completion — is unchanged, still tracked
  as a known issue.
