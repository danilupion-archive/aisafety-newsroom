/** Dates and labels as a reader in Spain reads them (R-WEB-4: Spanish interface). */

const LONG = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Europe/Madrid',
});

/** "15 de octubre de 2026", in Madrid's time. */
export const longDate = (value: string): string => LONG.format(new Date(value));

/** A date-only value ("2026-10-15", a source's access date) as the same calendar day, whatever the time zone. */
export const calendarDate = (value: string): string =>
  new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));

export const TYPE_LABEL: Record<'breve' | 'article' | 'page', string> = {
  breve: 'Breve',
  article: 'Artículo',
  page: 'Página',
};
