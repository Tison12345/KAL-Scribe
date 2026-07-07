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
} from "./consultation-recording.js";

export type {
  ClinicalAiJobType,
  ClinicalAiJobStatus,
  ConsultationAiJob,
  TranscriptionJobPayload,
  ExtractionJobPayload,
} from "./clinical-ai-job.js";

export {
  CLINICAL_AI_QUEUE_NAMES,
  DEFAULT_QUEUE_JOB_OPTIONS,
  BULLMQ_PREFIX,
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
  BpPosition,
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
  ConsultationAiResultStatus,
  ConsultationAiResult,
  CreateExtractionResultRequest,
  CreateExtractionResultResponse,
  EnqueueExtractionJobRequest,
  UpdateReviewDraftRequest,
  AcceptReviewDraftRequest,
} from "./consultation-ai-result.js";
