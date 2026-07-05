import { Module } from '@nestjs/common';
import { AcceptReviewDraftUseCase } from './application/accept-review-draft.use-case';
import { CompleteUploadUseCase } from './application/complete-upload.use-case';
import { CreateExtractionResultUseCase } from './application/create-extraction-result.use-case';
import { CreateTranscriptUseCase } from './application/create-transcript.use-case';
import { DiscardReviewDraftUseCase } from './application/discard-review-draft.use-case';
import { EnqueueExtractionJobUseCase } from './application/enqueue-extraction-job.use-case';
import { GetExtractionResultUseCase } from './application/get-extraction-result.use-case';
import { GetRecordingUseCase } from './application/get-recording.use-case';
import { GetTranscriptUseCase } from './application/get-transcript.use-case';
import { ListDeadLetterJobsUseCase } from './application/list-dead-letter-jobs.use-case';
import { ListRecordingJobsUseCase } from './application/list-recording-jobs.use-case';
import { RelabelTranscriptSpeakersUseCase } from './application/relabel-transcript-speakers.use-case';
import { ReprocessJobUseCase } from './application/reprocess-job.use-case';
import { RequestChunkReadUseCase } from './application/request-chunk-read.use-case';
import { RequestChunkUploadUseCase } from './application/request-chunk-upload.use-case';
import { StartRecordingUseCase } from './application/start-recording.use-case';
import { UpdateReviewDraftUseCase } from './application/update-review-draft.use-case';
import { ClinicalAiQueueEventsService } from './infrastructure/clinical-ai-queue-events.service';
import { CMS_INTEGRATION_ADAPTER } from './infrastructure/cms-integration.adapter';
import { ConsultationAiJobRepository } from './infrastructure/consultation-ai-job.repository';
import { ConsultationAiResultRepository } from './infrastructure/consultation-ai-result.repository';
import { ConsultationRecordingRepository } from './infrastructure/consultation-recording.repository';
import { ConsultationTranscriptRepository } from './infrastructure/consultation-transcript.repository';
import { LocalDiskStorageAdapter } from './infrastructure/local-disk-storage.adapter';
import { STORAGE_ADAPTER } from './infrastructure/storage.adapter';
import { StubCmsIntegrationAdapter } from './infrastructure/stub-cms-integration.adapter';
import { AdminClinicalAiController } from './presentation/admin-clinical-ai.controller';
import { ClinicalAiController } from './presentation/clinical-ai.controller';
import { LocalStorageController } from './presentation/local-storage.controller';

@Module({
  controllers: [
    ClinicalAiController,
    LocalStorageController,
    AdminClinicalAiController,
  ],
  providers: [
    ConsultationRecordingRepository,
    ConsultationAiJobRepository,
    ConsultationTranscriptRepository,
    ConsultationAiResultRepository,
    LocalDiskStorageAdapter,
    // Business logic depends on the STORAGE_ADAPTER abstraction;
    // LocalStorageController depends on the concrete class directly
    // (it needs verifyToken/read/writeObject, which aren't part of
    // the portable interface). useExisting keeps both resolving to
    // the same singleton.
    { provide: STORAGE_ADAPTER, useExisting: LocalDiskStorageAdapter },
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
    ClinicalAiQueueEventsService,
  ],
})
export class ClinicalAiModule {}
