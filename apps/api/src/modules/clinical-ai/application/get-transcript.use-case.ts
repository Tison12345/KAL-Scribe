import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  ConsultationTranscript,
  TranscriptSegment,
} from '@kal-scribe/types';
import { ConsultationTranscriptRepository } from '../infrastructure/consultation-transcript.repository';

@Injectable()
export class GetTranscriptUseCase {
  constructor(private readonly repository: ConsultationTranscriptRepository) {}

  async execute(recordingId: string): Promise<ConsultationTranscript> {
    const row = await this.repository.findByRecordingId(recordingId);
    if (!row) {
      throw new NotFoundException(
        `No transcript for recording "${recordingId}".`,
      );
    }

    return {
      id: row.id,
      recordingId: row.recordingId,
      segments: row.segments as TranscriptSegment[],
      sttProvider: row.sttProvider,
      diarizationProvider: row.diarizationProvider,
      languageDetected: row.languageDetected,
      isMultilingual: row.isMultilingual,
      isCodeSwitched: row.isCodeSwitched,
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
      totalTokens: row.totalTokens,
      transcriptionLatencyMs: row.transcriptionLatencyMs,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
