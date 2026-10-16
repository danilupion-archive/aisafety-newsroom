import type { Lang } from './i18n';

/**
 * The interface's words in each language (R-WEB-4). Content never comes from here (R-WEB-2): only the site's own
 * labels, for Dani to review. A link to the other language is labelled in that language, as readers look for it.
 */
export interface Strings {
  /** For dates (Intl) and Open Graph. */
  locale: string;
  ogLocale: string;
  /** The language's name in itself, for the link that switches to it. */
  name: string;
  /** On a page in the other language, the link to this language's version of the same post. */
  readIn: string;
  skip: string;
  nav: string;
  home: string;
  topics: string;
  about: string;
  latest: string;
  older: string;
  nothingYet: string;
  noOlder: string;
  noTopics: string;
  topic: (label: string) => string;
  sources: string;
  accessed: (date: string) => string;
  writtenBy: (author: string) => string;
  whoAndWhy: string;
  feed: string;
  aboutPending: string;
  notFound: string;
  backHome: string;
  type: Record<'breve' | 'article' | 'page', string>;
  gone: { title: string; heading: string; back: (site: string) => string };
  /** The query parameters of a list's next page: the last post's instant and slug. */
  cursor: { before: string; slug: string };
}

export const STRINGS: Record<Lang, Strings> = {
  es: {
    locale: 'es-ES',
    ogLocale: 'es_ES',
    name: 'Español',
    readIn: 'Léelo en español',
    skip: 'Ir al contenido',
    nav: 'Principal',
    home: 'Inicio',
    topics: 'Temas',
    about: 'Sobre este sitio',
    latest: 'Lo último',
    older: 'Publicaciones anteriores',
    nothingYet: 'Todavía no hay publicaciones.',
    noOlder: 'No hay publicaciones anteriores.',
    noTopics: 'Todavía no hay temas.',
    topic: (label) => `Tema: ${label}`,
    sources: 'Fuentes',
    accessed: (date) => `consultado el ${date}`,
    writtenBy: (author) => `Lo escribe ${author}`,
    whoAndWhy: 'Quién escribe y por qué',
    feed: 'Feed (Atom)',
    aboutPending: 'Esta página está en preparación.',
    notFound: 'No encontramos esta página',
    backHome: 'Volver al inicio',
    type: { breve: 'Breve', article: 'Artículo', page: 'Página' },
    gone: {
      title: 'Publicación retirada',
      heading: 'Esta publicación se ha retirado',
      back: (site) => `Volver a ${site}`,
    },
    cursor: { before: 'antes', slug: 'tras' },
  },
  en: {
    locale: 'en-GB',
    ogLocale: 'en_GB',
    name: 'English',
    readIn: 'Read it in English',
    skip: 'Skip to content',
    nav: 'Main',
    home: 'Home',
    topics: 'Topics',
    about: 'About this site',
    latest: 'Latest',
    older: 'Older posts',
    nothingYet: 'Nothing published yet.',
    noOlder: 'No older posts.',
    noTopics: 'No topics yet.',
    topic: (label) => `Topic: ${label}`,
    sources: 'Sources',
    accessed: (date) => `accessed ${date}`,
    writtenBy: (author) => `Written by ${author}`,
    whoAndWhy: 'Who writes this and why',
    feed: 'Feed (Atom)',
    aboutPending: 'This page is being written.',
    notFound: 'We couldn’t find this page',
    backHome: 'Back to the home page',
    type: { breve: 'In brief', article: 'Article', page: 'Page' },
    gone: {
      title: 'Post withdrawn',
      heading: 'This post has been withdrawn',
      back: (site) => `Back to ${site}`,
    },
    cursor: { before: 'before', slug: 'after' },
  },
};
