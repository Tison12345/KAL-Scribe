# ADR-0008: PGlite as the local-dev Postgres stand-in

- Status: accepted for local dev/test only — architecture.md's actual
  target remains a real, Drizzle-managed Postgres (Supabase's or any
  other host) in every real environment
- Date: 2026-07-04
- Context: Milestone 3 needs `consultation_recordings` persisted
  somewhere. No hosted Postgres exists for this repo yet, and Docker
  isn't available in this dev environment (`docker` resolves to
  nothing), ruling out `infrastructure/docker/docker-compose.yml`'s
  planned local Postgres/Redis/asr-service composition for now.
- Decision: `apps/api/src/infrastructure/database/client.ts` picks its
  driver based on whether `DATABASE_URL` is set. Set → a real Postgres
  connection via `drizzle-orm/node-postgres`, no different from talking
  to Supabase's own Postgres. Unset → an embedded PGlite instance
  (`@electric-sql/pglite`, a real Postgres compiled to WASM) persisted
  to disk under `PGLITE_DATA_DIR`, needing neither Docker nor a native
  Postgres install. Both branches run the exact same Drizzle schema and
  migrations (`drizzle-kit generate` output in
  `infrastructure/database/migrations/`) through the same
  `runMigrations` function — repository code never needs to know or
  care which one is live, since both speak the same Drizzle query
  builder API against the same schema.
- Consequences: Local dev/test needs zero external accounts or
  installed services to run `consultation_recordings` end-to-end — a
  fresh clone works immediately. The tradeoff is that PGlite is not
  literally the same Postgres binary/version Supabase runs, so a
  genuinely Postgres-version-specific behavior could theoretically
  differ between PGlite and production — not expected to matter at
  this schema's current complexity (one table, one enum, no
  extensions), but worth remembering if something passes locally and
  fails against real Supabase Postgres later. Setting `DATABASE_URL`
  once a real Postgres exists requires no code change, only an env var.
