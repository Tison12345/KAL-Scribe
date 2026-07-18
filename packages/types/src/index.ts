export type {
  ConsultationAiSessionStatus,
  ConsultationAiSession,
} from "./consultation-ai-session.js";

export type {
  ConsultationRecording,
  ConsultationRecordingStatus,
  SttDevice,
  StartRecordingRequest,
  StartRecordingResponse,
  RequestChunkUploadRequest,
  RequestChunkUploadResponse,
  RequestChunkReadResponse,
  UploadTargetMethod,
  CompleteUploadRequest,
  CompleteUploadResponse,
  UpdateRecordingAudioMetadataRequest,
} from "./consultation-recording.js";

export type {
  ClinicalAiJobType,
  ClinicalAiJobStatus,
  ConsultationAiJob,
  TranscriptionJobPayload,
  ExtractionJobPayload,
  UpdateJobStatusRequest,
} from "./clinical-ai-job.js";

export {
  CLINICAL_AI_QUEUE_NAMES,
  DEFAULT_QUEUE_JOB_OPTIONS,
} from "./clinical-ai-queues.js";
export type { ClinicalAiQueueName } from "./clinical-ai-queues.js";

export type {
  TranscriptSegment,
  SpeakerTurn,
  ProcessAudioResponse,
} from "./transcript-segment.js";

export type {
  ConsultationTranscript,
  CreateTranscriptRequest,
  CreateTranscriptResponse,
} from "./consultation-transcript.js";

export {
  CLINICAL_EXTRACTION_SCHEMA_VERSION,
  SROTAS_KEYS,
  SROTAS_DISTURBANCE_TYPES,
} from "./clinical-extraction.js";
export type {
  SrotasKey,
  SrotasDisturbanceType,
  QuantityUnit,
  StrokeDirection,
  Pressure,
  FollowUpUnit,
  AamaLevel,
  RiskFlagType,
  RiskFlagSeverity,
  PersonalHistory,
  FamilyHistory,
  GynecInfo,
  Vitals,
  AshtavidhaPariksha,
  SrotasEntry,
  ExtractedMedicine,
  ExtractedTreatment,
  RiskFlag,
  AiConfidence,
  TranscriptReference,
  ClinicalExtraction,
} from "./clinical-extraction.js";

export type {
  ConsultationAiRun,
  CreateExtractionResultRequest,
  CreateExtractionResultResponse,
  EnqueueExtractionJobRequest,
  ConsultationAnalytics,
} from "./consultation-ai-run.js";

export type {
  ConsultationReviewStatus,
  ConsultationReview,
  ReviewDraft,
  UpdateReviewDraftRequest,
  AcceptReviewDraftRequest,
} from "./consultation-review.js";

export type {
  ConsultationAiAuditLogEvent,
  RecordAuditEventRequest,
} from "./consultation-ai-audit-log.js";
