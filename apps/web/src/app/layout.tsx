import type { Metadata, Viewport } from 'next';
import type { PropsWithChildren } from 'react';

import { css } from '@styled-system/css';
import Link from 'next/link';
import { connection } from 'next/server';

import { site } from '@/site';
import { column, muted } from '@/styles';

import './globals.css';

// Read when a page renders: without connection(), Next would prerender this at build time with the build's settings.
export const generateMetadata = async (): Promise<Metadata> => {
  await connection();
  const { name, url } = site();
  return {
    metadataBase: new URL(url),
    title: { default: name, template: `%s · ${name}` },
    alternates: { types: { 'application/atom+xml': [{ url: '/feed.xml', title: name }] } },
  };
};

// Zoom stays enabled: WCAG 2.2 AA requires text to be resizable.
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

const skipLink = css({
  position: 'absolute',
  left: '-9999px',
  _focus: { left: '4', top: '4', bg: 'page', padding: '2', zIndex: 1 },
});
// Width, style and colour apart: a `1px solid` shorthand would reset the colour, whichever rule lands last.
const header = css({
  borderBottomWidth: '1px',
  borderBottomStyle: 'solid',
  borderBottomColor: 'rule',
  paddingY: '4',
  marginBottom: '6',
});
const brand = css({ fontSize: 'lg', fontWeight: 'bold', color: 'text', textDecoration: 'none' });
const nav = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '4',
  listStyle: 'none',
  padding: '0',
  marginTop: '2',
});
const footer = css({
  borderTopWidth: '1px',
  borderTopStyle: 'solid',
  borderTopColor: 'rule',
  paddingY: '6',
  marginTop: '12',
});

/** Every page says who writes it and links to the about page (R-WEB-3). Spanish throughout (R-WEB-4). */
const RootLayout = async ({ children }: Readonly<PropsWithChildren>) => {
  await connection();
  const { name, author, analytics } = site();
  return (
    <html lang="es">
      <head>
        {analytics ? (
          <script defer data-domain={analytics.domain} src={analytics.scriptUrl} />
        ) : null}
      </head>
      <body>
        <a href="#contenido" className={skipLink}>
          Ir al contenido
        </a>
        <header className={header}>
          <div className={column}>
            <Link href="/" className={brand}>
              {name}
            </Link>
            <nav aria-label="Principal">
              <ul className={nav}>
                <li>
                  <Link href="/">Inicio</Link>
                </li>
                <li>
                  <Link href="/temas">Temas</Link>
                </li>
                <li>
                  <Link href="/sobre">Sobre este sitio</Link>
                </li>
              </ul>
            </nav>
          </div>
        </header>
        <main id="contenido" className={column}>
          {children}
        </main>
        <footer className={footer}>
          <p className={`${column} ${muted}`}>
            Lo escribe {author} · <Link href="/sobre">Quién escribe y por qué</Link> ·{' '}
            {/* The feed is an XML route, not a page: a plain link, never client-side navigation. */}
            {/* oxlint-disable-next-line next/no-html-link-for-pages */}
            <a href="/feed.xml">Feed (Atom)</a>
          </p>
        </footer>
      </body>
    </html>
  );
};

export default RootLayout;
