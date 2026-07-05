import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { CLINICAL_AI_QUEUE_NAMES } from '@kal-scribe/types';
import type { ExtractionJobPayload } from '@kal-scribe/types';
import { ConsultationAiJobRepository } from '../infrastructure/consultation-ai-job.repository';

/**
 * Enqueues the extraction job once a transcript is persisted
 * (architecture.md §7 step 7→8's hand-off). Called by
 * workers/clinical-ai-worker over HTTP after it finishes the
 * transcription job, not by apps/api internally — apps/api is the
 * only BullMQ *producer* in this repo (docs/adr/0010), so the worker
 * asks apps/api to do the enqueueing rather than becoming a producer
 * itself.
 */
@Injectable()
export class EnqueueExtractionJobUseCase {
  constructor(
    private readonly jobs: ConsultationAiJobRepository,
    @InjectQueue(CLINICAL_AI_QUEUE_NAMES.extraction)
    private readonly extractionQueue: Queue<ExtractionJobPayload>,
  ) {}

  async execute(recordingId: string, transcriptId: string): Promise<void> {
    const jobRow = await this.jobs.create({
      recordingId,
      jobType: 'extraction',
      status: 'queued',
    });

    // Own row id doubles as the BullMQ job id (see
    // ClinicalAiQueueEventsService / CompleteUploadUseCase for the
    // same pattern on the transcription queue).
    await this.jobs.update(jobRow.id, { bullmqJobId: jobRow.id });
    await this.extractionQueue.add(
      'extract-clinical-data',
      { recordingId, transcriptId } satisfies ExtractionJobPayload,
      { jobId: jobRow.id },
    );
  }
}
