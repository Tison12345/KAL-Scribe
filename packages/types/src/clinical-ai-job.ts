import type { SttDevice } from "./consultation-recording.js";

/** Mirrors architecture.md §12's `consultation_ai_jobs` table. */
export type ClinicalAiJobType = "transcription" | "diarization" | "extraction";

export type ClinicalAiJobStatus =
  | "queued"
  | "active"
  | "completed"
  | "failed"
  | "dead_letter";

export interface ConsultationAiJob {
  id: string;
  recordingId: string;
  jobType: ClinicalAiJobType;
  bullmqJobId: string | null;
  status: ClinicalAiJobStatus;
  attemptCount: number;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

/** Payload enqueued onto the transcription queue once a recording
 * finishes uploading (architecture.md §7 step 4). */
export interface TranscriptionJobPayload {
  recordingId: string;
  storageKey: string;
  sttDevice?: SttDevice;
}

/** Payload enqueued onto the extraction queue once a transcript is
 * persisted (architecture.md §7 step 8). */
export interface ExtractionJobPayload {
  recordingId: string;
  transcriptId: string;
}
