import { css } from '@styled-system/css';

import { splitWordmark } from '@/brand';

const wordmark = css({
  fontWeight: '800',
  letterSpacing: '-0.03em',
  lineHeight: '1',
  color: 'text',
});

/** The configured name as the logo writes it: PandorIA, the IA in the aquamarine-to-pink gradient; any other plain. */
export const Wordmark = ({ name, className }: { name: string; className?: string }) => {
  const { lead, ia: tail } = splitWordmark(name);
  return (
    <span className={`${wordmark} ${className ?? ''}`}>
      {lead}
      {/* Its colours: .wordmark-ia in src/app/globals.css. */}
      {tail ? <span className="wordmark-ia">{tail}</span> : null}
    </span>
  );
};
