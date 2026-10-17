import type { Database } from '@aisafety-newsroom/db/client';

import { type Lang } from '@aisafety-newsroom/domain/languages';
import { sql } from 'kysely';

import { markRemoved } from '../images/data.js';

/**
 * The bot's emergency switches (R-CAP-10, R-CAP-11): what to do from a phone at 11 pm when an agency writes about a
 * photo, without the Mac or a deploy. They act on the database the public views read on every request, so the site
 * follows at once. aisafety-media stays the record: its `/post` sees a takedown and records the decision (R-MED-7).
 */

/** Which images the site shows (app.site_settings): every one, licensed lead images only, or none. */
export type ImagesMode = 'all' | 'licensed' | 'none';

const MODE_WORDS: Readonly<Record<string, ImagesMode>> = {
  on: 'all',
  all: 'all',
  licensed: 'licensed',
  off: 'none',
  none: 'none',
};

const MODE_REPLIES: Readonly<Record<ImagesMode, string>> = {
  all: 'Images on: lead images and the sources’ previews show.',
  licensed: 'Images: licensed only. The sources’ previews are hidden; lead images show.',
  none: 'Images off: the site shows none (the share cards stay). /images on brings them back.',
};

/** `/images [on|off|licensed]`: says the switch, or sets it. */
export const imagesCommand = async (db: Database, args: string): Promise<string> => {
  if (args === '') {
    const row = await db.selectFrom('app.site_settings').select('images').executeTakeFirst();
    const mode = (row?.images ?? 'none') as ImagesMode;
    return `${MODE_REPLIES[mode]}\nChange it with /images on, /images licensed or /images off.`;
  }
  const mode = MODE_WORDS[args.toLowerCase()];
  if (mode === undefined) {
    return 'Usage: /images [on|licensed|off]';
  }
  const updated = await db
    .updateTable('app.site_settings')
    .set({ images: mode })
    .returning('images')
    .executeTakeFirst();
  if (!updated) {
    // No settings row: the views already show no image (they fail closed), but say so rather than pretend.
    return 'The site has no image switch (its settings row is missing): it shows no images.';
  }
  return MODE_REPLIES[mode];
};

interface PostRow {
  lang: Lang;
  slug: string;
  title: string;
  translation_of_lang: Lang | null;
  translation_of_slug: string | null;
  image: unknown;
  sources: unknown;
  taken_down_at: Date | null;
}

/**
 * A post as Dani names it: `es/<slug>`, `en/<slug>`, a bare slug (Spanish first, since Spanish is at the root), or an
 * address copied from the site, `https://<site>/<slug>` or `…/en/<slug>`, whose path alone counts.
 */
