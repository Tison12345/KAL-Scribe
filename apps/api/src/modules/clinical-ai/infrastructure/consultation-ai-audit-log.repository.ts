import { Inject, Injectable } from '@nestjs/common';
import { DATABASE } from '../../../infrastructure/database/database.module';
import type { DrizzleDb } from '../../../infrastructure/database/client';
import {
  consultationAiAuditLog,
  type NewConsultationAiAuditLogRow,
} from '../../../infrastructure/database/schema';

/** The only place a Drizzle query for this table may appear —
 * architecture.md §20 principle 6. Append-only (architecture.md §12) —
 * no update/delete methods exist here on purpose. */
@Injectable()
export class ConsultationAiAuditLogRepository {
  constructor(@Inject(DATABASE) private readonly db: DrizzleDb) {}

  async record(data: NewConsultationAiAuditLogRow): Promise<void> {
    await this.db.insert(consultationAiAuditLog).values(data);
  }
}
