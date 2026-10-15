import MarkdownIt from 'markdown-it';

/**
 * Posts' Markdown, rendered here and only here (R-WEB-5), as aiontheballot renders its texts: raw HTML is escaped,
 * never passed through; images are off (a post can't load anything, and no AI-generated image can slip in, R-WEB-3);
 * links go only to http(s) and mailto addresses; headings start one level below the page's own h1. What this returns
 * is safe to put in a page.
 */
const markdown = new MarkdownIt({ html: false, linkify: false, typographer: false }).disable([
  'image',
]);

markdown.validateLink = (url: string): boolean => /^(?:https?:|mailto:)/iu.test(url.trim());

markdown.core.ruler.push('shift_headings', (state) => {
  for (const token of state.tokens) {
    if (token.type === 'heading_open' || token.type === 'heading_close') {
      token.tag = `h${Math.min(6, Number(token.tag.slice(1)) + 1)}`;
    }
  }
});

export const renderMarkdown = (text: string): string => markdown.render(text);

const WORD = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;

/** The words a reader reads in a Markdown text: link addresses and Markdown's own marks don't count (R-WEB-1). */
export const wordCount = (text: string): number => {
  const plain = renderMarkdown(text)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z]+;|&#\d+;/gi, ' ');
  return plain.match(WORD)?.length ?? 0;
};
