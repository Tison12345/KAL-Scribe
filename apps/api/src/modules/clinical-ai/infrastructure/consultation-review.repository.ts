import { Inject, Injectable } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { DATABASE } from '../../../infrastructure/database/database.module';
import type { DrizzleDb } from '../../../infrastructure/database/client';
import {
  consultationReviews,
  type ConsultationReviewRow,
  type NewConsultationReviewRow,
} from '../../../infrastructure/database/schema';

/** The only place a Drizzle query for `consultation_reviews` may
 * appear — architecture.md §20 principle 6. Mutable doctor workflow
 * state, split out of the old `consultation_ai_results`
 * (docs/adr/0014) — pairs 1:1 with a `consultation_ai_runs` row,
 * created via `ConsultationAiRunRepository.createWithReview`. */
@Injectable()
export class ConsultationReviewRepository {
  constructor(@Inject(DATABASE) private readonly db: DrizzleDb) {}

  /** A recording can have more than one review (one per run) — order
   * by recency so this reliably returns the latest attempt, not an
   * arbitrary one (same reasoning the old single-table repository
   * already had for this exact query). */
  async findByRecordingId(
    recordingId: string,
  ): Promise<ConsultationReviewRow | undefined> {
    const [row] = await this.db
      .select()
      .from(consultationReviews)
      .where(eq(consultationReviews.recordingId, recordingId))
      .orderBy(desc(consultationReviews.createdAt));
    return row;
  }

  async findByRunId(runId: string): Promise<ConsultationReviewRow | undefined> {
    const [row] = await this.db
      .select()
      .from(consultationReviews)
      .where(eq(consultationReviews.runId, runId));
    return row;
  }

  async update(
    id: string,
    data: Partial<NewConsultationReviewRow>,
  ): Promise<ConsultationReviewRow> {
    const [row] = await this.db
      .update(consultationReviews)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(consultationReviews.id, id))
      .returning();
    return row;
  }
}
