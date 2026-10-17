import type { PostSummary } from './api';

/**
 * Who wrote a post (R-WEB-3, D19): by default AI, from the linked sources, which every card and post says; a person,
 * when the post names them; or AI translating a person's text, when a translation names no writer of its own but its
 * original does.
 */
export type Byline =
  { kind: 'ai' } | { kind: 'person'; author: string } | { kind: 'translation'; author: string };

export const bylineOf = (post: Pick<PostSummary, 'author' | 'original_author'>): Byline => {
  if (post.author) {
    return { kind: 'person', author: post.author };
  }
  if (post.original_author) {
    return { kind: 'translation', author: post.original_author };
  }
  return { kind: 'ai' };
};
