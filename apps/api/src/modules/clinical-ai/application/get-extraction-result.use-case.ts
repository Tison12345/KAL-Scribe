import { Injectable, NotFoundException } from '@nestjs/common';
import type { ReviewDraft } from '@kal-scribe/types';
import { ConsultationAiRunRepository } from '../infrastructure/consultation-ai-run.repository';
import { ConsultationReviewRepository } from '../infrastructure/consultation-review.repository';
import { toReviewDraft } from './review-draft.mapper';

@Injectable()
export class GetExtractionResultUseCase {
  constructor(
    private readonly runs: ConsultationAiRunRepository,
    private readonly reviews: ConsultationReviewRepository,
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
    return toReviewDraft(run, review);
  }
}
