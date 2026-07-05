import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CompleteUploadRequest,
  CompleteUploadResponse,
} from '@kal-scribe/types';
import { assertValidStatusTransition } from '../domain/consultation-recording.entity';
import { ConsultationRecordingRepository } from '../infrastructure/consultation-recording.repository';

@Injectable()
export class CompleteUploadUseCase {
  constructor(private readonly repository: ConsultationRecordingRepository) {}

  async execute(
    recordingId: string,
    request: CompleteUploadRequest,
  ): Promise<CompleteUploadResponse> {
    const recording = await this.repository.findById(recordingId);
    if (!recording) {
      throw new NotFoundException(`No recording with id "${recordingId}".`);
    }

    // Idempotent, not a no-op re-apply: a finalized recording is
    // immutable (architecture.md §14), so a repeat call (e.g. a
    // retried request after a lost response) returns the existing
    // state rather than overwriting duration_seconds/storage_key with
    // whatever this particular call happened to send.
    if (recording.status === 'uploaded' || recording.status === 'processed') {
      return { recordingId: recording.id, status: recording.status };
    }

    try {
      assertValidStatusTransition(recording.status, 'uploaded');
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invalid status transition.',
      );
    }

    // storageKey points at the recording's chunk folder, not one
    // stitched file — stitching the chunks into a single continuous
    // audio file is deferred to whichever milestone actually consumes
    // it (Milestone 4's queue job or Milestone 5's ASR step), not
    // built here. See docs/PROJECT_STATUS.md.
    const updated = await this.repository.update(recordingId, {
      status: 'uploaded',
      durationSeconds: Math.round(request.durationSeconds),
      storageKey: `recordings/${recordingId}/`,
    });

    return { recordingId: updated.id, status: updated.status };
  }
}
