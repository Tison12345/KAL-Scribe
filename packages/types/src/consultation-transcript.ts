import type { TranscriptSegment } from "./transcript-segment.js";

/** Mirrors architecture.md §12's `consultation_transcripts` table. */
export interface ConsultationTranscript {
  id: string;
  recordingId: string;
  segments: TranscriptSegment[];
  sttProvider: string;
  diarizationProvider: string | null;
  languageDetected: string[] | null;
  createdAt: string;
}

export interface CreateTranscriptRequest {
  segments: TranscriptSegment[];
  sttProvider: string;
  diarizationProvider: string | null;
  languageDetected: string[] | null;
}

export interface CreateTranscriptResponse {
  transcriptId: string;
}
