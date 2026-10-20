import { describe, expect, it } from 'vitest';

import { failure, inRolledBackTransaction, RUNTIME_ROLES } from './db.js';

/**
 * Every table privilege each runtime role holds (SPEC §7). A new table or grant fails this test until it's listed
 * here, on purpose: the list is the review. No DELETE anywhere: items are never deleted in v1 (R-DB-2).
 */
const EXPECTED_GRANTS: Record<(typeof RUNTIME_ROLES)[number], string[]> = {
  newsroom_app: [
    'app.entities: INSERT',
    'app.entities: SELECT',
    'app.entities: UPDATE',
    'app.images: INSERT',
    'app.images: SELECT',
    'app.images: UPDATE',
    'app.inbox_items: INSERT',
    'app.inbox_items: SELECT',
    'app.inbox_items: UPDATE',
    'app.notifications: INSERT',
    'app.notifications: SELECT',
    'app.posts: INSERT',
    'app.posts: SELECT',
    'app.posts: UPDATE',
    'app.site_settings: SELECT',
    'app.site_settings: UPDATE',
    'app.telegram_updates: INSERT',
    'app.telegram_updates: SELECT',
  ],
  // Published posts, the images they show and the entities they name only, through views; never the tables (SPEC §7,
  // §13).
  newsroom_public: [
    'app.public_entities: SELECT',
    'app.public_images: SELECT',
    'app.published_posts: SELECT',
    'app.unpublished_posts: SELECT',
  ],
};

describe('runtime roles', () => {
  it('hold exactly the expected table privileges', async () => {
    const grants = await inRolledBackTransaction(async (client) => {
      const { rows } = await client.query<{ grantee: string; privilege: string }>(
        `SELECT grantee, table_schema || '.' || table_name || ': ' || privilege_type AS privilege
         FROM information_schema.role_table_grants
         WHERE grantee = ANY ($1)
         ORDER BY grantee, privilege`,
        [RUNTIME_ROLES],
      );
      return Object.fromEntries(
        RUNTIME_ROLES.map((role) => [
          role,
          rows.filter((row) => row.grantee === role).map((row) => row.privilege),
        ]),
      );
    });
    expect(grants).toEqual(EXPECTED_GRANTS);
  });

  it('own nothing', async () => {
    const owned = await inRolledBackTransaction(async (client) => {
      const { rows } = await client.query<{ name: string }>(
        `SELECT n.nspname || '.' || c.relname AS name
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE c.relowner = ANY (SELECT oid FROM pg_roles WHERE rolname = ANY ($1))
         UNION ALL
         SELECT nspname FROM pg_namespace WHERE nspowner = ANY (SELECT oid FROM pg_roles WHERE rolname = ANY ($1))`,
        [RUNTIME_ROLES],
      );
      return rows.map((row) => row.name);
    });
    expect(owned).toEqual([]);
  });

  it('can create nothing in any schema', async () => {
    await inRolledBackTransaction(async (client) => {
      for (const role of RUNTIME_ROLES) {
        await client.query(`SET LOCAL ROLE ${role}`);
        for (const schema of ['app', 'private', 'public']) {
          expect(await failure(client, `CREATE TABLE ${schema}.intruder (id int)`)).toEqual({
            code: '42501',
          });
        }
        await client.query('RESET ROLE');
      }
    });
  });

  it("can't reach this database through PUBLIC: only roles granted CONNECT can", async () => {
    const publicCanConnect = await inRolledBackTransaction(async (client) => {
      const { rows } = await client.query<{ granted: boolean }>(
        `SELECT EXISTS (
           SELECT FROM pg_database d, aclexplode(d.datacl) acl
           WHERE d.datname = current_database() AND acl.grantee = 0 AND acl.privilege_type = 'CONNECT'
         ) AS granted`,
      );
      return rows[0]?.granted;
    });
    expect(publicCanConnect).toBe(false);
  });

  it('newsroom_app writes inbox items, but never deletes them', async () => {
    await inRolledBackTransaction(async (client) => {
      await client.query('SET LOCAL ROLE newsroom_app');
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO app.inbox_items (url, url_normalized) VALUES ('https://example.com/a', 'https://example.com/a')
         RETURNING id`,
      );
      const id = rows[0]?.id;
      expect(
        await failure(client, `UPDATE app.inbox_items SET note = 'more' WHERE id = $1`, [id]),
      ).toBeNull();
      expect(await failure(client, 'DELETE FROM app.inbox_items WHERE id = $1', [id])).toEqual({
        code: '42501',
      });
      expect(
        await failure(client, 'INSERT INTO app.telegram_updates (update_id) VALUES (1)'),
      ).toBeNull();
      expect(await failure(client, 'DELETE FROM app.telegram_updates')).toEqual({ code: '42501' });
    });
  });

  it('newsroom_app never deletes an entity, and newsroom_public reads only what the views let through', async () => {
    await inRolledBackTransaction(async (client) => {
      await client.query('SET LOCAL ROLE newsroom_app');
      expect(await failure(client, 'DELETE FROM app.entities')).toEqual({ code: '42501' });
      await client.query('RESET ROLE');
      await client.query('SET LOCAL ROLE newsroom_public');
      expect(await failure(client, 'SELECT FROM app.entities')).toEqual({ code: '42501' });
      expect(await failure(client, 'SELECT FROM app.public_entities')).toBeNull();
    });
  });

  it('newsroom_public reads nothing of the inbox', async () => {
    await inRolledBackTransaction(async (client) => {
      await client.query('SET LOCAL ROLE newsroom_public');
      expect(await failure(client, 'SELECT FROM app.inbox_items')).toEqual({ code: '42501' });
      expect(await failure(client, 'SELECT FROM app.telegram_updates')).toEqual({ code: '42501' });
    });
  });

  it('newsroom_public reads neither the image store nor the switches, only what the views let through', async () => {
    await inRolledBackTransaction(async (client) => {
      await client.query('SET LOCAL ROLE newsroom_public');
      expect(await failure(client, 'SELECT FROM app.images')).toEqual({ code: '42501' });
      expect(await failure(client, 'SELECT FROM app.site_settings')).toEqual({ code: '42501' });
      expect(await failure(client, 'SELECT FROM app.public_images')).toBeNull();
    });
  });

  it('newsroom_app never deletes an image or the settings row: removing one only marks it', async () => {
    await inRolledBackTransaction(async (client) => {
      await client.query('SET LOCAL ROLE newsroom_app');
      expect(await failure(client, 'DELETE FROM app.images')).toEqual({ code: '42501' });
      expect(await failure(client, 'DELETE FROM app.site_settings')).toEqual({ code: '42501' });
      expect(await failure(client, "UPDATE app.site_settings SET images = 'none'")).toBeNull();
    });
  });
});
