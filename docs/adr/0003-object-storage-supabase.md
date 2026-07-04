# ADR-0003: Object storage — Supabase Storage

- Status: accepted
- Date: 2026-07-04
- Context: Repo B already provisions `SUPABASE_URL` /
  `SUPABASE_PUBLISHABLE_KEY` for Storage even after moving relational
  data to Drizzle-managed Postgres (architecture.md §14). Raw
  consultation audio needs durable, versioned, encrypted-at-rest
  object storage with short-lived signed upload/read URLs.
- Decision: Use Supabase Storage for raw audio in the MVP. Browsers
  never receive a permanent storage URL — uploads use short-lived
  signed upload URLs issued by `apps/api`, playback uses short-lived
  signed read URLs, neither cached client-side beyond the session
  (§14).
- Consequences: Ties storage to Supabase's default encryption-at-rest
  and its operational characteristics. An S3-compatible object store
  remains a documented fallback option if clinic-scale audio volume
  later argues for a dedicated store — that would be a new ADR
  superseding this one, not a silent swap, since it affects the
  storage adapter's signed-URL contract.
