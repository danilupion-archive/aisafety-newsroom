import type { Database } from '@aisafety-newsroom/db/client';
import type { FastifyInstance } from 'fastify';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { TelegramApi } from '../src/telegram/api.js';

import { buildApp } from '../src/app.js';
import { appDatabase, asSuperuser, emptyTables, insertItem } from './db.js';

const TOKEN = 'a'.repeat(43);
const SECRET = 'webhook_secret-'.repeat(3);
const DANI = 111;
const CHAT = 500;

interface Sent {
  chatId: number;
  text: string;
  replyTo?: number;
}

class FakeTelegram implements TelegramApi {
  sent: Sent[] = [];
  failing = false;
  private nextId = 9000;

  reset(): void {
    this.sent = [];
    this.failing = false;
    this.nextId = 9000;
  }

  sendMessage = async (chatId: number, text: string, replyTo?: number): Promise<number> => {
    if (this.failing) {
      throw new Error('Telegram is down');
    }
    this.sent.push({ chatId, text, replyTo });
    this.nextId += 1;
    return this.nextId;
  };

  editMessageText = async (): Promise<void> => {};
  setWebhook = async (): Promise<void> => {};
}

let db: Database;
let telegram: FakeTelegram;
let replyErrors: unknown[];
let app: FastifyInstance;

beforeAll(() => {
  db = appDatabase();
  telegram = new FakeTelegram();
  replyErrors = [];
  app = buildApp({
    apiToken: TOKEN,
    db,
    bot: {
      webhookSecret: SECRET,
      allowedUserIds: [DANI],
      api: telegram,
      onReplyError: (error) => replyErrors.push(error),
    },
  });
});

afterAll(async () => {
  await app.close();
  await db.destroy();
});

beforeEach(async () => {
  await emptyTables();
  telegram.reset();
  replyErrors.length = 0;
});

let nextUpdate = 1;

/** A private message from Dani with `text`, each of `urls` marked as a link the way Telegram marks them. */
const message = (text: string, urls: string[] = [], overrides: Record<string, unknown> = {}) => {
  nextUpdate += 1;
  return {
    update_id: nextUpdate,
    message: {
      message_id: nextUpdate * 10,
      chat: { id: CHAT, type: 'private' },
      from: { id: DANI },
      text,
      entities: urls.map((url) => ({ type: 'url', offset: text.indexOf(url), length: url.length })),
      ...overrides,
    },
  };
};

/** A bot command, with its bot_command entity. */
const command = (text: string) =>
  message(text, [], {
    entities: [{ type: 'bot_command', offset: 0, length: text.split(' ')[0]?.length ?? 0 }],
  });

/** A bot command followed by links, with the bot_command and url entities Telegram sends. */
const commandWithLinks = (text: string, urls: string[]) =>
  message(text, [], {
    entities: [
      { type: 'bot_command', offset: 0, length: text.split(' ')[0]?.length ?? 0 },
      ...urls.map((url) => ({ type: 'url', offset: text.indexOf(url), length: url.length })),
    ],
  });

/** Delivers an update as Telegram does; `null` sends no secret at all. */
const deliver = (update: object, secret: string | null = SECRET) =>
  app.inject({
    method: 'POST',
    url: '/telegram/webhook',
    headers: secret === null ? {} : { 'x-telegram-bot-api-secret-token': secret },
    payload: update,
  });

const items = () =>
  asSuperuser<{
    id: string;
    url: string | null;
    url_normalized: string | null;
    status: string;
    note: string;
    follows_up: string | null;
    submitted_by: string | null;
    reply_chat_id: string | null;
    reply_message_id: string | null;
    discard_reason: string | null;
    intent: string;
  }>('SELECT * FROM app.inbox_items ORDER BY id');

const texts = () => telegram.sent.map((sent) => sent.text);

