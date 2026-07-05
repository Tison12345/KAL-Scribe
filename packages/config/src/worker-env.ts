import { z } from "zod";

const workerEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  REDIS_URL: z.string().min(1),
  /** Capped low — each job holds a GPU-backed inference call once
   * Milestone 5 wires in real transcription (architecture.md §13). */
  TRANSCRIPTION_WORKER_CONCURRENCY: z.coerce.number().int().positive().default(2),
  /** apps/api — fetches a signed read URL for the recording's audio. */
  API_BASE_URL: z.string().min(1).default("http://localhost:3001"),
  /** python/asr-service (architecture.md §3.2). */
  ASR_SERVICE_URL: z.string().min(1).default("http://localhost:8787"),
  /** LLM provider abstraction (architecture.md §10, docs/adr/0002).
   * Extraction worker concurrency can run higher than transcription's
   * since LLM calls are I/O-bound, not holding a local inference
   * process (architecture.md §13). */
  EXTRACTION_WORKER_CONCURRENCY: z.coerce.number().int().positive().default(10),
  LLM_PROVIDER: z.string().min(1).default("groq"),
  GROQ_API_KEY: z.string().min(1).optional(),
  GROQ_MODEL: z.string().min(1).optional(),
});

export type WorkerEnv = z.infer<typeof workerEnvSchema>;

export function parseWorkerEnv(source: NodeJS.ProcessEnv = process.env): WorkerEnv {
  return workerEnvSchema.parse(source);
}
