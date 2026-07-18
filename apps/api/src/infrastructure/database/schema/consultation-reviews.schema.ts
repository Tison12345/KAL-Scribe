import {
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { consultationAiRuns } from './consultation-ai-runs.schema';
import { consultationRecordings } from './consultation-recordings.schema';

/**
 * Mutable doctor workflow state, split out of the old
 * `consultation_ai_results` (docs/adr/0014) — everything that changes
 * after a run is created lives here, separate from the run's immutable
 * AI output. Created transactionally alongside its run with
 * `status: 'draft'`.
 */
export const consultationReviewStatusEnum = pgEnum(
  'consultation_review_status',
  ['draft', 'edited', 'accepted', 'discarded'],
);

export const consultationReviews = pgTable('consultation_reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Denormalized from runId — keeps "get the current review for this
  // recording" a single-table query, matching the access pattern the
  // API already relies on today.
  recordingId: uuid('recording_id')
    .notNull()
    .references(() => consultationRecordings.id),
  runId: uuid('run_id')
    .notNull()
    .references(() => consultationAiRuns.id),
  status: consultationReviewStatusEnum('status').notNull().default('draft'),
  // Doctor's edited version, if different from the run's `extraction`
  // — kept separate so the original AI output is never silently
  // overwritten (audit + future model-quality evaluation).
  editedExtraction: jsonb('edited_extraction'),
  acceptedCmsPrescriptionRef: text('accepted_cms_prescription_ref'),
  reviewedByRef: text('reviewed_by_ref'),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type ConsultationReviewRow = typeof consultationReviews.$inferSelect;
export type NewConsultationReviewRow = typeof consultationReviews.$inferInsert;
