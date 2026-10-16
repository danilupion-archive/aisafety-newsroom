import { css } from '@styled-system/css';
import Link from 'next/link';

import type { Lang } from '@/i18n';

import { type Order, orderHref } from '@/paging';
import { STRINGS } from '@/strings';

const group = css({
  display: 'inline-flex',
  flexWrap: 'wrap',
  gap: '1',
  marginBottom: '6',
  marginLeft: { base: '0', md: '8.5rem' },
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
  _hover: { textDecoration: 'none', color: 'text' },
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
    <nav aria-label={t.orderNav} className={group}>
      {link('posted', t.latest)}
      {link('news', t.orderNews)}
    </nav>
  );
};
