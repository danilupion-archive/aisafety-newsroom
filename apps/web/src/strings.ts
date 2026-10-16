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
  /** The timeline in the order its stories happened (R-WEB-13), beside `latest`, as posted. */
  orderNews: string;
  /** The two orders' group of links. */
  orderNav: string;
  /** On a post posted on another day than its story happened: "noticia del 12 oct". */
  newsFrom: (date: string) => string;
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
  /** Who writes the texts and who answers for them (R-WEB-3), before the editor's name, in the footer. */
  credit: string;
  /** Above a post's sources: the text is AI-written from them (R-WEB-3). */
  aiNote: string;
  /** At the end of each feed entry, which readers show without the site's footer (R-WEB-3). */
  feedCredit: (editor: string) => string;
  howItsMade: string;
  /** The texts' licence (D14), linked to its deed in this language. */
  licence: { name: string; url: string };
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
  /** The query parameters of a list's next page: the last post's instant and slug, and in news order its news date. */
  cursor: { before: string; slug: string; day: string };
  /** The query parameter of the timeline's order, and its value for news order (R-WEB-13). */
  order: { key: string; news: string };
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
    tagline: 'La caja ya está abierta',
    intro: 'Noticias sobre los riesgos de la IA, en pocas líneas y con las fuentes enlazadas.',
    latest: 'Lo último',
    orderNews: 'Por fecha de la noticia',
    orderNav: 'Ordenar',
    newsFrom: (date) => `noticia del ${date}`,
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
    credit: 'Textos escritos por IA, elegidos y revisados por',
    aiNote: 'Texto escrito por IA a partir de estas fuentes.',
    feedCredit: (editor) => `Texto escrito por IA, elegido y revisado por ${editor}.`,
    howItsMade: 'Cómo se hace',
    licence: { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/deed.es' },
    feed: 'Feed (Atom)',
    followFeed: 'Síguelo en tu lector de RSS.',
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
    cursor: { before: 'antes', slug: 'tras', day: 'dia' },
    order: { key: 'orden', news: 'noticia' },
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
    tagline: 'The box is already open',
    intro: 'News about AI risk, in a few lines, with the sources linked.',
    latest: 'Latest',
    orderNews: 'By news date',
    orderNav: 'Sort',
    newsFrom: (date) => `news from ${date}`,
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
    credit: 'Texts written by AI, picked and checked by',
    aiNote: 'Written by AI from these sources.',
    feedCredit: (editor) => `Written by AI, picked and checked by ${editor}.`,
    howItsMade: 'How it’s made',
    licence: { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/deed.en' },
    feed: 'Feed (Atom)',
    followFeed: 'Follow it in your RSS reader.',
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
    cursor: { before: 'before', slug: 'after', day: 'day' },
    order: { key: 'order', news: 'news' },
  },
};
