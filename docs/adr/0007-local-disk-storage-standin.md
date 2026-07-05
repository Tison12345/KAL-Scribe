# ADR-0007: Local-disk storage stand-in, pending a real Supabase project

- Status: accepted — explicitly a stand-in, not a replacement for
  ADR-0003 (Supabase Storage remains the intended production choice)
- Date: 2026-07-04
- Context: Milestone 3 (Storage, architecture.md §18) needs a working
  upload session API now, but no Supabase project exists yet for this
  repo to connect to (user chose "build against local stand-ins" over
  setting one up first). Building the whole vertical slice — upload
  API, chunked resumable upload, `consultation_recordings` lifecycle —
  without real object storage would either mean stubbing so much that
  nothing is genuinely exercised, or blocking on external account
  setup before any progress could be made.
- Decision: `infrastructure/storage.adapter.ts` in
  `modules/clinical-ai/` defines the `StorageAdapter` interface
  (`createUploadTarget`, `createReadUrl`) that a real Supabase-backed
  adapter will also implement. `LocalDiskStorageAdapter` implements it
  today, writing to `STORAGE_LOCAL_DIR` on the local filesystem, using
  genuinely short-lived, HMAC-signed tokens (`STORAGE_SIGNED_URL_SECRET`)
  for its upload/read URLs — the same signed-URL *shape* a real
  Supabase Storage integration will produce, not a simplified stand-in
  contract. Because this implementation must also serve as its own
  tiny object store over HTTP (browsers PUT/GET directly against it),
  it needs a dedicated `LocalStorageController` at
  `/clinical-ai/storage/objects` and a raw-body middleware registration
  in `main.ts` — neither of which a real Supabase adapter would need,
  since Supabase Storage would serve the signed URL itself.
  `STORAGE_DRIVER=local` is the only value accepted today; a
  `STORAGE_DRIVER=supabase` value plus a `SupabaseStorageAdapter` class
  is the whole scope of the future swap.
- Consequences: Uploaded audio currently lives only on whatever machine
  runs `apps/api` locally — no real durability, no encryption-at-rest
  guarantee beyond the host filesystem's own, and nothing resembling
  production storage semantics (Supabase's retention, access policies,
  CDN, etc.). This is acceptable only because it's explicitly dev-only
  and gitignored (`.data/`). Before this repo handles real PHI-bearing
  audio, `LocalDiskStorageAdapter`/`LocalStorageController` must be
  replaced with a real Supabase-backed adapter — tracked as a known gap
  in `docs/PROJECT_STATUS.md`, not assumed done.
