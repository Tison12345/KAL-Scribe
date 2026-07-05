import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { RequestChunkReadResponse } from '@kal-scribe/types';
import { ConsultationRecordingRepository } from '../infrastructure/consultation-recording.repository';
import {
  STORAGE_ADAPTER,
  type StorageAdapter,
} from '../infrastructure/storage.adapter';

/**
 * Returns a signed read URL for one chunk (architecture.md §14's
 * signed-URL model — callers never get a raw storage path). Used by
 * workers/clinical-ai-worker to fetch audio for transcription.
 *
 * Only reads a single chunk by sequence — this repo doesn't stitch
 * multiple chunks into one continuous file yet (see docs/PROJECT_STATUS.md),
 * so Milestone 5's transcription only covers single-chunk recordings
 * for now, a deliberate, documented scope boundary, not a bug.
 */
@Injectable()
export class RequestChunkReadUseCase {
  constructor(
    private readonly repository: ConsultationRecordingRepository,
    @Inject(STORAGE_ADAPTER) private readonly storage: StorageAdapter,
  ) {}

  async execute(
    recordingId: string,
    sequence: number,
  ): Promise<RequestChunkReadResponse> {
    const recording = await this.repository.findById(recordingId);
    if (!recording) {
      throw new NotFoundException(`No recording with id "${recordingId}".`);
    }

    const storageKey = `recordings/${recordingId}/chunk-${String(
      sequence,
    ).padStart(6, '0')}.webm`;
    const target = await this.storage.createReadUrl({ storageKey });

    return { readUrl: target.readUrl, expiresAt: target.expiresAt };
  }
}
