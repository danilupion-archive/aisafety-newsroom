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

/**
 * PandorIA's mark (R-WEB-11): Pandora's box with its lid ajar, aquamarine tentacles coming out of it and hot pink light
 * pouring from the gap. Below 40 px only the rising tentacle is drawn, thicker, as in the browser tab's icon, where the
 * rest would only blur. Its filters and gradients take ids of their own, so several marks can share a page.
 * Decoration: the name beside it says the rest.
 */
export const Mark = ({ size, className }: { size: number; className?: string }) => {
  const id = useId().replace(/[^\w-]/g, '');
  const small = size < 40;
  const [halo, bloom, core, mouth, clip] = ['halo', 'bloom', 'core', 'mouth', 'clip'].map(
    (part) => `mark${id}-${part}`,
  );
  const tentacle = (d: string) => (
    <g filter={`url(#${halo})`}>
      <path d={d} fill={COLORS.accent} />
    </g>
  );
  return (
    // The glow may spill past the mark's box, as light does.
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 120 120"
      overflow="visible"
      className={className}
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
      <polygon points={BLOOM} fill={COLORS.highlight} opacity="0.95" filter={`url(#${bloom})`} />
      <polygon points={BLOOM_CORE} fill="#FFC2F1" opacity="0.9" filter={`url(#${core})`} />
      <polygon points={MOUTH} fill={`url(#${mouth})`} />
      {tentacle(small ? UP_SMALL : UP)}
      {small ? null : tentacle(THIRD)}
      <rect x={BOX.x} y={BOX.y} width={BOX.width} height={BOX.height} rx="5" fill="#E2E8F0" />
      <rect x={BOX.x} y={BOX.y} width={BOX.width} height={BOX.band} fill="#CBD5E1" />
      <polygon points={LID} fill="#F8FAFC" />
      {/* The lid's underside catching the light. */}
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
      {small ? null : (
        <>
          <g clipPath={`url(#${clip})`}>{tentacle(FRONT)}</g>
          {SUCKERS.map(([cx, cy, r]) => (
            <circle key={`${cx},${cy}`} cx={cx} cy={cy} r={r} fill={COLORS.page} />
          ))}
        </>
      )}
    </svg>
  );
};
