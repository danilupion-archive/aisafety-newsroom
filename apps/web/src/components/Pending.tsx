'use client';

import { css } from '@styled-system/css';
import { useLinkStatus } from 'next/link';

const bar = css({
  position: 'fixed',
  top: '0',
  left: '0',
  right: '0',
  height: '3px',
  bg: 'highlight',
  zIndex: '50',
  pointerEvents: 'none',
  animation: 'pulse',
  '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
});

/**
 * Inside a link: while the page it leads to is on its way, a thin bar across the top of the window, so a click is
 * answered at once. Only the followed link shows it. The pages themselves stay whole HTML, with no loading state for a
 * reader without JavaScript to be left on.
 */
export const Pending = () => {
  const { pending } = useLinkStatus();
  return pending ? <span className={bar} aria-hidden="true" /> : null;
};