const POST_PATH = /^\/?(?:(es|en)\/)?([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/;

const postPath = (reference: string): string => {
  const text = reference.trim();
  return /^https?:\/\//i.test(text) && URL.canParse(text) ? new URL(text).pathname : text;
};

const POST_COLUMNS = [
  'lang',
  'slug',
  'title',
  'translation_of_lang',
  'translation_of_slug',
  'image',
  'sources',
  'taken_down_at',
] as const;

const findPost = async (db: Database, reference: string): Promise<PostRow | string> => {
  const match = POST_PATH.exec(postPath(reference));
  const slug = match?.[2];
  if (slug === undefined) {
    return 'Name the post as es/<slug>, en/<slug>, its slug, or its address on the site';
  }
  const languages: Lang[] =
    match?.[1] === 'en' ? ['en'] : match?.[1] === 'es' ? ['es'] : ['es', 'en'];
  for (const lang of languages) {
    const row = await db
      .selectFrom('app.posts')
      .select(POST_COLUMNS)
      .where('lang', '=', lang)
      .where('slug', '=', slug)
      .executeTakeFirst();
    if (row) {
      return row;
    }
  }
  return `No post ${languages.length === 1 ? `${languages[0]}/` : ''}${slug}`;
};

/** The story's other version (D11): its original if it's a translation, its translation if not. */
const otherVersion = async (db: Database, post: PostRow): Promise<PostRow | undefined> =>
  db
    .selectFrom('app.posts')
    .select(POST_COLUMNS)
    .where((eb) =>
      post.translation_of_lang !== null && post.translation_of_slug !== null
        ? eb.and([
            eb('lang', '=', post.translation_of_lang),
            eb('slug', '=', post.translation_of_slug),
          ])
        : eb.and([
            eb('translation_of_lang', '=', post.lang),
            eb('translation_of_slug', '=', post.slug),
          ]),
    )
    .executeTakeFirst();

const name = (post: { lang: Lang; slug: string }): string => `${post.lang}/${post.slug}`;

/** `/takedown <post>`: the story leaves the site at once, both versions (410), until `/restore`. */
const takeDown = async (db: Database, reference: string): Promise<string> => {
  const post = await findPost(db, reference);
  if (typeof post === 'string') {
    return post;
  }
  if (post.taken_down_at !== null) {
    return `“${post.title}” (${name(post)}) is already taken down. /restore ${name(post)} brings it back.`;
  }
  await db
    .updateTable('app.posts')
    .set({ taken_down_at: sql<Date>`now()` })
    .where('lang', '=', post.lang)
    .where('slug', '=', post.slug)
    .execute();
  const other = await otherVersion(db, post);
  return [
    `Taken down: “${post.title}” (${name(post)})${other ? ` and ${name(other)}` : ''}. Their pages answer 410 now.`,
    `Record it in aisafety-media (/post sees it), or /restore ${name(post)} to bring it back.`,
  ].join('\n');
};

/** `/restore <post>`: undoes a takedown, whichever version it was made on. */
export const restorePost = async (db: Database, reference: string): Promise<string> => {
  const post = await findPost(db, reference);
  if (typeof post === 'string') {
    return post;
  }
  const other = await otherVersion(db, post);
  const versions = [post, ...(other ? [other] : [])].filter(
    (version) => version.taken_down_at !== null,
  );
  if (versions.length === 0) {
    return `“${post.title}” (${name(post)}) isn’t taken down.`;
  }
  for (const version of versions) {
    await db
      .updateTable('app.posts')
      .set({ taken_down_at: null })
      .where('lang', '=', version.lang)
      .where('slug', '=', version.slug)
      .execute();
  }
  return `Restored: “${post.title}” (${name(post)}). It shows again if it’s published.`;
};

interface NamedImage {
  sha256: string;
  what: string;
}

const leadOf = (post: PostRow): NamedImage[] => {
  const image = post.image as { sha256?: unknown; credit?: unknown } | null;
  return typeof image?.sha256 === 'string'
    ? [
        {
          sha256: image.sha256,
          what: `the lead image of ${name(post)}${typeof image.credit === 'string' ? ` (${image.credit})` : ''}`,
        },
      ]
    : [];
};

const previewsOf = (post: PostRow, only?: number): NamedImage[] =>
  (Array.isArray(post.sources)
    ? (post.sources as { preview?: { sha256?: unknown; credit?: unknown } }[])
    : []
  ).flatMap((source, index) =>
    typeof source.preview?.sha256 === 'string' && (only === undefined || only === index + 1)
      ? [
          {
            sha256: source.preview.sha256,
            what: `source ${index + 1}’s preview${typeof source.preview.credit === 'string' ? ` (${source.preview.credit})` : ''}`,
          },
        ]
      : [],
  );

/**
 * `/takedown image <post> [lead|<n>]` and `/restore image …`: the post's images, both versions' with no choice, its
 * lead image, or one source's preview. Removed images stay hidden wherever they're used, until restored.
 */
const imagesAction = async (db: Database, args: string, remove: boolean): Promise<string> => {
  const [reference = '', choice = ''] = args.split(/\s+/);
  const verb = remove ? 'takedown' : 'restore';
  if (reference === '') {
    return `Usage: /${verb} image <post> [lead|<source number>]`;
  }
  const post = await findPost(db, reference);
  if (typeof post === 'string') {
    return post;
  }
  let images: NamedImage[];
  if (choice === '') {
    const other = await otherVersion(db, post);
    images = [post, ...(other ? [other] : [])].flatMap((version) => [
      ...leadOf(version),
      ...previewsOf(version),
    ]);
  } else if (choice === 'lead') {
    images = leadOf(post);
  } else if (/^\d{1,2}$/.test(choice)) {
    images = previewsOf(post, Number(choice));
  } else {
    return `Usage: /${verb} image <post> [lead|<source number>]`;
  }
  if (images.length === 0) {
    return `${name(post)} has no such image.`;
  }
  const changed = new Set(
    await markRemoved(
      db,
      images.map((image) => image.sha256),
      remove,
    ),
  );
  const affected = images.filter(
    (image, index) =>
      changed.has(image.sha256) &&
      images.findIndex((other) => other.sha256 === image.sha256) === index,
  );
  if (affected.length === 0) {
    return remove ? 'Already removed.' : 'Already shown: nothing was removed.';
  }
  const list = affected.map((image) => `• ${image.what}`).join('\n');
  return remove
    ? `Removed from the site, wherever it’s used:\n${list}\n/restore image ${name(post)} brings it back.`
    : `Restored:\n${list}`;
};

/** `/takedown …`: a post, or with `image`, its images. */
export const takedownCommand = async (db: Database, args: string): Promise<string> => {
  if (args === '') {
    return 'Usage: /takedown <post>, or /takedown image <post> [lead|<source number>]';
  }
  const [first = '', ...rest] = args.split(/\s+/);
  return first.toLowerCase() === 'image'
    ? imagesAction(db, rest.join(' '), true)
    : takeDown(db, args);
};

/** `/restore image …`, the images' half of `/restore` (the bot's restore of an inbox item stays as it was). */
export const restoreImages = (db: Database, args: string): Promise<string> =>
  imagesAction(db, args, false);
