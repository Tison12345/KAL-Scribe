import { Injectable, NotFoundException } from '@nestjs/common';
import type { UpdateJobStatusRequest } from '@kal-scribe/types';
import { ConsultationAiJobRepository } from '../infrastructure/consultation-ai-job.repository';

/** The worker reports each job-lifecycle transition here over HTTP
 * (docs/adr/0015) — replaces `ClinicalAiQueueEventsService`'s old
 * BullMQ `QueueEvents` (Redis pub/sub) listener. pg-boss has no
 * cross-process event stream equivalent, but the worker already knows
 * exactly when each transition happens since it's the one running the
 * job, so it just tells apps/api directly — the same "worker calls
 * apps/api over HTTP" pattern this repo already uses everywhere else
 * (docs/adr/0010). */
@Injectable()
export class UpdateJobStatusUseCase {
  constructor(private readonly jobs: ConsultationAiJobRepository) {}

  async execute(jobId: string, request: UpdateJobStatusRequest): Promise<void> {
    const job = await this.jobs.findById(jobId);
    if (!job) {
      throw new NotFoundException(`No job with id "${jobId}".`);
    }

    const now = new Date();
    await this.jobs.update(jobId, {
      status: request.status,
      errorMessage: request.errorMessage ?? null,
      startedAt: request.status === 'active' ? now : job.startedAt,
      completedAt: request.status === 'completed' ? now : job.completedAt,
      attemptCount:
        request.status === 'failed' || request.status === 'dead_letter'
          ? job.attemptCount + 1
          : job.attemptCount,
    });
  }
}
