---
date: 2026-07-18
task: multilingual-kannada-hindi-tamil-malayalam-sanskrit
---

# Multilingual support: Kannada, Hindi, Tamil, Malayalam, Sanskrit

## What changed

Extended the pipeline's multilingual handling beyond the original MVP
scope (English/Malayalam/Hindi code-switching) to explicitly target
Kannada, Hindi, Tamil, Malayalam, and Sanskrit (Ayurvedic terminology),
on the Gemini-only deployed path (the classic WhisperX+Pyannote path
stays untouched, out of scope). Gemini's transcription prompt now
names all five languages explicitly, tightens Ayurvedic-term spelling
normalization in the English `text` output, and adds a per-segment
`originalText`/`originalLanguage` capture so the verbatim original-
script wording is never silently discarded, even though English stays
the primary transcript used for extraction and review. The frontend
surfaces this: a language badge on the transcript header (the first
time `languageDetected`/`isCodeSwitched` — already persisted end-to-end
since an earlier migration — has ever been displayed), and a global
"Show Original" toggle rendering original-script text in a properly
scripted font. Full reasoning: `docs/adr/0016-multilingual-original-text-capture.md`.

## Files touched

- `packages/types/src/transcript-segment.ts` — added nullable `originalText`/`originalLanguage` to `TranscriptSegment`
- `packages/validation/src/consultation-transcript.schema.ts` — matching Zod validation
- `packages/llm-client/src/gemini-provider.ts` — transcription prompt rewritten for the 5 target languages + Ayurvedic-term normalization rule; `TRANSCRIPTION_RESPONSE_SCHEMA`/`transcriptionResponseSchema` gain the two new segment fields
- `workers/clinical-ai-worker/src/internal-api-client.ts` — classic WhisperX path explicitly sets `originalText`/`originalLanguage` to `null` (type-honesty fill-in at the actual construction site — not a WhisperX capability change)
- `apps/web/src/app/layout.tsx` — four Noto Sans script fonts (Devanagari/Kannada/Tamil/Malayalam) loaded as scoped CSS variables, Manrope stays the body default
- `apps/web/src/features/clinical-ai/components/TranscriptViewer.tsx` — language badge, global "Show Original" toggle, per-segment font selection
- `tests/eval/fixtures/consultation-02-kannada-codeswitch.{transcript,expected}.json`, `consultation-03-hindi.{transcript,expected}.json` — new eval fixtures
- `tests/eval/fixtures/consultation-01.transcript.json` — backfilled with the new fields (`originalText`/`originalLanguage: "en"`) for type-honesty consistency
- `tests/eval/src/score.ts`, `tests/eval/src/expectation.ts` — fixed a latent bug found while writing the new fixtures (see below)
- `docs/adr/0016-multilingual-original-text-capture.md` — new ADR
- `docs/INDEX.md`, `docs/PROJECT_STATUS.md` — updated

## Decisions made

- Kept English as the primary/default transcript (used for extraction
  and the default review view) rather than switching to
  original-language-primary — the user's explicit choice, keeps
  extraction and `ReviewDraftPanel` completely untouched. Full
  reasoning in ADR-0016.
- `originalText`/`originalLanguage` are nullable, not always-populated
  — matches the exact existing precedent of
  `isMultilingual`/`isCodeSwitched` (null on the classic WhisperX path)
  rather than inventing a compatibility value.
- Sanskrit (`sa`) is scoped as a terminology-preservation tag, not a
  primary spoken-language target — the prompt explicitly tells the
  model not to tag every familiar Ayurvedic noun as a language switch.
- Global "Show Original" toggle instead of a per-segment expand — a
  real consultation is typically conducted mostly in one language, so
  flipping the whole transcript's view at once matches actual usage
  better (this replaced an initial per-segment-expand design, changed
  based on direct user feedback during planning).

## Follow-ups / left undone

- **Bug found and fixed in `tests/eval/src/score.ts`**: the
  `familyHistory` and `treatments` checks were each a single
  unconditional check (not the safe per-keyword-loop pattern
  `dietAvoid`/`dietEat`/`lifestyleMaintain` use) — when a fixture had
  nothing to expect there (e.g. no family history ever mentioned), the
  check would always report a false failure rather than being skipped.
  Discovered because the new Kannada/Hindi fixtures needed to express
  "no family history in this transcript." Fixed by skipping the check
  when the expectation is empty, same as the existing per-keyword-loop
  fields already did implicitly.
- Extraction prompt tuning (originally scoped as an optional Phase 4)
  deferred — no measured comprehension problem to fix yet; only worth
  doing once eval results show it's needed.
- Audio-level eval fixtures (real transcription accuracy per language)
  not started — needs real or sourced audio in each language plus
  hand-transcribed ground truth, a content-acquisition dependency
  outside this session's engineering work.
- Actual Gemini transcription quality for Kannada/Tamil/Malayalam
  specifically remains unverified — this work builds the scaffolding
  and a starting eval harness to measure it, not a quality guarantee.