describe('the webhook (R-CAP-2)', () => {
  it('refuses a request without Telegram’s secret, and saves nothing', async () => {
    const update = message('see https://example.com/a', ['https://example.com/a']);
    expect((await deliver(update, null)).statusCode).toBe(401);
    expect((await deliver(update, 'wrong')).statusCode).toBe(401);
    expect(await items()).toEqual([]);
  });

  it('answers 503 while the bot is not configured, so Telegram keeps the update', async () => {
    const bare = buildApp({ apiToken: TOKEN, db });
    const response = await bare.inject({ method: 'POST', url: '/telegram/webhook', payload: {} });
    expect(response.statusCode).toBe(503);
    await bare.close();
  });

  it('is outside the bearer guard: Telegram has no API token', async () => {
    expect((await deliver(message('a note'))).statusCode).toBe(200);
  });

  it('processes an update once, however often Telegram delivers it', async () => {
    const update = message('see https://example.com/a', ['https://example.com/a']);
    await deliver(update);
    await deliver(update);
    expect(await items()).toHaveLength(1);
    expect(texts()).toEqual(['Saved #1']);
  });

  it('acknowledges an update it can’t read, so Telegram stops sending it', async () => {
    expect((await deliver({ not: 'an update' })).statusCode).toBe(200);
  });
});

describe('who the bot listens to (R-CAP-1)', () => {
  it('ignores anyone outside the allowlist, without a reply', async () => {
    await deliver(
      message('https://example.com/a', ['https://example.com/a'], { from: { id: 999 } }),
    );
    expect(await items()).toEqual([]);
    expect(texts()).toEqual([]);
  });

  it('ignores group chats, even from Dani', async () => {
    await deliver(
      message('https://example.com/a', ['https://example.com/a'], {
        chat: { id: -5, type: 'group' },
      }),
    );
    expect(await items()).toEqual([]);
    expect(texts()).toEqual([]);
  });
});

describe('capture (R-CAP-3 to R-CAP-7)', () => {
  it('saves a link as a queued item with its note, and replies "Saved #n" to the message', async () => {
    const update = message('Look https://Example.com/a/?utm_source=tg important', [
      'https://Example.com/a/?utm_source=tg',
    ]);
    const response = await deliver(update);
    expect(response.statusCode).toBe(200);

    const [item] = await items();
    expect(item).toMatchObject({
      url: 'https://Example.com/a/?utm_source=tg',
      url_normalized: 'https://example.com/a',
      status: 'queued',
      submitted_by: String(DANI),
      reply_chat_id: String(CHAT),
      reply_message_id: '9001',
    });
    expect(item?.note).toMatch(/^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}Z\] Look important$/);
    expect(telegram.sent).toEqual([
      { chatId: CHAT, text: 'Saved #1', replyTo: update.message.message_id },
    ]);
  });

  it('saves one item per link, each with the same note', async () => {
    const text = 'two: https://one.example/a https://two.example/b';
    await deliver(message(text, ['https://one.example/a', 'https://two.example/b']));
    const saved = await items();
    expect(saved.map((item) => item.url_normalized)).toEqual([
      'https://one.example/a',
      'https://two.example/b',
    ]);
    expect(new Set(saved.map((item) => item.note)).size).toBe(1);
    expect(texts()).toEqual(['Saved #1', 'Saved #2']);
  });

  it('saves a message without a link as a note in needs_review (R-CAP-4)', async () => {
    await deliver(message('Check the AESIA annual report'));
    expect(await items()).toMatchObject([{ url: null, status: 'needs_review' }]);
    expect(texts()).toEqual(['Saved note #1']);
  });

  it('says so when a message has nothing to save', async () => {
    await deliver(message('', [], { text: undefined, entities: undefined, photo: [{}] }));
    expect(await items()).toEqual([]);
    expect(texts()).toEqual(['Nothing to save: send a link or a note.']);
  });

  it('appends the note when an open item’s link comes again, tracking parameters and all (AC-2)', async () => {
    await deliver(message('https://example.com/a', ['https://example.com/a']));
    await deliver(
      message('https://example.com/a?fbclid=x more context', ['https://example.com/a?fbclid=x']),
    );
    const saved = await items();
    expect(saved).toHaveLength(1);
    expect(saved[0]?.note).toMatch(/\] more context$/);
    expect(texts()).toEqual(['Saved #1', 'Already saved #1 (queued); note added']);
  });

  it('only replies when the link comes again with no note', async () => {
    await deliver(message('https://example.com/a', ['https://example.com/a']));
    await deliver(message('https://example.com/a', ['https://example.com/a']));
    expect(await items()).toHaveLength(1);
    expect(texts()).toEqual(['Saved #1', 'Already saved #1 (queued)']);
  });

  it('makes a follow-up of a note about a logged item, so /news sees it (R-CAP-6, AC-9)', async () => {
    const original = await insertItem({ url: 'https://example.com/a', status: 'logged' });
    await deliver(message('https://example.com/a now confirmed', ['https://example.com/a']));
    const saved = await items();
    expect(saved).toHaveLength(2);
    expect(saved[1]).toMatchObject({
      url: null,
      status: 'needs_review',
      follows_up: String(original),
    });
    // Not original + 1: the insert that found the link already there used up an id (ids may have gaps).
    expect(texts()).toEqual([`Already logged as #${original}; your note is #${saved[1]?.id}`]);
  });

  it('stores a link sent without a scheme as https, and gives the reply time to be remembered', async () => {
    await deliver(message('nytimes.com/2026/x', ['nytimes.com/2026/x']));
    const [row] = await asSuperuser<{ url: string; due_in: number }>(
      `SELECT url, round(extract(epoch FROM next_fetch_at - now()))::int AS due_in FROM app.inbox_items`,
    );
    expect(row?.url).toBe('https://nytimes.com/2026/x');
    // The worker can't claim it before the "Saved #n" reply is remembered (R-CAP-7).
    expect(row?.due_in).toBeGreaterThanOrEqual(8);
    expect(row?.due_in).toBeLessThanOrEqual(10);
  });

  it('saves the item even when the reply can’t be sent', async () => {
    telegram.failing = true;
    await deliver(message('https://example.com/a', ['https://example.com/a']));
    expect(await items()).toMatchObject([{ status: 'queued', reply_message_id: null }]);
    expect(replyErrors).toHaveLength(1);
  });
});

