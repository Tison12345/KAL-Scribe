// Must be the very first import: EnvModule calls parseApiEnv() at
// class-definition time (when app.module.ts's import chain first
// evaluates it), which happens as soon as `AppModule` is imported
// below — so process.env needs to already be populated from .env
// before that import statement runs, not just before bootstrap()
// executes.
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import type { ApiEnv } from '@kal-scribe/config';
import { AppModule } from './app.module';
import { API_ENV } from './infrastructure/env/env.module';

async function bootstrap() {
  // bufferLogs: true holds NestJS's own bootstrap-time log lines until
  // useLogger below swaps in the real (pino) logger, instead of losing
  // them to the default console logger first.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));

  // Express's default JSON body limit (100kb) is fine for most of this
  // API's routes, but a long consultation's transcript — segments plus
  // the full raw provider response — can comfortably exceed it (a real
  // ~15-minute recording did, 413'ing before the transcript was ever
  // saved). 10mb covers even a long recording's transcript payload with
  // real headroom, while still bounding request size sanely.
  app.useBodyParser('json', { limit: '10mb' });

  const env = app.get<ApiEnv>(API_ENV);

  // Audit finding: this used to be app.enableCors() with no options at
  // all — any origin could call this API from a browser. WEB_APP_ORIGIN
  // must be set for any real deployment; unset falls back to permissive
  // localhost-only (any port, since apps/web's dev port isn't fixed).
  app.enableCors({
    origin: env.WEB_APP_ORIGIN
      ? env.WEB_APP_ORIGIN.split(',').map((origin) => origin.trim())
      : /^http:\/\/localhost:\d+$/,
  });

  await app.listen(env.PORT);

  // Testing-mode toggle (docs/adr/0018) — runs the worker's own
  // job-processing loop inside this same process instead of it being a
  // separate deployable, so a single-doctor test doesn't need anyone
  // to run `workers/clinical-ai-worker` by hand. The worker only ever
  // talks to apps/api over HTTP (docs/adr/0010), never the database
  // directly — importing it here doesn't change that, it just means
  // those HTTP calls now happen to land on this same process instead
  // of a different one. `API_BASE_URL` is set to this process's own
  // resolved port right before the import, rather than requiring a
  // second env var to be kept in sync with `PORT` by hand.
  if (env.EMBEDDED_WORKER) {
    process.env.API_BASE_URL = `http://localhost:${env.PORT}`;
    await import('@kal-scribe/clinical-ai-worker');
  }
}
void bootstrap();
