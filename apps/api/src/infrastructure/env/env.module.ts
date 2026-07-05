import { Global, Module } from '@nestjs/common';
import { parseApiEnv } from '@kal-scribe/config';

export const API_ENV = Symbol('API_ENV');

/** Parses and validates process.env exactly once at boot; every other
 * module injects API_ENV rather than reading process.env directly. */
@Global()
@Module({
  providers: [{ provide: API_ENV, useValue: parseApiEnv() }],
  exports: [API_ENV],
})
export class EnvModule {}
