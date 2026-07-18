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
  // Explicit max, not `pg`'s default of 10 — Supabase's Session pooler
  // caps total concurrent clients at 15 (docs/adr/0015), shared across
  // this pool, apps/api's own PgBoss pool, and the worker's PgBoss
  // pool. Left generous relative to the other two since this is the
  // one pool serving all HTTP request traffic.
  const pool = new Pool({ connectionString: env.DATABASE_URL, max: 5 });
  return drizzle(pool, { schema });
}

export async function runMigrations(
  db: DrizzleDb,
  migrationsFolder: string,
): Promise<DrizzleDb> {
  await migrate(db, { migrationsFolder });
  return db;
}
