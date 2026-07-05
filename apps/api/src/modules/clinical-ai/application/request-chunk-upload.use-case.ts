import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  RequestChunkUploadRequest,
  RequestChunkUploadResponse,
} from '@kal-scribe/types';
import { assertValidStatusTransition } from '../domain/consultation-recording.entity';
import { ConsultationRecordingRepository } from '../infrastructure/consultation-recording.repository';
import {
  STORAGE_ADAPTER,
  type StorageAdapter,
} from '../infrastructure/storage.adapter';

@Injectable()
export class RequestChunkUploadUseCase {
  constructor(
    private readonly repository: ConsultationRecordingRepository,
    @Inject(STORAGE_ADAPTER) private readonly storage: StorageAdapter,
  ) {}

  async execute(
    recordingId: string,
    request: RequestChunkUploadRequest,
  ): Promise<RequestChunkUploadResponse> {
    const recording = await this.repository.findById(recordingId);
    if (!recording) {
      throw new NotFoundException(`No recording with id "${recordingId}".`);
    }
    if (recording.status !== 'recording' && recording.status !== 'uploading') {
      throw new BadRequestException(
        `Cannot upload a chunk for a recording in status "${recording.status}".`,
      );
    }

    if (recording.status === 'recording') {
      try {
        assertValidStatusTransition(recording.status, 'uploading');
      } catch (error) {
        throw new BadRequestException(
          error instanceof Error ? error.message : 'Invalid status transition.',
        );
      }
      await this.repository.update(recordingId, { status: 'uploading' });
    }

    const storageKey = `recordings/${recordingId}/chunk-${String(
      request.sequence,
    ).padStart(6, '0')}.webm`;
    const target = await this.storage.createUploadTarget({ storageKey });

    return {
      uploadUrl: target.uploadUrl,
      method: target.method,
      expiresAt: target.expiresAt,
    };
  }
}