describe('commands (R-CAP-8)', () => {
  it('/pending lists the unlogged items', async () => {
    await insertItem({ url: 'https://example.com/a', status: 'queued', fetch_status: 'pending' });
    await insertItem({ url: 'https://example.com/b', page_title: 'A title' });
    await insertItem({ status: 'logged' });
    await deliver(command('/pending'));
    expect(texts()).toEqual(['#1 · example.com (queued)\n#2 · A title (ready)']);
  });

  it('/discard drops an item and names it, so a wrong id shows at once', async () => {
    const id = await insertItem({ url: 'https://example.com/a', page_title: 'OpenAI cuts ties' });
    await deliver(command(`/discard ${id} duplicate of #40`));
    expect(texts()).toEqual([`Discarded #${id} · OpenAI cuts ties`]);
    expect(await items()).toMatchObject([
      { status: 'discarded', discard_reason: 'duplicate of #40' },
    ]);
  });

  it('/restore brings a discarded item back and says where to (AC-10)', async () => {
    const id = await insertItem({ url: 'https://example.com/a', status: 'discarded' });
    await deliver(command(`/restore ${id}`));
    expect(texts()).toEqual([`Restored #${id} · example.com (ready)`]);
  });

  it('/note adds to an item’s note', async () => {
    const id = await insertItem({ url: 'https://example.com/a' });
    await deliver(command(`/note #${id} see also the BOE`));
    expect(texts()).toEqual([`Noted on #${id} · example.com`]);
    expect((await items())[0]?.note).toMatch(/\] see also the BOE$/);
  });

  it('/note on a logged item makes a follow-up, so /news sees the note (R-CAP-6)', async () => {
    const id = await insertItem({ url: 'https://example.com/a', status: 'logged' });
    await deliver(command(`/note ${id} correction: it was 2025`));
    const saved = await items();
    expect(saved).toHaveLength(2);
    expect(saved[1]).toMatchObject({ url: null, status: 'needs_review', follows_up: String(id) });
    expect(saved[1]?.note).toMatch(/\] correction: it was 2025$/);
    expect(saved[0]?.note).toBe('');
    expect(texts()).toEqual([
      `#${id} · example.com is logged; your note is #${saved[1]?.id}, for /news`,
    ]);
  });

  it('/discard again without a reason keeps the reason', async () => {
    const id = await insertItem({ url: 'https://example.com/a' });
    await deliver(command(`/discard ${id} paywalled`));
    await deliver(command(`/discard ${id}`));
    expect(await items()).toMatchObject([{ status: 'discarded', discard_reason: 'paywalled' }]);
  });

  it('explains how to use a command, and what went wrong', async () => {
    const logged = await insertItem({ status: 'logged' });
    for (const text of [
      '/discard',
      '/note 3',
      '/restore',
      '/restore x',
      '/discard 99',
      `/discard ${logged}`,
      '/frobnicate',
    ]) {
      await deliver(command(text));
    }
    expect(texts()).toEqual([
      'Usage: /discard <id> [reason]',
      'Usage: /note <id> <text>',
      'Usage: /restore <id>, /restore <post>, /restore image <post> [lead|<source number>], or /restore entity <id>',
      // Not an item's number: a post's name (R-CAP-11).
      'No post x',
      'No item #99',
      `Item #${logged} is logged: it can't be discarded`,
      "I don't know /frobnicate. Send /help for the commands.",
    ]);
  });

  it('/help and /start explain the bot', async () => {
    await deliver(command('/help'));
    await deliver(command('/start'));
    expect(texts()).toHaveLength(2);
    expect(texts()[0]).toContain('/pending');
    expect(texts()[0]).toContain('/takedown entity <id>');
  });

  it('runs a redelivered command once', async () => {
    const update = command('/pending');
    await deliver(update);
    await deliver(update);
    expect(texts()).toEqual(['Nothing pending.']);
  });
});

