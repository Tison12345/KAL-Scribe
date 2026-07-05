import { Injectable } from '@nestjs/common';
import type {
  StartRecordingRequest,
  StartRecordingResponse,
} from '@kal-scribe/types';
import { ConsultationRecordingRepository } from '../infrastructure/consultation-recording.repository';

@Injectable()
export class StartRecordingUseCase {
  constructor(private readonly repository: ConsultationRecordingRepository) {}

  async execute(
    request: StartRecordingRequest,
  ): Promise<StartRecordingResponse> {
    // request.consentConfirmed is typed `true` (zod's literal(true) at
    // the controller boundary already enforced this) — architecture.md
    // §15: no recording may exist without explicit, per-session
    // doctor-confirmed consent, so this is recorded at creation time,
    // not bolted on after.
    const row = await this.repository.create({
      consultationSessionRef: request.consultationSessionRef,
      doctorIdRef: request.doctorIdRef,
      status: 'recording',
      consentConfirmed: true,
      consentConfirmedAt: new Date(),
    });

    return { recordingId: row.id, status: row.status };
  }
}
