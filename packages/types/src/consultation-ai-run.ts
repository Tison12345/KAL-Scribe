import type { ClinicalExtraction } from "./clinical-extraction.js";

/** Mirrors the `consultation_ai_runs` table (docs/adr/0014) — one
 * immutable row per extraction attempt, replacing the old
 * `ConsultationAiResult`'s combined run+review shape. */
export interface ConsultationAiRun {
  id: string;
  recordingId: string;
  transcriptId: string;
  runNumber: number;
  schemaVersion: string;
  provider: string;
  model: string;
  promptVersion: string;
  temperature: number | null;
  latencyMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  estimatedCostUsd: number | null;
  retryCount: number;
  hadValidationRetry: boolean;
  rawResponse: unknown;
  extraction: ClinicalExtraction;
  confidenceOverall: number | null;
  createdAt: string;
}

export interface CreateExtractionResultRequest {
  transcriptId: string;
  provider: string;
  model: string;
  extraction: ClinicalExtraction;
  promptVersion?: string;
  temperature?: number | null;
  latencyMs?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  estimatedCostUsd?: number | null;
  retryCount?: number;
  hadValidationRetry?: boolean;
  rawResponse?: unknown;
}

export interface CreateExtractionResultResponse {
  runId: string;
  reviewId: string;
}

export interface EnqueueExtractionJobRequest {
  transcriptId: string;
  /** Overrides the deployment-wide `EXTRACTION_PROVIDER` for this one
   * run — what actually makes "Run 2 against Claude, Run 3 against
   * Groq" for the same recording possible (docs/adr/0014). */
  requestedProvider?: string;
}

/** Derived, not stored (docs/adr/0014) — recomputed on read from
 * `consultation_transcripts.segments` + the latest run's metadata +
 * `consultation_ai_jobs`, rather than cached, so it never goes stale
 * when a transcript is relabeled. */
export interface ConsultationAnalytics {
  recordingId: string;
  durationSeconds: number | null;
  doctorSpeakingPercent: number | null;
  patientSpeakingPercent: number | null;
  silencePercent: number | null;
  transcriptionLatencyMs: number | null;
  /** Latest run's own metadata — not an aggregate across every run. */
  extractionLatencyMs: number | null;
  totalTokens: number | null;
  estimatedCostUsd: number | null;
  retryCount: number | null;
  hadValidationRetry: boolean | null;
  /** Sum of `completed_at - started_at` across every job row for this
   * recording (transcription + extraction) — already-available data,
   * not a new measurement. */
  totalProcessingLatencyMs: number | null;
}
