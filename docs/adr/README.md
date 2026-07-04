# Architecture Decision Records

One file per non-obvious decision — vendor choices (STT/LLM provider),
schema versioning calls, anything where "why did we pick this" won't be
obvious from reading the code later. Name files `NNNN-short-slug.md`
(e.g. `0001-stt-provider-whisperx.md`), numbered in creation order. Use
`adr-template.md` as the shape.

Rules:

- Don't edit an old ADR's decision after the fact — if a decision changes,
  create a new ADR and mark the old one's `Status:` as
  `superseded by ADR-NNNN`.
- Not every choice needs an ADR — only ones a future reader would
  reasonably ask "wait, why did we do it this way?" about.
