/** Mirrors the `consultation_ai_sessions` table (docs/adr/0014) — this
 * repo's own root grouping entity, not the CMS's own consultation
 * session concept. */
export type ConsultationAiSessionStatus = "active" | "completed" | "abandoned";

export interface ConsultationAiSession {
  id: string;
  consultationSessionRef: string;
  doctorIdRef: string;
  status: ConsultationAiSessionStatus;
  startedAt: string;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
