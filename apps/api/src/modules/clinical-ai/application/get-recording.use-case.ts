import { Injectable, NotFoundException } from '@nestjs/common';
import type { ConsultationRecording } from '@kal-scribe/types';
import { ConsultationRecordingRepository } from '../infrastructure/consultation-recording.repository';

/** Exposes a recording's own lifecycle timestamps (architecture.md
 * §12) — primarily so the frontend's pipeline-progress tracker can
 * compute upload duration (created_at -> updated_at once `uploaded`),
 * not previously exposed by any route. */
@Injectable()
export class GetRecordingUseCase {
  constructor(private readonly repository: ConsultationRecordingRepository) {}

  async execute(recordingId: string): Promise<ConsultationRecording> {
    const row = await this.repository.findById(recordingId);
    if (!row) {
      throw new NotFoundException(`No recording with id "${recordingId}".`);
    }

    return {
      id: row.id,
      consultationSessionRef: row.consultationSessionRef,
      doctorIdRef: row.doctorIdRef,
      status: row.status,
      storageKey: row.storageKey,
      durationSeconds: row.durationSeconds,
      consentConfirmed: row.consentConfirmed,
      consentConfirmedAt: row.consentConfirmedAt?.toISOString() ?? null,
      sttDevice: row.sttDevice,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
