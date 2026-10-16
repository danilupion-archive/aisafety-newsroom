import type { Lang } from './i18n';

import { STRINGS } from './strings';

/** Dates as each language's readers write them, on the site's clock, Madrid's (R-WEB-4). */

/** "16 de octubre de 2026" or "16 October 2026", in Madrid's time. */
export const longDate = (lang: Lang, value: string): string =>
  new Intl.DateTimeFormat(STRINGS[lang].locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Madrid',
  }).format(new Date(value));

/** A date-only value ("2026-10-15", a source's access date) as the same calendar day, whatever the time zone. */
export const calendarDate = (lang: Lang, value: string): string =>
  new Intl.DateTimeFormat(STRINGS[lang].locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));

/** A date's parts as the timeline shows them: "16", "OCT", "viernes", "VIE" ("SEPT" and "THU" in English). */
export interface DateParts {
  day: string;
  month: string;
  weekday: string;
  weekdayShort: string;
}

const partsOf = (lang: Lang, date: Date, timeZone: string): DateParts => {
  const { locale } = STRINGS[lang];
  // Some locales end an abbreviation with a full stop; the timeline doesn't.
  const part = (options: Intl.DateTimeFormatOptions): string =>
    new Intl.DateTimeFormat(locale, { ...options, timeZone }).format(date).replace(/\.$/, '');
  return {
    day: part({ day: 'numeric' }),
    month: part({ month: 'short' }).toLocaleUpperCase(locale),
    weekday: part({ weekday: 'long' }),
    weekdayShort: part({ weekday: 'short' }).toLocaleUpperCase(locale),
  };
};

/** A post's date in parts, in Madrid's time, each in its language: the timeline's date column. */
export const dateParts = (lang: Lang, value: string): DateParts =>
  partsOf(lang, new Date(value), 'Europe/Madrid');

/** A news date (`YYYY-MM-DD`, R-WEB-13) in the same parts, on its own calendar day: the column in news order. */
export const calendarParts = (lang: Lang, day: string): DateParts =>
  partsOf(lang, new Date(`${day.slice(0, 10)}T12:00:00Z`), 'UTC');

/** An instant's calendar day on the site's clock, `YYYY-MM-DD`. */
export const madridDay = (value: string): string =>
  new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Europe/Madrid',
  }).format(new Date(value));

/**
 * When a post was posted on another day than its story happened (R-WEB-13), that day: "noticia del 12 oct" on the
 * timeline (with its year when it's another), "noticia del 12 de octubre de 2026" on the post's page. Undefined when
 * they're the same day, or the post has no news date (from an API older than them).
 */
export const newsNote = (
  lang: Lang,
  post: { published_at: string; news_date?: string | null },
  length: 'short' | 'long' = 'short',
): string | undefined => {
  const day = post.news_date;
  const posted = madridDay(post.published_at);
  if (!day || day === posted) {
    return undefined;
  }
  const date =
    length === 'long'
      ? calendarDate(lang, day)
      : new Intl.DateTimeFormat(STRINGS[lang].locale, {
          day: 'numeric',
          month: 'short',
          year: day.slice(0, 4) === posted.slice(0, 4) ? undefined : 'numeric',
          timeZone: 'UTC',
        })
          .format(new Date(`${day}T12:00:00Z`))
          .replaceAll('.', '');
  return STRINGS[lang].newsFrom(date);
};
