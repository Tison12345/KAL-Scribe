# ADR-0011: Milestone 7 extraction implementation choices

- Status: accepted
- Date: 2026-07-05
- Context: Milestone 7 (architecture.md §18) needed three implementation
  calls that the architecture document left open pending this
  milestone's own work: (1) single-pass vs. two-pass extraction+SOAP
  (§7 stage 9 explicitly deferred this "pending eval, Milestone 7"),
  (2) how to actually guarantee the LLM's JSON conforms to §11's
  schema, given §10's own evaluation notes that structured-output
  support varies by vendor/model, and (3) where the LLM provider
  abstraction's calling code actually lives, given docs/adr/0010's
  worker-calls-things-directly pattern.
- Decision:
  1. **Single-pass extraction+SOAP**, per §7 stage 9's own MVP
     recommendation — one LLM call produces the full §11 JSON
     including the `soap` object, rather than a second call just for
     the SOAP narrative. Revisit only if the eval harness (tests/eval)
     shows a real quality gain from separating the two, which nothing
     observed so far suggests.
  2. **JSON mode + zod validation + one retry-with-feedback**, not a
     vendor-specific strict-schema mode. Groq's chat completions API
     is called with `response_format: { type: "json_object" }`
     (guarantees syntactically valid JSON, not schema conformance).
     The response is parsed and validated against
     `packages/validation`'s `clinicalExtractionSchema` — the same
     zod schema apps/api uses to validate the persisted request body,
     so there is exactly one schema definition, not two. If validation
     fails, the conversation is replayed once with the validation
     error appended, asking the model to correct it; if the retry also
     fails, the job fails loudly (visible via the existing dead-letter
     path, docs/log 2026-07-05 milestone-4) rather than persisting
     malformed data.
  3. **The LLM provider abstraction lives in a new shared package,
     `packages/llm-client`**, not in `apps/api/infrastructure/
     llm-provider.adapter.ts` as §5 originally listed. This directly
     follows from docs/adr/0010: since the worker (not apps/api) is
     what actually calls external inference providers, the STT client
     already lives in the worker (not apps/api) for the same reason.
     Making this a real shared package (rather than duplicating it
     into both `workers/clinical-ai-worker` and `tests/eval`) exists
     specifically because the eval harness needs to exercise the exact
     same provider code path the worker uses in production — a
     hand-copied second implementation would let the two silently
     drift and make the eval harness's numbers meaningless.
- Consequences:
  - `packages/llm-client` depends on `@kal-scribe/types` and
    `@kal-scribe/validation`, and is depended on by both
    `workers/clinical-ai-worker` and `tests/eval` — the same
    "shared package, not a duplicated file" pattern this repo already
    uses for its type/validation layers.
  - Adding a second LLM vendor later means one new file in
    `packages/llm-client` (e.g. `claude-provider.ts`) implementing the
    same `LlmProvider` interface, selected via `LLM_PROVIDER` — no
    change to the worker or the eval harness's calling code, matching
    §10's provider-independence requirement.
  - A missing `GROQ_API_KEY` fails loudly (`loadLlmProvider` throws)
    rather than gracefully degrading the way diarization does without
    `HF_TOKEN` — there is no meaningful placeholder extraction output,
    unlike diarization's legitimate single-speaker fallback.
