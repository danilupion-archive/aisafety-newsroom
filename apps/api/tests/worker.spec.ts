import type { Database } from '@aisafety-newsroom/db/client';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { TelegramApi } from '../src/telegram/api.js';
import type { Fetched } from '../src/worker/fetch-url.js';

import { FetchRefused } from '../src/worker/fetch-url.js';
import { claimDue } from '../src/worker/jobs.js';
import { runOnce } from '../src/worker/loop.js';
import { type WorkerDeps } from '../src/worker/process.js';
import { appDatabase, asSuperuser, emptyTables } from './db.js';

let db: Database;

beforeAll(() => {
  db = appDatabase();
});

afterAll(async () => {
  await db.destroy();
});

beforeEach(async () => {
  await emptyTables();
});

const ARTICLE = `<!doctype html><html><head><meta charset="utf-8">
  <meta property="og:title" content="Un informe de ejemplo"><meta property="og:site_name" content="Diario Ejemplo">
  <meta property="article:published_time" content="2026-10-13"></head><body><article>
  <p>El Laboratorio Ejemplo publicó un informe ficticio con resultados que sus autores no esperaban en absoluto.</p>
  <p>El documento describe las pruebas una por una y explica cómo se diseñaron y qué limitaciones tienen todas.</p>
  </article></body></html>`;

const page = (body = ARTICLE, contentType = 'text/html'): Fetched => ({
  contentType,
  finalUrl: 'https://example.com/final',
  status: 200,
  bytes: Buffer.from(body),
});

interface Edit {
  chatId: number;
  messageId: number;
  text: string;
}

const deps = (fetch: (url: string) => Promise<Fetched>, edits: Edit[] = []): WorkerDeps => ({
  db,
  fetch,
  skipHosts: ['x.com'],
  telegram: {
    sendMessage: async () => 0,
    setWebhook: async () => {},
    editMessageText: async (chatId, messageId, text) => {
      edits.push({ chatId, messageId, text });
    },
  } satisfies TelegramApi,
});

/** A queued link, due now, with its "Saved #n" reply remembered. */
const queue = async (url = 'https://example.com/a'): Promise<number> => {
  const [row] = await asSuperuser<{ id: string }>(
    `INSERT INTO app.inbox_items (url, url_normalized, status, next_fetch_at, reply_chat_id, reply_message_id)
     VALUES ($1, $1, 'queued', now(), 500, 9001) RETURNING id`,
    [url],
  );
  return Number(row?.id);
};

const item = async (id: number) => {
  const [row] = await asSuperuser<{
    status: string;
    fetch_status: string;
    fetch_attempts: number;
    http_status: number | null;
    final_url: string | null;
    content_type: string | null;
    page_title: string | null;
    page_site_name: string | null;
    page_published_at: string | null;
    page_text: string | null;
    last_error: string | null;
    retry_in_seconds: number | null;
  }>(
    `SELECT *, round(extract(epoch FROM next_fetch_at - now()))::int AS retry_in_seconds
     FROM app.inbox_items WHERE id = $1`,
    [id],
  );
  return row;
};

/** Makes an item due now, as the clock would after its retry wait or its lease. */
const makeDue = (id: number) =>
  asSuperuser('UPDATE app.inbox_items SET next_fetch_at = now() WHERE id = $1', [id]);

describe('claiming (R-FET-1, R-FET-5)', () => {
  it('claims due queued links only, counting the attempt before anything is fetched', async () => {
    const due = await queue();
    await asSuperuser(`INSERT INTO app.inbox_items (url, url_normalized, status, next_fetch_at)
      VALUES ('https://example.com/later', 'https://example.com/later', 'queued', now() + interval '1 hour')`);
    await asSuperuser(
      `INSERT INTO app.inbox_items (note, status) VALUES ('a note', 'needs_review')`,
    );
    await asSuperuser(`INSERT INTO app.inbox_items (url, url_normalized, status)
      VALUES ('https://example.com/ready', 'https://example.com/ready', 'ready')`);

    const claimed = await claimDue(db);
    expect(claimed).toEqual([
      {
        id: due,
        url: 'https://example.com/a',
        attempts: 1,
        replyChatId: 500,
        replyMessageId: 9001,
      },
    ]);
    // Held for the lease: a second claim right away finds nothing.
    expect(await claimDue(db)).toEqual([]);
    expect((await item(due))?.retry_in_seconds).toBeGreaterThan(9 * 60);
  });

  it('never gives the same item to two overlapping claims', async () => {
    for (let i = 0; i < 6; i += 1) {
      await queue(`https://example.com/${i}`);
    }
    const [first, second] = await Promise.all([claimDue(db, 4), claimDue(db, 4)]);
    const ids = [...(first ?? []), ...(second ?? [])].map((claimed) => claimed.id);
    expect(ids).toHaveLength(6);
    expect(new Set(ids).size).toBe(6);
  });

  it('claims an item again once a crashed worker’s lease runs out, its attempt already counted', async () => {
    const id = await queue();
    await claimDue(db);
    await makeDue(id);
    expect(await claimDue(db)).toMatchObject([{ id, attempts: 2 }]);
  });
});

