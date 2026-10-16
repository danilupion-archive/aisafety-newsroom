import { css } from '@styled-system/css';

import { splitWordmark } from '@/brand';

const wordmark = css({
  fontWeight: '800',
  letterSpacing: '-0.03em',
  lineHeight: '1',
  color: 'text',
});
const ia = css({ color: 'accent' });

/** The configured name as the logo writes it: PandorIA, the IA in orange; any other name plain. */
export const Wordmark = ({ name, className }: { name: string; className?: string }) => {
  const { lead, ia: tail } = splitWordmark(name);
  return (
    <span className={`${wordmark} ${className ?? ''}`}>
      {lead}
      {tail ? <span className={ia}>{tail}</span> : null}
    </span>
  );
};
