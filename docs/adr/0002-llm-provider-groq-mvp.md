# ADR-0002: LLM provider — Groq-hosted Llama for MVP clinical extraction

- Status: accepted for MVP scope only — see Consequences for the open
  sub-decision this does not close
- Date: 2026-07-04
- Context: The clinical extraction step (§7 stage 8, §11 schema) is
  closer to constrained structured-information-extraction than
  open-ended reasoning: read a transcript, fill in a well-specified
  JSON schema. Full vendor comparison in architecture.md §10.
- Decision: Use Groq-hosted Llama 3.x for the MVP extraction step —
  low latency (doctor sees the draft almost immediately after the
  consultation ends) and materially lower per-token cost at
  clinic-scale volume, with adequate structured-output reliability for
  a constrained schema. This sits behind
  `infrastructure/llm-provider.adapter.ts`, one interface
  (`extractClinicalData(transcript, schema) -> ClinicalExtraction`)
  with one concrete implementation per vendor (`groq.provider.ts`,
  `claude.provider.ts`, ...), selected via `LLM_PROVIDER` env var — the
  §11 JSON schema itself never varies by vendor. Frontier models
  (Claude, GPT, Gemini) remain the intended step-up path for harder,
  more open-ended reasoning (future dosha analysis, low-confidence
  re-checks, §19), not a replacement for this MVP choice.
- Consequences: Every LLM call sends transcript text — PHI — to a
  third-party API. Architecture.md §15 explicitly flags "cloud LLM vs.
  local LLM" as a decision that needs legal/compliance input before
  production PHI handling, not a default engineering choice; this ADR
  covers only the MVP/engineering-side choice of *which* cloud vendor
  to build against first, made possible specifically because the
  provider abstraction makes switching (including to a self-hosted
  Ollama model, if compliance requires data to never leave our
  infrastructure) a config change later, not a rewrite. That
  compliance decision itself is still open and should get its own ADR
  once legal weighs in.
