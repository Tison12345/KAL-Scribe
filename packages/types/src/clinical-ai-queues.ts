/** Shared between apps/api (enqueues, syncs status) and
 * workers/clinical-ai-worker (processes jobs) — architecture.md §13
 * requires both to agree on queue names without duplicating string
 * literals in two packages. */
export const CLINICAL_AI_QUEUE_NAMES = {
  transcription: "clinical-ai.transcription",
  extraction: "clinical-ai.extraction",
  deadLetter: "clinical-ai.dead-letter",
} as const;

export type ClinicalAiQueueName =
  (typeof CLINICAL_AI_QUEUE_NAMES)[keyof typeof CLINICAL_AI_QUEUE_NAMES];

/** Mirrors Repo B's defaultQueueJobOptions shape (architecture.md §13):
 * 5 attempts, exponential backoff starting at 60s, keep completed jobs
 * out of Redis, keep failed ones for inspection until dead-lettered. */
export const DEFAULT_QUEUE_JOB_OPTIONS = {
  attempts: 5,
  backoff: { type: "exponential", delay: 60_000 },
  removeOnComplete: true,
  removeOnFail: false,
} as const;

export const BULLMQ_PREFIX = "kal-scribe";
