import { Inject, Injectable } from '@nestjs/common';
import { PgBoss } from 'pg-boss';
import { CLINICAL_AI_QUEUE_NAMES } from '@kal-scribe/types';
import type { ExtractionJobPayload } from '@kal-scribe/types';
import { PG_BOSS } from '../../../infrastructure/queues/queue.module';
import { ConsultationAiJobRepository } from '../infrastructure/consultation-ai-job.repository';

/**
 * Enqueues the extraction job once a transcript is persisted
 * (architecture.md §7 step 7→8's hand-off). Called by
 * workers/clinical-ai-worker over HTTP after it finishes the
 * transcription job, not by apps/api internally — apps/api is the
 * only queue *producer* in this repo (docs/adr/0010), so the worker
 * asks apps/api to do the enqueueing rather than becoming a producer
 * itself.
 */
@Injectable()
export class EnqueueExtractionJobUseCase {
  constructor(
    private readonly jobs: ConsultationAiJobRepository,
    @Inject(PG_BOSS) private readonly boss: PgBoss,
  ) {}

  async execute(
    recordingId: string,
    transcriptId: string,
    requestedProvider?: string,
  ): Promise<void> {
    const jobRow = await this.jobs.create({
      recordingId,
      jobType: 'extraction',
      status: 'queued',
    });

    const queueJobId = await this.boss.send(
      CLINICAL_AI_QUEUE_NAMES.extraction,
      {
        jobId: jobRow.id,
        recordingId,
        transcriptId,
        requestedProvider,
      } satisfies ExtractionJobPayload,
    );
    await this.jobs.update(jobRow.id, { queueJobId });
  }
}
