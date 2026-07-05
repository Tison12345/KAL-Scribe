import type { ClinicalExtraction } from "./clinical-extraction.js";

/** Mirrors architecture.md §12's `consultation_ai_results` table —
 * the extraction output, versioned. */
export type ConsultationAiResultStatus =
  | "draft"
  | "edited"
  | "accepted"
  | "discarded";

export interface ConsultationAiResult {
  id: string;
  recordingId: string;
  transcriptId: string;
  schemaVersion: string;
  llmProvider: string;
  extraction: ClinicalExtraction;
  status: ConsultationAiResultStatus;
  editedExtraction: ClinicalExtraction | null;
  acceptedCmsPrescriptionRef: string | null;
  reviewedByRef: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface CreateExtractionResultRequest {
  transcriptId: string;
  llmProvider: string;
  extraction: ClinicalExtraction;
}

export interface CreateExtractionResultResponse {
  resultId: string;
}

export interface EnqueueExtractionJobRequest {
  transcriptId: string;
}
