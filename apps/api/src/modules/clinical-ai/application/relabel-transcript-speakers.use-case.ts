import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  ConsultationTranscript,
  TranscriptSegment,
} from '@kal-scribe/types';
import { swapDoctorAndPatient } from '../domain/doctor-patient-labeling.engine';
import { ConsultationTranscriptRepository } from '../infrastructure/consultation-transcript.repository';

/** One-tap Doctor/Patient correction (architecture.md §9) — swaps the
 * two roles wholesale, since a wrong heuristic guess is almost always
 * backwards entirely, not wrong on individual segments. */
@Injectable()
export class RelabelTranscriptSpeakersUseCase {
  constructor(private readonly repository: ConsultationTranscriptRepository) {}

  async execute(recordingId: string): Promise<ConsultationTranscript> {
    const row = await this.repository.findByRecordingId(recordingId);
    if (!row) {
      throw new NotFoundException(
        `No transcript for recording "${recordingId}".`,
      );
    }

    const swapped = swapDoctorAndPatient(row.segments as TranscriptSegment[]);
    const updated = await this.repository.updateSegments(row.id, swapped);

    return {
      id: updated.id,
      recordingId: updated.recordingId,
      segments: updated.segments as TranscriptSegment[],
      sttProvider: updated.sttProvider,
      diarizationProvider: updated.diarizationProvider,
      languageDetected: updated.languageDetected,
      isMultilingual: updated.isMultilingual,
      isCodeSwitched: updated.isCodeSwitched,
      inputTokens: updated.inputTokens,
      outputTokens: updated.outputTokens,
      totalTokens: updated.totalTokens,
      transcriptionLatencyMs: updated.transcriptionLatencyMs,
      createdAt: updated.createdAt.toISOString(),
    };
  }
}
