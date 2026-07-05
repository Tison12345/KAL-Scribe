import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  ConsultationAiResult,
  UpdateReviewDraftRequest,
} from '@kal-scribe/types';
import { ConsultationAiResultRepository } from '../infrastructure/consultation-ai-result.repository';
import { toConsultationAiResult } from './consultation-ai-result.mapper';

/** Doctor edits to the AI draft (architecture.md §7 step 12) — saved
 * into `edited_extraction`, never overwriting `extraction` itself, so
 * the original AI output stays auditable and comparable (§12's own
 * reasoning for the separate column). No-ops the status once a draft
 * is already `accepted`/`discarded` — editing a finalized draft isn't
 * a real state this use-case should silently allow. */
@Injectable()
export class UpdateReviewDraftUseCase {
  constructor(private readonly repository: ConsultationAiResultRepository) {}

  async execute(
    recordingId: string,
    request: UpdateReviewDraftRequest,
  ): Promise<ConsultationAiResult> {
    const row = await this.repository.findByRecordingId(recordingId);
    if (!row) {
      throw new NotFoundException(
        `No extraction result for recording "${recordingId}".`,
      );
    }

    const nextStatus =
      row.status === 'accepted' || row.status === 'discarded'
        ? row.status
        : 'edited';

    const updated = await this.repository.update(row.id, {
      editedExtraction: request.extraction,
      status: nextStatus,
    });
    return toConsultationAiResult(updated);
  }
}
