import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DATABASE } from '../../../infrastructure/database/database.module';
import type { DrizzleDb } from '../../../infrastructure/database/client';
import {
  consultationTranscripts,
  type ConsultationTranscriptRow,
  type NewConsultationTranscriptRow,
} from '../../../infrastructure/database/schema';

/** The only place a Drizzle query for this table may appear —
 * architecture.md §20 principle 6. */
@Injectable()
export class ConsultationTranscriptRepository {
  constructor(@Inject(DATABASE) private readonly db: DrizzleDb) {}

  async create(
    data: NewConsultationTranscriptRow,
  ): Promise<ConsultationTranscriptRow> {
    const [row] = await this.db
      .insert(consultationTranscripts)
      .values(data)
      .returning();
    return row;
  }

  async findByRecordingId(
    recordingId: string,
  ): Promise<ConsultationTranscriptRow | undefined> {
    const [row] = await this.db
      .select()
      .from(consultationTranscripts)
      .where(eq(consultationTranscripts.recordingId, recordingId));
    return row;
  }

  async updateSegments(
    id: string,
    segments: unknown,
  ): Promise<ConsultationTranscriptRow> {
    const [row] = await this.db
      .update(consultationTranscripts)
      .set({ segments })
      .where(eq(consultationTranscripts.id, id))
      .returning();
    return row;
  }
}
