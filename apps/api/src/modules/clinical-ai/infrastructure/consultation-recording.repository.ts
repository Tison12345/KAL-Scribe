import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DATABASE } from '../../../infrastructure/database/database.module';
import type { DrizzleDb } from '../../../infrastructure/database/client';
import {
  consultationRecordings,
  type ConsultationRecordingRow,
  type NewConsultationRecordingRow,
} from '../../../infrastructure/database/schema';

/** The only place a Drizzle query for this table may appear —
 * architecture.md §20 principle 6. */
@Injectable()
export class ConsultationRecordingRepository {
  constructor(@Inject(DATABASE) private readonly db: DrizzleDb) {}

  async create(
    data: NewConsultationRecordingRow,
  ): Promise<ConsultationRecordingRow> {
    const [row] = await this.db
      .insert(consultationRecordings)
      .values(data)
      .returning();
    return row;
  }

  async findById(id: string): Promise<ConsultationRecordingRow | undefined> {
    const [row] = await this.db
      .select()
      .from(consultationRecordings)
      .where(eq(consultationRecordings.id, id));
    return row;
  }

  async update(
    id: string,
    data: Partial<NewConsultationRecordingRow>,
  ): Promise<ConsultationRecordingRow> {
    const [row] = await this.db
      .update(consultationRecordings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(consultationRecordings.id, id))
      .returning();
    return row;
  }
}
