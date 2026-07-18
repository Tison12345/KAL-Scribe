import {
  check,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { consultationAiSessions } from './consultation-ai-sessions.schema';
import { consultationRecordings } from './consultation-recordings.schema';

/** Append-only event log — architecture.md §12 specified this table
 * but it was never implemented until docs/adr/0014. `recordingId` and
 * `sessionId` are both nullable: some events are session-scoped
 * (session started, pause/resume) rather than tied to one specific
 * recording; at least one of the two must be set. */
export const consultationAiAuditLog = pgTable(
  'consultation_ai_audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    recordingId: uuid('recording_id').references(
      () => consultationRecordings.id,
    ),
    sessionId: uuid('session_id').references(() => consultationAiSessions.id),
    eventType: text('event_type').notNull(),
    actorRef: text('actor_ref').notNull(),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      'consultation_ai_audit_log_recording_or_session_check',
      sql`${table.recordingId} is not null or ${table.sessionId} is not null`,
    ),
  ],
);

export type ConsultationAiAuditLogRow =
  typeof consultationAiAuditLog.$inferSelect;
export type NewConsultationAiAuditLogRow =
  typeof consultationAiAuditLog.$inferInsert;
