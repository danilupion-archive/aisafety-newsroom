import type { Database } from '@aisafety-newsroom/db/client';
import type { FastifyInstance } from 'fastify';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';
import { appDatabase, emptyTables, publicDatabase } from './db.js';

const TOKEN = 'a'.repeat(43);
const auth = { authorization: `Bearer ${TOKEN}` };

/** About 100 words of obviously fictional Spanish, with a word to find in it. */
const body = (word: string) =>
  Array.from(
    { length: 10 },
    (_, i) => `Frase de ejemplo número ${i + 1} sobre un laboratorio ficticio y su ${word}.`,
  ).join(' ');
const enBody = (word: string) =>
  Array.from(
    { length: 10 },
    (_, i) => `Example sentence number ${i + 1} about a fictional lab and its ${word}.`,
  ).join(' ');

const BREVE = {
  type: 'breve',
  title: 'Un laboratorio ficticio publica su informe',
  summary: 'Resumen de ejemplo.',
  body_md: body('informe'),
  sources: [
    { title: 'Informe de ejemplo', url: 'https://example.com/informe', accessed: '2026-10-15' },
  ],
  tags: ['labs'],
  published_at: '2026-10-15T10:00:00+02:00',
  news_date: '2026-10-14',
  content_ref: { path: 'posts/es/2026-10-15-ejemplo.md', commit: 'abc1234' },
};
const EN_BREVE = {
  ...BREVE,
  title: 'A fictional lab publishes its report',
  summary: 'Example summary.',
  body_md: enBody('report'),
  content_ref: { path: 'posts/en/2026-10-15-example.md', commit: 'abc1234' },
};

let db: Database;
let publicDb: Database;
let app: FastifyInstance;

beforeAll(() => {
  db = appDatabase();
  publicDb = publicDatabase();
  app = buildApp({ apiToken: TOKEN, db, publicDb });
});

afterAll(async () => {
  await app.close();
  await db.destroy();
  await publicDb.destroy();
});

beforeEach(async () => {
  await emptyTables();
});

const put = async (address: string, payload: object) => {
  const response = await app.inject({
    method: 'PUT',
    url: `/api/v1/posts/${address}`,
    headers: auth,
    payload,
  });
  expect(response.statusCode, response.body).toBeLessThan(300);
};

/** A published story in both languages (D11): the site searches only what it shows. */
const story = async (slug: string, enSlug: string, es: object = {}, en: object = {}) => {
  await put(`es/${slug}`, { ...BREVE, ...es });
  await put(`en/${enSlug}`, { ...EN_BREVE, ...en, translation_of: { lang: 'es', slug } });
};

type Answer = { results: Result[]; next: number | null };
type Result = { slug: string; title: string; excerpt: Segment[] };
type Segment = { text: string; match: boolean };

const search = async (query: string) => {
  const response = await app.inject({ method: 'GET', url: `/public/search?${query}` });
  return { status: response.statusCode, body: response.json<Answer>() };
};
const found = async (query: string) => (await search(query)).body.results.map((row) => row.slug);

