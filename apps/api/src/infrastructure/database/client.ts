import { mkdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import type { ApiEnv } from '@kal-scribe/config';
import { drizzle as drizzleNodePostgres } from 'drizzle-orm/node-postgres';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate as migrateNodePostgres } from 'drizzle-orm/node-postgres/migrator';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import type { PgliteDatabase } from 'drizzle-orm/pglite';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import { Pool } from 'pg';
import * as schema from './schema';

export type DrizzleDb =
  NodePgDatabase<typeof schema> | PgliteDatabase<typeof schema>;

type ApiDatabase =
  | { kind: 'node-postgres'; db: NodePgDatabase<typeof schema> }
  | { kind: 'pglite'; db: PgliteDatabase<typeof schema> };

/**
 * `DATABASE_URL` set → real Postgres (Supabase's or any other host).
 * Unset → an embedded PGlite instance persisted to disk, so local dev
 * needs neither Docker nor a hosted Postgres — see docs/adr/0008 for
 * the rationale. Repository code should never need to know which one is
 * in play; both speak the same Drizzle query builder API.
 */
export function createDatabase(
  env: Pick<ApiEnv, 'DATABASE_URL' | 'PGLITE_DATA_DIR'>,
): ApiDatabase {
  if (env.DATABASE_URL) {
    const pool = new Pool({ connectionString: env.DATABASE_URL });
    return { kind: 'node-postgres', db: drizzleNodePostgres(pool, { schema }) };
  }

  // PGlite's node filesystem backend doesn't create intermediate
  // parent directories — do it ourselves so a fresh checkout (no
  // .data/ yet) doesn't ENOENT on first boot.
  mkdirSync(env.PGLITE_DATA_DIR, { recursive: true });
  const client = new PGlite(env.PGLITE_DATA_DIR);
  return { kind: 'pglite', db: drizzlePglite(client, { schema }) };
}

export async function runMigrations(
  database: ApiDatabase,
  migrationsFolder: string,
): Promise<DrizzleDb> {
  if (database.kind === 'node-postgres') {
    await migrateNodePostgres(database.db, { migrationsFolder });
  } else {
    await migratePglite(database.db, { migrationsFolder });
  }
  return database.db;
}
