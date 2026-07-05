import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ConsultationAiResult } from '@kal-scribe/types';
import { ConsultationAiResultRepository } from '../infrastructure/consultation-ai-result.repository';
import { toConsultationAiResult } from './consultation-ai-result.mapper';

/** Doctor rejects the AI draft entirely (architecture.md §7 step 12) —
 * no CMS call, unlike accept. Idempotent: discarding an
 * already-discarded draft is a no-op, not an error. */
@Injectable()
export class DiscardReviewDraftUseCase {
  constructor(private readonly repository: ConsultationAiResultRepository) {}

  async execute(recordingId: string): Promise<ConsultationAiResult> {
    const row = await this.repository.findByRecordingId(recordingId);
    if (!row) {
      throw new NotFoundException(
        `No extraction result for recording "${recordingId}".`,
      );
    }
    if (row.status === 'discarded') {
      return toConsultationAiResult(row);
    }
    // An accepted draft was already submitted to the CMS (a real
    // acceptedCmsPrescriptionRef exists) — silently discarding it
    // afterward would leave this record showing "discarded" while the
    // CMS still has the submitted prescription. Same reasoning as the
    // symmetric check in AcceptReviewDraftUseCase.
    if (row.status === 'accepted') {
      throw new BadRequestException(
        'This draft was already accepted and cannot be discarded.',
      );
    }

    const updated = await this.repository.update(row.id, {
      status: 'discarded',
    });
    return toConsultationAiResult(updated);
  }
}
