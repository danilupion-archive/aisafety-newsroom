import type { Database } from '@aisafety-newsroom/db/client';
import type { FastifyInstance } from 'fastify';

import { mkdir, mkdtemp, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';
import { imageInfo } from '../src/images/data.js';
import { sha256Of } from '../src/images/process.js';
import { createImageStore, type ImageStore } from '../src/images/store.js';
import { appDatabase, asSuperuser, emptyTables, publicDatabase } from './db.js';

const TOKEN = 'a'.repeat(43);
const auth = { authorization: `Bearer ${TOKEN}` };

const BODY = Array.from(
  { length: 10 },
  (_, i) => `Frase de ejemplo número ${i + 1} sobre un laboratorio ficticio y su informe.`,
).join(' ');
const EN_BODY = Array.from(
  { length: 10 },
  (_, i) => `Example sentence number ${i + 1} about a fictional lab and its report.`,
).join(' ');

/** A generated photo: a flat colour, wide, with an artist in its EXIF that the site must never pass on. */
const photo = (colour: string, width = 2400, height = 1200) =>
  sharp({ create: { width, height, channels: 3, background: colour } })
    .jpeg()
    .withExif({ IFD0: { Artist: 'Autora de ejemplo', Copyright: 'Ejemplo' } })
    .toBuffer();

let db: Database;
let publicDb: Database;
let app: FastifyInstance;
let lead: Buffer;
let preview: Buffer;
/** The images' volume (D22): a scratch folder, emptied before each test like the tables. */
let dir: string;
let store: ImageStore;
/** Every line the app logs, for checking what a missing file reports. */
const logs: string[] = [];

beforeAll(async () => {
  db = appDatabase();
  publicDb = publicDatabase();
  dir = await mkdtemp(join(tmpdir(), 'newsroom-images-'));
  store = createImageStore(dir);
  const logger = { level: 'info', stream: { write: (line: string) => logs.push(line) } };
  app = buildApp({ apiToken: TOKEN, db, publicDb, imageStore: store, logger });
  lead = await photo('#336699');
  preview = await photo('#996633', 800, 600);
});

afterAll(async () => {
  await app.close();
  await db.destroy();
  await publicDb.destroy();
  await rm(dir, { recursive: true, force: true });
});

beforeEach(async () => {
  await emptyTables();
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  logs.length = 0;
});

const upload = (bytes: Buffer, sha256 = sha256Of(bytes), contentType = 'image/jpeg') =>
  app.inject({
    method: 'PUT',
    url: `/api/v1/images/${sha256}`,
    headers: { ...auth, 'content-type': contentType },
    payload: bytes,
  });
const put = (address: string, payload: object) =>
  app.inject({ method: 'PUT', url: `/api/v1/posts/${address}`, headers: auth, payload });
const read = (url: string) => app.inject({ method: 'GET', url });

const imageOf = (bytes: Buffer) => ({
  sha256: sha256Of(bytes),
  alt: 'Una imagen de ejemplo, de un solo color',
  credit: 'Autora de ejemplo',
  licence: 'CC BY 4.0',
  source_url: 'https://example.com/foto',
});
const sourcesWith = (bytes: Buffer) => [
  { title: 'Informe de ejemplo', url: 'https://example.com/informe', accessed: '2026-10-15' },
  {
    title: 'Cobertura de ejemplo',
    url: 'https://example.org/noticia',
    accessed: '2026-10-15',
    preview: { sha256: sha256Of(bytes), credit: 'example.org' },
  },
];

const BREVE = {
  type: 'breve',
  title: 'Un laboratorio ficticio publica su informe',
  summary: 'Resumen de ejemplo.',
  body_md: BODY,
  sources: [
    { title: 'Informe de ejemplo', url: 'https://example.com/informe', accessed: '2026-10-15' },
  ],
  tags: ['labs'],
  published_at: '2026-10-15T10:00:00+02:00',
  news_date: '2026-10-14',
  content_ref: { path: 'posts/es/2026-10-15-informe-de-ejemplo.md', commit: 'abc1234' },
};
const EN_BREVE = {
  ...BREVE,
  title: 'A fictional lab publishes its report',
  body_md: EN_BODY,
  content_ref: { path: 'posts/en/2026-10-15-example-report.md', commit: 'abc1234' },
};

/** A published story whose Spanish version has a lead image and a source with a preview, both uploaded first. */
const storyWithImages = async () => {
  expect((await upload(lead)).statusCode).toBe(201);
  expect((await upload(preview)).statusCode).toBe(201);
  const es = await put('es/con-imagen', {
    ...BREVE,
    image: imageOf(lead),
    sources: sourcesWith(preview),
  });
  expect(es.statusCode, es.body).toBe(201);
  const en = await put('en/with-image', {
    ...EN_BREVE,
    sources: sourcesWith(preview),
    translation_of: { lang: 'es', slug: 'con-imagen' },
  });
  expect(en.statusCode, en.body).toBe(201);
};

const setImages = (mode: string) => asSuperuser('UPDATE app.site_settings SET images = $1', [mode]);

describe('PUT /api/v1/images/:sha256 (R-API-5)', () => {
  it('stores an image at its own SHA-256, re-encoded within its size, and the same upload twice changes nothing', async () => {
    const first = await upload(lead);
    expect(first.statusCode).toBe(201);
    expect(first.json()).toMatchObject({
      sha256: sha256Of(lead),
      width: 1600,
      height: 800,
      removed_at: null,
    });
    const again = await upload(lead);
    expect(again.statusCode).toBe(200);
    expect(again.json()).toMatchObject({ sha256: sha256Of(lead), width: 1600 });
    expect(
      (
        await app.inject({ method: 'GET', url: `/api/v1/images/${sha256Of(lead)}`, headers: auth })
      ).json(),
    ).toMatchObject({ width: 1600, height: 800 });
  });

  it('refuses bytes whose SHA-256 isn’t the address, and anything without the token', async () => {
    const wrong = await upload(lead, sha256Of(preview));
    expect(wrong.statusCode).toBe(400);
    expect(wrong.json().error).toContain('not the one in its address');
    const anonymous = await app.inject({
      method: 'PUT',
      url: `/api/v1/images/${sha256Of(lead)}`,
      headers: { 'content-type': 'image/jpeg' },
      payload: lead,
    });
    expect(anonymous.statusCode).toBe(401);
  });

  it('takes raster images only: never SVG, nor bytes that aren’t an image', async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>',
    );
    expect((await upload(svg, sha256Of(svg), 'image/svg+xml')).statusCode).toBe(415);
    expect((await upload(svg, sha256Of(svg), 'application/octet-stream')).statusCode).toBe(415);
    const junk = Buffer.from('not an image at all, just text');
    expect((await upload(junk, sha256Of(junk), 'image/png')).statusCode).toBe(400);
    expect(await asSuperuser('SELECT sha256 FROM app.images')).toEqual([]);
  });

  it('keeps an image removed by the bot removed when it is uploaded again (R-CAP-11)', async () => {
    await upload(lead);
    await asSuperuser('UPDATE app.images SET removed_at = now()');
    expect((await upload(lead)).json().removed_at).not.toBeNull();
  });
});

