import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { CLINICAL_AI_QUEUE_NAMES } from '@kal-scribe/types';
import { ConsultationAiJobRepository } from '../infrastructure/consultation-ai-job.repository';

/** Manual "reprocess" per architecture.md §13 — re-runs just this job's
 * stage, not the whole pipeline from audio again. With only the
 * transcription stage existing so far, that's the only queue this can
 * target; extraction reprocessing follows once Milestone 7 exists. */
@Injectable()
export class ReprocessJobUseCase {
  constructor(
    private readonly jobs: ConsultationAiJobRepository,
    @InjectQueue(CLINICAL_AI_QUEUE_NAMES.transcription)
    private readonly transcriptionQueue: Queue,
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

    const bullJob = await this.transcriptionQueue.getJob(
      job.bullmqJobId ?? job.id,
    );
    if (!bullJob) {
      throw new NotFoundException(
        'Original BullMQ job no longer exists — cannot reprocess.',
      );
    }

    await bullJob.retry('failed');
    await this.jobs.update(job.id, { status: 'queued', errorMessage: null });
  }
}
