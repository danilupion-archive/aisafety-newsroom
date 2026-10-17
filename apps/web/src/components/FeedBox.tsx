import { css } from '@styled-system/css';

import type { Lang } from '@/i18n';

import { paths } from '@/i18n';
import { STRINGS } from '@/strings';
import { button } from '@/styles';

const box = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '4',
  marginTop: '2',
  marginLeft: { base: '0', md: '8.5rem' },
  paddingX: '6',
  paddingY: '5',
  borderRadius: 'xl',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'rule',
  bg: 'card',
});
const actions = css({ display: 'flex', flexWrap: 'wrap', gap: '3' });

/**
 * The end of a timeline: the feed, and the older entries when there are more, for a reader without JavaScript only:
 * with it, the timeline goes on by itself (R-WEB-19).
 */
export const FeedBox = ({ lang, older }: { lang: Lang; older: string | undefined }) => {
  const t = STRINGS[lang];
  return (
    <aside className={box}>
      <p className={css({ fontSize: '1.125rem' })}>{t.followFeed}</p>
      <p className={actions}>
        {/* The feed is an XML route, not a page: a plain link, never client-side navigation. */}
        {/* oxlint-disable-next-line next/no-html-link-for-pages */}
        <a href={paths.feed(lang)} className={button} data-primary="">
          {t.feedButton}
        </a>
        {older ? (
          <noscript>
            {/* oxlint-disable-next-line next/no-html-link-for-pages -- a plain link, for readers without scripts */}
            <a href={older} className={button}>
              {t.older}
            </a>
          </noscript>
        ) : null}
      </p>
    </aside>
  );
};
