import type pg from 'pg';

import { describe, expect, it } from 'vitest';

import { failure, inRolledBackTransaction } from './db.js';

const LEAD = 'a'.repeat(64);
const PREVIEW = 'b'.repeat(64);
const UNUSED = 'c'.repeat(64);

/** A stored image: the bytes don't matter here, only that the row exists. */
const insertImage = (client: pg.Client, sha256: string) =>
  client.query(
    `INSERT INTO app.images (sha256, width, height, full_webp, thumb_webp)
     VALUES ($1, 1200, 800, '\\x01'::bytea, '\\x02'::bytea)`,
    [sha256],
  );

/**
 * A published story in both languages (D11), the Spanish version with a lead image and a source with a preview, the
 * English one with the same source and preview, as a translation carries them.
 */
const insertStory = async (client: pg.Client) => {
  await insertImage(client, LEAD);
  await insertImage(client, PREVIEW);
  await insertImage(client, UNUSED);
  const sources = JSON.stringify([
    { title: 'Una fuente', url: 'https://example.com/a', accessed: '2026-10-01' },
    {
      title: 'Otra fuente',
      url: 'https://example.com/b',
      accessed: '2026-10-01',
      preview: { sha256: PREVIEW, credit: 'example.com' },
    },
  ]);
  const image = JSON.stringify({
    sha256: LEAD,
    alt: 'Una imagen de ejemplo',
    credit: 'Autora de ejemplo',
    licence: 'CC BY 4.0',
    source_url: 'https://example.com/foto',
  });
  await client.query(
    `INSERT INTO app.posts (slug, lang, type, title, body_md, published_at, content_ref, news_date, sources, image)
     VALUES ('con-imagen', 'es', 'breve', 'Con imagen', 'Texto.', '2026-10-01', '{}', '2026-09-30', $1, $2)`,
    [sources, image],
  );
  await client.query(
    `INSERT INTO app.posts (slug, lang, type, title, body_md, published_at, content_ref, news_date, sources,
       translation_of_lang, translation_of_slug)
     VALUES ('with-image', 'en', 'breve', 'With image', 'Text.', '2026-10-01', '{}', '2026-09-30', $1, 'es',
       'con-imagen')`,
    [sources],
  );
};

/** What newsroom_public sees: each post's image and previews, and the files it may serve. */
const publicView = async (client: pg.Client) => {
  await client.query('SET LOCAL ROLE newsroom_public');
  const posts = await client.query<{
    slug: string;
    image: { sha256: string; width: number; height: number } | null;
    sources: { preview?: { sha256: string } }[];
  }>('SELECT slug, image, sources FROM app.published_posts ORDER BY lang DESC');
  const files = await client.query<{ sha256: string; kind: string }>(
    'SELECT sha256, kind FROM app.public_images ORDER BY kind, sha256',
  );
  await client.query('RESET ROLE');
  return {
    lead: posts.rows.find((post) => post.slug === 'con-imagen')?.image ?? null,
    previews: posts.rows.map((post) =>
      post.sources.flatMap((source) => (source.preview ? [source.preview.sha256] : [])),
    ),
    files: files.rows.map((file) => `${file.kind}:${file.sha256.slice(0, 1)}`),
  };
};

describe('app.images', () => {
  it('keys an image by the SHA-256 of what was sent, in hex', async () => {
    await inRolledBackTransaction(async (client) => {
      for (const sha256 of ['A'.repeat(64), 'a'.repeat(63), 'g'.repeat(64)]) {
        expect(
          await failure(
            client,
            `INSERT INTO app.images (sha256, width, height, full_webp, thumb_webp)
             VALUES ($1, 1, 1, '\\x01', '\\x01')`,
            [sha256],
          ),
        ).toEqual({ code: '23514', constraint: 'images_sha256_format' });
      }
    });
  });

  it('gives a page no image', async () => {
    await inRolledBackTransaction(async (client) => {
      expect(
        await failure(
          client,
          `INSERT INTO app.posts (slug, lang, type, title, body_md, published_at, content_ref, image)
           VALUES ('sobre', 'es', 'page', 'Sobre', 'Texto.', now(), '{}', '{"sha256": "x"}')`,
        ),
      ).toEqual({ code: '23514', constraint: 'posts_page_has_no_image' });
    });
  });
});

