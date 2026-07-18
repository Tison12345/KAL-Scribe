import type { ClinicalExtraction } from "./clinical-extraction.js";

/** Mirrors the `consultation_reviews` table (docs/adr/0014) — mutable
 * doctor workflow state, split out of the old `ConsultationAiResult`. */
export type ConsultationReviewStatus = "draft" | "edited" | "accepted" | "discarded";

export interface ConsultationReview {
  id: string;
  recordingId: string;
  runId: string;
  status: ConsultationReviewStatus;
  editedExtraction: ClinicalExtraction | null;
  acceptedCmsPrescriptionRef: string | null;
  reviewedByRef: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** The flat, API-facing DTO the review endpoints return — a join of
 * the latest run (immutable AI output) and its review (mutable doctor
 * workflow state), preserving the shape the old single-table
 * `ConsultationAiResult` used to return so `ReviewDraftPanel`/
 * `useReviewDraft` only need a type-import rename, not a rewrite. */
export interface ReviewDraft {
  /** The review row's id — this is what update/accept/discard mutate. */
  id: string;
  recordingId: string;
  runId: string;
  runNumber: number;
  transcriptId: string;
  schemaVersion: string;
  provider: string;
  model: string;
  confidenceOverall: number | null;
  extraction: ClinicalExtraction;
  status: ConsultationReviewStatus;
  editedExtraction: ClinicalExtraction | null;
  acceptedCmsPrescriptionRef: string | null;
  reviewedByRef: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface UpdateReviewDraftRequest {
  extraction: ClinicalExtraction;
}

export interface AcceptReviewDraftRequest {
  /** Opaque CMS doctor reference — no real auth exists in this
   * standalone repo yet (architecture.md §17 Phase 1), so this is
   * caller-supplied rather than derived from a session. */
  reviewedByRef: string;
}
