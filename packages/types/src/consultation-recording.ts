/** Mirrors architecture.md §12's `consultation_recordings` table.
 * `deleted_at` is intentionally omitted from this API-facing type — it's
 * an internal soft-delete marker, not something callers need. */
export type ConsultationRecordingStatus =
  | "recording"
  | "uploading"
  | "uploaded"
  | "processing_failed"
  | "processed";

export interface ConsultationRecording {
  id: string;
  consultationSessionRef: string;
  doctorIdRef: string;
  status: ConsultationRecordingStatus;
  storageKey: string | null;
  durationSeconds: number | null;
  consentConfirmed: boolean;
  consentConfirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StartRecordingRequest {
  consultationSessionRef: string;
  doctorIdRef: string;
  /** Must be `true` — architecture.md §15: no recording may exist
   * without explicit, per-session doctor-confirmed consent. */
  consentConfirmed: true;
}

export interface StartRecordingResponse {
  recordingId: string;
  status: ConsultationRecordingStatus;
}

export interface RequestChunkUploadRequest {
  sequence: number;
}

export type UploadTargetMethod = "PUT";

export interface RequestChunkUploadResponse {
  uploadUrl: string;
  method: UploadTargetMethod;
  expiresAt: string;
}

export interface RequestChunkReadResponse {
  readUrl: string;
  expiresAt: string;
}

export interface CompleteUploadRequest {
  durationSeconds: number;
}

export interface CompleteUploadResponse {
  recordingId: string;
  status: ConsultationRecordingStatus;
}
