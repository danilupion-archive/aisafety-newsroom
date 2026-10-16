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
  /** The header's group of language links. */
  language: string;
  home: string;
  topics: string;
  about: string;
  /** The about page's name in the header's navigation, where it's shorter. */
  navAbout: string;
  /** Next to the site's name, in the header. */
  tagline: string;
  /** The home page's first line. */
  intro: string;
  latest: string;
  older: string;
  nothingYet: string;
  noOlder: string;
  noTopics: string;
  topic: (label: string) => string;
  sources: string;
  /** How many sources a listed post has. */
  sourceCount: (count: number) => string;
  /** The link from a listed post to the post itself. */
  read: string;
  /** From a post back to the timeline. */
  allEntries: string;
  accessed: (date: string) => string;
  writtenBy: (author: string) => string;
  whoAndWhy: string;
  feed: string;
  /** The feed's box at the end of the timeline. */
  followFeed: string;
  feedButton: string;
  /** The feed in the header's navigation (an Atom feed: every RSS reader takes it). */
  navFeed: string;
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
    language: 'Idioma',
    home: 'Inicio',
    topics: 'Temas',
    about: 'Sobre este sitio',
    navAbout: 'Sobre',
    tagline: 'Los riesgos de la IA, día a día',
    intro: 'Lo que ya ha salido de la caja: los riesgos de la IA, cada día y con sus fuentes.',
    latest: 'Lo último',
    older: 'Entradas anteriores',
    nothingYet: 'Todavía no hay publicaciones.',
    noOlder: 'No hay publicaciones anteriores.',
    noTopics: 'Todavía no hay temas.',
    topic: (label) => `Tema: ${label}`,
    sources: 'Fuentes',
    sourceCount: (count) => (count === 1 ? '1 fuente' : `${count} fuentes`),
    read: 'Leer',
    allEntries: 'Todas las entradas',
    accessed: (date) => `consultado el ${date}`,
    writtenBy: (author) => `Lo escribe ${author}`,
    whoAndWhy: 'Quién escribe y por qué',
    feed: 'Feed (Atom)',
    followFeed: 'Síguela desde tu lector de RSS.',
    feedButton: 'Feed RSS',
    navFeed: 'RSS',
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
    language: 'Language',
    home: 'Home',
    topics: 'Topics',
    about: 'About this site',
    navAbout: 'About',
    tagline: 'AI risk, day by day',
    intro: 'What’s already out of the box: AI risk, every day, with its sources.',
    latest: 'Latest',
    older: 'Older entries',
    nothingYet: 'Nothing published yet.',
    noOlder: 'No older posts.',
    noTopics: 'No topics yet.',
    topic: (label) => `Topic: ${label}`,
    sources: 'Sources',
    sourceCount: (count) => (count === 1 ? '1 source' : `${count} sources`),
    read: 'Read',
    allEntries: 'All entries',
    accessed: (date) => `accessed ${date}`,
    writtenBy: (author) => `Written by ${author}`,
    whoAndWhy: 'Who writes this and why',
    feed: 'Feed (Atom)',
    followFeed: 'Follow it from your RSS reader.',
    feedButton: 'RSS feed',
    navFeed: 'RSS',
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
