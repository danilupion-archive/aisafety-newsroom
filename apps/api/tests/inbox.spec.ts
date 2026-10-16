import type { Database } from '@aisafety-newsroom/db/client';
import type { FastifyInstance } from 'fastify';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';
import { appDatabase, asSuperuser, emptyTables, insertItem } from './db.js';

const TOKEN = 'a'.repeat(43);
const auth = { authorization: `Bearer ${TOKEN}` };
const REF = {
  news_file: 'news/2026/10/2026-10-15-example-item.md',
  entry_date: '2026-10-15',
  tags: ['labs', 'loss-of-control'],
  relevance: 'high',
};

let db: Database;
let app: FastifyInstance;

beforeAll(() => {
  db = appDatabase();
  app = buildApp({ apiToken: TOKEN, db });
});

afterAll(async () => {
  await app.close();
  await db.destroy();
});

beforeEach(async () => {
  await emptyTables();
});

const get = (url: string) => app.inject({ method: 'GET', url, headers: auth });
const post = (url: string, payload?: object) =>
  app.inject({ method: 'POST', url, headers: auth, payload });

describe('GET /api/v1/items (§9)', () => {
  it('lists ready and needs_review items by default, oldest first, without their page text', async () => {
    const ready = await insertItem({ page_text: 'x'.repeat(5000), page_title: 'A title' });
    const note = await insertItem({ url: null, note: '[2026-10-15 10:00Z] a note' });
    await insertItem({ status: 'queued', fetch_status: 'pending' });
    await insertItem({ status: 'logged' });
    await insertItem({ status: 'discarded' });

    const response = await get('/api/v1/items');
    expect(response.statusCode).toBe(200);
    const items = response.json<Record<string, unknown>[]>();
    expect(items.map((item) => item.id)).toEqual([ready, note]);
    expect(items[0]).not.toHaveProperty('page_text');
    expect(items[0]?.page_excerpt).toHaveLength(4000);
    expect(items[0]).toMatchObject({ status: 'ready', page_title: 'A title', follows_up: null });
    expect(items[0]).not.toHaveProperty('reply_chat_id');
  });

  it('says what kind of thing was fetched, and for a video its channel and length (R-FET-7)', async () => {
    const video = await insertItem({ page_title: 'Una charla de ejemplo' });
    await asSuperuser(
      `UPDATE app.inbox_items SET page_kind = 'video', page_author = 'Canal de ejemplo', page_duration_seconds = 754
       WHERE id = $1`,
      [video],
    );
    const before = await insertItem();
    const fields = (item: Record<string, unknown> | undefined) => ({
      page_kind: item?.page_kind,
      page_author: item?.page_author,
      page_duration_seconds: item?.page_duration_seconds,
    });
    const items = (await get('/api/v1/items')).json<Record<string, unknown>[]>();
    expect(fields(items.find((item) => item.id === video))).toEqual({
      page_kind: 'video',
      page_author: 'Canal de ejemplo',
      page_duration_seconds: 754,
    });
    expect(fields(items.find((item) => item.id === before))).toEqual({
      page_kind: null,
      page_author: null,
      page_duration_seconds: null,
    });
    expect(fields((await get(`/api/v1/items/${video}`)).json())).toMatchObject({
      page_kind: 'video',
    });
  });

  it('sorts by the day each page says it was published when asked, oldest first, undated last (R-API-4)', async () => {
    const recent = await insertItem({ page_published_at: '2026-10-10T08:00:00-07:00' });
    const undated = await insertItem();
    const old = await insertItem({ page_published_at: '2026-09-01' });
    const unreadable = await insertItem({ page_published_at: 'el viernes pasado' });
    const ids = async (url: string) =>
      (await get(url)).json<{ id: number }[]>().map((item) => item.id);

    expect(await ids('/api/v1/items')).toEqual([recent, undated, old, unreadable]);
    expect(await ids('/api/v1/items?sort=found')).toEqual([recent, undated, old, unreadable]);
    expect(await ids('/api/v1/items?sort=source')).toEqual([old, recent, undated, unreadable]);
    const items = (await get('/api/v1/items?sort=source')).json<Record<string, unknown>[]>();
    expect(items.map((item) => item.page_published_on)).toEqual([
      '2026-09-01',
      '2026-10-10',
      null,
      null,
    ]);
    expect((await get(`/api/v1/items/${old}`)).json()).toMatchObject({
      page_published_on: '2026-09-01',
    });
    expect((await get('/api/v1/items?sort=newest')).statusCode).toBe(400);
  });

  it('filters by status and limits the count', async () => {
    const queued = await insertItem({ status: 'queued', fetch_status: 'pending' });
    await insertItem();
    const queuedOnly = await get('/api/v1/items?status=queued');
    expect(queuedOnly.json<{ id: number }[]>().map((item) => item.id)).toEqual([queued]);

    await insertItem();
    expect((await get('/api/v1/items?limit=1')).json<unknown[]>()).toHaveLength(1);
  });

  it('refuses unknown statuses and limits past 50', async () => {
    expect((await get('/api/v1/items?status=parsed')).statusCode).toBe(400);
    const tooMany = await get('/api/v1/items?limit=51');
    expect(tooMany.statusCode).toBe(400);
    expect(tooMany.json()).toEqual({ error: expect.stringContaining('limit') });
  });

  it("shows a follow-up's original, so /news can find its entry (R-CAP-6)", async () => {
    const original = await insertItem({
      status: 'logged',
      page_title: 'The original',
      logged_ref: REF,
    });
    await insertItem({
      url: null,
      follows_up: original,
      note: '[2026-10-16 09:00Z] now confirmed',
    });
    const [followUp] = (await get('/api/v1/items')).json<Record<string, unknown>[]>();
    expect(followUp?.follows_up).toMatchObject({
      id: original,
      status: 'logged',
      page_title: 'The original',
      logged_ref: REF,
    });
  });
});

