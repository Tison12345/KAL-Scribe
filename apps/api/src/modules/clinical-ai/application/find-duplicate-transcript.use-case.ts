import { Injectable } from '@nestjs/common';
import type {
  DuplicateTranscriptResponse,
  TranscriptSegment,
} from '@kal-scribe/types';
import { ConsultationRecordingRepository } from '../infrastructure/consultation-recording.repository';
import { ConsultationTranscriptRepository } from '../infrastructure/consultation-transcript.repository';

/**
 * Audit finding E4 — content-hash audio deduplication. Called by the
 * worker before it spends a Gemini transcription call on audio it may
 * have already paid for once. Looks for the *oldest* other recording
 * with the same `audioHash` that already has a persisted transcript,
 * so a genuine byte-identical duplicate reuses that transcript instead
 * of being re-transcribed and re-billed.
 */
@Injectable()
export class FindDuplicateTranscriptUseCase {
  constructor(
    private readonly recordings: ConsultationRecordingRepository,
    private readonly transcripts: ConsultationTranscriptRepository,
  ) {}

  async execute(
    recordingId: string,
    audioHash: string,
  ): Promise<DuplicateTranscriptResponse> {
    const candidates = await this.recordings.findByAudioHash(
      audioHash,
      recordingId,
    );
    for (const candidate of candidates) {
      const row = await this.transcripts.findByRecordingId(candidate.id);
      if (row) {
        return {
          transcript: {
            id: row.id,
            recordingId: row.recordingId,
            segments: row.segments as TranscriptSegment[],
            sttProvider: row.sttProvider,
            diarizationProvider: row.diarizationProvider,
            model: row.model,
            promptVersion: row.promptVersion,
            languageDetected: row.languageDetected,
            isMultilingual: row.isMultilingual,
            isCodeSwitched: row.isCodeSwitched,
            inputTokens: row.inputTokens,
            outputTokens: row.outputTokens,
            totalTokens: row.totalTokens,
            transcriptionLatencyMs: row.transcriptionLatencyMs,
            createdAt: row.createdAt.toISOString(),
          },
        };
      }
    }
    return { transcript: null };
  }
}
