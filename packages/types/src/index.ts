export type {
  ConsultationRecording,
  ConsultationRecordingStatus,
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
} from "./clinical-extraction.js";
export type {
  Onset,
  Severity,
  PainType,
  SleepQuality,
  StressLevel,
  TreatmentType,
  RiskFlagType,
  RiskFlagSeverity,
  ChiefComplaint,
  PainCharacteristics,
  ExtractedSymptom,
  ClinicalHistory,
  Diagnosis,
  ExtractedMedicine,
  Diet,
  SleepInfo,
  StressInfo,
  Lifestyle,
  ExtractedTreatment,
  FollowUp,
  SoapNote,
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
} from "./consultation-ai-result.js";
