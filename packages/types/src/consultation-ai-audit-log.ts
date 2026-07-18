/** Mirrors the `consultation_ai_audit_log` table (architecture.md §12,
 * implemented as of docs/adr/0014). At least one of `recordingId`/
 * `sessionId` is always set (enforced by a DB check constraint). */
export interface ConsultationAiAuditLogEvent {
  id: string;
  recordingId: string | null;
  sessionId: string | null;
  eventType: string;
  actorRef: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface RecordAuditEventRequest {
  recordingId?: string | null;
  sessionId?: string | null;
  eventType: string;
  actorRef: string;
  metadata?: Record<string, unknown>;
}
