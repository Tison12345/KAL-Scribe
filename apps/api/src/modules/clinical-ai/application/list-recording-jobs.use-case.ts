import { Injectable } from '@nestjs/common';
import type { ConsultationAiJob } from '@kal-scribe/types';
import { ConsultationAiJobRepository } from '../infrastructure/consultation-ai-job.repository';

/** Backs the frontend's pipeline-progress tracker: current stage
 * (queued/active/completed per job type) and per-stage timing
 * (started_at -> completed_at). Not the same concern as the admin
 * dead-letter list — this is a doctor-facing "how far along is my
 * consultation" view, not an ops/reprocess view. */
@Injectable()
export class ListRecordingJobsUseCase {
  constructor(private readonly repository: ConsultationAiJobRepository) {}

  async execute(recordingId: string): Promise<ConsultationAiJob[]> {
    const rows = await this.repository.findByRecordingId(recordingId);
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
