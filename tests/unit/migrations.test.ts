import { expect, it } from 'vitest';
import type { PoolClient } from 'pg';
import { runMigrations } from '../../packages/server/src/db/migrations';

it('records schema versions and skips already applied migrations', async () => {
  const applied = new Set<string>();
  const executed: string[] = [];
  const query = async (sql: string, params?: string[]) => {
    executed.push(sql);
    if (sql.startsWith('SELECT version')) return { rowCount: applied.has(params![0]) ? 1 : 0 };
    if (sql.startsWith('INSERT INTO timebox_migrations')) applied.add(params![0]);
    return { rowCount: 0 };
  };
  const client = { query } as unknown as Pick<PoolClient, 'query'>;
  await runMigrations(client);
  await runMigrations(client);
  expect(applied.size).toBe(2);
  expect(executed.filter((sql) => sql.includes('ALTER TABLE reminders ADD COLUMN'))).toHaveLength(
    1,
  );
  expect(executed.filter((sql) => sql === 'COMMIT')).toHaveLength(2);
});
it('rolls back migration failures without committing', async () => {
  const executed: string[] = [];
  const client = {
    query: async (sql: string) => {
      executed.push(sql);
      if (sql.includes('CREATE TABLE IF NOT EXISTS users')) throw new Error('schema failed');
      return { rowCount: 0 };
    },
  } as unknown as Pick<PoolClient, 'query'>;
  await expect(runMigrations(client)).rejects.toThrow('schema failed');
  expect(executed.at(-1)).toBe('ROLLBACK');
  expect(executed).not.toContain('COMMIT');
});
