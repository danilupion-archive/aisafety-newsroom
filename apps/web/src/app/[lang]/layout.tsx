import type { Metadata, Viewport } from 'next';
import type { PropsWithChildren } from 'react';

import { css } from '@styled-system/css';
import Link from 'next/link';
import { connection } from 'next/server';

import { otherLang, paths } from '@/i18n';
import { pageLang } from '@/params';
import { site } from '@/site';
import { STRINGS } from '@/strings';
import { column, headerRow, muted } from '@/styles';

import '../globals.css';

type Props = Readonly<PropsWithChildren<{ params: Promise<{ lang: string }> }>>;

// Read when a page renders: without connection(), Next would prerender this at build time with the build's settings.
export const generateMetadata = async ({ params }: Props): Promise<Metadata> => {
  await connection();
  const lang = await pageLang(params);
  const { name, url } = site();
  return {
    metadataBase: new URL(url),
    title: { default: name[lang], template: `%s · ${name[lang]}` },
    alternates: {
      types: { 'application/atom+xml': [{ url: paths.feed(lang), title: name[lang] }] },
    },
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

/**
 * Every page in one language (R-WEB-4): who writes it and a link to the about page (R-WEB-3), and a link to the other
 * language, labelled in that language.
 */
const RootLayout = async ({ children, params }: Props) => {
  await connection();
  const lang = await pageLang(params);
  const other = otherLang(lang);
  const { name, author, analytics } = site();
  const t = STRINGS[lang];
  return (
    <html lang={lang}>
      <head>
        {analytics ? (
          <script defer data-domain={analytics.domain} src={analytics.scriptUrl} />
        ) : null}
      </head>
      <body>
        <a href="#main" className={skipLink}>
          {t.skip}
        </a>
        <header className={header}>
          <div className={column}>
            <div className={headerRow}>
              <Link href={paths.home(lang)} className={brand}>
                {name[lang]}
              </Link>
              <Link href={paths.home(other)} hrefLang={other} lang={other}>
                {STRINGS[other].name}
              </Link>
            </div>
            <nav aria-label={t.nav}>
              <ul className={nav}>
                <li>
                  <Link href={paths.home(lang)}>{t.home}</Link>
                </li>
                <li>
                  <Link href={paths.topics(lang)}>{t.topics}</Link>
                </li>
                <li>
                  <Link href={paths.about(lang)}>{t.about}</Link>
                </li>
              </ul>
            </nav>
          </div>
        </header>
        <main id="main" className={column}>
          {children}
        </main>
        <footer className={footer}>
          <p className={`${column} ${muted}`}>
            {t.writtenBy(author)} · <Link href={paths.about(lang)}>{t.whoAndWhy}</Link> ·{' '}
            {/* The feed is an XML route, not a page: a plain link, never client-side navigation. */}
            {/* oxlint-disable-next-line next/no-html-link-for-pages */}
            <a href={paths.feed(lang)}>{t.feed}</a>
          </p>
        </footer>
      </body>
    </html>
  );
};

export default RootLayout;
