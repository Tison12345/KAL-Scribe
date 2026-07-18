import { Injectable, NotFoundException } from '@nestjs/common';
import type { ReviewDraft, UpdateReviewDraftRequest } from '@kal-scribe/types';
import { ConsultationAiAuditLogRepository } from '../infrastructure/consultation-ai-audit-log.repository';
import { ConsultationAiRunRepository } from '../infrastructure/consultation-ai-run.repository';
import { ConsultationReviewRepository } from '../infrastructure/consultation-review.repository';
import { toReviewDraft } from './review-draft.mapper';

/** Doctor edits to the AI draft (architecture.md §7 step 12) — saved
 * into the review's `edited_extraction`, never overwriting the run's
 * `extraction` itself, so the original AI output stays auditable and
 * comparable (docs/adr/0014). No-ops the status once a draft is
 * already `accepted`/`discarded` — editing a finalized draft isn't a
 * real state this use-case should silently allow. */
@Injectable()
export class UpdateReviewDraftUseCase {
  constructor(
    private readonly runs: ConsultationAiRunRepository,
    private readonly reviews: ConsultationReviewRepository,
    private readonly auditLog: ConsultationAiAuditLogRepository,
  ) {}

  async execute(
    recordingId: string,
    request: UpdateReviewDraftRequest,
  ): Promise<ReviewDraft> {
    const review = await this.reviews.findByRecordingId(recordingId);
    if (!review) {
      throw new NotFoundException(
        `No extraction result for recording "${recordingId}".`,
      );
    }

    const nextStatus =
      review.status === 'accepted' || review.status === 'discarded'
        ? review.status
        : 'edited';

    const updated = await this.reviews.update(review.id, {
      editedExtraction: request.extraction,
      status: nextStatus,
    });
    const run = await this.runs.findById(updated.runId);
    if (!run) {
      throw new NotFoundException(
        `Review "${updated.id}" references a missing run "${updated.runId}".`,
      );
    }

    if (nextStatus === 'edited') {
      await this.auditLog.record({
        recordingId,
        eventType: 'draft_edited',
        actorRef: 'system',
        metadata: { reviewId: updated.id, runId: updated.runId },
      });
    }

    return toReviewDraft(run, updated);
  }
}
