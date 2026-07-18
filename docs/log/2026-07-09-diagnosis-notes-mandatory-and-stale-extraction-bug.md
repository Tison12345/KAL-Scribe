---
date: 2026-07-09
task: diagnosis-notes-mandatory-and-stale-extraction-bug
---

# Diagnosis/clinical-notes prompt rules relaxed; stale extraction-result query bug fixed

## What changed

Following the Groq model swap to `llama-3.1-8b-instant` (rate-limit
workaround, see the Redis/rate-limit log entries from earlier today),
testing surfaced `modernDiagnosis` and `clinicalNotes` frequently
coming back null/empty. Investigated and made two deliberate prompt
changes after confirming with the user that `modernDiagnosis` (shown
directly to the patient) should stay conservative while
`clinicalNotes` (doctor-only, never patient-facing) should not:

- `modernDiagnosis`: relaxed from "ONLY if explicitly stated" to also
  allow a clear characterization of the underlying condition in
  different words (e.g. "your stomach lining is inflamed" → may
  restate as gastritis) — still null if the doctor never characterized
  a condition at all, so the anti-hallucination guarantee for this
  patient-facing field is intentionally kept, just less literal.
- `clinicalNotes`: made genuinely mandatory — prompt now requires a
  real 2-4 sentence summary, and `packages/validation`'s zod schema
  changed from `z.string()` to `z.string().min(1)` so an empty
  response now fails validation and triggers the existing
  retry-with-feedback path in `groq-provider.ts` instead of silently
  persisting a blank note.

Verified by re-triggering extraction on an existing transcript — but
the first re-check still showed the old empty result, which led to
finding a second, unrelated, pre-existing bug: `ConsultationAiResultRepository
.findByRecordingId()` had no `ORDER BY`, and `create-extraction-result
.use-case.ts` always inserts a new row per attempt rather than
upserting — so once a recording has more than one extraction attempt
(retries, re-enqueues), `GET .../extraction` could non-deterministically
return an old row instead of the latest one. Not caused by anything
today; it just hadn't surfaced before because no recording had needed
more than one extraction attempt until now. Fixed by ordering
`findByRecordingId` by `createdAt DESC`. Re-verified after the fix:
the true latest result had `modernDiagnosis: "hypostatic condition,
constipation"`, a real 4-sentence `clinicalNotes`, and `aiConfidence`
in the 0.6-0.9 range (previously all zeros).

## Files touched

- `packages/llm-client/src/prompt.ts` — relaxed rule 2
  (`modernDiagnosis`), added rule 9 (`clinicalNotes` mandatory).
- `packages/validation/src/clinical-extraction.schema.ts` —
  `clinicalNotes: z.string()` → `z.string().min(1)`.
- `apps/api/src/modules/clinical-ai/infrastructure/consultation-ai-result.repository.ts` —
  `findByRecordingId` now orders by `createdAt DESC`.

## Decisions made

- Kept `modernDiagnosis` conditional rather than fully mandatory, per
  the user's explicit choice — it's shown to the patient, so an
  AI-guessed diagnosis with no basis in what the doctor actually said
  is a real safety risk `clinicalNotes` doesn't carry.

## Follow-ups / left undone

- `consultation_ai_results` accumulating one row per extraction
  attempt (never cleaned up/deduped) is by design (auditability), but
  worth knowing if that table's growth ever needs addressing.
- Extraction quality on `llama-3.1-8b-instant` is still less reliable
  than the original `llama-3.3-70b-versatile` on other fields (e.g.
  missed a second medicine in one run) — this session's fixes target
  the two specific fields that were reported empty, not a general
  accuracy pass on the smaller model.
