import { wordCount } from '@aisafety-newsroom/domain/markdown';
import { z } from 'zod';

import { tag } from '../inbox/schemas.js';

/** A post's address on the site: lowercase words joined by hyphens, as aisafety-media names it. */
export const slug = z
  .string()
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'a slug is lowercase words joined by hyphens');

/**
 * The site's own paths: posts live at the site's root (`/<slug>`), so these would be hidden behind the site's pages.
 * `sobre` is the about page itself, pushed as a page (R-WEB-3).
 */
const RESERVED = new Set(['sobre', 'temas', 'etiqueta', 'healthz']);

/** Why a slug can't take this post, or undefined if it can. */
export const reservedSlug = (name: string, type: string): string | undefined =>
  RESERVED.has(name) && !(name === 'sobre' && type === 'page')
    ? `${name} is one of the site's own paths`
    : undefined;

/** A source as the site lists it (R-WEB-1): its title, its link and when it was checked. */
const source = z.strictObject({
  title: z.string().trim().min(1).max(300),
  url: z.url({ protocol: /^https?$/ }),
  accessed: z.iso.date(),
});

/**
 * R-WEB-1: a breve is 80 to 150 words with 1 to 3 sources; an article is long form and lists its sources too. A page
 * (the about page) is the site's own text: no sources, never listed.
 */
const BREVE_WORDS = { min: 80, max: 150 };
const BREVE_SOURCES = { min: 1, max: 3 };

/** `PUT /posts/:slug` (§13): what aisafety-media's `/post` pushes. */
export const postBody = z
  .strictObject({
    type: z.enum(['breve', 'article', 'page']),
    title: z.string().trim().min(1).max(300),
    summary: z.string().trim().max(600).default(''),
    body_md: z.string().min(1).max(200_000),
    sources: z.array(source).max(50),
    tags: z.array(tag).max(10),
    published_at: z.union([z.iso.datetime({ offset: true }), z.iso.date()]),
    content_ref: z.strictObject({
      path: z
        .string()
        .max(300)
        .regex(/^[\w./-]+\.md$/, 'content_ref.path is a Markdown file’s path in aisafety-media'),
      commit: z.string().regex(/^[0-9a-f]{7,40}$/, 'content_ref.commit is a git commit'),
    }),
  })
  .superRefine((post, context) => {
    if (post.type !== 'page' && post.sources.length === 0) {
      context.addIssue({
        code: 'custom',
        path: ['sources'],
        message: 'every post lists its sources',
      });
    }
    if (post.type === 'breve') {
      const words = wordCount(post.body_md);
      if (words < BREVE_WORDS.min || words > BREVE_WORDS.max) {
        context.addIssue({
          code: 'custom',
          path: ['body_md'],
          message: `a breve is ${BREVE_WORDS.min}–${BREVE_WORDS.max} words; this one has ${words}`,
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

export type PostBody = z.output<typeof postBody>;

export const publicListQuery = z
  .object({
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
