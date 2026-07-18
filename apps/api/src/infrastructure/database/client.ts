import type { ApiEnv } from '@kal-scribe/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as schema from './schema';

export type DrizzleDb = NodePgDatabase<typeof schema>;

/**
 * Real Postgres only (Supabase's or any other host) — no embedded
 * local-dev stand-in (docs/adr/0014 supersedes docs/adr/0008's PGlite
 * stand-in). `DATABASE_URL` is required.
 */
export function createDatabase(env: Pick<ApiEnv, 'DATABASE_URL'>): DrizzleDb {
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  return drizzle(pool, { schema });
}

export async function runMigrations(
  db: DrizzleDb,
  migrationsFolder: string,
): Promise<DrizzleDb> {
  await migrate(db, { migrationsFolder });
  return db;
}
