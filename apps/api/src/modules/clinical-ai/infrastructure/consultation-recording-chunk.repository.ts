import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import { DATABASE } from '../../../infrastructure/database/database.module';
import type { DrizzleDb } from '../../../infrastructure/database/client';
import {
  consultationRecordingChunks,
  type ConsultationRecordingChunkRow,
} from '../../../infrastructure/database/schema';

/** The only place a Drizzle query for this table may appear —
 * architecture.md §20 principle 6. */
@Injectable()
export class ConsultationRecordingChunkRepository {
  constructor(@Inject(DATABASE) private readonly db: DrizzleDb) {}

  /** Idempotent — a doctor's browser retrying a confirm call (e.g. a
   * flaky connection) should never fail on the unique
   * (recording_id, sequence) index. */
  async confirm(
    recordingId: string,
    sequence: number,
  ): Promise<ConsultationRecordingChunkRow> {
    const [row] = await this.db
      .insert(consultationRecordingChunks)
      .values({ recordingId, sequence })
      .onConflictDoNothing({
        target: [
          consultationRecordingChunks.recordingId,
          consultationRecordingChunks.sequence,
        ],
      })
      .returning();
    if (row) return row;
    // Conflict path — the row already existed, fetch and return it.
    const [existing] = await this.db
      .select()
      .from(consultationRecordingChunks)
      .where(
        and(
          eq(consultationRecordingChunks.recordingId, recordingId),
          eq(consultationRecordingChunks.sequence, sequence),
        ),
      );
    return existing;
  }

  async findByRecordingId(
    recordingId: string,
  ): Promise<ConsultationRecordingChunkRow[]> {
    return this.db
      .select()
      .from(consultationRecordingChunks)
      .where(eq(consultationRecordingChunks.recordingId, recordingId))
      .orderBy(asc(consultationRecordingChunks.sequence));
  }
}
