// Must be the very first import: EnvModule calls parseApiEnv() at
// class-definition time (when app.module.ts's import chain first
// evaluates it), which happens as soon as `AppModule` is imported
// below — so process.env needs to already be populated from .env
// before that import statement runs, not just before bootstrap()
// executes.
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import type { ApiEnv } from '@kal-scribe/config';
import { AppModule } from './app.module';
import { API_ENV } from './infrastructure/env/env.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // TODO before production: restrict to the real apps/web origin(s) —
  // permissive for local dev only, since apps/web and apps/api run on
  // different localhost ports.
  app.enableCors();

  const env = app.get<ApiEnv>(API_ENV);
  await app.listen(env.PORT);
}
void bootstrap();
