'use client';

import { useEffect, useRef } from 'react';

import { MarkSvg } from '@/components/Mark';
import { REVEAL_ATTRIBUTE, REVEAL_MS } from '@/mark-motion';

/**
 * The header's mark, alive (R-WEB-11): the stylesheet does the moving (app/globals.css); this only rests it when it's
 * out of view, and, once the first page's reveal has played, takes the page's reveal mark off so a later remount
 * doesn't play it again (unmounted mid-reveal, a remount may replay it: harmless). Every animated group ends where the
 * still mark is, so taking it off changes nothing on screen.
 */
export const LiveMark = ({ size, className }: { size: number; className?: string }) => {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const svg = ref.current;
    const page = document.documentElement;
    const settle = () => page.removeAttribute(REVEAL_ATTRIBUTE);
    const timer = page.hasAttribute(REVEAL_ATTRIBUTE)
      ? window.setTimeout(settle, REVEAL_MS)
      : undefined;
    let observer: IntersectionObserver | undefined;
    if (svg && 'IntersectionObserver' in window) {
      observer = new IntersectionObserver(([entry]) => {
        svg.classList.toggle('mark-paused', entry !== undefined && !entry.isIntersecting);
      });
      observer.observe(svg);
    }
    return () => {
      window.clearTimeout(timer);
      observer?.disconnect();
    };
  }, []);
  return <MarkSvg ref={ref} size={size} className={className} live />;
};
