import { Injectable } from '@nestjs/common';
import type {
  CreateExtractionResultRequest,
  CreateExtractionResultResponse,
} from '@kal-scribe/types';
import { ConsultationAiResultRepository } from '../infrastructure/consultation-ai-result.repository';

/** Persists the LLM's extraction output once the worker has it
 * (architecture.md §7 step 8, §12's `consultation_ai_results`). The
 * extraction itself is never mutated here — `edited_extraction` is a
 * separate column the doctor's review-draft edits populate later
 * (Milestone 8), so the original AI output stays auditable. */
@Injectable()
export class CreateExtractionResultUseCase {
  constructor(private readonly repository: ConsultationAiResultRepository) {}

  async execute(
    recordingId: string,
    request: CreateExtractionResultRequest,
  ): Promise<CreateExtractionResultResponse> {
    const row = await this.repository.create({
      recordingId,
      transcriptId: request.transcriptId,
      schemaVersion: request.extraction.schemaVersion,
      llmProvider: request.llmProvider,
      extraction: request.extraction,
      status: 'draft',
    });

    return { resultId: row.id };
  }
}
