/**
 * The header mark's tentacles as chains (R-WEB-11): each outline in mark-shapes.ts is cut into three segments, base,
 * middle and tip, so the live mark can bend them joint by joint. A segment is the whole outline clipped to its stretch:
 * between two joints, the outline's own sides pushed out by a small margin (so the clip never trims the outline's
 * edge), reaching a hair past each joint into the next stretch, plus a disc at each joint just inside the outline. At
 * rest the segments' union is exactly the outline, with no clip edge left bare inside it; bent, a joint turns about its
 * disc's centre, so the disc fills the opening on the outer side of the bend, as a knee, and the hair of overlap is all
 * that the outline gains there.
 *
 * The outlines run up one side from the root to the tip, round the tip with an arc, and down the other side: pairing the
 * two sides point by point gives the centre line and the half width all along.
 */

export type Point = readonly [number, number];

export interface Segment {
  /** Where it turns: its joint with the segment before (the base turns where the tentacle leaves the box). */
  pivot: Point;
  /** The clip region: a polygon along its stretch, and discs at its joints (and at the root or the tip). */
  polygon: readonly Point[];
  discs: readonly (readonly [number, number, number])[];
}

export interface Chain {
  segments: readonly [Segment, Segment, Segment];
  /** The segment, 0 to 2, a point on the tentacle belongs to (for its suckers). */
  segmentOf: (point: Point) => 0 | 1 | 2;
}

const NUMBER = /[MLAZ]|-?\d+(?:\.\d+)?/g;

/** The outline's two sides, root to tip and tip to root, without the arc's own parameters. */
export const outlineSides = (d: string): { up: Point[]; down: Point[] } => {
  const tokens = d.match(NUMBER) ?? [];
  const up: Point[] = [];
  const down: Point[] = [];
  let side = up;
  for (let i = 0; i < tokens.length;) {
    const command = tokens[i++];
    if (command === 'M' || command === 'L') {
      side.push([Number(tokens[i++]), Number(tokens[i++])]);
    } else if (command === 'A') {
      // rx ry rotation large-arc sweep, then the arc's end: the first point of the way down.
      i += 5;
      side = down;
      side.push([Number(tokens[i++]), Number(tokens[i++])]);
    }
  }
  return { up, down };
};

const distance = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const round = (value: number) => Math.round(value * 100) / 100;
const lerp = (a: Point, b: Point, t: number): Point => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
];
/** How far a point is from a polyline. */
const away = (point: Point, line: readonly Point[]) => {
  let nearest = Infinity;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1] as Point;
    const b = line[i] as Point;
    const length = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2;
    const t =
      length === 0
        ? 0
        : Math.max(
            0,
            Math.min(
              1,
              ((point[0] - a[0]) * (b[0] - a[0]) + (point[1] - a[1]) * (b[1] - a[1])) / length,
            ),
          );
    nearest = Math.min(nearest, distance(point, lerp(a, b, t)));
  }
  return nearest;
};

/** How far, in points along the outline, a stretch reaches past its joint (the points are about a unit apart). */
const OVERLAP = 0.35;

/**
 * Cuts an outline into a chain. `joints` are the two cuts as fractions of the centre line's length from the root;
 * `margin` is how far the clip lies outside the outline's sides (kept below half the gap between parts of the same
 * tentacle that come close, so a segment never takes in a piece of another).
 */