describe('what Dani wants from an item: a post, or the log only (D18)', () => {
  it('saves a plain link to be posted, and `/log <link> [note]` to be logged only', async () => {
    await deliver(message('see https://example.com/a', ['https://example.com/a']));
    await deliver(
      commandWithLinks('/log https://example.com/b background only', ['https://example.com/b']),
    );
    expect(await items()).toMatchObject([
      { url: 'https://example.com/a', intent: 'post', status: 'queued' },
      { url: 'https://example.com/b', intent: 'log', status: 'queued' },
    ]);
    expect((await items())[1]?.note).toMatch(/\] background only$/);
    expect(texts()).toEqual(['Saved #1', 'Saved #2 · log only']);
  });

  it('`/log` on a link already saved adds the note as usual and makes the item log only', async () => {
    const id = await insertItem({ url: 'https://example.com/a', page_title: 'A title' });
    await deliver(
      commandWithLinks('/log https://example.com/a not for the site', ['https://example.com/a']),
    );
    expect(await items()).toMatchObject([{ id: String(id), intent: 'log' }]);
    expect((await items())[0]?.note).toMatch(/\] not for the site$/);
    expect(texts()).toEqual([`Already saved #${id} (ready); note added · log only`]);
  });

  it('`/log <id>` and `/post <id>` switch an item and name it, so a wrong id shows at once', async () => {
    const id = await insertItem({ url: 'https://example.com/a', page_title: 'OpenAI cuts ties' });
    await deliver(command(`/log ${id}`));
    await deliver(command(`/log #${id}`));
    await deliver(command(`/post ${id}`));
    await deliver(command(`/post ${id}`));
    expect(texts()).toEqual([
      `Log only: #${id} · OpenAI cuts ties`,
      `Already log only: #${id} · OpenAI cuts ties`,
      `To post: #${id} · OpenAI cuts ties`,
      `Already to post: #${id} · OpenAI cuts ties`,
    ]);
    expect(await items()).toMatchObject([{ intent: 'post' }]);
  });

  it('refuses a discarded item, and warns about a logged one, whose post may already be up', async () => {
    const discarded = await insertItem({ url: 'https://example.com/a', status: 'discarded' });
    const logged = await insertItem({ url: 'https://example.com/b', status: 'logged' });
    await deliver(command(`/log ${discarded}`));
    await deliver(command(`/log ${logged}`));
    expect(texts()).toEqual([
      `Item #${discarded} is discarded: restore it first (/restore ${discarded})`,
      `Log only: #${logged} · example.com\n#${logged} was already logged: a post may already be on the site (/takedown removes it).`,
    ]);
    expect(await items()).toMatchObject([{ intent: 'post' }, { intent: 'log', status: 'logged' }]);
  });

  it('explains /log and /post, and says when there is no such item', async () => {
    for (const text of ['/log', '/post', '/post soon', '/log 3 extra', '/post 99']) {
      await deliver(command(text));
    }
    expect(texts()).toEqual([
      'Usage: /log <link> [note], or /log <id>',
      'Usage: /post <id>',
      'Usage: /post <id>',
      'Usage: /log <link> [note], or /log <id>',
      'No item #99',
    ]);
  });

  it('/pending marks the items to log only', async () => {
    await insertItem({ url: 'https://example.com/a', page_title: 'For the site' });
    const quiet = await insertItem({ url: 'https://example.com/b', page_title: 'Background' });
    await deliver(command(`/log ${quiet}`));
    telegram.reset();
    await deliver(command('/pending'));
    expect(texts()).toEqual(['#1 · For the site (ready)\n#2 · Background (ready) · log only']);
  });
});

