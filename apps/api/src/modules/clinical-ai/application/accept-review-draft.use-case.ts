import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AcceptReviewDraftRequest,
  ClinicalExtraction,
  ReviewDraft,
} from '@kal-scribe/types';
import { ConsultationAiAuditLogRepository } from '../infrastructure/consultation-ai-audit-log.repository';
import {
  CMS_INTEGRATION_ADAPTER,
  type CmsIntegrationAdapter,
} from '../infrastructure/cms-integration.adapter';
import { ConsultationAiRunRepository } from '../infrastructure/consultation-ai-run.repository';
import { ConsultationAiSessionRepository } from '../infrastructure/consultation-ai-session.repository';
import { ConsultationRecordingRepository } from '../infrastructure/consultation-recording.repository';
import { ConsultationReviewRepository } from '../infrastructure/consultation-review.repository';
import { toReviewDraft } from './review-draft.mapper';

/** The one use-case that calls the CMS integration port (architecture.md
 * §5, §7 step 13): submits the (possibly doctor-edited) extraction as
 * a prescription draft, marks the review row `accepted`, and links the
 * resulting CMS record ref for traceability. Idempotent — an
 * already-accepted draft returns its existing state rather than
 * re-submitting to the CMS a second time (same reasoning as
 * CompleteUploadUseCase). */
@Injectable()
export class AcceptReviewDraftUseCase {
  constructor(
    private readonly runs: ConsultationAiRunRepository,
    private readonly reviews: ConsultationReviewRepository,
    private readonly recordings: ConsultationRecordingRepository,
    private readonly sessions: ConsultationAiSessionRepository,
    private readonly auditLog: ConsultationAiAuditLogRepository,
    @Inject(CMS_INTEGRATION_ADAPTER)
    private readonly cms: CmsIntegrationAdapter,
  ) {}

  async execute(
    recordingId: string,
    request: AcceptReviewDraftRequest,
  ): Promise<ReviewDraft> {
    const review = await this.reviews.findByRecordingId(recordingId);
    if (!review) {
      throw new NotFoundException(
        `No extraction result for recording "${recordingId}".`,
      );
    }
    const run = await this.runs.findById(review.runId);
    if (!run) {
      throw new NotFoundException(
        `Review "${review.id}" references a missing run "${review.runId}".`,
      );
    }
    if (review.status === 'accepted') {
      return toReviewDraft(run, review);
    }
    // A discarded draft is a terminal, deliberate doctor decision —
    // unlike the 'accepted' idempotency check above, this must not
    // silently succeed. Without this, a discarded draft could still
    // be submitted to the CMS as a real prescription later.
    if (review.status === 'discarded') {
      throw new BadRequestException(
        'This draft was discarded and cannot be accepted.',
      );
    }

    const recording = await this.recordings.findById(recordingId);
    if (!recording) {
      throw new NotFoundException(`No recording with id "${recordingId}".`);
    }
    const session = await this.sessions.findById(recording.sessionId);
    if (!session) {
      throw new NotFoundException(
        `Recording "${recordingId}" references a missing session "${recording.sessionId}".`,
      );
    }

    const finalExtraction = (review.editedExtraction ??
      run.extraction) as ClinicalExtraction;
    const { cmsPrescriptionRef } = await this.cms.submitPrescriptionDraft(
      session.consultationSessionRef,
      finalExtraction,
    );

    const updated = await this.reviews.update(review.id, {
      status: 'accepted',
      acceptedCmsPrescriptionRef: cmsPrescriptionRef,
      reviewedByRef: request.reviewedByRef,
      reviewedAt: new Date(),
    });

    await this.auditLog.record({
      recordingId,
      sessionId: session.id,
      eventType: 'draft_accepted',
      actorRef: request.reviewedByRef,
      metadata: { reviewId: updated.id, runId: run.id, cmsPrescriptionRef },
    });

    return toReviewDraft(run, updated);
  }
}
