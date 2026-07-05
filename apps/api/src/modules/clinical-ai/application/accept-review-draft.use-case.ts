import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  AcceptReviewDraftRequest,
  ClinicalExtraction,
  ConsultationAiResult,
} from '@kal-scribe/types';
import {
  CMS_INTEGRATION_ADAPTER,
  type CmsIntegrationAdapter,
} from '../infrastructure/cms-integration.adapter';
import { ConsultationAiResultRepository } from '../infrastructure/consultation-ai-result.repository';
import { ConsultationRecordingRepository } from '../infrastructure/consultation-recording.repository';
import { toConsultationAiResult } from './consultation-ai-result.mapper';

/** The one use-case that calls the CMS integration port (architecture.md
 * §5, §7 step 13): submits the (possibly doctor-edited) extraction as
 * a prescription draft, marks this module's own result row `accepted`,
 * and links the resulting CMS record ref for traceability. Idempotent
 * — an already-accepted draft returns its existing state rather than
 * re-submitting to the CMS a second time (same reasoning as
 * CompleteUploadUseCase). */
@Injectable()
export class AcceptReviewDraftUseCase {
  constructor(
    private readonly results: ConsultationAiResultRepository,
    private readonly recordings: ConsultationRecordingRepository,
    @Inject(CMS_INTEGRATION_ADAPTER)
    private readonly cms: CmsIntegrationAdapter,
  ) {}

  async execute(
    recordingId: string,
    request: AcceptReviewDraftRequest,
  ): Promise<ConsultationAiResult> {
    const row = await this.results.findByRecordingId(recordingId);
    if (!row) {
      throw new NotFoundException(
        `No extraction result for recording "${recordingId}".`,
      );
    }
    if (row.status === 'accepted') {
      return toConsultationAiResult(row);
    }

    const recording = await this.recordings.findById(recordingId);
    if (!recording) {
      throw new NotFoundException(`No recording with id "${recordingId}".`);
    }

    const finalExtraction = (row.editedExtraction ??
      row.extraction) as ClinicalExtraction;
    const { cmsPrescriptionRef } = await this.cms.submitPrescriptionDraft(
      recording.consultationSessionRef,
      finalExtraction,
    );

    const updated = await this.results.update(row.id, {
      status: 'accepted',
      acceptedCmsPrescriptionRef: cmsPrescriptionRef,
      reviewedByRef: request.reviewedByRef,
      reviewedAt: new Date(),
    });
    return toConsultationAiResult(updated);
  }
}
