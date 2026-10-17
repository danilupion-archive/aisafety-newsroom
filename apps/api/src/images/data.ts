import type { Database } from '@aisafety-newsroom/db/client';

import { sql } from 'kysely';

import type { ProcessedImage } from './process.js';

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
