import { z } from "zod";

const apiEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  // 3001, not 3000 — apps/web's Next dev server already defaults to 3000.
  PORT: z.coerce.number().int().positive().default(3001),
  /** Omitted → apps/api falls back to an embedded PGlite instance for
   * local dev/test (no Docker or hosted Postgres required). Set this
   * to switch to a real Postgres (e.g. Supabase's) with no code
   * changes — see docs/adr for the local-dev stand-in rationale. */
  DATABASE_URL: z.string().min(1).optional(),
  /** Only used when DATABASE_URL is unset — where the embedded PGlite
   * instance persists its data on disk between runs. */
  PGLITE_DATA_DIR: z.string().min(1).default(".data/pglite"),
  /** Only "local" exists today (docs/adr — local-disk storage
   * stand-in). Adding a "supabase" driver here is the whole point of
   * the seam: apps/api's business logic never changes, only this
   * value and the adapter registered for it. */
  STORAGE_DRIVER: z.enum(["local"]).default("local"),
  STORAGE_LOCAL_DIR: z.string().min(1).default(".data/storage"),
  STORAGE_SIGNED_URL_SECRET: z.string().min(1).optional(),
});

export type ApiEnv = Omit<z.infer<typeof apiEnvSchema>, "STORAGE_SIGNED_URL_SECRET"> & {
  STORAGE_SIGNED_URL_SECRET: string;
};

const DEV_ONLY_INSECURE_SIGNING_SECRET =
  "dev-only-insecure-signing-secret-do-not-use-in-production";

/**
 * Parses and validates apps/api's environment once at startup. Never
 * read `process.env.*` ad hoc elsewhere in apps/api — this is the one
 * place that happens, per architecture.md §20's "validate at every
 * boundary" (env is a boundary too).
 */
export function parseApiEnv(source: NodeJS.ProcessEnv = process.env): ApiEnv {
  const parsed = apiEnvSchema.parse(source);

  if (parsed.STORAGE_SIGNED_URL_SECRET) {
    return parsed as ApiEnv;
  }

  if (parsed.NODE_ENV === "production") {
    throw new Error(
      "STORAGE_SIGNED_URL_SECRET must be set in production — refusing to start with an insecure default.",
    );
  }

  return { ...parsed, STORAGE_SIGNED_URL_SECRET: DEV_ONLY_INSECURE_SIGNING_SECRET };
}
