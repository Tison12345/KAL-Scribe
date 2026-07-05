import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { consultationRecordings } from './consultation-recordings.schema';

/** Mirrors architecture.md §12 exactly. `segments` is a
 * TranscriptSegment[] (packages/types) stored as jsonb. */
export const consultationTranscripts = pgTable('consultation_transcripts', {
  id: uuid('id').primaryKey().defaultRandom(),
  recordingId: uuid('recording_id')
    .notNull()
    .references(() => consultationRecordings.id),
  segments: jsonb('segments').notNull(),
  sttProvider: text('stt_provider').notNull(),
  diarizationProvider: text('diarization_provider'),
  languageDetected: text('language_detected').array(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type ConsultationTranscriptRow =
  typeof consultationTranscripts.$inferSelect;
export type NewConsultationTranscriptRow =
  typeof consultationTranscripts.$inferInsert;
