import { describe, expect, it } from 'vitest';

import { renderMarkdown, wordCount } from './markdown.js';

describe('renderMarkdown (R-WEB-5)', () => {
  it('renders paragraphs, emphasis and links', () => {
    expect(renderMarkdown('Un *texto* con [enlace](https://example.com).')).toBe(
      '<p>Un <em>texto</em> con <a href="https://example.com">enlace</a>.</p>\n',
    );
  });

  it('escapes raw HTML instead of passing it through', () => {
    const html = renderMarkdown('<script>alert(1)</script> <b onclick="x()">negrita</b>');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<b ');
    expect(html).toContain('&lt;script&gt;');
  });

  it('loads no image and links nowhere but http(s) and mailto', () => {
    expect(renderMarkdown('![x](https://tracker.example/x.gif)')).not.toContain('<img');
    expect(renderMarkdown('[x](javascript:alert(1))')).not.toContain('href="javascript');
    expect(renderMarkdown('[x](data:text/html,hi)')).not.toContain('href="data');
    expect(renderMarkdown('[x](mailto:a@example.com)')).toContain('href="mailto:a@example.com"');
  });

  it('starts headings one level below the page’s own h1', () => {
    expect(renderMarkdown('# Sección')).toBe('<h2>Sección</h2>\n');
  });
});

describe('wordCount (R-WEB-1)', () => {
  it('counts the words a reader reads, not the Markdown around them', () => {
    expect(wordCount('Un **texto** con [un enlace](https://example.com/largo/camino).')).toBe(5);
    expect(wordCount('# Título\n\n- uno\n- dos')).toBe(3);
  });

  it('counts words with accents, apostrophes and hyphens as one', () => {
    expect(wordCount('Pérdida de control: el "fin" del país o l’avenir, multi-agente.')).toBe(10);
  });

  it('counts nothing in an empty text', () => {
    expect(wordCount('   ')).toBe(0);
  });
});
