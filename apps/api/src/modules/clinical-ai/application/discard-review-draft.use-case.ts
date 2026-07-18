import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ReviewDraft } from '@kal-scribe/types';
import { ConsultationAiAuditLogRepository } from '../infrastructure/consultation-ai-audit-log.repository';
import { ConsultationAiRunRepository } from '../infrastructure/consultation-ai-run.repository';
import { ConsultationReviewRepository } from '../infrastructure/consultation-review.repository';
import { toReviewDraft } from './review-draft.mapper';

/** Doctor rejects the AI draft entirely (architecture.md §7 step 12) —
 * no CMS call, unlike accept. Idempotent: discarding an
 * already-discarded draft is a no-op, not an error. */
@Injectable()
export class DiscardReviewDraftUseCase {
  constructor(
    private readonly runs: ConsultationAiRunRepository,
    private readonly reviews: ConsultationReviewRepository,
    private readonly auditLog: ConsultationAiAuditLogRepository,
  ) {}

  async execute(recordingId: string): Promise<ReviewDraft> {
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
    if (review.status === 'discarded') {
      return toReviewDraft(run, review);
    }
    // An accepted draft was already submitted to the CMS (a real
    // acceptedCmsPrescriptionRef exists) — silently discarding it
    // afterward would leave this record showing "discarded" while the
    // CMS still has the submitted prescription. Same reasoning as the
    // symmetric check in AcceptReviewDraftUseCase.
    if (review.status === 'accepted') {
      throw new BadRequestException(
        'This draft was already accepted and cannot be discarded.',
      );
    }

    const updated = await this.reviews.update(review.id, {
      status: 'discarded',
    });

    await this.auditLog.record({
      recordingId,
      eventType: 'draft_discarded',
      actorRef: 'system',
      metadata: { reviewId: updated.id, runId: run.id },
    });

    return toReviewDraft(run, updated);
  }
}
