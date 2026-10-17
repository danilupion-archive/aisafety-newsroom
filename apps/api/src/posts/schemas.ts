import { type Lang, LANGS, PATH_WORDS, RESERVED_SLUGS } from '@aisafety-newsroom/domain/languages';
import { wordCount } from '@aisafety-newsroom/domain/markdown';
import { z } from 'zod';

import { tag } from '../inbox/schemas.js';

export type { Lang };

/** The site's languages (R-WEB-4, D10): each post is written in one of them, at /<lang>/<slug>. */
export const lang = z.enum(LANGS, { error: 'a language is es or en' });

/** A post's address within its language: lowercase words joined by hyphens, as aisafety-media names it. */
export const slug = z
  .string()
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'a slug is lowercase words joined by hyphens');

/**
 * Why a slug can't take this post in this language, or undefined if it can. The site's own path words and the root's
 * are taken in both languages (RESERVED_SLUGS); the about page is pushed as a page under its language's word (R-WEB-3).
 */
export const reservedSlug = (language: Lang, name: string, type: string): string | undefined =>
  RESERVED_SLUGS.has(name) && !(name === PATH_WORDS[language].about && type === 'page')
    ? `${name} is one of the site's own paths`
    : undefined;

/** An image a post names: uploaded first (`PUT /images/:sha256`), by the SHA-256 of its bytes (R-API-5). */
const sha256 = z
  .string()
  .regex(/^[0-9a-f]{64}$/, 'an image is named by the SHA-256 of its bytes, in lowercase hex');

/**
 * A source's preview (R-WEB-16): the outlet's own image for the page, small, beside the link, credited to the outlet.
 * Copies of the outlets' photos: the bot's switches take them down (R-CAP-10, R-CAP-11).
 */
const preview = z.strictObject({ sha256, credit: z.string().trim().min(1).max(100) });

/** A source as the site lists it (R-WEB-1): its title, its link and when it was checked, and its preview if any. */
const source = z.strictObject({
  title: z.string().trim().min(1).max(300),
  url: z.url({ protocol: /^https?$/ }),
  accessed: z.iso.date(),
  preview: preview.optional(),
});

/**
 * A post's lead image (R-WEB-15): one under a clear licence (a Commons file, a press kit, a public-domain image), never
 * AI-generated (R-WEB-3), with its alt text in the post's language, who to credit, under what licence, and where it
 * came from.
 */
const image = z.strictObject({
  sha256,
  alt: z.string().trim().min(1).max(300),
  credit: z.string().trim().min(1).max(200),
  licence: z.string().trim().min(1).max(100),
  source_url: z.url({ protocol: /^https?$/ }),
});

/**
 * R-WEB-1: a breve is 80 to 150 words in the language it's written in, with 1 to 3 sources; its translation says the
 * same at whatever length that takes, with no limit of its own (D15). An article is long form and lists its sources
 * too. A page (the about page) is the site's own text: no sources, never listed.
 */
export const BREVE_WORDS = { min: 80, max: 150 };
const BREVE_SOURCES = { min: 1, max: 3 };

const fields = z.strictObject({
  type: z.enum(['breve', 'article', 'page']),
  title: z.string().trim().min(1).max(300),
  summary: z.string().trim().max(600).default(''),
  body_md: z.string().min(1).max(200_000),
  sources: z.array(source).max(50),
  tags: z.array(tag).max(10),
  published_at: z.union([z.iso.datetime({ offset: true }), z.iso.date()]),
  /**
   * The day the story happened, as its original source dates it (R-WEB-13): a calendar day. A page never has one. A
   * breve or an article pushed without it (a client older than news dates) is dated by its posted day. Both versions of
   * a story have the same one, or the site shows neither.
   */
  news_date: z.iso.date().optional(),
  /** Its lead image (R-WEB-15), or none. A page has none. */
  image: image.nullable().default(null),
  /**
   * Who wrote it, when a person did (R-WEB-3, D19): their name as the site shows it. None, it's written by AI and
   * checked by the editor. Each version has its own: a translation without one, of a signed original, is an AI one.
   */
  author: z.string().trim().min(1).max(100).nullable().default(null),
  /** The post this one translates, in the other language (R-WEB-10); none for an original. */
  translation_of: z.strictObject({ lang, slug }).nullable().default(null),
  /**
   * A rebuild (R-WEB-8) restores an unpublished post as unpublished, in one step, so it never shows: its address
   * answers 410 again and its translation can name it. Any other push publishes.
   */
  unpublished: z.boolean().default(false),
  content_ref: z.strictObject({
    path: z
      .string()
      .max(300)
      .regex(/^[\w./-]+\.md$/, 'content_ref.path is a Markdown file’s path in aisafety-media'),
    commit: z.string().regex(/^[0-9a-f]{7,40}$/, 'content_ref.commit is a git commit'),
  }),
});

