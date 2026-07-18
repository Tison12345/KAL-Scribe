import { Injectable } from '@nestjs/common';
import type { ConsultationAiRun } from '@kal-scribe/types';
import { ConsultationAiRunRepository } from '../infrastructure/consultation-ai-run.repository';
import { toConsultationAiRun } from './consultation-ai-run.mapper';

/** Every extraction attempt for one recording, most recent first —
 * the benchmarking/comparison view docs/adr/0014's run-versioning was
 * built for ("Run 1 → Gemini, Run 2 → Claude, Run 3 → Groq"). */
@Injectable()
export class ListConsultationRunsUseCase {
  constructor(private readonly runs: ConsultationAiRunRepository) {}

  async execute(recordingId: string): Promise<ConsultationAiRun[]> {
    const rows = await this.runs.findAllByRecordingId(recordingId);
    return rows.map(toConsultationAiRun);
  }
}
