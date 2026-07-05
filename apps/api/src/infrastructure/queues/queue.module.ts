import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import {
  BULLMQ_PREFIX,
  CLINICAL_AI_QUEUE_NAMES,
  DEFAULT_QUEUE_JOB_OPTIONS,
} from '@kal-scribe/types';
import type { ApiEnv } from '@kal-scribe/config';
import { API_ENV, EnvModule } from '../env/env.module';
import { createRedisConnection } from './redis-connection';

/**
 * Registers the queues this repo adds (architecture.md §13): producers
 * (apps/api, via @InjectQueue) live here; actual job processing lives
 * in workers/clinical-ai-worker, a separately deployed process, so a
 * stuck transcription job never competes with API request latency.
 */
@Global()
@Module({
  imports: [
    EnvModule,
    BullModule.forRootAsync({
      imports: [EnvModule],
      inject: [API_ENV],
      useFactory: (env: ApiEnv) => ({
        connection: createRedisConnection(env.REDIS_URL),
        prefix: BULLMQ_PREFIX,
      }),
    }),
    BullModule.registerQueue(
      {
        name: CLINICAL_AI_QUEUE_NAMES.transcription,
        defaultJobOptions: DEFAULT_QUEUE_JOB_OPTIONS,
      },
      {
        name: CLINICAL_AI_QUEUE_NAMES.extraction,
        defaultJobOptions: DEFAULT_QUEUE_JOB_OPTIONS,
      },
      // No defaultJobOptions — this is a plain inspection queue, not
      // something a Worker processes with retries.
      { name: CLINICAL_AI_QUEUE_NAMES.deadLetter },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}
