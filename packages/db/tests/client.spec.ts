import { sql } from 'kysely';
import { afterAll, describe, expect, it } from 'vitest';

import { createDatabase } from '../src/client.js';
import { ownerUrl } from './env.js';

/**
 * Every connection the apps open (SPEC §7): no JIT, whose compiling of the published-posts view cost more than running
 * it (about 200 ms of the database's CPU per query, for a query that takes a fraction of a millisecond), and limits
 * that make a stuck database fail a request instead of holding it until the gateway gives up.
 */
describe('createDatabase', () => {
  const db = createDatabase({ connectionString: ownerUrl(), statementTimeoutMs: 1234 });
  afterAll(async () => {
    await db.destroy();
  });

  it('turns JIT off on its connections', async () => {
    const { rows } = await sql<{ jit: string }>`show jit`.execute(db);
    expect(rows[0]?.jit).toBe('off');
  });

  it('bounds every statement', async () => {
    const { rows } = await sql<{ statement_timeout: string }>`show statement_timeout`.execute(db);
    expect(rows[0]?.statement_timeout).toBe('1234ms');
    const error = await sql`select pg_sleep(2)`.execute(db).catch((caught: unknown) => caught);
    expect(error).toMatchObject({ code: '57014' });
  });
});
