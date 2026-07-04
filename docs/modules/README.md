# Module Docs

Living, per-module/per-service documentation. One file per module (matching
`docs/architecture.md`'s module list — e.g. `clinical-ai-backend.md`,
`clinical-ai-frontend.md`, `asr-service.md`). Use `_template.md` as the
shape.

Rules:

- **Rewrite in place**, don't append — this describes the *current* design,
  not its history. If you want history, that's what `docs/log/` and git are
  for.
- Only describe things here that aren't already clear from
  `docs/architecture.md` — link back to it rather than re-explaining the
  original design. This file exists to capture *drift* from that plan and
  detail that only emerged during implementation.