describe('GET /api/v1/items/:id', () => {
  it('returns the whole item, page text included', async () => {
    const id = await insertItem({ page_text: 'x'.repeat(5000) });
    const response = await get(`/api/v1/items/${id}`);
    expect(response.statusCode).toBe(200);
    expect(response.json<{ page_text: string }>().page_text).toHaveLength(5000);
  });

  it('answers 404 for a missing item and 400 for an id that is not one', async () => {
    expect((await get('/api/v1/items/999')).json()).toEqual({ error: 'No item #999' });
    expect((await get('/api/v1/items/999')).statusCode).toBe(404);
    expect((await get('/api/v1/items/abc')).statusCode).toBe(400);
    expect((await get('/api/v1/items/0')).statusCode).toBe(400);
  });
});

describe('POST /api/v1/items/:id/logged', () => {
  it('logs a ready item, with its pointer into aisafety-media', async () => {
    const id = await insertItem();
    const response = await post(`/api/v1/items/${id}/logged`, REF);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id, status: 'logged', logged_ref: REF });
  });

  it('takes a month’s file too, as the log was before one file per item', async () => {
    const id = await insertItem();
    const monthly = { ...REF, news_file: 'news/2026-10.md' };
    expect((await post(`/api/v1/items/${id}/logged`, monthly)).statusCode).toBe(200);
  });

  it('logs a needs_review item too: a note, or a page that could not be fetched', async () => {
    const id = await insertItem({ url: null, note: 'a note' });
    expect((await post(`/api/v1/items/${id}/logged`, REF)).statusCode).toBe(200);
  });

  it('answers 200 to the same call again, and updates only the pointer to a different one (R-API-3)', async () => {
    const id = await insertItem();
    const first = (await post(`/api/v1/items/${id}/logged`, REF)).json<{ logged_at: string }>();
    const again = await post(`/api/v1/items/${id}/logged`, REF);
    expect(again.statusCode).toBe(200);
    expect(again.json<{ logged_at: string }>().logged_at).toBe(first.logged_at);

    const moved = {
      ...REF,
      news_file: 'news/2026/09/2026-09-30-example-item.md',
      entry_date: '2026-09-30',
    };
    const updated = await post(`/api/v1/items/${id}/logged`, moved);
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject({
      status: 'logged',
      logged_ref: moved,
      logged_at: first.logged_at,
    });
  });

  it('refuses to log a queued or discarded item (409)', async () => {
    for (const status of ['queued', 'discarded']) {
      const id = await insertItem({ status, fetch_status: status === 'queued' ? 'pending' : 'ok' });
      const response = await post(`/api/v1/items/${id}/logged`, REF);
      expect(response.statusCode).toBe(409);
      expect(response.json()).toEqual({ error: `Item #${id} is ${status}: it can't be logged` });
    }
  });

  it('checks the body', async () => {
    const id = await insertItem();
    for (const body of [
      { ...REF, news_file: 'news/october.md' },
      { ...REF, news_file: 'news/2026/10/notes.md' },
      { ...REF, news_file: 'news/../CLAUDE.md' },
      { ...REF, entry_date: '15/10/2026' },
      { ...REF, tags: ['#labs'] },
      { ...REF, relevance: 'urgent' },
      { ...REF, extra: true },
    ]) {
      expect((await post(`/api/v1/items/${id}/logged`, body)).statusCode).toBe(400);
    }
    expect((await post('/api/v1/items/999/logged', REF)).statusCode).toBe(404);
  });
});

