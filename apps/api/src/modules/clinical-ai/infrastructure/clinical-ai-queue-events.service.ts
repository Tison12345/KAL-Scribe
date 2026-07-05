import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { QueueEvents, type Queue } from 'bullmq';
import {
  BULLMQ_PREFIX,
  CLINICAL_AI_QUEUE_NAMES,
  type ExtractionJobPayload,
  type TranscriptionJobPayload,
} from '@kal-scribe/types';
import type { ApiEnv } from '@kal-scribe/config';
import { API_ENV } from '../../../infrastructure/env/env.module';
import { createRedisConnection } from '../../../infrastructure/queues/redis-connection';
import { ConsultationAiJobRepository } from './consultation-ai-job.repository';

/**
 * Keeps `consultation_ai_jobs.status` in sync with BullMQ's own job
 * lifecycle (architecture.md §13) by listening to both the
 * transcription and extraction queues' events — this is the "single
 * source of truth stays in Postgres, BullMQ is just the mechanism"
 * half of §13's design.
 *
 * `bullmq_job_id` is always set equal to the `consultation_ai_jobs`
 * row's own id (see CompleteUploadUseCase / EnqueueExtractionJobUseCase)
 * specifically so this service can look a job up with one `findById`,
 * no separate index.
 */
@Injectable()
export class ClinicalAiQueueEventsService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(ClinicalAiQueueEventsService.name);
  private watchedEvents: QueueEvents[] = [];

  constructor(
    @Inject(API_ENV) private readonly env: ApiEnv,
    private readonly jobs: ConsultationAiJobRepository,
    @InjectQueue(CLINICAL_AI_QUEUE_NAMES.transcription)
    private readonly transcriptionQueue: Queue<TranscriptionJobPayload>,
    @InjectQueue(CLINICAL_AI_QUEUE_NAMES.extraction)
    private readonly extractionQueue: Queue<ExtractionJobPayload>,
    @InjectQueue(CLINICAL_AI_QUEUE_NAMES.deadLetter)
    private readonly deadLetterQueue: Queue,
  ) {}

  onModuleInit(): void {
    for (const queueName of [
      CLINICAL_AI_QUEUE_NAMES.transcription,
      CLINICAL_AI_QUEUE_NAMES.extraction,
    ]) {
      const events = new QueueEvents(queueName, {
        connection: createRedisConnection(this.env.REDIS_URL),
        // Must match QueueModule's BullModule.forRootAsync prefix —
        // otherwise this listens on a different Redis keyspace than
        // the one jobs actually get written to.
        prefix: BULLMQ_PREFIX,
      });

      events.on('active', ({ jobId }) => {
        void this.markActive(jobId);
      });
      events.on('completed', ({ jobId }) => {
        void this.markCompleted(jobId);
      });
      events.on('failed', ({ jobId, failedReason }) => {
        void this.handleFailed(queueName, jobId, failedReason);
      });

      this.watchedEvents.push(events);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(this.watchedEvents.map((events) => events.close()));
  }

  private async markActive(jobId: string): Promise<void> {
    const job = await this.jobs.findById(jobId);
    if (!job) return;
    await this.jobs.update(job.id, { status: 'active', startedAt: new Date() });
  }

  private async markCompleted(jobId: string): Promise<void> {
    const job = await this.jobs.findById(jobId);
    if (!job) return;
    await this.jobs.update(job.id, {
      status: 'completed',
      completedAt: new Date(),
    });
  }

  private async handleFailed(
    queueName: string,
    jobId: string,
    failedReason: string,
  ): Promise<void> {
    const job = await this.jobs.findById(jobId);
    if (!job) return;

    // QueueEvents' 'failed' fires on every failed attempt, not just the
    // final one — only dead-letter once the job's own record confirms
    // no attempts remain.
    const sourceQueue =
      queueName === CLINICAL_AI_QUEUE_NAMES.extraction
        ? this.extractionQueue
        : this.transcriptionQueue;
    const bullJob = await sourceQueue.getJob(jobId);
    const attemptsMade = bullJob?.attemptsMade ?? job.attemptCount + 1;
    const maxAttempts =
      typeof bullJob?.opts.attempts === 'number' ? bullJob.opts.attempts : 5;

    if (attemptsMade < maxAttempts) {
      await this.jobs.update(job.id, {
        attemptCount: attemptsMade,
        errorMessage: failedReason,
      });
      return;
    }

    await this.deadLetterQueue.add('dead-letter', {
      originalQueue: queueName,
      originalJobId: jobId,
      payload: bullJob?.data,
      failedReason,
    });
    await this.jobs.update(job.id, {
      status: 'dead_letter',
      attemptCount: attemptsMade,
      errorMessage: failedReason,
    });
    this.logger.warn(
      `Job ${jobId} on "${queueName}" exhausted retries and was dead-lettered: ${failedReason}`,
    );
  }
}
