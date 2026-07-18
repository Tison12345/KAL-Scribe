import { z } from "zod";

const apiEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  // 3001, not 3000 — apps/web's Next dev server already defaults to 3000.
  PORT: z.coerce.number().int().positive().default(3001),
  /** Required — no embedded local-dev stand-in (docs/adr/0014
   * supersedes docs/adr/0008's PGlite stand-in). Real Postgres (e.g.
   * Supabase's) from day one, even for local dev. */
  DATABASE_URL: z.string().min(1),
  /** Supabase Storage — the only storage backend (docs/adr/0014
   * supersedes docs/adr/0007's local-disk stand-in). The **secret** key
   * (`sb_secret_...`), not the publishable key — signing upload/read
   * URLs for arbitrary paths needs it. This is Supabase's current key
   * naming, replacing the legacy JWT-based `service_role` key (which
   * Supabase is deprecating by end of 2026); a `sb_secret_...` value
   * works as a drop-in with `createClient`, same permissions. */
  SUPABASE_URL: z.string().min(1),
  SUPABASE_SECRET_KEY: z.string().min(1),
  SUPABASE_STORAGE_BUCKET: z.string().min(1),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;

/**
 * Parses and validates apps/api's environment once at startup. Never
 * read `process.env.*` ad hoc elsewhere in apps/api — this is the one
 * place that happens, per architecture.md §20's "validate at every
 * boundary" (env is a boundary too).
 */
export function parseApiEnv(source: NodeJS.ProcessEnv = process.env): ApiEnv {
  return apiEnvSchema.parse(source);
}
