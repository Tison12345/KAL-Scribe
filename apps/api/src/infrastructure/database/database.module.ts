import path from 'node:path';
import { Global, Module } from '@nestjs/common';
import type { ApiEnv } from '@kal-scribe/config';
import { API_ENV, EnvModule } from '../env/env.module';
import { createDatabase, runMigrations, type DrizzleDb } from './client';

export const DATABASE = Symbol('DATABASE');

@Global()
@Module({
  imports: [EnvModule],
  providers: [
    {
      provide: DATABASE,
      inject: [API_ENV],
      useFactory: async (env: ApiEnv): Promise<DrizzleDb> => {
        const database = createDatabase(env);
        // Resolved against process.cwd() (apps/api/), not __dirname —
        // these are static .sql/.json files, not compiled code, so
        // reading them straight from src/ works identically in dev and
        // prod and sidesteps a real race hit under `nest start
        // --watch`: deleteOutDir wipes dist/ on every restart, and the
        // asset-copy step isn't guaranteed to finish before this
        // factory runs, so migrations could go missing right at boot.
        const migrationsFolder = path.join(
          process.cwd(),
          'src/infrastructure/database/migrations',
        );
        return runMigrations(database, migrationsFolder);
      },
    },
  ],
  exports: [DATABASE],
})
export class DatabaseModule {}
