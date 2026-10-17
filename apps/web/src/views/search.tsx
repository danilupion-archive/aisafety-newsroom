import { css } from '@styled-system/css';
import Link from 'next/link';
import { connection } from 'next/server';

import { searchPosts } from '@/api';
import { Timeline } from '@/components/Timeline';
import { paths } from '@/i18n';
import { readSearch, SEARCH_MAX, SEARCH_PAGE, searchHref } from '@/search';
import { STRINGS } from '@/strings';
import { button, container, pageTitle, srOnly } from '@/styles';

import { readSearchPage, type SearchProps } from './search-route';

const form = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '3',
  marginBottom: '4',
  maxWidth: '44rem',
});
const field = css({
  flex: '1 1 16rem',
  minHeight: '48px',
  paddingX: '4',
  borderRadius: 'lg',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'rule',
  bg: 'card',
  color: 'text',
  fontSize: '1.0625rem',
  _placeholder: { color: 'muted' },
  _focusVisible: { borderColor: 'accent' },
});
const hint = css({ maxWidth: '44rem', marginBottom: '8', color: 'muted', fontSize: '0.9375rem' });
const heading = css({ marginBottom: '6', fontSize: '1.125rem', color: 'body' });
const next = css({ marginLeft: { base: '0', md: '8.5rem' }, marginBottom: '6' });

/**
 * The search page (R-WEB-18): a plain form that works without JavaScript, and the results as the timeline's cards,
 * each with the excerpt where it matched. The query is echoed as text, escaped like everything else.
 */
export const SearchView = async ({
  word,
  params,
  searchParams,
}: SearchProps & { word: string }) => {
  await connection();
  const lang = await readSearchPage(word, params);
  const t = STRINGS[lang];
  const { q, from } = readSearch(lang, await searchParams);
  const answer = q === undefined ? undefined : await searchPosts(lang, q, from, SEARCH_PAGE);
  return (
    <div className={container}>
      <h1 className={pageTitle}>{t.search.name}</h1>
      <form role="search" action={paths.search(lang)} method="get" className={form}>
        <label htmlFor="q" className={srOnly}>
          {t.search.label}
        </label>
        <input
          id="q"
          name={t.search.params.query}
          type="search"
          defaultValue={q ?? ''}
          maxLength={SEARCH_MAX}
          placeholder={t.search.placeholder}
          className={field}
          autoComplete="off"
          enterKeyHint="search"
          // Arriving to search (the header's link, mostly on a phone), the keyboard comes up at once; on results, not.
          // oxlint-disable-next-line jsx-a11y/no-autofocus -- only on the empty search page, which exists to be typed in
          autoFocus={q === undefined}
        />
        <button type="submit" className={button} data-primary="">
          {t.search.button}
        </button>
      </form>
      <p className={hint}>{t.search.hint}</p>
      {q === undefined || answer === undefined ? null : (
        <section aria-labelledby="results">
          <h2 id="results" className={heading}>
            {answer.results.length === 0 && from === 0 ? t.search.none(q) : t.search.results(q)}
          </h2>
          {answer.results.length === 0 ? null : (
            <Timeline lang={lang} posts={answer.results} featureFirst={false} />
          )}
          {answer.next === null ? null : (
            <p className={next}>
              <Link href={searchHref(lang, q, answer.next)} className={button}>
                {t.search.more}
              </Link>
            </p>
          )}
        </section>
      )}
    </div>
  );
};
