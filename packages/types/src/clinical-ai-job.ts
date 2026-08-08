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
  queueJobId: string | null;
  status: ClinicalAiJobStatus;
  attemptCount: number;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

/** Payload sent onto the transcription queue once a recording finishes
 * uploading (architecture.md §7 step 4). `jobId` is this repo's own
 * `consultation_ai_jobs` row id (docs/adr/0015) — carried in the
 * payload itself rather than relying on pg-boss's own job id, since a
 * reprocessed job gets a fresh pg-boss id but must still report status
 * against the same tracking row. */
export interface TranscriptionJobPayload {
  jobId: string;
  recordingId: string;
  storageKey: string;
}

/** Payload sent onto the extraction queue once a transcript is
 * persisted (architecture.md §7 step 8). */
export interface ExtractionJobPayload {
  jobId: string;
  recordingId: string;
  transcriptId: string;
  /** Overrides the deployment-wide `EXTRACTION_PROVIDER` for this one
   * run (docs/adr/0014) — what makes triggering "Run 2 against a
   * different provider" for the same recording possible. */
  requestedProvider?: string;
}

/** The worker reports each job-lifecycle transition to apps/api over
 * HTTP (docs/adr/0015) — pg-boss has no cross-process event stream the
 * way BullMQ's Redis pub/sub did, and the worker already knows exactly
 * when each transition happens since it's the one running the job. */
export interface UpdateJobStatusRequest {
  status: ClinicalAiJobStatus;
  errorMessage?: string | null;
}