export const tentacleChain = (
  d: string,
  joints: readonly [number, number],
  margin: number,
): Chain => {
  const { up, down } = outlineSides(d);
  const count = up.length;
  const partner = (i: number) =>
    down[down.length - 1 - Math.round((i * (down.length - 1)) / (count - 1))] as Point;
  const centre: Point[] = [];
  const half: number[] = [];
  const outward: Point[] = [];
  for (let i = 0; i < count; i++) {
    const a = up[i] as Point;
    const b = partner(i);
    const width = distance(a, b);
    centre.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
    half.push(width / 2);
    outward.push(width === 0 ? [0, 0] : [(a[0] - b[0]) / width, (a[1] - b[1]) / width]);
  }
  const along = [0];
  for (let i = 1; i < count; i++) {
    along.push((along[i - 1] as number) + distance(centre[i] as Point, centre[i - 1] as Point));
  }
  const length = along[count - 1] as number;
  const at = (fraction: number) => along.findIndex((value) => value >= fraction * length);
  const cuts = [0, at(joints[0]), at(joints[1]), count - 1] as const;
  const mouth = Math.max(
    0,
    centre.findIndex((point) => point[1] < 70),
  );
  const pivotOf = ([x, y]: Point): Point => [round(x), round(y)];
  /**
   * Where a joint turns: the point of its cut as far from one side as from the other, the centre of the widest disc
   * that fits there, so the disc fills the bend's outer side right up to the outline.
   */
  const middle = (i: number): Point => {
    const a = up[i] as Point;
    const b = partner(i);
    let [low, high] = [0, 1];
    for (let step = 0; step < 30; step++) {
      const t = (low + high) / 2;
      [low, high] = away(lerp(a, b, t), up) < away(lerp(a, b, t), down) ? [t, high] : [low, t];
    }
    return lerp(a, b, (low + high) / 2);
  };
  const disc = ([x, y]: Point, radius: number) => [round(x), round(y), round(radius)] as const;
  // A joint's disc stays just inside the outline, so bending never pushes its edge out; the root's straight end and the
  // tip's round cap, with nothing to turn against, get a disc a margin wider, so they stay inside the clip.
  const joint = (i: number) => disc(middle(i), away(middle(i), up) - 0.05);
  const end = (i: number, extra: number) =>
    disc(centre[i] as Point, (half[i] as number) + margin + extra);
  /** The outline's two sides, pushed out by the margin, at a point's index, which may fall between two points. */
  const sidesAt = (index: number): [Point, Point] => {
    const i = Math.min(Math.floor(index), count - 2);
    const t = index - i;
    const a = lerp(up[i] as Point, up[i + 1] as Point, t);
    const b = lerp(partner(i), partner(i + 1), t);
    const [ux, uy] = lerp(outward[i] as Point, outward[i + 1] as Point, t);
    return [
      [round(a[0] + ux * margin), round(a[1] + uy * margin)],
      [round(b[0] - ux * margin), round(b[1] - uy * margin)],
    ];
  };
  const stretch = (from: number, to: number): Point[] => {
    const indices = [from];
    for (let i = Math.floor(from) + 1; i < to; i++) {
      indices.push(i);
    }
    indices.push(to);
    const pairs = indices.map(sidesAt);
    return [...pairs.map(([left]) => left), ...pairs.map(([, right]) => right).reverse()];
  };
  const segments = [0, 1, 2].map((k) => {
    const from = cuts[k] as number;
    const to = cuts[k + 1] as number;
    return {
      pivot: pivotOf(k === 0 ? (centre[mouth] as Point) : middle(from)),
      polygon: stretch(k === 0 ? from : from - OVERLAP, k === 2 ? to : to + OVERLAP),
      discs: [k === 0 ? end(from, 1) : joint(from), k === 2 ? end(to, 0.5) : joint(to)],
    };
  }) as unknown as [Segment, Segment, Segment];
  const segmentOf = (point: Point): 0 | 1 | 2 => {
    let nearest = 0;
    for (let i = 1; i < count; i++) {
      if (distance(point, centre[i] as Point) < distance(point, centre[nearest] as Point)) {
        nearest = i;
      }
    }
    return nearest < cuts[1] ? 0 : nearest < cuts[2] ? 1 : 2;
  };
  return { segments, segmentOf };
};

/** Whether a point lies inside a polygon (even–odd rule), for the tests' check that the segments cover the outline. */
export const insidePolygon = (point: Point, polygon: readonly Point[]): boolean => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i] as Point;
    const [xj, yj] = polygon[j] as Point;
    if (
      yi > point[1] !== yj > point[1] &&
      point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
};
