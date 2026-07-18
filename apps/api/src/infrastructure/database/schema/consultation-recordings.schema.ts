import {
  bigint,
  boolean,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { consultationAiSessions } from './consultation-ai-sessions.schema';

export const consultationRecordingStatusEnum = pgEnum(
  'consultation_recording_status',
  ['recording', 'uploading', 'uploaded', 'processing_failed', 'processed'],
);

/** Which device asr-service should run WhisperX on for this
 * recording (docs/adr/0012). Null means "use asr-service's own
 * default" — not every recording needs an explicit choice. */
export const sttDeviceEnum = pgEnum('stt_device', ['cpu', 'gpu']);

export const consultationRecordings = pgTable('consultation_recordings', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Session ownership replaces this recording directly holding the CMS
  // ref — `consultation_session_ref`/`doctor_id_ref` moved up to
  // `consultation_ai_sessions` (docs/adr/0014). Every recording in a
  // session inherits the session's doctor/CMS ref.
  sessionId: uuid('session_id')
    .notNull()
    .references(() => consultationAiSessions.id),
  // Pause/resume ordering within a session — 0 is the first recording.
  sequenceInSession: integer('sequence_in_session').notNull().default(0),
  status: consultationRecordingStatusEnum('status')
    .notNull()
    .default('recording'),
  storageKey: text('storage_key'),
  durationSeconds: integer('duration_seconds'),
  // Audio metadata (docs/adr/0014) — populated post-stitch via ffprobe,
  // nullable until then.
  sampleRateHz: integer('sample_rate_hz'),
  channels: integer('channels'),
  codec: text('codec'),
  fileSizeBytes: bigint('file_size_bytes', { mode: 'number' }),
  // Stays recording-scoped, not session-scoped, even though a session
  // can now span multiple recordings (pause/resume) — re-confirm on
  // every resume rather than once at session start (safer default).
  consentConfirmed: boolean('consent_confirmed').notNull().default(false),
  consentConfirmedAt: timestamp('consent_confirmed_at', {
    withTimezone: true,
  }),
  sttDevice: sttDeviceEnum('stt_device'),
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
