import type { ConsultationAiRun } from '@kal-scribe/types';
import type { ClinicalExtraction } from '@kal-scribe/types';
import type { ConsultationAiRunRow } from '../../../infrastructure/database/schema';

export function toConsultationAiRun(
  row: ConsultationAiRunRow,
): ConsultationAiRun {
  return {
    id: row.id,
    recordingId: row.recordingId,
    transcriptId: row.transcriptId,
    runNumber: row.runNumber,
    schemaVersion: row.schemaVersion,
    provider: row.provider,
    model: row.model,
    promptVersion: row.promptVersion,
    temperature: row.temperature,
    latencyMs: row.latencyMs,
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
    totalTokens: row.totalTokens,
    estimatedCostUsd: row.estimatedCostUsd,
    retryCount: row.retryCount,
    hadValidationRetry: row.hadValidationRetry,
    rawResponse: row.rawResponse,
    extraction: row.extraction as ClinicalExtraction,
    confidenceOverall: row.confidenceOverall,
    createdAt: row.createdAt.toISOString(),
  };
}
