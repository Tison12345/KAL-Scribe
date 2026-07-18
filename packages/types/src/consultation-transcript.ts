import type { TranscriptSegment } from "./transcript-segment.js";

/** Mirrors the `consultation_transcripts` table (docs/adr/0014). */
export interface ConsultationTranscript {
  id: string;
  recordingId: string;
  segments: TranscriptSegment[];
  sttProvider: string;
  diarizationProvider: string | null;
  languageDetected: string[] | null;
  isMultilingual: boolean | null;
  isCodeSwitched: boolean | null;
  transcriptionLatencyMs: number | null;
  createdAt: string;
}

export interface CreateTranscriptRequest {
  segments: TranscriptSegment[];
  sttProvider: string;
  diarizationProvider: string | null;
  languageDetected: string[] | null;
  isMultilingual?: boolean | null;
  isCodeSwitched?: boolean | null;
  rawResponse?: unknown;
  transcriptionLatencyMs?: number | null;
}

export interface CreateTranscriptResponse {
  transcriptId: string;
}
