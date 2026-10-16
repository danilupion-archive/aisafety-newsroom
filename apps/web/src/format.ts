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

/** A post's date in parts, in Madrid's time, each in its language: the timeline's date column. */
export const dateParts = (lang: Lang, value: string): DateParts => {
  const { locale } = STRINGS[lang];
  const date = new Date(value);
  // Some locales end an abbreviation with a full stop; the timeline doesn't.
  const part = (options: Intl.DateTimeFormatOptions): string =>
    new Intl.DateTimeFormat(locale, { ...options, timeZone: 'Europe/Madrid' })
      .format(date)
      .replace(/\.$/, '');
  return {
    day: part({ day: 'numeric' }),
    month: part({ month: 'short' }).toLocaleUpperCase(locale),
    weekday: part({ weekday: 'long' }),
    weekdayShort: part({ weekday: 'short' }).toLocaleUpperCase(locale),
  };
};
