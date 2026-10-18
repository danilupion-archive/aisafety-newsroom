import type { ReactNode, Ref } from 'react';

import { useId } from 'react';

import {
  BLOOM,
  BLOOM_CORE,
  BOX,
  FRONT,
  FRONT_CLIP,
  LID,
  MOUTH,
  SUCKERS,
  THIRD,
  UP,
  UP_SMALL,
} from '@/mark-shapes';
import { COLORS } from '@/palette';

/** The gap's light: an almost white core where it's widest, hot pink around it, deeper magenta at the edges. */
const MOUTH_STOPS = [
  ['0', '#FFF3FC'],
  ['0.3', '#FF9BE9'],
  ['0.65', COLORS.highlight],
  ['1', '#D3159A'],
] as const;

/** The suckers of the rising tentacle come first; the rest run down the draped one. */
const UP_SUCKERS = SUCKERS.slice(0, 9);
const FRONT_SUCKERS = SUCKERS.slice(9);

type Part = 'up' | 'third' | 'front';

/**
 * PandorIA's mark (R-WEB-11): Pandora's box with its lid ajar, aquamarine tentacles coming out of it and hot pink light
 * pouring from the gap. Below 40 px only the rising tentacle is drawn, thicker, as in the browser tab's icon, where the
 * rest would only blur. Its filters and gradients take ids of their own, so several marks can share a page.
 * Decoration: the name beside it says the rest.
 *
 * `live` (the header's, through LiveMark) wraps the lid, the light and each tentacle in groups the stylesheet animates
 * (app/globals.css): the lid, the light and the tentacles' reveal, and each tentacle's sway in two layers, a slow light
 * one and a faster one whose width the logo's hover turns up. Every group is the identity at rest, so a live mark that
 * doesn't move is exactly the static one.
 */
export const MarkSvg = ({
  size,
  className,
  live = false,
  ref,
}: {
  size: number;
  className?: string;
  live?: boolean;
  ref?: Ref<SVGSVGElement>;
}) => {
  const id = useId().replace(/[^\w-]/g, '');
  const small = size < 40;
  const moving = live && !small;
  const [halo, bloom, core, mouth, clip] = ['halo', 'bloom', 'core', 'mouth', 'clip'].map(
    (part) => `mark${id}-${part}`,
  );
  const tentacle = (d: string) => (
    <g filter={`url(#${halo})`}>
      <path d={d} fill={COLORS.accent} />
    </g>
  );
  const suckers = (list: typeof SUCKERS) =>
    list.map(([cx, cy, r]) => (
      <circle key={`${cx},${cy}`} cx={cx} cy={cy} r={r} fill={COLORS.page} />
    ));
  // A tentacle's three moving layers, from the outside in: its reveal, its slow sway, its hover sway.
  const animated = (part: Part, children: ReactNode) =>
    moving ? (
      <g className={`mark-part mark-${part}`}>
        <g className={`mark-part mark-${part}-idle`}>
          <g className={`mark-part mark-${part}-hover`}>{children}</g>
        </g>
      </g>
    ) : (
      children
    );
  const light = moving ? 'mark-part mark-light' : undefined;
  return (
    // The glow may spill past the mark's box, as light does.
    <svg
      ref={ref}
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 120 120"
      overflow="visible"
      className={
        [className, moving ? 'mark-live' : undefined].filter(Boolean).join(' ') || undefined
      }
      focusable="false"
    >
      <defs>
        <filter id={halo} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="2" result="blur" />
          <feFlood floodColor={COLORS.highlight} floodOpacity="0.85" result="pink" />
          <feComposite in="pink" in2="blur" operator="in" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={bloom} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="8" />
        </filter>
        <filter id={core} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="3.5" />
        </filter>
        <radialGradient id={mouth} gradientUnits="userSpaceOnUse" cx="60" cy="61" r="34">
          {MOUTH_STOPS.map(([offset, color]) => (
            <stop key={offset} offset={offset} stopColor={color} />
          ))}
        </radialGradient>
        <clipPath id={clip}>
          <path d={FRONT_CLIP} clipRule="evenodd" />
        </clipPath>
      </defs>
      <g className={light}>
        <polygon points={BLOOM} fill={COLORS.highlight} opacity="0.95" filter={`url(#${bloom})`} />
        <polygon points={BLOOM_CORE} fill="#FFC2F1" opacity="0.9" filter={`url(#${core})`} />
        <polygon points={MOUTH} fill={`url(#${mouth})`} />
      </g>
      {animated(
        'up',
        <>
          {tentacle(small ? UP_SMALL : UP)}
          {small ? null : suckers(UP_SUCKERS)}
        </>,
      )}
      {small ? null : animated('third', tentacle(THIRD))}
      <rect x={BOX.x} y={BOX.y} width={BOX.width} height={BOX.height} rx="5" fill="#E2E8F0" />
      <rect x={BOX.x} y={BOX.y} width={BOX.width} height={BOX.band} fill="#CBD5E1" />
      <g className={moving ? 'mark-part mark-lid' : undefined}>
        <polygon points={LID} fill="#F8FAFC" />
        {/* The lid's underside catching the light (its own group, so the light's fade keeps the line's opacity). */}
        <g className={light}>
          <line
            x1="12"
            y1="70.4"
            x2="78.6"
            y2="41.6"
            stroke={COLORS.highlight}
            strokeWidth="2.2"
            strokeLinecap="round"
            opacity="0.85"
          />
        </g>
      </g>
      {small ? null : (
        <g clipPath={`url(#${clip})`}>
          {animated(
            'front',
            <>
              {tentacle(FRONT)}
              {suckers(FRONT_SUCKERS)}
            </>,
          )}
        </g>
      )}
    </svg>
  );
};

/** The mark, still: icons, share cards and anywhere but the header. */
export const Mark = ({ size, className }: { size: number; className?: string }) => (
  <MarkSvg size={size} className={className} />
);
