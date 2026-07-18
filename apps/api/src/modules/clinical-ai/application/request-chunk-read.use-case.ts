import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { RequestChunkReadResponse } from '@kal-scribe/types';
import { ConsultationRecordingRepository } from '../infrastructure/consultation-recording.repository';
import {
  STORAGE_ADAPTER,
  StorageObjectNotFoundError,
  type StorageAdapter,
} from '../infrastructure/storage.adapter';

/**
 * Returns a signed read URL for one chunk (architecture.md §14's
 * signed-URL model — callers never get a raw storage path). Used by
 * workers/clinical-ai-worker's chunk-fetch-and-stitch loop
 * (internal-api-client.ts's `fetchAndStitchRecordingAudio`), which
 * requests sequence 0, 1, 2... and stops on the first 404 — so a
 * missing chunk here must surface as a 404, not a 500, or the worker
 * treats a normal "end of chunks" as a hard failure.
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
    try {
      const target = await this.storage.createReadUrl({ storageKey });
      return { readUrl: target.readUrl, expiresAt: target.expiresAt };
    } catch (error) {
      if (error instanceof StorageObjectNotFoundError) {
        throw new NotFoundException(
          `No chunk ${sequence} for recording "${recordingId}".`,
        );
      }
      throw error;
    }
  }
}
