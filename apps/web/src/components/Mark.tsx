import type { CSSProperties, ReactNode, Ref } from 'react';

import { useId } from 'react';

import { type Point, tentacleChain } from '@/mark-segments';
import {
  BLOOM,
  BLOOM_CORE,
  BOX,
  FRONT,
  FRONT_CLIP,
  FRONT_CLIP_LIVE,
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
type Sucker = (typeof SUCKERS)[number];

/**
 * The live tentacles as chains of three segments (mark-segments.ts): where they're cut, and how far each clip lies
 * outside the outline (the short third tentacle curls tight, so its margin is smaller).
 */
const CHAINS: Record<
  Part,
  { d: string; suckers: readonly Sucker[]; chain: ReturnType<typeof tentacleChain> }
> = {
  up: { d: UP, suckers: UP_SUCKERS, chain: tentacleChain(UP, [0.45, 0.72], 1) },
  third: { d: THIRD, suckers: [], chain: tentacleChain(THIRD, [0.45, 0.7], 0.6) },
  front: { d: FRONT, suckers: FRONT_SUCKERS, chain: tentacleChain(FRONT, [0.45, 0.72], 0.8) },
};
export const LIVE_CHAINS = CHAINS;

const origin = ([x, y]: Point): CSSProperties => ({ transformOrigin: `${x}px ${y}px` });

/**
 * PandorIA's mark (R-WEB-11): Pandora's box with its lid ajar, aquamarine tentacles coming out of it and hot pink light
 * pouring from the gap. Below 40 px only the rising tentacle is drawn, thicker, as in the browser tab's icon, where the
 * rest would only blur. Its filters and gradients take ids of their own, so several marks can share a page.
 * Decoration: the name beside it says the rest.
 *
 * `live` (the header's, through LiveMark) draws the same shapes in groups the stylesheet animates (app/globals.css): the
 * lid (its reveal, then a faint lift), the light (its reveal, then its breathing in two slow layers and a faster one the
 * logo's hover turns up), and each tentacle as a chain of three segments, base, middle and tip, each turning at its own
 * joint in a slow layer and a hover layer, so the tentacle bends along its length. Every group is the identity at rest,
 * and the segments' union is the outline, so a live mark that doesn't move is the static one.
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
  const segmentClip = (part: Part, k: number) => `mark${id}-${part}-${k + 1}`;
  const tentacle = (d: string) => (
    <g filter={`url(#${halo})`}>
      <path d={d} fill={COLORS.accent} />
    </g>
  );
  const suckers = (list: readonly Sucker[]) =>
    list.map(([cx, cy, r]) => (
      <circle key={`${cx},${cy}`} cx={cx} cy={cy} r={r} fill={COLORS.page} />
    ));
  /**
   * A live tentacle: its reveal, its halo over the whole chain, then the chain. Each segment turns at its joint in two
   * layers (slow, and hover); its own copy of the outline is clipped to its stretch, and its suckers come after every
   * segment further out, so a joint's overlap never covers one.
   */
  const chain = (part: Part) => {
    const {
      d,
      suckers: list,
      chain: { segments, segmentOf },
    } = CHAINS[part];
    const level = (k: number): ReactNode => {
      const segment = segments[k as 0 | 1 | 2];
      const at = origin(segment.pivot);
      const name = `mark-${part}-${k + 1}`;
      return (
        <g className={`mark-part mark-bend ${name}`} style={at}>
          <g className={`mark-part mark-bend-hover ${name}`} style={at}>
            <path d={d} fill={COLORS.accent} clipPath={`url(#${segmentClip(part, k)})`} />
            {k < 2 ? level(k + 1) : null}
            {suckers(list.filter(([cx, cy]) => segmentOf([cx, cy]) === k))}
          </g>
        </g>
      );
    };
    return (
      <g className={`mark-part mark-${part}`}>
        <g filter={`url(#${halo})`}>{level(0)}</g>
      </g>
    );
  };
  const glow = (children: ReactNode) =>
    moving ? (
      <g className="mark-part mark-light">
        <g className="mark-part mark-glow mark-glow-a">
          <g className="mark-part mark-glow mark-glow-b">
            <g className="mark-part mark-glow mark-glow-hover">{children}</g>
          </g>
        </g>
      </g>
    ) : (
      children
    );
  const lid = (children: ReactNode) =>
    moving ? (
      <g className="mark-part mark-lid">
        <g className="mark-part mark-lid-lift">{children}</g>
      </g>
    ) : (
      children
    );
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
          <path d={moving ? FRONT_CLIP_LIVE : FRONT_CLIP} clipRule="evenodd" />
        </clipPath>
        {moving
          ? (Object.keys(CHAINS) as Part[]).flatMap((part) =>
              CHAINS[part].chain.segments.map((segment, k) => (
                <clipPath key={`${part}-${k}`} id={segmentClip(part, k)}>
                  <polygon points={segment.polygon.map((point) => point.join(',')).join(' ')} />
                  {segment.discs.map(([cx, cy, r]) => (
                    <circle key={`${cx},${cy}`} cx={cx} cy={cy} r={r} />
                  ))}
                </clipPath>
              )),
            )
          : null}
      </defs>
      {glow(
        <>
          <polygon
            points={BLOOM}
            fill={COLORS.highlight}
            opacity="0.95"
            filter={`url(#${bloom})`}
          />
          <polygon points={BLOOM_CORE} fill="#FFC2F1" opacity="0.9" filter={`url(#${core})`} />
          <polygon points={MOUTH} fill={`url(#${mouth})`} />
        </>,
      )}
      {moving ? (
        chain('up')
      ) : (
        <>
          {tentacle(small ? UP_SMALL : UP)}
          {small ? null : suckers(UP_SUCKERS)}
        </>
      )}
      {small ? null : moving ? chain('third') : tentacle(THIRD)}
      <rect x={BOX.x} y={BOX.y} width={BOX.width} height={BOX.height} rx="5" fill="#E2E8F0" />
      <rect x={BOX.x} y={BOX.y} width={BOX.width} height={BOX.band} fill="#CBD5E1" />
      {lid(
        <>
          <polygon points={LID} fill="#F8FAFC" />
          {/* The lid's underside catching the light (its own group, so the light's fade keeps the line's opacity). */}
          <g className={moving ? 'mark-part mark-light' : undefined}>
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
        </>,
      )}
      {small ? null : (
        <g clipPath={`url(#${clip})`}>
          {moving ? (
            chain('front')
          ) : (
            <>
              {tentacle(FRONT)}
              {suckers(FRONT_SUCKERS)}
            </>
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
