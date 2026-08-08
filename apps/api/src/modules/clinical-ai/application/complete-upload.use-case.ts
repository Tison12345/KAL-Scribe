import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PgBoss } from 'pg-boss';
import { CLINICAL_AI_QUEUE_NAMES } from '@kal-scribe/types';
import type {
  CompleteUploadRequest,
  CompleteUploadResponse,
  TranscriptionJobPayload,
} from '@kal-scribe/types';
import { PG_BOSS } from '../../../infrastructure/queues/queue.module';
import { assertValidStatusTransition } from '../domain/consultation-recording.entity';
import { ConsultationAiJobRepository } from '../infrastructure/consultation-ai-job.repository';
import { ConsultationRecordingRepository } from '../infrastructure/consultation-recording.repository';

@Injectable()
export class CompleteUploadUseCase {
  constructor(
    private readonly repository: ConsultationRecordingRepository,
    private readonly jobs: ConsultationAiJobRepository,
    @Inject(PG_BOSS) private readonly boss: PgBoss,
  ) {}

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
    // whatever this particular call happened to send. Also means the
    // transcription job is only ever enqueued once per recording.
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
    // it (Milestone 5's ASR step), not built here.
    const storageKey = `recordings/${recordingId}/`;
    const updated = await this.repository.update(recordingId, {
      status: 'uploaded',
      durationSeconds: Math.round(request.durationSeconds),
      storageKey,
    });

    await this.enqueueTranscriptionJob(updated.id, storageKey);

    return { recordingId: updated.id, status: updated.status };
  }

  /** Hand-off point from "client concern" to "durable background
   * pipeline" (architecture.md §7 step 4). */
  private async enqueueTranscriptionJob(
    recordingId: string,
    storageKey: string,
  ): Promise<void> {
    const jobRow = await this.jobs.create({
      recordingId,
      jobType: 'transcription',
      status: 'queued',
    });

    const queueJobId = await this.boss.send(
      CLINICAL_AI_QUEUE_NAMES.transcription,
      {
        jobId: jobRow.id,
        recordingId,
        storageKey,
      } satisfies TranscriptionJobPayload,
    );
    await this.jobs.update(jobRow.id, { queueJobId });
  }
}
