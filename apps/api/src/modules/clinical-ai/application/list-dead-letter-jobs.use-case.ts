import { Injectable } from '@nestjs/common';
import type { ConsultationAiJob } from '@kal-scribe/types';
import { ConsultationAiJobRepository } from '../infrastructure/consultation-ai-job.repository';

@Injectable()
export class ListDeadLetterJobsUseCase {
  constructor(private readonly jobs: ConsultationAiJobRepository) {}

  async execute(): Promise<ConsultationAiJob[]> {
    const rows = await this.jobs.listDeadLetter();
    return rows.map((row) => ({
      id: row.id,
      recordingId: row.recordingId,
      jobType: row.jobType,
      bullmqJobId: row.bullmqJobId,
      status: row.status,
      attemptCount: row.attemptCount,
      errorMessage: row.errorMessage,
      startedAt: row.startedAt?.toISOString() ?? null,
      completedAt: row.completedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    }));
  }
}
