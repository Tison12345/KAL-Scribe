import { Injectable } from '@nestjs/common';
import type {
  CreateExtractionResultRequest,
  CreateExtractionResultResponse,
} from '@kal-scribe/types';
import { ConsultationAiAuditLogRepository } from '../infrastructure/consultation-ai-audit-log.repository';
import { ConsultationAiRunRepository } from '../infrastructure/consultation-ai-run.repository';

/** Persists the LLM's extraction output once the worker has it
 * (architecture.md §7 step 8) as a new immutable run, plus its paired
 * draft review (docs/adr/0014 — replaces the old single-table
 * `consultation_ai_results`). The extraction itself is never mutated
 * — `edited_extraction` on the review is a separate row the doctor's
 * review-draft edits populate later, so the original AI output stays
 * auditable and comparable across runs. */
@Injectable()
export class CreateExtractionResultUseCase {
  constructor(
    private readonly runs: ConsultationAiRunRepository,
    private readonly auditLog: ConsultationAiAuditLogRepository,
  ) {}

  async execute(
    recordingId: string,
    request: CreateExtractionResultRequest,
  ): Promise<CreateExtractionResultResponse> {
    const { run, review } = await this.runs.createWithReview({
      recordingId,
      transcriptId: request.transcriptId,
      schemaVersion: request.extraction.schemaVersion,
      provider: request.provider,
      model: request.model,
      promptVersion: request.promptVersion ?? 'unknown',
      temperature: request.temperature ?? null,
      latencyMs: request.latencyMs ?? null,
      inputTokens: request.inputTokens ?? null,
      outputTokens: request.outputTokens ?? null,
      totalTokens: request.totalTokens ?? null,
      estimatedCostUsd: request.estimatedCostUsd ?? null,
      retryCount: request.retryCount ?? 0,
      hadValidationRetry: request.hadValidationRetry ?? false,
      // Falls back to the parsed extraction itself when the caller
      // doesn't have a distinct pre-parse response to hand over yet
      // (Phase 3 wires real raw-response capture through) — never
      // null, the column is NOT NULL.
      rawResponse: request.rawResponse ?? request.extraction,
      extraction: request.extraction,
      confidenceOverall: request.extraction.aiConfidence?.overall ?? null,
    });

    await this.auditLog.record({
      recordingId,
      eventType: 'run_created',
      actorRef: 'system',
      metadata: {
        runId: run.id,
        runNumber: run.runNumber,
        provider: run.provider,
        model: run.model,
      },
    });

    return { runId: run.id, reviewId: review.id };
  }
}