const bodyIn = (language: Lang) =>
  fields.superRefine((post, context) => {
    if (post.translation_of?.lang === language) {
      context.addIssue({
        code: 'custom',
        path: ['translation_of'],
        message: 'a translation is of a post in the other language',
      });
    }
    if (post.type === 'page' && post.image !== null) {
      context.addIssue({ code: 'custom', path: ['image'], message: 'a page has no image' });
    }
    if (post.type === 'page' && post.news_date !== undefined) {
      context.addIssue({
        code: 'custom',
        path: ['news_date'],
        message: 'a page has no news date',
      });
    }
    if (post.type !== 'page' && post.sources.length === 0) {
      context.addIssue({
        code: 'custom',
        path: ['sources'],
        message: 'every post lists its sources',
      });
    }
    if (post.type === 'breve') {
      const words = wordCount(post.body_md);
      const { min, max } = BREVE_WORDS;
      if (post.translation_of === null && (words < min || words > max)) {
        context.addIssue({
          code: 'custom',
          path: ['body_md'],
          message: `a breve is ${min}–${max} words in the language it’s written in; this one has ${words}`,
        });
      }
      if (post.sources.length > BREVE_SOURCES.max) {
        context.addIssue({
          code: 'custom',
          path: ['sources'],
          message: `a breve has ${BREVE_SOURCES.min}–${BREVE_SOURCES.max} sources`,
        });
      }
    }
  });

/** `PUT /posts/:lang/:slug` (§13): what aisafety-media's `/post` pushes, held to its language's rules. */
export const postBody: Record<Lang, ReturnType<typeof bodyIn>> = {
  es: bodyIn('es'),
  en: bodyIn('en'),
};

export type PostBody = z.output<typeof fields>;

/** Every image a post names, its lead image and its sources' previews, each once. */
export const imagesOf = (post: Pick<PostBody, 'image' | 'sources'>): string[] => [
  ...new Set([
    ...(post.image ? [post.image.sha256] : []),
    ...post.sources.flatMap((entry) => (entry.preview ? [entry.preview.sha256] : [])),
  ]),
];

/** A post's address in the API's paths: `/posts/:lang/:slug`. */
export const postAddress = z.strictObject({ lang, slug });

export const publicListQuery = z
  .object({
    lang,
    tag: tag.optional(),
    limit: z.coerce.number().int().min(1).max(500).default(20),
    /**
     * `posted` (the default): latest published first. `news`: by the day each story happened, newest first, then as
     * posted (R-WEB-13).
     */
    order: z.enum(['posted', 'news']).default('posted'),
    /**
     * The next page starts after the last post shown: its `published_at`, and its slug for posts that share that
     * instant (a list is ordered by both). `before` alone gives the posts published before it. In news order the last
     * post's news date leads (`before_date`); alone, it gives the stories from before that day.
     */
    before: z.iso.datetime({ offset: true }).optional(),
    before_slug: slug.optional(),
    before_date: z.iso.date().optional(),
  })
  .refine((query) => query.before_slug === undefined || query.before !== undefined, {
    path: ['before_slug'],
    message: 'before_slug goes with before',
  })
  .refine((query) => query.before_date === undefined || query.order === 'news', {
    path: ['before_date'],
    message: 'before_date goes with order=news',
  })
  .refine(
    (query) =>
      query.order !== 'news' || query.before === undefined || query.before_date !== undefined,
    { path: ['before'], message: 'in news order, before goes with before_date' },
  );

export const publicTagsQuery = z.object({ lang });