describe('POST /api/v1/items/:id/discarded', () => {
  it('discards an open item with its reason, and answers 200 again', async () => {
    const id = await insertItem({ status: 'queued', fetch_status: 'pending' });
    const response = await post(`/api/v1/items/${id}/discarded`, { reason: 'duplicate of #3' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: 'discarded',
      discard_reason: 'duplicate of #3',
    });
    expect(
      (await post(`/api/v1/items/${id}/discarded`, { reason: 'duplicate of #3' })).statusCode,
    ).toBe(200);
  });

  it('never discards a logged item, and needs a reason', async () => {
    const logged = await insertItem({ status: 'logged' });
    expect((await post(`/api/v1/items/${logged}/discarded`, { reason: 'no' })).statusCode).toBe(
      409,
    );
    const open = await insertItem();
    expect((await post(`/api/v1/items/${open}/discarded`, { reason: '  ' })).statusCode).toBe(400);
    expect((await post(`/api/v1/items/${open}/discarded`)).statusCode).toBe(400);
  });
});

describe('POST /api/v1/items/:id/restored (R-DB-1)', () => {
  it('brings a discarded item back to where it would be now', async () => {
    const cases = [
      { fixture: { status: 'discarded', fetch_status: 'pending' }, expected: 'queued' },
      { fixture: { status: 'discarded', fetch_status: 'ok' }, expected: 'ready' },
      { fixture: { status: 'discarded', fetch_status: 'skipped' }, expected: 'ready' },
      { fixture: { status: 'discarded', fetch_status: 'failed' }, expected: 'needs_review' },
      { fixture: { status: 'discarded', url: null }, expected: 'needs_review' },
    ];
    for (const { fixture, expected } of cases) {
      const id = await insertItem(fixture);
      const response = await post(`/api/v1/items/${id}/restored`);
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ status: expected, discard_reason: null });
    }
  });

  it('makes a restored queued item due for a fetch at once', async () => {
    const id = await insertItem({ status: 'discarded', fetch_status: 'pending' });
    await post(`/api/v1/items/${id}/restored`);
    const [row] = await asSuperuser<{ due: boolean }>(
      'SELECT next_fetch_at <= now() AS due FROM app.inbox_items WHERE id = $1',
      [id],
    );
    expect(row?.due).toBe(true);
  });

  it('leaves an open item as it is, and refuses a logged one', async () => {
    const open = await insertItem();
    expect((await post(`/api/v1/items/${open}/restored`)).json()).toMatchObject({
      status: 'ready',
    });
    const logged = await insertItem({ status: 'logged' });
    expect((await post(`/api/v1/items/${logged}/restored`)).statusCode).toBe(409);
  });
});

describe('POST /api/v1/items/:id/note', () => {
  it('adds a timestamped entry, and nothing more when repeated (R-API-3)', async () => {
    const id = await insertItem();
    const first = await post(`/api/v1/items/${id}/note`, { text: 'now confirmed by Reuters' });
    expect(first.statusCode).toBe(200);
    const note = first.json<{ note: string }>().note;
    expect(note).toMatch(/^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}Z\] now confirmed by Reuters$/);
    expect(
      (await post(`/api/v1/items/${id}/note`, { text: 'now confirmed by Reuters' })).json(),
    ).toMatchObject({ note });
  });

  it('takes a note on a logged item too', async () => {
    const id = await insertItem({ status: 'logged' });
    expect((await post(`/api/v1/items/${id}/note`, { text: 'see also #9' })).statusCode).toBe(200);
  });
});

describe('the database stays the last word', () => {
  it('refuses, through the API’s own role, a move the code would never make', async () => {
    const id = await insertItem({ status: 'logged' });
    // A direct update, as a bug would make it; app.spec.ts checks that the handler answers it with a 409.
    await expect(
      db
        .updateTable('app.inbox_items')
        .set({ status: 'ready' })
        .where('id', '=', String(id))
        .execute(),
    ).rejects.toMatchObject({ constraint: 'inbox_items_transition' });
  });
});
