import type { ConsultationTranscript } from "./consultation-transcript.js";

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

/** Audit finding E2 — one row per chunk the browser has confirmed
 * actually finished uploading (see docs comment on the DB table). */
export interface RecordingChunk {
  sequence: number;
  uploadedAt: string;
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
  /** sha256 of the stitched audio bytes (audit finding E4). Optional/
   * nullable so a provider that can't compute it doesn't have to. */
  audioHash?: string | null;
}

/** Audit finding E4 — returned by the duplicate-audio check the worker
 * runs before transcribing. `null` means no duplicate found. Carries
 * the full transcript (not just an id) so the worker can copy it in
 * one round trip rather than needing a second "get transcript by id"
 * call that doesn't otherwise exist. */
export interface DuplicateTranscriptResponse {
  transcript: ConsultationTranscript | null;
}
