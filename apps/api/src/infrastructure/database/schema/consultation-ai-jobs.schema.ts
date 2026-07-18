import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { consultationRecordings } from './consultation-recordings.schema';

/** Mirrors architecture.md §12 exactly. */
export const clinicalAiJobTypeEnum = pgEnum('clinical_ai_job_type', [
  'transcription',
  'diarization',
  'extraction',
]);

export const clinicalAiJobStatusEnum = pgEnum('clinical_ai_job_status', [
  'queued',
  'active',
  'completed',
  'failed',
  'dead_letter',
]);

export const consultationAiJobs = pgTable('consultation_ai_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  recordingId: uuid('recording_id')
    .notNull()
    .references(() => consultationRecordings.id),
  jobType: clinicalAiJobTypeEnum('job_type').notNull(),
  // Cross-reference to the pg-boss job for debugging (architecture.md
  // §13, docs/adr/0015 — renamed from bullmq_job_id when BullMQ/Redis
  // was replaced) — nullable because the row is created an instant
  // before the queue job itself is confirmed sent.
  queueJobId: text('queue_job_id'),
  status: clinicalAiJobStatusEnum('status').notNull().default('queued'),
  attemptCount: integer('attempt_count').notNull().default(0),
  errorMessage: text('error_message'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type ConsultationAiJobRow = typeof consultationAiJobs.$inferSelect;
export type NewConsultationAiJobRow = typeof consultationAiJobs.$inferInsert;
