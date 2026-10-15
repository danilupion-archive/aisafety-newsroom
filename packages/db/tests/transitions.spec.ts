import { canTransition, INBOX_STATUSES } from '@aisafety-newsroom/domain/inbox';
import { describe, expect, it } from 'vitest';

import { failure, inRolledBackTransaction } from './db.js';

// The trigger and packages/domain's canTransition are two copies of one table (R-DB-1): this keeps them equal.
describe('the inbox_items_transition trigger', () => {
  it('allows exactly the moves canTransition allows, for newsroom_app', async () => {
    const outcomes = await inRolledBackTransaction(async (client) => {
      await client.query('SET LOCAL ROLE newsroom_app');
      const results: string[] = [];
      for (const from of INBOX_STATUSES) {
        for (const to of INBOX_STATUSES) {
          const url = `https://example.com/${from}-${to}`;
          const { rows } = await client.query<{ id: string }>(
            `INSERT INTO app.inbox_items (url, url_normalized, status, logged_at, logged_ref)
             VALUES ($1, $1, $2::app.inbox_status, CASE WHEN $2 = 'logged' THEN now() END, CASE WHEN $2 = 'logged' THEN '{}'::jsonb END)
             RETURNING id`,
            [url, from],
          );
          const refused = await failure(
            client,
            `UPDATE app.inbox_items
             SET status = $2::app.inbox_status, logged_at = coalesce(logged_at, now()), logged_ref = coalesce(logged_ref, '{}'::jsonb)
             WHERE id = $1`,
            [rows[0]?.id, to],
          );
          if (refused) {
            expect(refused).toEqual({ code: '23514', constraint: 'inbox_items_transition' });
          }
          results.push(`${from} → ${to}: ${refused ? 'refused' : 'allowed'}`);
        }
      }
      return results;
    });

    const expected = INBOX_STATUSES.flatMap((from) =>
      INBOX_STATUSES.map(
        (to) => `${from} → ${to}: ${canTransition(from, to) ? 'allowed' : 'refused'}`,
      ),
    );
    expect(outcomes).toEqual(expected);
  });
});
