import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DATABASE } from '../../../infrastructure/database/database.module';
import type { DrizzleDb } from '../../../infrastructure/database/client';
import {
  consultationAiSessions,
  type ConsultationAiSessionRow,
  type NewConsultationAiSessionRow,
} from '../../../infrastructure/database/schema';

/** The only place a Drizzle query for this table may appear —
 * architecture.md §20 principle 6. */
@Injectable()
export class ConsultationAiSessionRepository {
  constructor(@Inject(DATABASE) private readonly db: DrizzleDb) {}

  async create(
    data: NewConsultationAiSessionRow,
  ): Promise<ConsultationAiSessionRow> {
    const [row] = await this.db
      .insert(consultationAiSessions)
      .values(data)
      .returning();
    return row;
  }

  async findById(id: string): Promise<ConsultationAiSessionRow | undefined> {
    const [row] = await this.db
      .select()
      .from(consultationAiSessions)
      .where(eq(consultationAiSessions.id, id));
    return row;
  }

  /** Pause/resume support — a new recording under the same
   * consultation-session-ref reuses the existing active session
   * rather than starting a new one. */
  async findActiveByConsultationSessionRef(
    consultationSessionRef: string,
  ): Promise<ConsultationAiSessionRow | undefined> {
    const [row] = await this.db
      .select()
      .from(consultationAiSessions)
      .where(
        and(
          eq(
            consultationAiSessions.consultationSessionRef,
            consultationSessionRef,
          ),
          eq(consultationAiSessions.status, 'active'),
        ),
      );
    return row;
  }

  async update(
    id: string,
    data: Partial<NewConsultationAiSessionRow>,
  ): Promise<ConsultationAiSessionRow> {
    const [row] = await this.db
      .update(consultationAiSessions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(consultationAiSessions.id, id))
      .returning();
    return row;
  }
}
