'use client';

import { css } from '@styled-system/css';
import Link from 'next/link';
import { type MouseEvent, useState } from 'react';

const WIDE = '(min-width: 768px)';

const magnifier = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: '44px',
  minHeight: '44px',
  marginX: '-2',
  color: 'text',
  _hover: { color: 'accent' },
});
const form = css({ display: 'flex', alignItems: 'center' });
const field = css({
  width: '15rem',
  minHeight: '40px',
  paddingX: '3.5',
  borderRadius: 'lg',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'rule',
  bg: 'card',
  color: 'text',
  fontSize: '0.9375rem',
  _placeholder: { color: 'muted' },
});

const Icon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="2.25" />
    <path d="m15.5 15.5 5 5" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
  </svg>
);

/**
 * The header's search (R-WEB-18). A magnifier that links to the search page, which is all a phone or a reader without
 * JavaScript gets; on a wider screen it opens a field in the header instead, and Enter lands on the results. Escape,
 * or leaving it empty, closes it again.
 */
export const HeaderSearch = ({
  href,
  param,
  name,
  label,
  placeholder,
}: {
  href: string;
  param: string;
  name: string;
  label: string;
  placeholder: string;
}) => {
  const [open, setOpen] = useState(false);
  const openHere = (event: MouseEvent) => {
    if (window.matchMedia(WIDE).matches) {
      event.preventDefault();
      setOpen(true);
    }
  };
  return open ? (
    <form role="search" action={href} method="get" className={form}>
      <input
        name={param}
        type="search"
        aria-label={label}
        placeholder={placeholder}
        className={field}
        autoComplete="off"
        enterKeyHint="search"
        // oxlint-disable-next-line jsx-a11y/no-autofocus -- opened by the reader's own click, to type in at once
        autoFocus
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setOpen(false);
          }
        }}
        onBlur={(event) => {
          if (event.currentTarget.value.trim() === '') {
            setOpen(false);
          }
        }}
      />
    </form>
  ) : (
    <Link href={href} className={magnifier} aria-label={name} title={name} onClick={openHere}>
      <Icon />
    </Link>
  );
};