describe('a post’s images (R-WEB-15, R-WEB-16)', () => {
  it('refuses a post naming an image that isn’t uploaded, and a page with an image', async () => {
    const missing = await put('es/sin-subir', { ...BREVE, image: imageOf(lead) });
    expect(missing.statusCode).toBe(400);
    expect(missing.json().error).toBe(
      `Image ${sha256Of(lead)} isn’t uploaded: PUT /api/v1/images/${sha256Of(lead)} first`,
    );
    await upload(lead);
    const page = await put('es/sobre', {
      type: 'page',
      title: 'Cómo se hace',
      body_md: 'Texto de ejemplo.',
      sources: [],
      tags: [],
      published_at: '2026-10-15',
      content_ref: { path: 'posts/es/sobre.md', commit: 'abc1234' },
      image: imageOf(lead),
    });
    expect(page.json()).toEqual({ error: 'image: a page has no image' });
  });

  it('wants alt text, a credit, a licence and where it came from; a preview wants its outlet', async () => {
    await upload(lead);
    const { alt: _, ...noAlt } = imageOf(lead);
    expect((await put('es/sin-alt', { ...BREVE, image: noAlt })).statusCode).toBe(400);
    const noCredit = sourcesWith(lead).map((source) =>
      source.preview ? { ...source, preview: { sha256: source.preview.sha256 } } : source,
    );
    expect((await put('es/sin-credito', { ...BREVE, sources: noCredit })).statusCode).toBe(400);
  });

  it('shows a published post’s lead image with its size, its previews, and serves their files from the site’s side', async () => {
    await storyWithImages();
    const post = (await read('/public/posts/es/con-imagen')).json();
    expect(post.image).toMatchObject({ ...imageOf(lead), width: 1600, height: 800 });
    expect(post.sources[1].preview).toEqual({ sha256: sha256Of(preview), credit: 'example.org' });
    const listed = (await read('/public/posts?lang=es')).json<{ image: unknown }[]>();
    expect(listed[0]?.image).toMatchObject({ sha256: sha256Of(lead) });

    const full = await read(`/public/images/lead/${sha256Of(lead)}`);
    expect(full.statusCode).toBe(200);
    expect(full.headers['content-type']).toBe('image/webp');
    const metadata = await sharp(full.rawPayload).metadata();
    expect(metadata).toMatchObject({ format: 'webp', width: 1600, height: 800 });
    // Nothing of the original's metadata: no EXIF (its artist), no colour profile.
    expect(metadata.exif).toBeUndefined();
    expect(metadata.icc).toBeUndefined();
    const thumb = await read(`/public/images/preview/${sha256Of(preview)}?size=thumb`);
    expect((await sharp(thumb.rawPayload).metadata()).width).toBe(480);
    // As another kind than a post shows it, or never named by a published post: no file.
    expect((await read(`/public/images/preview/${sha256Of(lead)}`)).statusCode).toBe(404);
    const unused = await photo('#00aa00', 50, 50);
    await upload(unused);
    expect((await read(`/public/images/lead/${sha256Of(unused)}`)).statusCode).toBe(404);
  });

  it('lists each post with its first source preview, for a card without a lead image (R-WEB-16)', async () => {
    await storyWithImages();
    type Listed = { slug: string; preview: unknown };
    const listed = (await read('/public/posts?lang=es')).json<Listed[]>();
    expect(listed.find((row) => row.slug === 'con-imagen')?.preview).toEqual({
      sha256: sha256Of(preview),
      credit: 'example.org',
      source_url: sourcesWith(preview)[1]?.url,
    });
    await setImages('licensed');
    const hidden = (await read('/public/posts?lang=es')).json<Listed[]>();
    expect(hidden.find((row) => row.slug === 'con-imagen')?.preview).toBeNull();
  });

  it('lists a video source’s still before an earlier source’s image, so the card can play it (R-WEB-12)', async () => {
    const still = await photo('#223344', 640, 360);
    expect((await upload(preview)).statusCode).toBe(201);
    expect((await upload(still)).statusCode).toBe(201);
    const video = {
      title: 'Una charla de ejemplo',
      url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
      accessed: '2026-10-15',
      preview: { sha256: sha256Of(still), credit: 'Canal de ejemplo' },
    };
    const sources = [sourcesWith(preview)[1], video];
    expect((await put('es/con-video', { ...BREVE, sources })).statusCode).toBe(201);
    const en = { ...EN_BREVE, sources, translation_of: { lang: 'es', slug: 'con-video' } };
    expect((await put('en/with-video', en)).statusCode).toBe(201);
    type Listed = { slug: string; preview: { source_url?: string } | null };
    const listed = (await read('/public/posts?lang=es')).json<Listed[]>();
    expect(listed.find((row) => row.slug === 'con-video')?.preview).toEqual({
      sha256: sha256Of(still),
      credit: 'Canal de ejemplo',
      source_url: video.url,
    });
  });

  it('follows the switch on the next request: `licensed` hides previews, `none` every image (R-CAP-10)', async () => {
    await storyWithImages();
    await setImages('licensed');
    let post = (await read('/public/posts/es/con-imagen')).json();
    expect(post.image).toMatchObject({ sha256: sha256Of(lead) });
    expect(post.sources[1]).not.toHaveProperty('preview');
    expect((await read(`/public/images/preview/${sha256Of(preview)}`)).statusCode).toBe(404);
    expect((await read(`/public/images/lead/${sha256Of(lead)}`)).statusCode).toBe(200);

    await setImages('none');
    post = (await read('/public/posts/es/con-imagen')).json();
    expect(post.image).toBeNull();
    expect((await read('/public/posts?lang=es')).json<{ image: unknown }[]>()[0]?.image).toBeNull();
    expect((await read(`/public/images/lead/${sha256Of(lead)}`)).statusCode).toBe(404);
  });
});