describe('a round (R-FET-2)', () => {
  it('stores the page’s metadata and text, makes the item ready and edits the reply with its title', async () => {
    const id = await queue();
    const edits: Edit[] = [];
    expect(await runOnce(deps(async () => page(), edits))).toBe(1);
    expect(await item(id)).toMatchObject({
      status: 'ready',
      fetch_status: 'ok',
      http_status: 200,
      final_url: 'https://example.com/final',
      content_type: 'text/html',
      page_title: 'Un informe de ejemplo',
      page_site_name: 'Diario Ejemplo',
      page_published_at: '2026-10-13',
      last_error: null,
      retry_in_seconds: null,
    });
    expect((await item(id))?.page_text).toContain('El Laboratorio Ejemplo publicó');
    expect(edits).toEqual([
      { chatId: 500, messageId: 9001, text: `#${id} · Un informe de ejemplo` },
    ]);
  });

  it('skips x.com without fetching, and the item relies on its note (R-FET-3, AC-3)', async () => {
    const id = await queue('https://x.com/someone/status/1');
    const edits: Edit[] = [];
    let fetched = false;
    await runOnce(
      deps(async () => {
        fetched = true;
        return page();
      }, edits),
    );
    expect(fetched).toBe(false);
    expect(await item(id)).toMatchObject({ status: 'ready', fetch_status: 'skipped' });
    expect(edits[0]?.text).toBe(`#${id} · x.com (not fetched; your note goes to /news)`);
  });

  it('tries a failed fetch again later, and after the third failure sends the item to needs_review', async () => {
    const id = await queue();
    const edits: Edit[] = [];
    const failing = deps(async () => {
      throw new FetchRefused('timeout');
    }, edits);

    await runOnce(failing);
    expect(await item(id)).toMatchObject({
      status: 'queued',
      fetch_attempts: 1,
      last_error: 'timeout',
    });
    expect((await item(id))?.retry_in_seconds).toBeLessThanOrEqual(60);

    await makeDue(id);
    await runOnce(failing);
    expect(await item(id)).toMatchObject({ status: 'queued', fetch_attempts: 2 });
    expect((await item(id))?.retry_in_seconds).toBeGreaterThan(9 * 60);
    expect(edits).toEqual([]);

    await makeDue(id);
    await runOnce(failing);
    expect(await item(id)).toMatchObject({
      status: 'needs_review',
      fetch_status: 'failed',
      fetch_attempts: 3,
    });
    expect(edits[0]?.text).toBe(`#${id} · couldn't fetch it (timeout); your note goes to /news`);
  });

  it('gives up on a page that is gone at once', async () => {
    const id = await queue();
    await runOnce(
      deps(async () => {
        throw new FetchRefused('status', 404);
      }),
    );
    expect(await item(id)).toMatchObject({
      status: 'needs_review',
      fetch_status: 'failed',
      last_error: 'HTTP 404',
    });
  });

  it('refuses HTML past 5 MB, though a PDF may be larger', async () => {
    const id = await queue();
    const huge = `<html><body><p>${'x'.repeat(5 * 1024 * 1024)}</p></body></html>`;
    await runOnce(deps(async () => page(huge)));
    expect(await item(id)).toMatchObject({ status: 'queued', last_error: 'tooLarge' });
  });

  it('records a page it can’t read by the failure’s class only', async () => {
    const id = await queue();
    await runOnce(deps(async () => page('not a pdf at all', 'application/pdf')));
    expect((await item(id))?.last_error).toMatch(/^unreadable \(\w+\)$/);
  });

  it('leaves an item discarded while it was being fetched discarded', async () => {
    const id = await queue();
    const edits: Edit[] = [];
    await runOnce(
      deps(async () => {
        await asSuperuser(`UPDATE app.inbox_items SET status = 'discarded' WHERE id = $1`, [id]);
        return page();
      }, edits),
    );
    expect(await item(id)).toMatchObject({ status: 'discarded', page_title: null });
    expect(edits).toEqual([]);
  });

  it('stores the page even when the reply can’t be edited', async () => {
    const id = await queue();
    const failingEdit: WorkerDeps = {
      ...deps(async () => page()),
      telegram: {
        sendMessage: async () => 0,
        setWebhook: async () => {},
        editMessageText: async () => {
          throw new Error('Telegram is down');
        },
      },
    };
    await runOnce(failingEdit);
    expect(await item(id)).toMatchObject({ status: 'ready' });
  });
});