describe('GET /public/search (R-WEB-18)', () => {
  it('finds published posts in the asked language only, the title outranking the summary and the body', async () => {
    await story('en-el-texto', 'in-the-text', {
      body_md: `${body('nada')} Al final, la regulación.`,
    });
    await story('en-el-titulo', 'in-the-title', {
      title: 'La regulación de un laboratorio ficticio',
    });
    await story('en-el-resumen', 'in-the-summary', { summary: 'Un resumen sobre regulación.' });
    await story('sin-ella', 'without-it');
    expect(await found('lang=es&q=regulación')).toEqual([
      'en-el-titulo',
      'en-el-resumen',
      'en-el-texto',
    ]);
    expect(await found('lang=en&q=regulación')).toEqual([]);
  });

  it('matches the language’s forms of a word, with or without its accents', async () => {
    await story('regular', 'to-regulate', {
      title: 'Un laboratorio ficticio quiere regular la IA',
    });
    await story('regulacion', 'regulation', { title: 'La regulación de un laboratorio ficticio' });
    expect(await found('lang=es&q=regulación')).toContain('regulacion');
    // Typed without its accent, as readers often do.
    expect(await found('lang=es&q=regulacion')).toContain('regulacion');
    expect(await found('lang=en&q=regulations')).toEqual([]);
    await story('otro', 'regulations-again', {}, { title: 'Fictional regulations for a lab' });
    expect(await found('lang=en&q=regulation')).toEqual(['regulations-again']);
  });

  it('takes a reader’s search syntax: quoted phrases, OR and a minus', async () => {
    const plain = { body_md: body('nada') };
    await story('frase', 'phrase', { ...plain, title: 'Un informe sobre pérdida de control' });
    await story('palabras', 'words', { ...plain, title: 'El control de una pérdida ficticia' });
    await story('otra', 'other', { ...plain, title: 'Una auditoría ficticia' });
    expect(await found('lang=es&q="pérdida de control"')).toEqual(['frase']);
    expect(await found('lang=es&q=pérdida -informe')).toEqual(['palabras']);
    expect((await found('lang=es&q=auditoría OR informe')).sort()).toEqual(['frase', 'otra']);
  });

  it('gives each result an excerpt with the matched words marked, as plain text', async () => {
    await story('con-enlace', 'with-link', {
      body_md: `Según [un **informe** ficticio](https://example.org/x), la <b>regulación</b> llega. ${body('nada')}`,
    });
    const [result] = (await search('lang=es&q=regulación')).body.results;
    expect(
      result?.excerpt.some((segment) => segment.match && /regulación/i.test(segment.text)),
    ).toBe(true);
    const text = result?.excerpt.map((segment) => segment.text).join('') ?? '';
    // No Markdown link target or emphasis marks; the post's own text, never its markup, decides what's shown.
    expect(text).not.toContain('https://example.org');
    expect(text).not.toContain('**');
    // oxlint-disable-next-line no-control-regex -- the excerpt's marks must never reach the text
    expect(text).not.toMatch(/[\u0002\u0003]/);
  });

  it('never searches pages or unpublished posts', async () => {
    await story('visible', 'visible-en', { title: 'Un laboratorio ficticio y su auditoría' });
    await put('es/sobre', {
      ...BREVE,
      type: 'page',
      title: 'Sobre la auditoría',
      body_md: 'Una auditoría de ejemplo.',
      sources: [],
      news_date: undefined,
    });
    await story('retirada', 'withdrawn', { title: 'Una auditoría retirada' });
    await app.inject({ method: 'DELETE', url: '/api/v1/posts/es/retirada', headers: auth });
    expect(await found('lang=es&q=auditoría')).toEqual(['visible']);
  });

  it('pages its results, and says where the next page starts', async () => {
    for (let i = 0; i < 5; i++) {
      const day = { published_at: `2026-10-1${i}T10:00:00+02:00`, news_date: `2026-10-1${i}` };
      await story(`caso-${i}`, `case-${i}`, { ...day, title: `Un caso ficticio número ${i}` }, day);
    }
    const first = await search('lang=es&q=caso&limit=2');
    expect(first.body.results).toHaveLength(2);
    expect(first.body.next).toBe(2);
    const last = await search('lang=es&q=caso&limit=2&cursor=4');
    expect(last.body.results).toHaveLength(1);
    expect(last.body.next).toBeNull();
  });

  it('refuses an empty or overlong query, and a query in no language', async () => {
    expect((await search('lang=es&q=')).status).toBe(400);
    expect((await search('lang=es&q=%20%20')).status).toBe(400);
    expect((await search(`lang=es&q=${'a'.repeat(101)}`)).status).toBe(400);
    expect((await search('q=informe')).status).toBe(400);
    expect((await search('lang=es&q=informe&limit=51')).status).toBe(400);
  });

  it('answers a query of nothing but common words with no results, not an error', async () => {
    await story('algo', 'something');
    const answer = await search('lang=es&q=de la el');
    expect(answer.status).toBe(200);
    expect(answer.body.results).toEqual([]);
  });
});
