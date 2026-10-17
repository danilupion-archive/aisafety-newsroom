import type { Database } from '@aisafety-newsroom/db/client';

import { sql } from 'kysely';

import type { ProcessedImage } from './process.js';
import type { ImageStore } from './store.js';

/** What the posts API says of a stored image (§13 `GET /images/:sha256`): never its bytes. */
export interface ImageInfo {
  sha256: string;
  width: number;
  height: number;
  full_bytes: number;
  thumb_bytes: number;
  created_at: Date;
  removed_at: Date | null;
}

const info = [
  'sha256',
  'width',
  'height',
  sql<number>`octet_length(full_webp)`.as('full_bytes'),
  sql<number>`octet_length(thumb_webp)`.as('thumb_bytes'),
  'created_at',
  'removed_at',
] as const;

export const imageInfo = async (db: Database, sha256: string): Promise<ImageInfo | undefined> =>
  db.selectFrom('app.images').select(info).where('sha256', '=', sha256).executeTakeFirst();

/**
 * Stores an image unless it's there already (R-API-3): the same upload twice is one image, and an image that was
 * removed stays removed (R-CAP-11). `created` says whether this upload stored it.
 */
export const storeImage = async (
  db: Database,
  sha256: string,
  image: ProcessedImage,
): Promise<{ created: boolean; image: ImageInfo }> => {
  const inserted = await db
    .insertInto('app.images')
    .values({
      sha256,
      width: image.width,
      height: image.height,
      full_webp: image.full,
      thumb_webp: image.thumb,
    })
    .onConflict((conflict) => conflict.column('sha256').doNothing())
    .returning(info)
    .executeTakeFirst();
  if (inserted) {
    return { created: true, image: inserted };
  }
  const existing = await imageInfo(db, sha256);
  if (!existing) {
    throw new Error('An image that conflicted on insert is missing');
  }
  return { created: false, image: existing };
};

/** Which of these images aren't stored: a post may name only images uploaded before it (R-API-5). */
export const missingImages = async (db: Database, hashes: readonly string[]): Promise<string[]> => {
  if (hashes.length === 0) {
    return [];
  }
  const found = await db
    .selectFrom('app.images')
    .select('sha256')
    .where('sha256', 'in', [...hashes])
    .execute();
  const stored = new Set(found.map((row) => row.sha256));
  return [...new Set(hashes)].filter((hash) => !stored.has(hash));
};

/**
 * Removes images from the site, or restores them (R-CAP-11): marked, never deleted, so a later push naming one can't
 * bring it back. Returns the images whose mark changed.
 */
export const markRemoved = async (
  db: Database,
  hashes: readonly string[],
  removed: boolean,
): Promise<string[]> => {
  if (hashes.length === 0) {
    return [];
  }
  const rows = await db
    .updateTable('app.images')
    .set({ removed_at: removed ? sql<Date>`now()` : null })
    .where('sha256', 'in', [...hashes])
    .where('removed_at', removed ? 'is' : 'is not', null)
    .returning('sha256')
    .execute();
  return rows.map((row) => row.sha256);
};

const BYTES = { full: 'full_webp as bytes', thumb: 'thumb_webp as bytes' } as const;

/** How many images the database holds, how many the store has both files of, and the first few it lacks. */
export interface ImageCensus {
  store: 'files' | 'database';
  count: number;
  on_disk: number | null;
  missing: string[];
}

/** For checking the store before the database stops keeping images' bytes (D22, step 2). */
export const imageCensus = async (
  db: Database,
  store: ImageStore | undefined,
): Promise<ImageCensus> => {
  const rows = await db.selectFrom('app.images').select('sha256').orderBy('sha256').execute();
  if (!store) {
    return { store: 'database', count: rows.length, on_disk: null, missing: [] };
  }
  const missing: string[] = [];
  for (const { sha256 } of rows) {
    if (!(await store.has(sha256, 'full')) || !(await store.has(sha256, 'thumb'))) {
      missing.push(sha256);
    }
  }
  return {
    store: 'files',
    count: rows.length,
    on_disk: rows.length - missing.length,
    missing: missing.slice(0, 10),
  };
};

/**
 * Copies into the store every image's file the database holds and the store doesn't (D22): removed images too, so a
 * restore finds them. One image at a time, so its memory stays small; idempotent, and harmless with both API replicas
 * running it at once.
 */
export const backfillImages = async (
  db: Database,
  store: ImageStore,
): Promise<{ checked: number; copied: number }> => {
  const rows = await db.selectFrom('app.images').select('sha256').orderBy('sha256').execute();
  let copied = 0;
  for (const { sha256 } of rows) {
    for (const size of ['full', 'thumb'] as const) {
      if (await store.has(sha256, size)) {
        continue;
      }
      const row = await db
        .selectFrom('app.images')
        .select(BYTES[size])
        .where('sha256', '=', sha256)
        .executeTakeFirst();
      if (row?.bytes) {
        await store.write(sha256, size, row.bytes);
        copied += 1;
      }
    }
  }
  return { checked: rows.length, copied };
};
