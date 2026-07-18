/** Shared between apps/api (sends jobs, tracks status) and
 * workers/clinical-ai-worker (processes jobs, reports status) —
 * architecture.md §13 requires both to agree on queue names without
 * duplicating string literals in two packages. Each source queue has
 * its own dead-letter queue (docs/adr/0015, pg-boss's native
 * `deadLetter` option) — `workers/clinical-ai-worker` runs a small
 * `.work()` consumer on each `*DeadLetter` queue purely to mark
 * `consultation_ai_jobs.status = 'dead_letter'`. */
export const CLINICAL_AI_QUEUE_NAMES = {
  transcription: "clinical-ai.transcription",
  transcriptionDeadLetter: "clinical-ai.transcription.dlq",
  extraction: "clinical-ai.extraction",
  extractionDeadLetter: "clinical-ai.extraction.dlq",
} as const;

export type ClinicalAiQueueName =
  (typeof CLINICAL_AI_QUEUE_NAMES)[keyof typeof CLINICAL_AI_QUEUE_NAMES];

/** pg-boss `createQueue` options for both source queues (docs/adr/0015)
 * — 5 attempts with exponential backoff starting at 60s, matching the
 * BullMQ defaults this replaces. `deadLetter` is set per-queue at
 * creation time (see queue.module.ts), not here, since it references
 * the queue's own dead-letter queue name. */
export const DEFAULT_QUEUE_JOB_OPTIONS = {
  retryLimit: 5,
  retryBackoff: true,
  retryDelay: 60,
} as const;
