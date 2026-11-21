import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import pg from 'pg';
import { databaseUrl } from './config.ts';

const directory = process.env.MIGRATIONS_DIR ?? '/migrations';
const files = (await readdir(directory)).filter((name) => /^\d+_[a-z_]+\.sql$/.test(name)).sort();
if (!files.length) throw new Error('No SQL migrations found.');
const database = new pg.Pool({ connectionString: databaseUrl() });

try {
  const client = await database.connect();
  try {
    await client.query('SELECT pg_advisory_lock(1241202891)');
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY)');
    for (const file of files) {
      const { rowCount } = await client.query('SELECT 1 FROM schema_migrations WHERE name = $1', [file]);
      if (rowCount) continue;
      const sql = await readFile(join(directory, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log('Applied ' + file);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock(1241202891)').finally(() => client.release());
  }
} finally {
  await database.end();
}
