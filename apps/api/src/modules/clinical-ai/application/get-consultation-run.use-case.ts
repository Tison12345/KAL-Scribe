import { Injectable, NotFoundException } from '@nestjs/common';
import type { ConsultationAiRun } from '@kal-scribe/types';
import { ConsultationAiRunRepository } from '../infrastructure/consultation-ai-run.repository';
import { toConsultationAiRun } from './consultation-ai-run.mapper';

@Injectable()
export class GetConsultationRunUseCase {
  constructor(private readonly runs: ConsultationAiRunRepository) {}

  async execute(
    recordingId: string,
    runId: string,
  ): Promise<ConsultationAiRun> {
    const run = await this.runs.findById(runId);
    if (!run || run.recordingId !== recordingId) {
      throw new NotFoundException(
        `No run "${runId}" for recording "${recordingId}".`,
      );
    }
    return toConsultationAiRun(run);
  }
}
