import { Injectable, NotFoundException } from '@nestjs/common';
import type { ClinicalExtraction, ConsultationAiResult } from '@kal-scribe/types';
import { ConsultationAiResultRepository } from '../infrastructure/consultation-ai-result.repository';

/** Read-only for now — the full review/edit flow (edited_extraction,
 * accept/discard) is Milestone 8's scope. This exists in Milestone 7
 * so the extraction pipeline is verifiable end-to-end without waiting
 * on the review UI. */
@Injectable()
export class GetExtractionResultUseCase {
  constructor(private readonly repository: ConsultationAiResultRepository) {}

  async execute(recordingId: string): Promise<ConsultationAiResult> {
    const row = await this.repository.findByRecordingId(recordingId);
    if (!row) {
      throw new NotFoundException(
        `No extraction result for recording "${recordingId}".`,
      );
    }

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
}
