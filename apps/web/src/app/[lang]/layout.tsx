import type { Metadata, Viewport } from 'next';
import type { PropsWithChildren } from 'react';

import { css } from '@styled-system/css';
import { headers } from 'next/headers';
import Link from 'next/link';
import { connection } from 'next/server';

import type { Lang } from '@/i18n';

import { getPost, type Translation } from '@/api';
import { Mark } from '@/components/Mark';
import { Wordmark } from '@/components/Wordmark';
import { otherLang, otherLanguageHref, PATH_WORDS, PATHNAME_HEADER, paths, readPath } from '@/i18n';
import { pageLang } from '@/params';
import { site } from '@/site';
import { STRINGS } from '@/strings';
import { container, label } from '@/styles';
import { isSlug } from '@/tags';

import '@fontsource-variable/hanken-grotesk';

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
    description: STRINGS[lang].intro,
    alternates: {
      types: { 'application/atom+xml': [{ url: paths.feed(lang), title: name[lang] }] },
    },
  };
};

// Zoom stays enabled: WCAG 2.2 AA requires text to be resizable.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0F172A',
  colorScheme: 'dark',
};

const skipLink = css({
  position: 'absolute',
  left: '-9999px',
  _focus: { left: '4', top: '4', bg: 'accent', color: 'page', padding: '3', zIndex: 1 },
});
const header = css({
  borderBottomWidth: '1px',
  borderBottomStyle: 'solid',
  borderBottomColor: 'card',
});
const headerRow = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  columnGap: '6',
  rowGap: '1',
});
const brand = css({
  display: 'flex',
  alignItems: 'center',
  gap: '3',
  paddingY: '3.5',
  _hover: { textDecoration: 'none' },
});
const brandName = css({ fontSize: { base: '1.625rem', md: '1.875rem' } });
const tagline = css({
  display: { base: 'none', sm: 'inline' },
  color: 'muted',
  fontSize: '0.9375rem',
});
const headerEnd = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  columnGap: '6',
  rowGap: '1',
});
const navList = css({
  display: 'flex',
  flexWrap: 'wrap',
  columnGap: '5',
  listStyle: 'none',
  padding: '0',
  margin: '0',
  fontWeight: '500',
});
const navLink = css({ display: 'inline-block', paddingY: '3' });
const languages = css({
  display: 'flex',
  padding: '3px',
  borderRadius: 'full',
  bg: 'card',
});
const languageItem = css({
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '38px',
  paddingX: '4',
  borderRadius: 'full',
  color: 'muted',
  _hover: { textDecoration: 'none', color: 'text' },
  '&[aria-current]': { bg: 'accent', color: 'page' },
});
const footer = css({
  borderTopWidth: '1px',
  borderTopStyle: 'solid',
  borderTopColor: 'card',
  marginTop: '12',
  paddingY: '6',
  color: 'muted',
  fontSize: '0.9375rem',
});
const footerRow = css({ display: 'flex', flexWrap: 'wrap', columnGap: '2', rowGap: '1' });

/**
 * A post's version in the other language, for the header's switch: on a post's address only (a word of the
 * language's own is a page, not a post), asked once per request with the page itself (getPost is cached).
 */
const translationOf = async (
  lang: Lang,
  pathname: string | undefined,
): Promise<Translation | undefined> => {
  const path = readPath(pathname);
  const [slug, ...rest] = path?.segments ?? [];
  const words: readonly string[] = Object.values(PATH_WORDS[lang]);
  if (path?.lang !== lang || rest.length > 0 || !slug || !isSlug(slug) || words.includes(slug)) {
    return undefined;
  }
  const post = await getPost(lang, slug);
  return post && post !== 'gone' ? post.translations[0] : undefined;
};

/**
 * Every page in one language (R-WEB-4): the mark, the name and its tagline; the topics, the about page (R-WEB-3) and
 * the feed; the switch to the same page in the other language, labelled in that language; who writes it.
 */
const RootLayout = async ({ children, params }: Props) => {
  await connection();
  const lang = await pageLang(params);
  const other = otherLang(lang);
  const { name, author, analytics } = site();
  const t = STRINGS[lang];
  const pathname = (await headers()).get(PATHNAME_HEADER) ?? undefined;
  const otherHref = otherLanguageHref(lang, pathname, await translationOf(lang, pathname));
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
          <div className={`${container} ${headerRow}`}>
            <Link href={paths.home(lang)} className={brand}>
              <Mark size={46} />
              <Wordmark name={name[lang]} className={brandName} />
              <span className={tagline}>{t.tagline}</span>
            </Link>
            <div className={headerEnd}>
              <nav aria-label={t.nav}>
                <ul className={navList}>
                  <li>
                    <Link href={paths.topics(lang)} className={navLink}>
                      {t.topics}
                    </Link>
                  </li>
                  <li>
                    <Link href={paths.about(lang)} className={navLink}>
                      {t.navAbout}
                    </Link>
                  </li>
                  <li>
                    {/* The feed is an XML route, not a page: a plain link, never client-side navigation. */}
                    {/* oxlint-disable-next-line next/no-html-link-for-pages */}
                    <a href={paths.feed(lang)} className={navLink}>
                      {t.navFeed}
                    </a>
                  </li>
                </ul>
              </nav>
              <div role="group" aria-label={t.language} className={`${languages} ${label}`}>
                <span aria-current="true" className={languageItem} lang={lang}>
                  {lang.toUpperCase()}
                </span>
                <Link
                  href={otherHref}
                  hrefLang={other}
                  lang={other}
                  aria-label={STRINGS[other].name}
                  className={languageItem}
                >
                  {other.toUpperCase()}
                </Link>
              </div>
            </div>
          </div>
        </header>
        <main id="main">{children}</main>
        <footer className={footer}>
          <p className={`${container} ${footerRow}`}>
            <span>{name[lang]}</span>
            <span aria-hidden="true">·</span>
            <span>{t.writtenBy(author)}</span>
            <span aria-hidden="true">·</span>
            <Link href={paths.about(lang)}>{t.whoAndWhy}</Link>
            <span aria-hidden="true">·</span>
            {/* oxlint-disable-next-line next/no-html-link-for-pages */}
            <a href={paths.feed(lang)}>{t.feed}</a>
          </p>
        </footer>
      </body>
    </html>
  );
};

export default RootLayout;
