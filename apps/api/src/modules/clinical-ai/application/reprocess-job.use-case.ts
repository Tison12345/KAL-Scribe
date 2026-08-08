import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PgBoss } from 'pg-boss';
import { CLINICAL_AI_QUEUE_NAMES } from '@kal-scribe/types';
import type { TranscriptionJobPayload } from '@kal-scribe/types';
import { PG_BOSS } from '../../../infrastructure/queues/queue.module';
import { ConsultationAiJobRepository } from '../infrastructure/consultation-ai-job.repository';
import { ConsultationRecordingRepository } from '../infrastructure/consultation-recording.repository';

/** Manual "reprocess" per architecture.md §13 — re-runs just this job's
 * stage, not the whole pipeline from audio again. Only the
 * transcription stage is supported so far; extraction reprocessing
 * would need the job row to retain `transcriptId`/`requestedProvider`,
 * not currently stored — a documented follow-up, not a milestone gate.
 *
 * pg-boss dead-letters a job as a *new* row in the dead-letter queue
 * (docs/adr/0015) rather than leaving the original retryable in place,
 * so reprocessing here means sending a fresh job with the
 * reconstructed original payload, not resurrecting the old one. */
@Injectable()
export class ReprocessJobUseCase {
  constructor(
    private readonly jobs: ConsultationAiJobRepository,
    private readonly recordings: ConsultationRecordingRepository,
    @Inject(PG_BOSS) private readonly boss: PgBoss,
  ) {}

  async execute(jobId: string): Promise<void> {
    const job = await this.jobs.findById(jobId);
    if (!job) {
      throw new NotFoundException(`No job with id "${jobId}".`);
    }
    if (job.status !== 'dead_letter') {
      throw new BadRequestException(
        `Only dead-lettered jobs can be reprocessed (current status: "${job.status}").`,
      );
    }
    if (job.jobType !== 'transcription') {
      throw new BadRequestException(
        `Reprocessing is only supported for "transcription" jobs today (this job is "${job.jobType}").`,
      );
    }

    const recording = await this.recordings.findById(job.recordingId);
    if (!recording || !recording.storageKey) {
      throw new NotFoundException(
        `No recording (with a storage key) found for job "${jobId}".`,
      );
    }

    const queueJobId = await this.boss.send(
      CLINICAL_AI_QUEUE_NAMES.transcription,
      {
        jobId: job.id,
        recordingId: recording.id,
        storageKey: recording.storageKey,
      } satisfies TranscriptionJobPayload,
    );

    await this.jobs.update(job.id, {
      status: 'queued',
      errorMessage: null,
      queueJobId,
    });
  }
}
