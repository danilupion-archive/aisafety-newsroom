import { INBOX_STATUSES } from '@aisafety-newsroom/domain/inbox';
import { z } from 'zod';

/** A watchlist tag, without its `#`: lowercase words joined by hyphens (aisafety-media `news/watchlist.md`). */
const tag = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'a tag is lowercase words joined by hyphens, without #');

export const itemId = z
  .string()
  .regex(/^[1-9]\d{0,14}$/, 'an item id is a positive whole number')
  .transform(Number);

export const listQuery = z.object({
  status: z
    .string()
    .optional()
    .transform((value) =>
      (value ?? 'ready,needs_review')
        .split(',')
        .map((part) => part.trim())
        .filter((part) => part !== ''),
    )
    .pipe(z.array(z.enum(INBOX_STATUSES)).min(1, 'status needs at least one status')),
  limit: z.coerce.number().int().min(1).max(50).default(50),
});

export const loggedBody = z.strictObject({
  news_file: z.string().regex(/^news\/\d{4}-\d{2}\.md$/, 'news_file is news/YYYY-MM.md'),
  entry_date: z.iso.date(),
  tags: z.array(tag).max(10),
  relevance: z.enum(['high', 'medium', 'low']),
});

export const discardedBody = z.strictObject({
  reason: z.string().trim().min(1).max(500),
});

export const noteBody = z.strictObject({
  text: z.string().trim().min(1).max(2000),
});

/** The first problem in a request, for `{ error }` (§9). */
export const describe = (error: z.ZodError): string => {
  const [issue] = error.issues;
  if (!issue) {
    return 'Invalid request';
  }
  const path = issue.path.join('.');
  return path ? `${path}: ${issue.message}` : issue.message;
};