describe('the site’s switches (R-CAP-10, R-CAP-11)', () => {
  const LEAD = 'a'.repeat(64);
  const PREVIEW = 'b'.repeat(64);

  /** A published story in both languages; the Spanish one with a lead image and a source preview. */
  const story = async () => {
    for (const sha256 of [LEAD, PREVIEW]) {
      await asSuperuser(
        `INSERT INTO app.images (sha256, width, height, full_bytes, thumb_bytes) VALUES ($1, 10, 10, 1, 2)`,
        [sha256],
      );
    }
    const sources = JSON.stringify([
      { title: 'Fuente', url: 'https://example.com/a', accessed: '2026-10-01' },
      {
        title: 'Otra',
        url: 'https://example.org/b',
        accessed: '2026-10-01',
        preview: { sha256: PREVIEW, credit: 'example.org' },
      },
    ]);
    const image = JSON.stringify({
      sha256: LEAD,
      alt: 'Ejemplo',
      credit: 'Autora de ejemplo',
      licence: 'CC BY 4.0',
      source_url: 'https://example.com/foto',
    });
    await asSuperuser(
      `INSERT INTO app.posts (slug, lang, type, title, body_md, published_at, content_ref, news_date, sources, image)
       VALUES ('informe-ficticio', 'es', 'breve', 'Un informe ficticio', 'Texto.', '2026-10-01', '{}', '2026-09-30', $1, $2)`,
      [sources, image],
    );
    await asSuperuser(
      `INSERT INTO app.posts (slug, lang, type, title, body_md, published_at, content_ref, news_date,
         translation_of_lang, translation_of_slug)
       VALUES ('fictional-report', 'en', 'breve', 'A fictional report', 'Text.', '2026-10-01', '{}', '2026-09-30',
         'es', 'informe-ficticio')`,
    );
  };
  const takenDown = async () =>
    (
      await asSuperuser<{ slug: string }>(
        'SELECT slug FROM app.posts WHERE taken_down_at IS NOT NULL ORDER BY slug',
      )
    ).map((row) => row.slug);
  const removed = async () =>
    (
      await asSuperuser<{ sha256: string }>(
        'SELECT sha256 FROM app.images WHERE removed_at IS NOT NULL ORDER BY sha256',
      )
    ).map((row) => row.sha256.slice(0, 1));
  const imagesMode = async () =>
    (await asSuperuser<{ images: string }>('SELECT images FROM app.site_settings'))[0]?.images;

  it('/images says the switch, and sets it: off, licensed, on', async () => {
    await deliver(command('/images'));
    await deliver(command('/images off'));
    expect(await imagesMode()).toBe('none');
    await deliver(command('/images licensed'));
    expect(await imagesMode()).toBe('licensed');
    await deliver(command('/images on'));
    expect(await imagesMode()).toBe('all');
    await deliver(command('/images sideways'));
    expect(texts()).toEqual([
      expect.stringContaining('Images on'),
      expect.stringContaining('Images off: the site shows none'),
      expect.stringContaining('licensed only'),
      expect.stringContaining('Images on'),
      'Usage: /images [on|licensed|off]',
    ]);
  });

  it('/takedown hides a story at once, named any way Dani has it, and /restore brings it back', async () => {
    await story();
    await deliver(command('/takedown https://pandoria.example/en/fictional-report'));
    expect(await takenDown()).toEqual(['fictional-report']);
    expect(texts().at(-1)).toContain(
      'Taken down: “A fictional report” (en/fictional-report) and es/informe-ficticio',
    );
    await deliver(command('/takedown informe-ficticio'));
    expect(await takenDown()).toEqual(['fictional-report', 'informe-ficticio']);
    // Restored through either version, the whole story comes back.
    await deliver(command('/restore es/informe-ficticio'));
    expect(await takenDown()).toEqual([]);
    expect(texts().at(-1)).toContain('Restored: “Un informe ficticio”');
    await deliver(command('/takedown es/no-such-post'));
    expect(texts().at(-1)).toBe('No post es/no-such-post');
  });

  it('/takedown image hides a post’s images, its lead image or one preview, and /restore image undoes it', async () => {
    await story();
    await deliver(command('/takedown image es/informe-ficticio 2'));
    expect(await removed()).toEqual(['b']);
    expect(texts().at(-1)).toContain('source 2’s preview (example.org)');
    await deliver(command('/takedown image en/fictional-report'));
    // The English version shares the story: with no choice, both versions' images go.
    expect(await removed()).toEqual(['a', 'b']);
    await deliver(command('/restore image es/informe-ficticio lead'));
    expect(await removed()).toEqual(['b']);
    await deliver(command('/restore image es/informe-ficticio'));
    expect(await removed()).toEqual([]);
    // The posts themselves were never touched.
    expect(await takenDown()).toEqual([]);
  });

  it('/takedown entity hides an entity at once, by its id or its page’s address, and /restore entity brings it back (R-CAP-12)', async () => {
    await asSuperuser(
      `INSERT INTO app.entities (id, type, name, description_es, description_en, content_ref)
       VALUES ('example-lab', 'organisation', 'Example Lab', 'Un laboratorio ficticio.', 'A fictional lab.', '{}')`,
    );
    const hidden = async () =>
      (
        await asSuperuser<{ id: string }>(
          'SELECT id FROM app.entities WHERE taken_down_at IS NOT NULL ORDER BY id',
        )
      ).map((row) => row.id);
    await deliver(command('/takedown entity https://pandoria.example/en/who/example-lab'));
    expect(await hidden()).toEqual(['example-lab']);
    expect(texts().at(-1)).toContain('Hidden: “Example Lab” (example-lab).');
    await deliver(command('/takedown entity example-lab'));
    expect(texts().at(-1)).toBe(
      '“Example Lab” (example-lab) is already hidden. /restore entity example-lab brings it back.',
    );
    await deliver(command('/restore entity /quien/example-lab'));
    expect(await hidden()).toEqual([]);
    expect(texts().at(-1)).toContain('Restored: “Example Lab” (example-lab).');
    await deliver(command('/restore entity example-lab'));
    expect(texts().at(-1)).toBe('“Example Lab” (example-lab) isn’t hidden.');
    await deliver(command('/takedown entity no-such-lab'));
    expect(texts().at(-1)).toBe('No entity no-such-lab');
    await deliver(command('/takedown entity'));
    expect(texts().at(-1)).toBe('Usage: /takedown entity <id>');
    await deliver(command('/restore entity Not An Id'));
    expect(texts().at(-1)).toBe('Name the entity by its id, or its page’s address on the site');
    // The posts were never touched.
    expect(await takenDown()).toEqual([]);
  });

  it('keeps /restore <id> for the inbox', async () => {
    const id = await insertItem({ status: 'discarded' });
    await deliver(command(`/restore ${id}`));
    expect(texts().at(-1)).toMatch(/^Restored #\d+/);
  });
});
