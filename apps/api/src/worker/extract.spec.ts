import { describe, expect, it } from 'vitest';

import { extract, PAGE_TEXT_MAX } from './extract.js';

/** A minimal PDF with one line of text per page and an optional title: fictional text only. */
const pdf = (pages: string[], title?: string): Uint8Array => {
  const objects: string[] = [];
  const pageIds = pages.map((_, i) => 3 + i * 2);
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`;
  const font = 3 + pages.length * 2;
  pages.forEach((text, i) => {
    const page = pageIds[i] ?? 0;
    const stream = `BT /F1 12 Tf 72 712 Td (${text}) Tj ET`;
    objects[page] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${page + 1} 0 R ` +
      `/Resources << /Font << /F1 ${font} 0 R >> >> >>`;
    objects[page + 1] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });
  objects[font] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  const info = title === undefined ? undefined : font + 1;
  if (info !== undefined) {
    objects[info] = `<< /Title (${title}) >>`;
  }
  let body = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = body.length;
    body += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = body.length;
  body += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1) {
    body += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  }
  const infoRef = info === undefined ? '' : ` /Info ${info} 0 R`;
  body += `trailer\n<< /Size ${objects.length} /Root 1 0 R${infoRef} >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(body);
};

const html = (head: string, body: string): Uint8Array =>
  new TextEncoder().encode(
    `<!doctype html><html><head><meta charset="utf-8">${head}</head><body>${body}</body></html>`,
  );

const ARTICLE = `
  <nav><a href="/">Inicio</a> <a href="/tech">Tecnología</a></nav>
  <article>
    <h1>Un laboratorio de ejemplo publica su informe</h1>
    <p>El Laboratorio Ejemplo publicó el martes un informe de evaluación sobre su modelo ficticio, con resultados
       que, según sus autores, muestran comportamientos que no esperaban en las pruebas de control.</p>
    <p>El documento, de cuarenta páginas, describe las pruebas una por una y explica cómo las diseñaron, qué
       midieron y qué limitaciones tiene cada una de ellas, algo poco habitual en este tipo de informes.</p>
    <h2>Lo que dicen los expertos</h2>
    <p>Una investigadora ficticia, que no participó en el trabajo, dijo que los resultados son preliminares y que
       harán falta más estudios independientes antes de sacar conclusiones firmes sobre lo que significan.</p>
  </article>
  <footer>Aviso legal · Cookies</footer>`;

describe('extract (R-FET-2)', () => {
  it('reads a web page’s main text and its metadata, verbatim', async () => {
    const page = await extract(
      'text/html',
      html(
        `<title>Informe | Diario Ejemplo</title>
         <meta property="og:title" content="Un laboratorio de ejemplo publica su informe">
         <meta property="og:site_name" content="Diario Ejemplo">
         <meta property="article:published_time" content="2026-10-13T08:00:00+02:00">`,
        ARTICLE,
      ),
    );
    expect(page.title).toBe('Un laboratorio de ejemplo publica su informe');
    expect(page.siteName).toBe('Diario Ejemplo');
    expect(page.publishedAt).toBe('2026-10-13T08:00:00+02:00');
    expect(page.text).toContain('El Laboratorio Ejemplo publicó el martes');
    expect(page.text).toContain('Lo que dicen los expertos');
    expect(page.text).not.toContain('Aviso legal');
    expect(page.text).not.toContain('Inicio');
  });

  it('falls back to the page’s <title> and its first <time datetime>', async () => {
    const page = await extract(
      'text/html',
      html(
        '<title>Informe | Diario Ejemplo</title>',
        `<time datetime="2026-10-12">12 de octubre</time>${ARTICLE}`,
      ),
    );
    expect(page.title).toBe('Informe | Diario Ejemplo');
    expect(page.siteName).toBeNull();
    expect(page.publishedAt).toBe('2026-10-12');
  });

  it('runs no script and loads nothing from the page', async () => {
    const page = await extract(
      'text/html',
      html(
        '<title>T</title><script>globalThis.ran = true</script>',
        `${ARTICLE}<img src="https://tracker.example/x.gif">`,
      ),
    );
    expect((globalThis as { ran?: boolean }).ran).toBeUndefined();
    expect(page.text).toContain('Laboratorio Ejemplo');
  });

  it('reads a page in Latin-1 as it was written', async () => {
    const latin1 = Buffer.from(
      `<!doctype html><html><head><meta charset="iso-8859-1"><title>Información</title></head><body>${ARTICLE}</body></html>`,
      'latin1',
    );
    const page = await extract('text/html', latin1);
    expect(page.title).toBe('Información');
    expect(page.text).toContain('cuarenta páginas');
  });

  it('reads a page in the charset its server sent, when the page itself declares none', async () => {
    // "Новости" in windows-1251; read as windows-1252 it would be "Íîâîñòè".
    const title = Buffer.from([0xcd, 0xee, 0xe2, 0xee, 0xf1, 0xf2, 0xe8]);
    const html = Buffer.concat([
      Buffer.from('<!doctype html><html><head><title>'),
      title,
      Buffer.from(`</title></head><body>${ARTICLE}</body></html>`),
    ]);
    expect((await extract('text/html', html, 'windows-1251')).title).toBe('Новости');
    expect((await extract('text/plain', title, 'windows-1251')).text).toBe('Новости');
    // A label nobody knows is no charset at all.
    expect((await extract('text/plain', Buffer.from('plain'), 'x-unknown')).text).toBe('plain');
  });

  it('reads a PDF’s text and title', async () => {
    const page = await extract(
      'application/pdf',
      pdf(['Primera pagina del informe', 'Segunda pagina'], 'Informe Ejemplo'),
    );
    expect(page.title).toBe('Informe Ejemplo');
    expect(page.text).toContain('Primera pagina del informe');
    expect(page.text).toContain('Segunda pagina');
    expect(page.siteName).toBeNull();
  });

  it('reads plain text as it is', async () => {
    const page = await extract('text/plain', new TextEncoder().encode('Una nota en texto plano.'));
    expect(page).toEqual({
      title: null,
      siteName: null,
      publishedAt: null,
      text: 'Una nota en texto plano.',
    });
  });

  it('gives nothing for a type it can’t read', async () => {
    expect(await extract('image/png', new Uint8Array([0x89, 0x50]))).toEqual({
      title: null,
      siteName: null,
      publishedAt: null,
      text: null,
    });
  });

  it(`keeps at most ${PAGE_TEXT_MAX} characters of text, the database's limit`, async () => {
    const long = await extract('text/plain', new TextEncoder().encode('palabra '.repeat(10_000)));
    expect(long.text?.length).toBeLessThanOrEqual(PAGE_TEXT_MAX);
  });

  it('drops characters Postgres can’t store', async () => {
    const page = await extract('text/plain', new TextEncoder().encode('uno\u0000dos\u0007tres'));
    expect(page.text).toBe('unodos tres');
  });

  it('fails on bytes that are no PDF, for the worker to record', async () => {
    await expect(
      extract('application/pdf', new TextEncoder().encode('no es un PDF')),
    ).rejects.toThrow();
  });
});
