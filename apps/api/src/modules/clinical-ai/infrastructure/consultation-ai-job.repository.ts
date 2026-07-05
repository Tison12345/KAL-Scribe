import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DATABASE } from '../../../infrastructure/database/database.module';
import type { DrizzleDb } from '../../../infrastructure/database/client';
import {
  consultationAiJobs,
  type ConsultationAiJobRow,
  type NewConsultationAiJobRow,
} from '../../../infrastructure/database/schema';

/** The only place a Drizzle query for this table may appear —
 * architecture.md §20 principle 6. */
@Injectable()
export class ConsultationAiJobRepository {
  constructor(@Inject(DATABASE) private readonly db: DrizzleDb) {}

  async create(data: NewConsultationAiJobRow): Promise<ConsultationAiJobRow> {
    const [row] = await this.db
      .insert(consultationAiJobs)
      .values(data)
      .returning();
    return row;
  }

  async findById(id: string): Promise<ConsultationAiJobRow | undefined> {
    const [row] = await this.db
      .select()
      .from(consultationAiJobs)
      .where(eq(consultationAiJobs.id, id));
    return row;
  }

  async update(
    id: string,
    data: Partial<NewConsultationAiJobRow>,
  ): Promise<ConsultationAiJobRow> {
    const [row] = await this.db
      .update(consultationAiJobs)
      .set(data)
      .where(eq(consultationAiJobs.id, id))
      .returning();
    return row;
  }

  async listDeadLetter(): Promise<ConsultationAiJobRow[]> {
    return this.db
      .select()
      .from(consultationAiJobs)
      .where(eq(consultationAiJobs.status, 'dead_letter'));
  }
}
