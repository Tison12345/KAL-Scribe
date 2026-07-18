import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import type {
  ConsultationAiJob,
  UpdateJobStatusRequest,
} from '@kal-scribe/types';
import { updateJobStatusSchema } from '@kal-scribe/validation';
import { ZodValidationPipe } from '../../../shared/zod-validation.pipe';
import { ListDeadLetterJobsUseCase } from '../application/list-dead-letter-jobs.use-case';
import { ReprocessJobUseCase } from '../application/reprocess-job.use-case';
import { UpdateJobStatusUseCase } from '../application/update-job-status.use-case';

/**
 * Admin: view/reprocess dead-lettered jobs (architecture.md §13) — a
 * dead-lettered job must be an actionable, visible list, never a
 * silent failure the doctor discovers only when their draft never
 * shows up. `PATCH :id/status` is called by workers/clinical-ai-worker
 * to report job-lifecycle transitions (docs/adr/0015) — an internal
 * caller, not a doctor-facing action.
 *
 * No access control yet — this repo has no identity/role system until
 * the real CMS integration (§17 Phase 3/4). Restricting this to
 * admins/internal services only is a hard requirement before any real
 * deployment.
 */
@Controller('clinical-ai/admin/jobs')
export class AdminClinicalAiController {
  constructor(
    private readonly listDeadLetterJobs: ListDeadLetterJobsUseCase,
    private readonly reprocessJob: ReprocessJobUseCase,
    private readonly updateJobStatus: UpdateJobStatusUseCase,
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

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateJobStatusSchema))
    body: UpdateJobStatusRequest,
  ): Promise<void> {
    return this.updateJobStatus.execute(id, body);
  }
}
