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
  /** Comma-separated allowed CORS origins (e.g.
   * "https://kal-scribe-web.vercel.app,https://staging.example.com").
   * Optional — unset falls back to permissive localhost-only CORS
   * (any port, since apps/web's dev port isn't fixed), which is fine
   * for local dev but must be set for any real deployment (audit
   * finding: CORS was previously fully open with no restriction at
   * all). See main.ts. */
  WEB_APP_ORIGIN: z.string().min(1).optional(),
  /** Testing-mode toggle (docs/adr/0018) — when true, this process also
   * runs workers/clinical-ai-worker's job-processing loop in-process
   * instead of it being a separately deployed/run service. Exists so a
   * single-doctor test doesn't need anyone to run a worker by hand;
   * NOT intended to stay on for a real multi-doctor deployment (see the
   * ADR for why). Defaults to false — the normal, documented
   * separate-worker architecture is unaffected unless this is
   * explicitly set. */
  EMBEDDED_WORKER: z
    .string()
    .optional()
    .transform((value) => value === "true"),
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
