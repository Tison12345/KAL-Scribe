import {
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { consultationRecordings } from './consultation-recordings.schema';
import { consultationTranscripts } from './consultation-transcripts.schema';

/** Mirrors architecture.md §12 exactly — the extraction output,
 * versioned. `extraction` is a ClinicalExtraction (packages/types,
 * §11) stored as jsonb. */
export const consultationAiResultStatusEnum = pgEnum(
  'consultation_ai_result_status',
  ['draft', 'edited', 'accepted', 'discarded'],
);

export const consultationAiResults = pgTable('consultation_ai_results', {
  id: uuid('id').primaryKey().defaultRandom(),
  recordingId: uuid('recording_id')
    .notNull()
    .references(() => consultationRecordings.id),
  transcriptId: uuid('transcript_id')
    .notNull()
    .references(() => consultationTranscripts.id),
  schemaVersion: text('schema_version').notNull(),
  llmProvider: text('llm_provider').notNull(),
  extraction: jsonb('extraction').notNull(),
  status: consultationAiResultStatusEnum('status').notNull().default('draft'),
  // Doctor's edited version, if different from `extraction` — kept
  // separate so the original AI output is never silently overwritten
  // (audit + future model-quality evaluation, architecture.md §12).
  editedExtraction: jsonb('edited_extraction'),
  acceptedCmsPrescriptionRef: text('accepted_cms_prescription_ref'),
  reviewedByRef: text('reviewed_by_ref'),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type ConsultationAiResultRow = typeof consultationAiResults.$inferSelect;
export type NewConsultationAiResultRow =
  typeof consultationAiResults.$inferInsert;
