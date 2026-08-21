import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { consultationRecordings } from './consultation-recordings.schema';

/** `segments` is a TranscriptSegment[] (packages/types) stored as
 * jsonb. Stays 1:1 per recording (not versioned like
 * `consultation_ai_runs`) — versioning is scoped to extraction runs
 * per the actual MVP need; the same insert-only pattern is a
 * documented extensibility point here if STT-provider benchmarking
 * becomes a real need later (docs/adr/0014), not applied now. */
export const consultationTranscripts = pgTable('consultation_transcripts', {
  id: uuid('id').primaryKey().defaultRandom(),
  recordingId: uuid('recording_id')
    .notNull()
    .references(() => consultationRecordings.id),
  segments: jsonb('segments').notNull(),
  sttProvider: text('stt_provider').notNull(),
  diarizationProvider: text('diarization_provider'),
  languageDetected: text('language_detected').array(),
  // Language metadata (docs/adr/0014).
  isMultilingual: boolean('is_multilingual'),
  // Only meaningfully reportable by a model that understands the
  // audio directly (e.g. Gemini) — null for the WhisperX path, which
  // has no signal for this.
  isCodeSwitched: boolean('is_code_switched'),
  // Same reasoning as consultation_ai_runs' token columns — null
  // until the provider's response actually reports them.
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  totalTokens: integer('total_tokens'),
  // Pre-parse provider response for the transcription/diarization
  // stage (docs/adr/0014) — kept for parser improvements, debugging,
  // reprocessing, cross-provider comparison.
  rawResponse: jsonb('raw_response'),
  transcriptionLatencyMs: integer('transcription_latency_ms'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type ConsultationTranscriptRow =
  typeof consultationTranscripts.$inferSelect;
export type NewConsultationTranscriptRow =
  typeof consultationTranscripts.$inferInsert;
