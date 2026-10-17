import { css } from '@styled-system/css';
import Link from 'next/link';

import type { Lang } from '@/i18n';

import { type Order, orderHref } from '@/paging';
import { STRINGS } from '@/strings';

const row = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  columnGap: '3',
  rowGap: '2',
  marginBottom: '6',
  marginLeft: { base: '0', md: '8.5rem' },
});
const caption = css({ color: 'muted', fontSize: '0.9375rem' });
const group = css({
  display: 'inline-flex',
  flexWrap: 'wrap',
  gap: '1',
  padding: '3px',
  borderRadius: 'xl',
  bg: 'card',
});
const item = css({
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '38px',
  paddingX: '4',
  borderRadius: 'lg',
  color: 'muted',
  fontWeight: '600',
  fontSize: '0.9375rem',
  _hover: { textDecoration: 'none' },
  // The chosen order stays as it is under the pointer; the other lights up.
  '&:not([aria-current]):hover': { color: 'text', bg: 'rule' },
  '&[aria-current]': { bg: 'accent', color: 'page' },
});

/**
 * A timeline's two orders (R-WEB-13): as posted, the default, so a story added late doesn't land deep in the list; and
 * by the day each story happened. Each starts at its first page.
 */
export const OrderSwitch = ({ lang, path, order }: { lang: Lang; path: string; order: Order }) => {
  const t = STRINGS[lang];
  const link = (to: Order, text: string) => (
    <Link
      href={orderHref(lang, path, to)}
      className={item}
      aria-current={order === to ? 'page' : undefined}
    >
      {text}
    </Link>
  );
  return (
    <nav aria-label={t.orderNav} className={row}>
      <span className={caption} aria-hidden="true">
        {t.sortBy}
      </span>
      <span className={group}>
        {link('posted', t.orderPosted)}
        {link('news', t.orderNews)}
      </span>
    </nav>
  );
};
