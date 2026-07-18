import { Injectable, NotFoundException } from '@nestjs/common';
import type { ConsultationRecording } from '@kal-scribe/types';
import { ConsultationAiSessionRepository } from '../infrastructure/consultation-ai-session.repository';
import { ConsultationRecordingRepository } from '../infrastructure/consultation-recording.repository';

/** Exposes a recording's own lifecycle timestamps (architecture.md
 * §12) — primarily so the frontend's pipeline-progress tracker can
 * compute upload duration (created_at -> updated_at once `uploaded`),
 * not previously exposed by any route. `consultationSessionRef`/
 * `doctorIdRef` are joined from the owning session (docs/adr/0014
 * moved those fields off the recording itself). */
@Injectable()
export class GetRecordingUseCase {
  constructor(
    private readonly repository: ConsultationRecordingRepository,
    private readonly sessions: ConsultationAiSessionRepository,
  ) {}

  async execute(recordingId: string): Promise<ConsultationRecording> {
    const row = await this.repository.findById(recordingId);
    if (!row) {
      throw new NotFoundException(`No recording with id "${recordingId}".`);
    }

    const session = await this.sessions.findById(row.sessionId);
    if (!session) {
      throw new NotFoundException(
        `Recording "${recordingId}" references a missing session "${row.sessionId}".`,
      );
    }

    return {
      id: row.id,
      consultationSessionRef: session.consultationSessionRef,
      doctorIdRef: session.doctorIdRef,
      sessionId: row.sessionId,
      sequenceInSession: row.sequenceInSession,
      status: row.status,
      storageKey: row.storageKey,
      durationSeconds: row.durationSeconds,
      sampleRateHz: row.sampleRateHz,
      channels: row.channels,
      codec: row.codec,
      fileSizeBytes: row.fileSizeBytes,
      consentConfirmed: row.consentConfirmed,
      consentConfirmedAt: row.consentConfirmedAt?.toISOString() ?? null,
      sttDevice: row.sttDevice,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
