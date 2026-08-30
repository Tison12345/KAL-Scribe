import { Global, Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import { PgBoss } from 'pg-boss';
import {
  CLINICAL_AI_QUEUE_NAMES,
  DEFAULT_QUEUE_JOB_OPTIONS,
} from '@kal-scribe/types';
import type { ApiEnv } from '@kal-scribe/config';
import { API_ENV, EnvModule } from '../env/env.module';
import { logger } from '../logger';

export const PG_BOSS = Symbol('PG_BOSS');

/**
 * Registers the single pg-boss instance this repo's queue producer side
 * uses (architecture.md §13, docs/adr/0015 — replaces BullMQ/Redis).
 * apps/api only ever `send()`s jobs; actual job processing lives in
 * workers/clinical-ai-worker, a separately deployed process, so a stuck
 * transcription job never competes with API request latency. pg-boss
 * runs on the same Postgres `DATABASE_URL` already in use — no
 * additional hosted service, no separate quota to exhaust.
 *
 * Each source queue gets its own dead-letter queue via pg-boss's native
 * `deadLetter` option (`createQueue` is `ON CONFLICT DO NOTHING`
 * internally, so calling it on every boot is safe) — a small `.work()`
 * consumer on each `*DeadLetter` queue in the worker marks
 * `consultation_ai_jobs.status = 'dead_letter'` when pg-boss routes a
 * job there after exhausting retries.
 */
@Global()
@Module({
  imports: [EnvModule],
  providers: [
    {
      provide: PG_BOSS,
      inject: [API_ENV],
      useFactory: async (env: ApiEnv): Promise<PgBoss> => {
        const boss = new PgBoss({
          connectionString: env.DATABASE_URL,
          // apps/api is producer-only (never calls .work()) — no need
          // for this instance to also run pg-boss's maintenance loops;
          // the worker's own instance already does.
          supervise: false,
          schedule: false,
          // A producer never fetches jobs, so it gets no benefit from
          // pg-boss's LISTEN/NOTIFY wake-up path — skip it to save the
          // dedicated connection it would otherwise hold open.
          useListenNotify: false,
          // Explicit max, not pg-boss's own pg.Pool default of 10 —
          // Supabase's Session pooler caps total concurrent clients at
          // 15 across every pool this repo opens (docs/adr/0015).
          max: 3,
        });
        boss.on('error', (error) => {
          logger.error({ err: error }, 'pg-boss internal error');
        });
        await boss.start();

        await boss.createQueue(CLINICAL_AI_QUEUE_NAMES.transcriptionDeadLetter);
        await boss.createQueue(CLINICAL_AI_QUEUE_NAMES.transcription, {
          ...DEFAULT_QUEUE_JOB_OPTIONS,
          deadLetter: CLINICAL_AI_QUEUE_NAMES.transcriptionDeadLetter,
        });
        await boss.createQueue(CLINICAL_AI_QUEUE_NAMES.extractionDeadLetter);
        await boss.createQueue(CLINICAL_AI_QUEUE_NAMES.extraction, {
          ...DEFAULT_QUEUE_JOB_OPTIONS,
          deadLetter: CLINICAL_AI_QUEUE_NAMES.extractionDeadLetter,
        });

        return boss;
      },
    },
  ],
  exports: [PG_BOSS],
})
export class QueueModule implements OnModuleDestroy {
  constructor(@Inject(PG_BOSS) private readonly boss: PgBoss) {}

  async onModuleDestroy(): Promise<void> {
    await this.boss.stop();
  }
}