describe('images on the public site (D17)', () => {
  it('shows a published post’s lead image with its size, its previews, and serves only those files', async () => {
    const seen = await inRolledBackTransaction(async (client) => {
      await insertStory(client);
      return publicView(client);
    });
    expect(seen.lead).toMatchObject({
      sha256: LEAD,
      width: 1200,
      height: 800,
      alt: 'Una imagen de ejemplo',
    });
    expect(seen.previews).toEqual([[PREVIEW], [PREVIEW]]);
    // The upload no published post names isn't public.
    expect(seen.files).toEqual(['lead:a', 'preview:b']);
  });

  it('hides the outlets’ previews but keeps licensed lead images when the switch says `licensed` (R-CAP-10)', async () => {
    const seen = await inRolledBackTransaction(async (client) => {
      await insertStory(client);
      await client.query("UPDATE app.site_settings SET images = 'licensed'");
      return publicView(client);
    });
    expect(seen.lead).toMatchObject({ sha256: LEAD });
    expect(seen.previews).toEqual([[], []]);
    expect(seen.files).toEqual(['lead:a']);
  });

  it('hides every image when the switch says `none`, and when there is no switch at all (fails closed)', async () => {
    const seen = await inRolledBackTransaction(async (client) => {
      await insertStory(client);
      await client.query("UPDATE app.site_settings SET images = 'none'");
      const off = await publicView(client);
      await client.query('DELETE FROM app.site_settings');
      const missing = await publicView(client);
      return { off, missing };
    });
    for (const view of [seen.off, seen.missing]) {
      expect(view.lead).toBeNull();
      expect(view.previews).toEqual([[], []]);
      expect(view.files).toEqual([]);
    }
  });

  it('stops showing a removed image everywhere, whatever post names it, until it is restored (R-CAP-11)', async () => {
    const seen = await inRolledBackTransaction(async (client) => {
      await insertStory(client);
      await client.query('UPDATE app.images SET removed_at = now() WHERE sha256 = $1', [PREVIEW]);
      const removed = await publicView(client);
      await client.query('UPDATE app.images SET removed_at = NULL WHERE sha256 = $1', [PREVIEW]);
      const restored = await publicView(client);
      return { removed, restored };
    });
    expect(seen.removed.lead).toMatchObject({ sha256: LEAD });
    expect(seen.removed.previews).toEqual([[], []]);
    expect(seen.removed.files).toEqual(['lead:a']);
    expect(seen.restored.previews).toEqual([[PREVIEW], [PREVIEW]]);
  });

  it('keeps a source’s entry, and its order, when its preview is hidden', async () => {
    const sources = await inRolledBackTransaction(async (client) => {
      await insertStory(client);
      await client.query("UPDATE app.site_settings SET images = 'none'");
      await client.query('SET LOCAL ROLE newsroom_public');
      const { rows } = await client.query<{ sources: { title: string }[] }>(
        "SELECT sources FROM app.published_posts WHERE slug = 'con-imagen'",
      );
      return rows[0]?.sources;
    });
    expect(sources).toEqual([
      { title: 'Una fuente', url: 'https://example.com/a', accessed: '2026-10-01' },
      { title: 'Otra fuente', url: 'https://example.com/b', accessed: '2026-10-01' },
    ]);
  });
});

describe('takedowns (R-CAP-11)', () => {
  it('hides both versions of a taken-down story and answers 410 for both, until it is restored', async () => {
    const seen = await inRolledBackTransaction(async (client) => {
      await insertStory(client);
      await client.query("UPDATE app.posts SET taken_down_at = now() WHERE slug = 'with-image'");
      await client.query('SET LOCAL ROLE newsroom_public');
      const published = await client.query('SELECT slug FROM app.published_posts');
      const gone = await client.query<{ slug: string; unpublished_at: Date | null }>(
        'SELECT slug, unpublished_at FROM app.unpublished_posts ORDER BY slug',
      );
      const files = await client.query('SELECT FROM app.public_images');
      await client.query('RESET ROLE');
      await client.query("UPDATE app.posts SET taken_down_at = NULL WHERE slug = 'with-image'");
      const back = await client.query('SELECT slug FROM app.published_posts');
      return {
        published: published.rowCount,
        gone: gone.rows.map((row) => ({ slug: row.slug, dated: row.unpublished_at !== null })),
        files: files.rowCount,
        back: back.rowCount,
      };
    });
    expect(seen.published).toBe(0);
    expect(seen.gone).toEqual([
      { slug: 'con-imagen', dated: true },
      { slug: 'with-image', dated: true },
    ]);
    // Nor its images: they're public only while a published post shows them.
    expect(seen.files).toBe(0);
    expect(seen.back).toBe(2);
  });
});
