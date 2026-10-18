/**
 * The header mark's motion (R-WEB-11). The reveal (the box opening and the tentacles coming out) plays on the first page
 * of a visit only: this script, inline in the page's head, decides before the first paint, so the mark is drawn closed
 * from the start rather than open and then closed. It marks the page with `data-mark-reveal`, which the stylesheet
 * animates (app/globals.css), and remembers the visit in sessionStorage; without storage it plays. With
 * prefers-reduced-motion it does nothing, and the stylesheet keeps the mark still anyway. A constant, never built from a
 * request.
 */
export const REVEAL_ATTRIBUTE = 'data-mark-reveal';
export const REVEAL_KEY = 'pandoria-mark-revealed';
/** The reveal's length in the stylesheet, plus a margin, after which the page's mark is put back as it rests. */
export const REVEAL_MS = 1800;

export const MARK_REVEAL_SCRIPT =
  '(function(){var d=document.documentElement;try{' +
  "if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;" +
  `if(window.sessionStorage.getItem('${REVEAL_KEY}'))return;` +
  `window.sessionStorage.setItem('${REVEAL_KEY}','1')}catch(e){}` +
  `d.setAttribute('${REVEAL_ATTRIBUTE}','')})()`;
