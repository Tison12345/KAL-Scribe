import { Module } from '@nestjs/common';
import { AcceptReviewDraftUseCase } from './application/accept-review-draft.use-case';
import { CompleteUploadUseCase } from './application/complete-upload.use-case';
import { ConfirmChunkUploadUseCase } from './application/confirm-chunk-upload.use-case';
import { CreateExtractionResultUseCase } from './application/create-extraction-result.use-case';
import { CreateTranscriptUseCase } from './application/create-transcript.use-case';
import { DiscardReviewDraftUseCase } from './application/discard-review-draft.use-case';
import { EnqueueExtractionJobUseCase } from './application/enqueue-extraction-job.use-case';
import { FindDuplicateTranscriptUseCase } from './application/find-duplicate-transcript.use-case';
import { GetConsultationAnalyticsUseCase } from './application/get-consultation-analytics.use-case';
import { GetConsultationRunUseCase } from './application/get-consultation-run.use-case';
import { GetExtractionResultUseCase } from './application/get-extraction-result.use-case';
import { GetRecordingUseCase } from './application/get-recording.use-case';
import { GetTranscriptUseCase } from './application/get-transcript.use-case';
import { ListConsultationRunsUseCase } from './application/list-consultation-runs.use-case';
import { ListRecordingChunksUseCase } from './application/list-recording-chunks.use-case';
import { ListDeadLetterJobsUseCase } from './application/list-dead-letter-jobs.use-case';
import { ListRecordingJobsUseCase } from './application/list-recording-jobs.use-case';
import { RelabelTranscriptSpeakersUseCase } from './application/relabel-transcript-speakers.use-case';
import { ReprocessJobUseCase } from './application/reprocess-job.use-case';
import { RequestChunkReadUseCase } from './application/request-chunk-read.use-case';
import { RequestChunkUploadUseCase } from './application/request-chunk-upload.use-case';
import { StartRecordingUseCase } from './application/start-recording.use-case';
import { UpdateJobStatusUseCase } from './application/update-job-status.use-case';
import { UpdateRecordingAudioMetadataUseCase } from './application/update-recording-audio-metadata.use-case';
import { UpdateReviewDraftUseCase } from './application/update-review-draft.use-case';
import { CMS_INTEGRATION_ADAPTER } from './infrastructure/cms-integration.adapter';
import { ConsultationAiAuditLogRepository } from './infrastructure/consultation-ai-audit-log.repository';
import { ConsultationAiJobRepository } from './infrastructure/consultation-ai-job.repository';
import { ConsultationAiRunRepository } from './infrastructure/consultation-ai-run.repository';
import { ConsultationAiSessionRepository } from './infrastructure/consultation-ai-session.repository';
import { ConsultationRecordingChunkRepository } from './infrastructure/consultation-recording-chunk.repository';
import { ConsultationRecordingRepository } from './infrastructure/consultation-recording.repository';
import { ConsultationReviewRepository } from './infrastructure/consultation-review.repository';
import { ConsultationTranscriptRepository } from './infrastructure/consultation-transcript.repository';
import { SupabaseStorageAdapter } from './infrastructure/supabase-storage.adapter';
import { STORAGE_ADAPTER } from './infrastructure/storage.adapter';
import { StubCmsIntegrationAdapter } from './infrastructure/stub-cms-integration.adapter';
import { AdminClinicalAiController } from './presentation/admin-clinical-ai.controller';
import { ClinicalAiController } from './presentation/clinical-ai.controller';

@Module({
  controllers: [ClinicalAiController, AdminClinicalAiController],
  providers: [
    ConsultationAiSessionRepository,
    ConsultationRecordingRepository,
    ConsultationRecordingChunkRepository,
    ConsultationAiJobRepository,
    ConsultationTranscriptRepository,
    ConsultationAiRunRepository,
    ConsultationReviewRepository,
    ConsultationAiAuditLogRepository,
    { provide: STORAGE_ADAPTER, useClass: SupabaseStorageAdapter },
    StubCmsIntegrationAdapter,
    {
      provide: CMS_INTEGRATION_ADAPTER,
      useExisting: StubCmsIntegrationAdapter,
    },
    StartRecordingUseCase,
    RequestChunkUploadUseCase,
    RequestChunkReadUseCase,
    CompleteUploadUseCase,
    CreateTranscriptUseCase,
    GetTranscriptUseCase,
    RelabelTranscriptSpeakersUseCase,
    EnqueueExtractionJobUseCase,
    CreateExtractionResultUseCase,
    GetExtractionResultUseCase,
    UpdateReviewDraftUseCase,
    AcceptReviewDraftUseCase,
    DiscardReviewDraftUseCase,
    GetRecordingUseCase,
    ListRecordingJobsUseCase,
    ListDeadLetterJobsUseCase,
    ReprocessJobUseCase,
    UpdateRecordingAudioMetadataUseCase,
    ListConsultationRunsUseCase,
    GetConsultationRunUseCase,
    GetConsultationAnalyticsUseCase,
    UpdateJobStatusUseCase,
    FindDuplicateTranscriptUseCase,
    ConfirmChunkUploadUseCase,
    ListRecordingChunksUseCase,
  ],
})
export class ClinicalAiModule {}
