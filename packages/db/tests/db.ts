import pg from 'pg';

import { superuserUrl } from './env.js';

/** Runs `fn` in a superuser transaction that is always rolled back, so tests never leave anything behind. */
export const inRolledBackTransaction = async <T>(
  fn: (client: pg.Client) => Promise<T>,
): Promise<T> => {
  const client = new pg.Client({ connectionString: superuserUrl() });
  await client.connect();
  try {
    await client.query('BEGIN');
    return await fn(client);
  } finally {
    await client.query('ROLLBACK').catch(() => undefined);
    await client.end();
  }
};

export interface Failure {
  code: string;
  constraint?: string;
}

/** Runs `sql` inside a savepoint and returns how it failed, or null if it succeeded. */
export const failure = async (
  client: pg.Client,
  sql: string,
  values: unknown[] = [],
): Promise<Failure | null> => {
  await client.query('SAVEPOINT attempt');
  try {
    await client.query(sql, values);
    await client.query('RELEASE SAVEPOINT attempt');
    return null;
  } catch (error) {
    await client.query('ROLLBACK TO SAVEPOINT attempt');
    const { code, constraint } = error as { code?: string; constraint?: string };
    return { code: code ?? 'unknown', ...(constraint ? { constraint } : {}) };
  }
};

export const RUNTIME_ROLES = ['newsroom_app', 'newsroom_public'] as const;
