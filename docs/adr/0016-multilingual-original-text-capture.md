# ADR-0016: Multilingual support — capture original-language text, nullable per-provider

- Status: accepted
- Date: 2026-07-18
- Context: The pipeline's MVP scope (architecture.md §2, §19) was
  originally English/Malayalam/Hindi code-switching only, with broader
  multilingual expansion explicitly flagged as an unaddressed future
  item. The user asked for real support for Kannada, Hindi, Tamil,
  Malayalam, and Sanskrit on top of English. Gemini's transcription
  prompt (`packages/llm-client/src/gemini-provider.ts`) already
  translates non-English speech into English before anything else
  touches the transcript, keeping only Ayurvedic/Sanskrit terms
  verbatim — this loses the patient's/doctor's exact original wording,
  which matters for audit and dispute resolution in a clinical
  context. Three decisions were needed together: whether to keep
  translating or switch to preserving original wording as primary,
  how to model any newly-captured original-language data given the
  provider asymmetry (only Gemini understands audio directly — the
  classic WhisperX path, out of scope here but still present in the
  codebase, has no equivalent signal), and how to render non-Latin
  scripts (Devanagari, Kannada, Tamil, Malayalam) given the current
  font (Manrope) only covers Latin.
- Decision:
  1. **Keep translating to English as the primary/default transcript**
     (used for extraction and the default review view), but **also
     capture each segment's original-language wording** (`originalText`)
     and its dominant language (`originalLanguage`, ISO 639-1) —
     doctors review the English draft by default; original wording is
     an optional, toggleable secondary view, not a UI overhaul. This
     avoids touching the extraction step at all (it keeps consuming
     English `text` exactly as today) while no longer silently
     discarding what was actually said.
  2. **`originalText`/`originalLanguage` are nullable on
     `TranscriptSegment`**, not always-populated. This deliberately
     matches the exact existing precedent already established for
     `SpeechUnderstandingMetadata.isMultilingual`/`isCodeSwitched`:
     "only meaningfully reportable by a model that understands the
     audio directly — null on the classic WhisperX path." An
     alternative considered was always populating both fields (with a
     compatibility shim mirroring `text` for the classic path), but
     nullable is simpler, matches the codebase's own idiom exactly,
     and is honest about what data is actually available per provider
     rather than inventing a value. The classic path
     (`workers/clinical-ai-worker/src/main.ts`'s non-Gemini branch)
     explicitly sets both to `null` for type-honesty — a two-line
     change, not a WhisperX capability change; `python/asr-service`
     itself is untouched.
  3. **Sanskrit (`sa`) is a terminology-preservation tag, not a
     primary spoken-language target.** A real consultation won't be
     conducted in fluent spoken Sanskrit; "Sanskrit support" means
     correctly recognizing and preserving Ayurvedic Sanskrit
     terminology (dosha names, srotas names, agni/ojas states)
     embedded in Hindi/Kannada/Tamil/Malayalam/English speech. The
     transcription prompt explicitly reserves `sa` for genuine
     multi-word Sanskrit phrases, not every familiar Ayurvedic noun
     already expected in the English `text` — otherwise
     `isMultilingual`/`isCodeSwitched` would be perpetually true and
     useless as a signal.
  4. **Ayurvedic-term spelling is normalized in `text` but not in
     `originalText`.** The prompt already asks the model to keep
     Ayurvedic terms "as actually spoken" in the English `text`; this
     is tightened to require standard Sanskrit-transliteration
     spelling specifically (always "Vata"/"Pitta"/"Kapha", never
     phonetic respellings like "Vatha") since downstream extraction
     matches this spelling against fixed clinical dropdown options
     that must match an external CMS's literal values exactly
     (`docs/modules/clinical-extraction-schema.md`). `originalText`
     stays an unmodified verbatim record — normalization only ever
     applies to the English side.
  5. **Original-language text rendering uses four separate Noto Sans
     script variants** (Devanagari, Kannada, Tamil, Malayalam), loaded
     scoped to `TranscriptViewer.tsx`'s original-text view only — not
     applied globally, not applied to `ReviewDraftPanel.tsx` (which
     stays English-only, no UI localization). Google Fonts has no
     single family spanning all four scripts; the four Noto Sans
     variants share the same design language, so mixing them reads as
     one coherent typographic system. Loaded via `next/font/google`'s
     `variable` mode (CSS custom properties only) so the global body
     font stays Manrope, unaffected — per this repo's rule that a new
     font requires an ADR (precedent: `docs/adr/0005-ui-font-manrope.md`),
     recorded here rather than a separate file since it's a small,
     tightly-scoped addition alongside the rest of this decision.
- Consequences:
  - `packages/types/src/transcript-segment.ts`,
    `packages/validation/src/consultation-transcript.schema.ts`, and
    `packages/llm-client/src/gemini-provider.ts` gain the two new
    fields; no DB migration needed (`consultation_transcripts.segments`
    is a single jsonb column with no per-field Drizzle mapping).
  - `packages/llm-client/src/prompt.ts`'s extraction prompt is
    unchanged in this phase — it never reads `originalText`, only the
    existing English `text` (see the follow-up prompt-tuning item
    noted in `docs/modules/clinical-ai-pipeline.md` if extraction-side
    comprehension issues surface later).
  - No eval fixtures exist yet for any of the five target languages
    (transcript-level fixtures are cheap to add and don't require
    audio; audio-level accuracy validation requires real recorded/
    sourced audio per language, a content-acquisition dependency
    outside this change).
  - Actual Gemini transcription quality for Kannada/Tamil/Malayalam
    specifically remains unverified by this change alone — this ADR
    records the scaffolding/design decisions, not a quality guarantee.
