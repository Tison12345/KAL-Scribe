import type { ClinicalExtraction, ReviewDraft } from '@kal-scribe/types';
import type {
  ConsultationAiRunRow,
  ConsultationReviewRow,
} from '../../../infrastructure/database/schema';

/** Shared by every use-case that returns a `ReviewDraft`
 * (get/create/update/accept/discard) so the run+review -> DTO join
 * exists in exactly one place (docs/adr/0014 — replaces the old
 * single-table `toConsultationAiResult`). */
export function toReviewDraft(
  run: ConsultationAiRunRow,
  review: ConsultationReviewRow,
): ReviewDraft {
  return {
    id: review.id,
    recordingId: review.recordingId,
    runId: run.id,
    runNumber: run.runNumber,
    transcriptId: run.transcriptId,
    schemaVersion: run.schemaVersion,
    provider: run.provider,
    model: run.model,
    confidenceOverall: run.confidenceOverall,
    extraction: run.extraction as ClinicalExtraction,
    status: review.status,
    editedExtraction: review.editedExtraction as ClinicalExtraction | null,
    acceptedCmsPrescriptionRef: review.acceptedCmsPrescriptionRef,
    reviewedByRef: review.reviewedByRef,
    reviewedAt: review.reviewedAt?.toISOString() ?? null,
    createdAt: review.createdAt.toISOString(),
  };
}
