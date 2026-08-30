import { Inject, Injectable } from '@nestjs/common';
import { and, count, eq, ne } from 'drizzle-orm';
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

  /** Pause/resume ordering — how many recordings already exist in this
   * session, so the next one gets the right `sequenceInSession`. */
  async countBySessionId(sessionId: string): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(consultationRecordings)
      .where(eq(consultationRecordings.sessionId, sessionId));
    return row?.value ?? 0;
  }

  /** Audit finding E4 — candidates for audio-content dedup: every other
   * recording sharing this exact audio hash, oldest first (so a match
   * always points back to the *original*, never a later duplicate of a
   * duplicate). Excludes `excludeRecordingId` (the recording asking the
   * question) so it never matches itself. */
  async findByAudioHash(
    audioHash: string,
    excludeRecordingId: string,
  ): Promise<ConsultationRecordingRow[]> {
    return this.db
      .select()
      .from(consultationRecordings)
      .where(
        and(
          eq(consultationRecordings.audioHash, audioHash),
          ne(consultationRecordings.id, excludeRecordingId),
        ),
      )
      .orderBy(consultationRecordings.createdAt);
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
