import { pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Root entity for this repo's own recording/run history — NOT a mirror
 * of the CMS's own "consultation session" concept (docs/adr/0014).
 * Named `..._ai_...` deliberately so that boundary stays unambiguous
 * even in the table name, not just in a comment: this repo owns zero
 * CMS concepts (architecture.md §16 — zero FKs into CMS tables), it
 * only stores the opaque `consultation_session_ref` string below.
 *
 * Groups everything belonging to one CMS-side consultation on this
 * repo's side, enabling multiple recordings per consultation
 * (pause/resume) and multiple AI runs per consultation — neither was
 * representable when `consultation_recordings` was the root entity.
 */
export const consultationAiSessionStatusEnum = pgEnum(
  'consultation_ai_session_status',
  ['active', 'completed', 'abandoned'],
);

export const consultationAiSessions = pgTable('consultation_ai_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Opaque CMS-side reference — this repo never validates or owns this
  // beyond storing it (architecture.md §16).
  consultationSessionRef: text('consultation_session_ref').notNull(),
  doctorIdRef: text('doctor_id_ref').notNull(),
  status: consultationAiSessionStatusEnum('status').notNull().default('active'),
  startedAt: timestamp('started_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type ConsultationAiSessionRow =
  typeof consultationAiSessions.$inferSelect;
export type NewConsultationAiSessionRow =
  typeof consultationAiSessions.$inferInsert;
