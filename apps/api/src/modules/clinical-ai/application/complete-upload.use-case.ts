import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { CLINICAL_AI_QUEUE_NAMES } from '@kal-scribe/types';
import type {
  CompleteUploadRequest,
  CompleteUploadResponse,
  TranscriptionJobPayload,
} from '@kal-scribe/types';
import { assertValidStatusTransition } from '../domain/consultation-recording.entity';
import { ConsultationAiJobRepository } from '../infrastructure/consultation-ai-job.repository';
import { ConsultationRecordingRepository } from '../infrastructure/consultation-recording.repository';

@Injectable()
export class CompleteUploadUseCase {
  constructor(
    private readonly repository: ConsultationRecordingRepository,
    private readonly jobs: ConsultationAiJobRepository,
    @InjectQueue(CLINICAL_AI_QUEUE_NAMES.transcription)
    private readonly transcriptionQueue: Queue<TranscriptionJobPayload>,
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
   * pipeline" (architecture.md §7 step 4). The actual transcription
   * logic doesn't exist until Milestone 5 — this just gets a job onto
   * the queue with a tracked consultation_ai_jobs row. */
  private async enqueueTranscriptionJob(
    recordingId: string,
    storageKey: string,
  ): Promise<void> {
    const jobRow = await this.jobs.create({
      recordingId,
      jobType: 'transcription',
      status: 'queued',
    });

    // Our own row id doubles as the BullMQ job id, by construction —
    // keeps bullmq_job_id trivially correct with no separate lookup
    // index needed (see ClinicalAiQueueEventsService).
    await this.jobs.update(jobRow.id, { bullmqJobId: jobRow.id });
    await this.transcriptionQueue.add(
      'transcribe-consultation',
      { recordingId, storageKey } satisfies TranscriptionJobPayload,
      { jobId: jobRow.id },
    );
  }
}
