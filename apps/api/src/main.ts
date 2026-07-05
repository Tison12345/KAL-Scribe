import { NestFactory } from '@nestjs/core';
import express from 'express';
import type { ApiEnv } from '@kal-scribe/config';
import { AppModule } from './app.module';
import { API_ENV } from './infrastructure/env/env.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // TODO before production: restrict to the real apps/web origin(s) —
  // permissive for local dev only, since apps/web and apps/api run on
  // different localhost ports.
  app.enableCors();

  // Raw binary body for the local storage stand-in's upload endpoint —
  // Nest's default JSON/urlencoded parsers (registered during
  // NestFactory.create) skip non-matching content types, so this is
  // safe to layer on for just this one path.
  app.use(
    '/clinical-ai/storage/objects',
    express.raw({ type: '*/*', limit: '30mb' }),
  );

  const env = app.get<ApiEnv>(API_ENV);
  await app.listen(env.PORT);
}
void bootstrap();
