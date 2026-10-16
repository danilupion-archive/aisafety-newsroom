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

/** A source as the site lists it (R-WEB-1): its title, its link and when it was checked. */
const source = z.strictObject({
  title: z.string().trim().min(1).max(300),
  url: z.url({ protocol: /^https?$/ }),
  accessed: z.iso.date(),
});

/**
 * R-WEB-1: a breve is 80 to 150 words in Spanish with 1 to 3 sources; English says the same in about 15% fewer words,
 * so a faithful translation of a short breve still fits. An article is long form and lists its sources too. A page
 * (the about page) is the site's own text: no sources, never listed.
 */
export const BREVE_WORDS: Record<Lang, { min: number; max: number }> = {
  es: { min: 80, max: 150 },
  en: { min: 65, max: 130 },
};
const BREVE_SOURCES = { min: 1, max: 3 };

const fields = z.strictObject({
  type: z.enum(['breve', 'article', 'page']),
  title: z.string().trim().min(1).max(300),
  summary: z.string().trim().max(600).default(''),
  body_md: z.string().min(1).max(200_000),
  sources: z.array(source).max(50),
  tags: z.array(tag).max(10),
  published_at: z.union([z.iso.datetime({ offset: true }), z.iso.date()]),
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
    if (post.type !== 'page' && post.sources.length === 0) {
      context.addIssue({
        code: 'custom',
        path: ['sources'],
        message: 'every post lists its sources',
      });
    }
    if (post.type === 'breve') {
      const words = wordCount(post.body_md);
      const { min, max } = BREVE_WORDS[language];
      if (words < min || words > max) {
        context.addIssue({
          code: 'custom',
          path: ['body_md'],
          message: `a breve in ${language} is ${min}–${max} words; this one has ${words}`,
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

/** A post's address in the API's paths: `/posts/:lang/:slug`. */
export const postAddress = z.strictObject({ lang, slug });

export const publicListQuery = z
  .object({
    lang,
    tag: tag.optional(),
    limit: z.coerce.number().int().min(1).max(500).default(20),
    /**
     * The next page starts after the last post shown: its `published_at`, and its slug for posts that share that
     * instant (a list is ordered by both). `before` alone gives the posts published before it.
     */
    before: z.iso.datetime({ offset: true }).optional(),
    before_slug: slug.optional(),
  })
  .refine((query) => query.before_slug === undefined || query.before !== undefined, {
    path: ['before_slug'],
    message: 'before_slug goes with before',
  });

export const publicTagsQuery = z.object({ lang });
