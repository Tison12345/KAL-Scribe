import { Inject, Injectable } from '@nestjs/common';
import { desc, eq, max } from 'drizzle-orm';
import { DATABASE } from '../../../infrastructure/database/database.module';
import type { DrizzleDb } from '../../../infrastructure/database/client';
import {
  consultationAiRuns,
  consultationReviews,
  type ConsultationAiRunRow,
  type ConsultationReviewRow,
  type NewConsultationAiRunRow,
  type NewConsultationReviewRow,
} from '../../../infrastructure/database/schema';

/** The only place a Drizzle query for `consultation_ai_runs` may
 * appear — architecture.md §20 principle 6. Insert-only: a run is
 * never updated after creation (immutable AI output, docs/adr/0014) —
 * only `consultation_reviews` (ConsultationReviewRepository) mutates. */
@Injectable()
export class ConsultationAiRunRepository {
  constructor(@Inject(DATABASE) private readonly db: DrizzleDb) {}

  /** Creates a run and its paired review row (`status: 'draft'`) in
   * one transaction — a run always has exactly one review the instant
   * it's created (docs/adr/0014), so this is one atomic operation, not
   * two call sites that could partially fail. `runNumber` (1, 2, 3...)
   * is computed inside the same transaction to avoid a race between
   * concurrent extraction attempts for the same recording. */
  async createWithReview(
    data: Omit<NewConsultationAiRunRow, 'runNumber'>,
  ): Promise<{ run: ConsultationAiRunRow; review: ConsultationReviewRow }> {
    return this.db.transaction(async (tx) => {
      const [maxRow] = await tx
        .select({ value: max(consultationAiRuns.runNumber) })
        .from(consultationAiRuns)
        .where(eq(consultationAiRuns.recordingId, data.recordingId));
      const runNumber = (maxRow?.value ?? 0) + 1;

      const [run] = await tx
        .insert(consultationAiRuns)
        .values({ ...data, runNumber })
        .returning();

      const reviewData: NewConsultationReviewRow = {
        recordingId: data.recordingId,
        runId: run.id,
        status: 'draft',
      };
      const [review] = await tx
        .insert(consultationReviews)
        .values(reviewData)
        .returning();

      return { run, review };
    });
  }

  async findById(id: string): Promise<ConsultationAiRunRow | undefined> {
    const [row] = await this.db
      .select()
      .from(consultationAiRuns)
      .where(eq(consultationAiRuns.id, id));
    return row;
  }

  async findAllByRecordingId(
    recordingId: string,
  ): Promise<ConsultationAiRunRow[]> {
    return this.db
      .select()
      .from(consultationAiRuns)
      .where(eq(consultationAiRuns.recordingId, recordingId))
      .orderBy(desc(consultationAiRuns.runNumber));
  }
}
