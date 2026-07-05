import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DATABASE } from '../../../infrastructure/database/database.module';
import type { DrizzleDb } from '../../../infrastructure/database/client';
import {
  consultationAiResults,
  type ConsultationAiResultRow,
  type NewConsultationAiResultRow,
} from '../../../infrastructure/database/schema';

/** The only place a Drizzle query for this table may appear —
 * architecture.md §20 principle 6. */
@Injectable()
export class ConsultationAiResultRepository {
  constructor(@Inject(DATABASE) private readonly db: DrizzleDb) {}

  async create(
    data: NewConsultationAiResultRow,
  ): Promise<ConsultationAiResultRow> {
    const [row] = await this.db
      .insert(consultationAiResults)
      .values(data)
      .returning();
    return row;
  }

  async findByRecordingId(
    recordingId: string,
  ): Promise<ConsultationAiResultRow | undefined> {
    const [row] = await this.db
      .select()
      .from(consultationAiResults)
      .where(eq(consultationAiResults.recordingId, recordingId));
    return row;
  }

  async update(
    id: string,
    data: Partial<NewConsultationAiResultRow>,
  ): Promise<ConsultationAiResultRow> {
    const [row] = await this.db
      .update(consultationAiResults)
      .set(data)
      .where(eq(consultationAiResults.id, id))
      .returning();
    return row;
  }
}
