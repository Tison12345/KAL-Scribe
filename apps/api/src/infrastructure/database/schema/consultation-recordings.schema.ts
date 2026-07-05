import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

/** Mirrors architecture.md §12 exactly. */
export const consultationRecordingStatusEnum = pgEnum(
  'consultation_recording_status',
  ['recording', 'uploading', 'uploaded', 'processing_failed', 'processed'],
);

export const consultationRecordings = pgTable('consultation_recordings', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Opaque CMS-side references — this repo never validates or owns
  // these beyond storing them (architecture.md §16's "zero foreign
  // keys into CMS tables" rule).
  consultationSessionRef: text('consultation_session_ref').notNull(),
  doctorIdRef: text('doctor_id_ref').notNull(),
  status: consultationRecordingStatusEnum('status')
    .notNull()
    .default('recording'),
  storageKey: text('storage_key'),
  durationSeconds: integer('duration_seconds'),
  consentConfirmed: boolean('consent_confirmed').notNull().default(false),
  consentConfirmedAt: timestamp('consent_confirmed_at', {
    withTimezone: true,
  }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export type ConsultationRecordingRow =
  typeof consultationRecordings.$inferSelect;
export type NewConsultationRecordingRow =
  typeof consultationRecordings.$inferInsert;
