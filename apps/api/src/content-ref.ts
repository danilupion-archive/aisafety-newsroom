import { z } from 'zod';

/**
 * Where a pushed post or entity came from in aisafety-media, the record (P1): its Markdown file and the commit it was
 * pushed from. Never public.
 */
export const contentRef = z.strictObject({
  path: z
    .string()
    .max(300)
    .regex(/^[\w./-]+\.md$/, 'content_ref.path is a Markdown file’s path in aisafety-media'),
  commit: z.string().regex(/^[0-9a-f]{7,40}$/, 'content_ref.commit is a git commit'),
});
