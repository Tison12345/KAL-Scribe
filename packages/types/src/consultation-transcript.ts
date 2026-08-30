import type { TranscriptSegment } from "./transcript-segment.js";

/** Mirrors the `consultation_transcripts` table (docs/adr/0014). */
export interface ConsultationTranscript {
  id: string;
  recordingId: string;
  segments: TranscriptSegment[];
  sttProvider: string;
  diarizationProvider: string | null;
  /** Audit finding E8 — nullable: null for transcripts persisted before
   * this field existed, or from a future provider that doesn't report
   * it. */
  model: string | null;
  promptVersion: string | null;
  languageDetected: string[] | null;
  isMultilingual: boolean | null;
  isCodeSwitched: boolean | null;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  transcriptionLatencyMs: number | null;
  createdAt: string;
}

export interface CreateTranscriptRequest {
  segments: TranscriptSegment[];
  sttProvider: string;
  diarizationProvider: string | null;
  model?: string | null;
  promptVersion?: string | null;
  languageDetected: string[] | null;
  isMultilingual?: boolean | null;
  isCodeSwitched?: boolean | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  rawResponse?: unknown;
  transcriptionLatencyMs?: number | null;
}

export interface CreateTranscriptResponse {
  transcriptId: string;
}
