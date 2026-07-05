import { Controller, Get, Param, Post } from '@nestjs/common';
import type { ConsultationAiJob } from '@kal-scribe/types';
import { ListDeadLetterJobsUseCase } from '../application/list-dead-letter-jobs.use-case';
import { ReprocessJobUseCase } from '../application/reprocess-job.use-case';

/**
 * Admin: view/reprocess dead-lettered jobs (architecture.md §13) — a
 * dead-lettered job must be an actionable, visible list, never a
 * silent failure the doctor discovers only when their draft never
 * shows up.
 *
 * No access control yet — this repo has no identity/role system until
 * the real CMS integration (§17 Phase 3/4). Restricting this to
 * admins only is a hard requirement before any real deployment.
 */
@Controller('clinical-ai/admin/jobs')
export class AdminClinicalAiController {
  constructor(
    private readonly listDeadLetterJobs: ListDeadLetterJobsUseCase,
    private readonly reprocessJob: ReprocessJobUseCase,
  ) {}

  @Get('dead-letter')
  async listDeadLetter(): Promise<ConsultationAiJob[]> {
    return this.listDeadLetterJobs.execute();
  }

  @Post(':id/reprocess')
  async reprocess(@Param('id') id: string): Promise<{ ok: true }> {
    await this.reprocessJob.execute(id);
    return { ok: true };
  }
}
