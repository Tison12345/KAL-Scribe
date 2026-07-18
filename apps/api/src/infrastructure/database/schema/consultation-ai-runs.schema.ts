import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { consultationRecordings } from './consultation-recordings.schema';
import { consultationTranscripts } from './consultation-transcripts.schema';

/**
 * One immutable row per extraction attempt (docs/adr/0014 — renamed +
 * redesigned from `consultation_ai_results`, split from the doctor's
 * mutable review workflow state, which now lives in
 * `consultation_reviews`). `extraction` is a ClinicalExtraction
 * (packages/types, architecture.md §11) stored as jsonb.
 *
 * `run_number` (1, 2, 3...) is what makes "Run 1 → Gemini, Run 2 →
 * Claude, Run 3 → Groq" for the same recording a real, queryable
 * comparison rather than the old single-row-per-recording shape
 * (which already allowed multiple rows via retry, just without any of
 * this metadata or a stable ordinal).
 */
export const consultationAiRuns = pgTable(
  'consultation_ai_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    recordingId: uuid('recording_id')
      .notNull()
      .references(() => consultationRecordings.id),
    transcriptId: uuid('transcript_id')
      .notNull()
      .references(() => consultationTranscripts.id),
    runNumber: integer('run_number').notNull(),
    schemaVersion: text('schema_version').notNull(),
    // Split from the old combined `llm_provider` string (e.g.
    // "groq/llama-3.3-70b") into vendor + model separately.
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    promptVersion: text('prompt_version').notNull(),
    temperature: numeric('temperature', {
      precision: 3,
      scale: 2,
      mode: 'number',
    }),
    latencyMs: integer('latency_ms'),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    totalTokens: integer('total_tokens'),
    estimatedCostUsd: numeric('estimated_cost_usd', {
      precision: 10,
      scale: 6,
      mode: 'number',
    }),
    retryCount: integer('retry_count').notNull().default(0),
    hadValidationRetry: boolean('had_validation_retry')
      .notNull()
      .default(false),
    // Pre-parse provider response, stored even on success — not just
    // on failure — for parser improvements, debugging, reprocessing,
    // cross-provider comparison (docs/adr/0014).
    rawResponse: jsonb('raw_response').notNull(),
    extraction: jsonb('extraction').notNull(),
    // Promoted from extraction.aiConfidence.overall for sort/filter —
    // the one deliberate exception to "everything else stays in
    // jsonb" in this schema; not a precedent for promoting more
    // fields (docs/adr/0014).
    confidenceOverall: numeric('confidence_overall', {
      precision: 4,
      scale: 3,
      mode: 'number',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('consultation_ai_runs_recording_id_run_number_idx').on(
      table.recordingId,
      table.runNumber,
    ),
  ],
);

export type ConsultationAiRunRow = typeof consultationAiRuns.$inferSelect;
export type NewConsultationAiRunRow = typeof consultationAiRuns.$inferInsert;
