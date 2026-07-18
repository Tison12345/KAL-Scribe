import { Injectable } from '@nestjs/common';
import type {
  StartRecordingRequest,
  StartRecordingResponse,
} from '@kal-scribe/types';
import { ConsultationAiAuditLogRepository } from '../infrastructure/consultation-ai-audit-log.repository';
import { ConsultationAiSessionRepository } from '../infrastructure/consultation-ai-session.repository';
import { ConsultationRecordingRepository } from '../infrastructure/consultation-recording.repository';

@Injectable()
export class StartRecordingUseCase {
  constructor(
    private readonly sessions: ConsultationAiSessionRepository,
    private readonly repository: ConsultationRecordingRepository,
    private readonly auditLog: ConsultationAiAuditLogRepository,
  ) {}

  async execute(
    request: StartRecordingRequest,
  ): Promise<StartRecordingResponse> {
    // Pause/resume support (docs/adr/0014): a new recording under the
    // same consultation-session-ref reuses the existing active session
    // rather than starting a new one.
    let session = await this.sessions.findActiveByConsultationSessionRef(
      request.consultationSessionRef,
    );
    let sequenceInSession = 0;
    if (session) {
      sequenceInSession = await this.repository.countBySessionId(session.id);
    } else {
      session = await this.sessions.create({
        consultationSessionRef: request.consultationSessionRef,
        doctorIdRef: request.doctorIdRef,
        status: 'active',
      });
      await this.auditLog.record({
        sessionId: session.id,
        eventType: 'session_started',
        actorRef: request.doctorIdRef,
        metadata: { consultationSessionRef: request.consultationSessionRef },
      });
    }

    // request.consentConfirmed is typed `true` (zod's literal(true) at
    // the controller boundary already enforced this) — architecture.md
    // §15: no recording may exist without explicit, doctor-confirmed
    // consent, recorded fresh on every recording (including every
    // resume within a session — see docs/adr/0014's consent-scope note).
    const row = await this.repository.create({
      sessionId: session.id,
      sequenceInSession,
      status: 'recording',
      consentConfirmed: true,
      consentConfirmedAt: new Date(),
      sttDevice: request.sttDevice ?? null,
    });

    await this.auditLog.record({
      recordingId: row.id,
      sessionId: session.id,
      eventType: 'consent_confirmed',
      actorRef: request.doctorIdRef,
      metadata: { sequenceInSession },
    });

    return { recordingId: row.id, status: row.status };
  }
}