describe('takedowns (R-CAP-11)', () => {
  it('keeps a story taken down whatever a push says, and lists when for aisafety-media to reconcile', async () => {
    await storyWithImages();
    await asSuperuser("UPDATE app.posts SET taken_down_at = now() WHERE slug = 'con-imagen'");
    expect((await read('/public/posts/es/con-imagen')).statusCode).toBe(410);
    expect((await read('/public/posts/en/with-image')).statusCode).toBe(410);
    // A push, a rebuild's included, doesn't bring it back: only the bot's /restore does.
    await put('es/con-imagen', { ...BREVE, image: imageOf(lead), sources: sourcesWith(preview) });
    expect((await read('/public/posts/es/con-imagen')).statusCode).toBe(410);
    const listed = (await app.inject({ method: 'GET', url: '/api/v1/posts', headers: auth })).json<
      { slug: string; taken_down_at: string | null }[]
    >();
    expect(listed.find((post) => post.slug === 'con-imagen')?.taken_down_at).not.toBeNull();
    expect(listed.find((post) => post.slug === 'with-image')?.taken_down_at).toBeNull();
  });
});

describe('images’ files on a volume, and only there (D22)', () => {
  it('writes an upload’s two files and a row that keeps what the image is, never its bytes', async () => {
    expect((await upload(lead)).statusCode).toBe(201);
    const full = await store.read(sha256Of(lead), 'full');
    expect((await sharp(full).metadata()).width).toBe(1600);
    expect(await store.has(sha256Of(lead), 'thumb')).toBe(true);
    const [row] = await asSuperuser<{ bytes: boolean; full_bytes: number }>(
      'SELECT full_webp IS NOT NULL OR thumb_webp IS NOT NULL AS bytes, full_bytes FROM app.images WHERE sha256 = $1',
      [sha256Of(lead)],
    );
    expect(row).toEqual({ bytes: false, full_bytes: full?.length });
    expect((await imageInfo(db, sha256Of(lead)))?.full_bytes).toBe(full?.length);
  });

  it('serves the volume’s bytes once the database allows the image; a missing file is a 404 and an error naming it', async () => {
    await storyWithImages();
    const sha = sha256Of(preview);
    await writeFile(join(dir, `${sha}.thumb.webp`), 'from the volume');
    const served = await read(`/public/images/preview/${sha}?size=thumb`);
    expect(served.statusCode).toBe(200);
    expect(served.body).toBe('from the volume');
    // The database still decides: a switched-off preview isn't served, whatever the volume holds.
    await setImages('licensed');
    expect((await read(`/public/images/preview/${sha}?size=thumb`)).statusCode).toBe(404);
    await setImages('all');
    // No database to fall back on: a file the volume lost is a 404, and the log names the image, nothing else.
    await unlink(join(dir, `${sha}.thumb.webp`));
    logs.length = 0;
    expect((await read(`/public/images/preview/${sha}?size=thumb`)).statusCode).toBe(404);
    const reported = logs.map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(reported).toContainEqual(
      expect.objectContaining({
        level: 50,
        sha256: sha,
        size: 'thumb',
        msg: 'an image file is missing',
      }),
    );
    expect(await store.has(sha, 'thumb')).toBe(false);
  });

  it('writes an image’s files again when the same upload comes back after they were lost', async () => {
    expect((await upload(lead)).statusCode).toBe(201);
    await unlink(join(dir, `${sha256Of(lead)}.webp`));
    const again = await upload(lead);
    expect(again.statusCode).toBe(200);
    expect(await store.has(sha256Of(lead), 'full')).toBe(true);
  });

  it('counts the images and the ones whose files the volume lacks', async () => {
    await storyWithImages();
    const census = () => app.inject({ method: 'GET', url: '/api/v1/images', headers: auth });
    expect((await census()).json()).toEqual({ store: 'files', count: 2, on_disk: 2, missing: [] });
    await unlink(join(dir, `${sha256Of(lead)}.thumb.webp`));
    expect((await census()).json()).toEqual({
      store: 'files',
      count: 2,
      on_disk: 1,
      missing: [sha256Of(lead)],
    });
    expect((await read('/api/v1/images')).statusCode).toBe(401);
  });

  it('without a volume, stores and serves no image: the image routes answer 503', async () => {
    const bare = buildApp({ apiToken: TOKEN, db, publicDb });
    try {
      const uploaded = await bare.inject({
        method: 'PUT',
        url: `/api/v1/images/${sha256Of(lead)}`,
        headers: { ...auth, 'content-type': 'image/jpeg' },
        payload: lead,
      });
      expect(uploaded.statusCode).toBe(503);
      expect(uploaded.json().error).toContain('IMAGES_DIR');
      const census = await bare.inject({ method: 'GET', url: '/api/v1/images', headers: auth });
      expect(census.statusCode).toBe(503);
      const served = await bare.inject({
        method: 'GET',
        url: `/public/images/lead/${sha256Of(lead)}`,
      });
      expect(served.statusCode).toBe(503);
    } finally {
      await bare.close();
    }
  });
});
