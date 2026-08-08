/** Mirrors the `consultation_recordings` table (docs/adr/0014).
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
  /** Sourced via a join to the owning `consultation_ai_sessions` row
   * (docs/adr/0014 moved these two fields off the recording itself) —
   * kept here so existing callers don't need to change. */
  consultationSessionRef: string;
  doctorIdRef: string;
  sessionId: string;
  sequenceInSession: number;
  status: ConsultationRecordingStatus;
  storageKey: string | null;
  durationSeconds: number | null;
  sampleRateHz: number | null;
  channels: number | null;
  codec: string | null;
  fileSizeBytes: number | null;
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

/** Populated post-stitch via ffprobe (docs/adr/0014) — the worker
 * calls this once it has the continuous audio file, before handing it
 * to a transcription provider. */
export interface UpdateRecordingAudioMetadataRequest {
  sampleRateHz: number | null;
  channels: number | null;
  codec: string | null;
  fileSizeBytes: number | null;
}
