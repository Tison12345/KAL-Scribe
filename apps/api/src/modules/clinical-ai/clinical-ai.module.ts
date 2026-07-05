import { Module } from '@nestjs/common';
import { CompleteUploadUseCase } from './application/complete-upload.use-case';
import { RequestChunkUploadUseCase } from './application/request-chunk-upload.use-case';
import { StartRecordingUseCase } from './application/start-recording.use-case';
import { ConsultationRecordingRepository } from './infrastructure/consultation-recording.repository';
import { LocalDiskStorageAdapter } from './infrastructure/local-disk-storage.adapter';
import { STORAGE_ADAPTER } from './infrastructure/storage.adapter';
import { ClinicalAiController } from './presentation/clinical-ai.controller';
import { LocalStorageController } from './presentation/local-storage.controller';

@Module({
  controllers: [ClinicalAiController, LocalStorageController],
  providers: [
    ConsultationRecordingRepository,
    LocalDiskStorageAdapter,
    // Business logic depends on the STORAGE_ADAPTER abstraction;
    // LocalStorageController depends on the concrete class directly
    // (it needs verifyToken/read/writeObject, which aren't part of
    // the portable interface). useExisting keeps both resolving to
    // the same singleton.
    { provide: STORAGE_ADAPTER, useExisting: LocalDiskStorageAdapter },
    StartRecordingUseCase,
    RequestChunkUploadUseCase,
    CompleteUploadUseCase,
  ],
})
export class ClinicalAiModule {}
