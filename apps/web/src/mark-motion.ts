/**
 * The header mark's motion (R-WEB-11). The reveal (the box opening and the tentacles coming out) plays on every full
 * page load, reloads included, and never on a move within the site, which keeps the document: this script, inline in
 * the page's head, runs once per document and decides before the first paint, so the mark is drawn closed from the
 * start rather than open and then closed. It marks the page with `data-mark-reveal`, which the stylesheet animates
 * (app/globals.css) and LiveMark takes off once it has played. With prefers-reduced-motion it does nothing, and the
 * stylesheet keeps the mark still anyway. A constant, never built from a request.
 */
export const REVEAL_ATTRIBUTE = 'data-mark-reveal';
/** The reveal's length in the stylesheet, plus a margin, after which the page's mark is put back as it rests. */
export const REVEAL_MS = 1800;

export const MARK_REVEAL_SCRIPT =
  "(function(){try{if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return}catch(e){}" +
  `document.documentElement.setAttribute('${REVEAL_ATTRIBUTE}','')})()`;
