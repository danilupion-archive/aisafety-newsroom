import { css } from '@styled-system/css';

/** The site's shared styles: the night design's widths, type and pills (R-WEB-4). */

/** The page's width: the header, the timeline, the footer. */
export const container = css({ maxWidth: '65rem', marginX: 'auto', paddingX: '4' });
/** A post's or a page's reading width. */
export const column = css({ maxWidth: '47.5rem', marginX: 'auto', paddingX: '4' });
export const muted = css({ color: 'muted', fontSize: 'sm' });
/** Read by screen readers, not shown. */
export const srOnly = css({
  position: 'absolute',
  width: '1px',
  height: '1px',
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
});
export const pageTitle = css({
  fontSize: { base: '2rem', md: '2.75rem' },
  lineHeight: '1.1',
  fontWeight: '800',
  letterSpacing: '-0.02em',
  marginTop: '6',
  marginBottom: '4',
});
export const sectionTitle = css({
  fontSize: 'sm',
  fontWeight: '700',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'accent',
  marginBottom: '3',
});
/** Small uppercase labels: dates, a post's type, tags. */
export const label = css({
  fontSize: '0.875rem',
  fontWeight: '700',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  fontVariantNumeric: 'tabular-nums',
});
export const pillRow = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '2',
  listStyle: 'none',
  padding: '0',
  margin: '0',
});
/** A tag: aquamarine on its soft fill, a link to the tag's page. */
export const tagPill = css({
  display: 'inline-block',
  paddingX: '2.5',
  paddingY: '0.5',
  borderRadius: 'full',
  bg: 'accentSoft',
  color: 'accent',
  fontSize: '0.875rem',
  fontWeight: '600',
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
});
/** A post's type: quiet for a breve, light for an article. */
export const typePill = css({
  display: 'inline-block',
  paddingX: '2.5',
  paddingY: '0.5',
  borderRadius: 'full',
  bg: 'page',
  color: 'muted',
  fontSize: '0.875rem',
  fontWeight: '600',
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  '&[data-type=article]': { bg: 'text', color: 'page' },
});
/** A signed post's badge (R-WEB-3, D19): its writer's name, outlined in the accent, beside its type. */
export const authorPill = css({
  display: 'inline-block',
  paddingX: '2.5',
  paddingY: '0.5',
  borderRadius: 'full',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'accent',
  color: 'accent',
  fontSize: '0.875rem',
  fontWeight: '600',
});
/** A rounded button: aquamarine with navy text, or outlined. At least 44 px tall, for a finger. */
export const button = css({
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '44px',
  paddingX: '4.5',
  borderRadius: 'full',
  fontWeight: '700',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'muted',
  color: 'text',
  _hover: { textDecoration: 'none', borderColor: 'text' },
  '&[data-primary]': { bg: 'accent', borderColor: 'accent', color: 'page' },
});
export const prose = css({
  color: 'body',
  fontSize: { base: '1.0625rem', md: '1.1875rem' },
  lineHeight: '1.7',
  '& p': { marginY: '5' },
  '& a': {
    color: 'text',
    textDecoration: 'underline',
    textDecorationColor: 'accent',
    textDecorationThickness: '2px',
    textUnderlineOffset: '0.2em',
  },
  '& strong': { color: 'text' },
  '& h2': {
    color: 'text',
    fontSize: '1.5rem',
    fontWeight: '700',
    lineHeight: '1.25',
    marginTop: '10',
    marginBottom: '3',
  },
  '& h3': {
    color: 'text',
    fontSize: '1.25rem',
    fontWeight: '700',
    marginTop: '8',
    marginBottom: '2',
  },
  '& ul': { listStyle: 'disc', paddingLeft: '6', marginY: '5' },
  '& ol': { listStyle: 'decimal', paddingLeft: '6', marginY: '5' },
  '& li': { marginY: '1.5' },
  '& blockquote': {
    borderLeftWidth: '3px',
    borderLeftStyle: 'solid',
    borderLeftColor: 'accent',
    paddingLeft: '4',
    color: 'muted',
    marginY: '5',
  },
  '& code': { fontFamily: 'mono', fontSize: '0.9em' },
});
