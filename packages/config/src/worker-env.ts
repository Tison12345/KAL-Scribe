import { z } from "zod";

const workerEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  /** pg-boss connects directly to Postgres (docs/adr/0015 — replaces
   * BullMQ/Redis) — same `DATABASE_URL` apps/api uses. This is the one
   * place the worker touches Postgres directly rather than through
   * apps/api's HTTP API (docs/adr/0010's "worker calls apps/api over
   * HTTP" rule is about the *domain* data; pg-boss's own job tables are
   * queue-engine internals, not domain data). */
  DATABASE_URL: z.string().min(1),
  /** Capped low — each job holds a GPU-backed inference call once
   * Milestone 5 wires in real transcription (architecture.md §13). */
  TRANSCRIPTION_WORKER_CONCURRENCY: z.coerce.number().int().positive().default(2),
  /** apps/api — fetches a signed read URL for the recording's audio. */
  API_BASE_URL: z.string().min(1).default("http://localhost:3001"),
  /** Provider abstraction (architecture.md §10, docs/adr/0002,
   * docs/adr/0014, docs/adr/0017). Extraction worker concurrency can
   * run higher than transcription's since these calls are I/O-bound,
   * not holding a local inference process (architecture.md §13). Split
   * from the old single `LLM_PROVIDER` (docs/adr/0014) — one var
   * conflated "which model extracts" and "which model transcribes",
   * which only got more confusing once a vendor (Groq) can do only one
   * of the two jobs. Gemini is the sole speech-understanding provider
   * (docs/adr/0017), so unlike `EXTRACTION_PROVIDER` there is no
   * corresponding `SPEECH_PROVIDER` selector. */
  EXTRACTION_WORKER_CONCURRENCY: z.coerce.number().int().positive().default(10),
  EXTRACTION_PROVIDER: z.string().min(1).default("gemini"),
  GROQ_API_KEY: z.string().min(1).optional(),
  GROQ_MODEL: z.string().min(1).optional(),
  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_MODEL: z.string().min(1).optional(),
});

export type WorkerEnv = z.infer<typeof workerEnvSchema>;

export function parseWorkerEnv(source: NodeJS.ProcessEnv = process.env): WorkerEnv {
  return workerEnvSchema.parse(source);
}
