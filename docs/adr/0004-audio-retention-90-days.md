# ADR-0004: Raw audio retention window — 90 days (default, pending legal review)

- Status: proposed — recorded here as the working default so it's
  visible and configurable, not silently assumed; needs explicit
  legal/compliance sign-off before this is treated as final (see
  architecture.md §15's healthcare-compliance note)
- Date: 2026-07-04
- Context: Raw audio and transcripts are PHI by definition
  (architecture.md §14–§15). Retention must be long enough to allow
  doctor dispute resolution or re-processing after a pipeline bug fix,
  short enough to bound PHI exposure — and must be a configurable
  value, not hardcoded, since clinic/legal requirements may differ by
  jurisdiction (HIPAA-equivalent vs. India's DPDP Act considerations).
- Decision: Default raw-audio retention window is 90 days
  post-consultation, enforced by a scheduled BullMQ repeatable cleanup
  job (observable the same way every other job is, not an
  out-of-band cron job), reading the window from `packages/config`.
  Soft-delete first (`deleted_at` set, object scheduled for purge),
  then a hard-delete job actually removes the object and nulls
  `storage_key` (§14). Transcript and extraction records may be
  retained longer than raw audio by default, or set equal if legal
  requires audio and transcript to expire together.
- Consequences: This number is a placeholder engineering default, not
  a compliance-reviewed policy. Before this module handles real PHI in
  production, legal/compliance must confirm (or override) the 90-day
  figure and the transcript/extraction retention relationship; that
  review should land as a new ADR (superseding this one if the number
  changes) rather than a silent config edit.
