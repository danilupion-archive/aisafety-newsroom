import { css } from '@styled-system/css';

/** The site's few shared styles: one readable column (R-WEB-4). */
export const column = css({ maxWidth: '42rem', marginX: 'auto', paddingX: '4' });
export const muted = css({ color: 'muted', fontSize: 'sm' });
export const pageTitle = css({
  fontSize: { base: '2xl', md: '3xl' },
  lineHeight: '1.2',
  fontWeight: 'bold',
  marginY: '4',
});
export const sectionTitle = css({
  fontSize: 'xl',
  fontWeight: 'bold',
  marginTop: '8',
  marginBottom: '3',
});
export const prose = css({
  '& p': { marginY: '4' },
  '& h2': { fontSize: 'xl', fontWeight: 'bold', marginTop: '8', marginBottom: '3' },
  '& h3': { fontSize: 'lg', fontWeight: 'bold', marginTop: '6', marginBottom: '2' },
  '& ul': { listStyle: 'disc', paddingLeft: '6', marginY: '4' },
  '& ol': { listStyle: 'decimal', paddingLeft: '6', marginY: '4' },
  '& blockquote': {
    borderLeftWidth: '3px',
    borderLeftStyle: 'solid',
    borderLeftColor: 'rule',
    paddingLeft: '4',
    color: 'muted',
    marginY: '4',
  },
  '& code': { fontFamily: 'mono', fontSize: '0.9em' },
});
