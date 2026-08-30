import {
  integer,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { consultationRecordings } from './consultation-recordings.schema';

/**
 * Audit finding E2 — chunk existence/order used to be entirely
 * implicit (a chunk "exists" only if a signed read URL for its storage
 * key doesn't 404). This table gives chunks a real, queryable
 * server-side state: one row per chunk the browser has confirmed
 * finished uploading (not merely requested a signed URL for — a
 * request can still fail the actual PUT). `sequence` mirrors the
 * `chunk-{sequence}.webm` storage key numbering.
 *
 * Deliberately does not (yet) drive a resume-on-reload UX by itself —
 * that also needs the frontend to load this list on reopen and
 * reconcile it against the browser's own recorder state, which is a
 * separate follow-up. This table is the missing server-side half.
 */
export const consultationRecordingChunks = pgTable(
  'consultation_recording_chunks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    recordingId: uuid('recording_id')
      .notNull()
      .references(() => consultationRecordings.id),
    sequence: integer('sequence').notNull(),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('consultation_recording_chunks_recording_sequence_idx').on(
      table.recordingId,
      table.sequence,
    ),
  ],
);

export type ConsultationRecordingChunkRow =
  typeof consultationRecordingChunks.$inferSelect;
export type NewConsultationRecordingChunkRow =
  typeof consultationRecordingChunks.$inferInsert;
