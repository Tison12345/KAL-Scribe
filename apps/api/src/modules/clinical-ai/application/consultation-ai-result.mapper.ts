import type {
  ClinicalExtraction,
  ConsultationAiResult,
} from '@kal-scribe/types';
import type { ConsultationAiResultRow } from '../../../infrastructure/database/schema';

/** Shared by every use-case that returns a ConsultationAiResult
 * (get/create/update/accept/discard) so the row->DTO mapping exists
 * in exactly one place. */
export function toConsultationAiResult(
  row: ConsultationAiResultRow,
): ConsultationAiResult {
  return {
    id: row.id,
    recordingId: row.recordingId,
    transcriptId: row.transcriptId,
    schemaVersion: row.schemaVersion,
    llmProvider: row.llmProvider,
    extraction: row.extraction as ClinicalExtraction,
    status: row.status,
    editedExtraction: row.editedExtraction as ClinicalExtraction | null,
    acceptedCmsPrescriptionRef: row.acceptedCmsPrescriptionRef,
    reviewedByRef: row.reviewedByRef,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
