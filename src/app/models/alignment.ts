import { Rect } from './marquee';

// Pure Alignment Guide geometry (issue #22, ADR-0017). While a Node is dragged,
// its edges and center axes are matched against other Nodes; a match within the
// threshold snaps the drag and draws a transient guide line. No Angular, no DOM.
//
// Coordinates are canvas units. The threshold is passed in canvas units — the
// caller sizes it per-frame from a screen-pixel constant divided by zoom, so
// the on-screen grab stays constant while this stays a pure function.

// The magnetic grab, in SCREEN pixels. Callers convert to canvas units as
// ALIGNMENT_SNAP_THRESHOLD / zoom before calling computeAlignment (ADR-0017).
export const ALIGNMENT_SNAP_THRESHOLD = 6;

// Two coincident axis positions closer than this (canvas units) are treated as
// the same guide. Any genuine coincidence lands well inside it.
const GUIDE_EPSILON = 0.5;

export interface AlignmentGuide {
  // A vertical guide is a line at a fixed x spanning [start, end] in y;
  // a horizontal guide is a line at a fixed y spanning [start, end] in x.
  orientation: 'vertical' | 'horizontal';
  position: number;
  start: number;
  end: number;
}

export interface AlignmentResult {
  // Offsets to add to the dragged rect so it lands on its nearest alignment
  // (0 on an axis with no snap).
  dx: number;
  dy: number;
  guides: AlignmentGuide[];
}

// The three reference axes of a rect on each dimension.
function verticalAxes(r: Rect): number[] {
  return [r.x, r.x + r.width / 2, r.x + r.width];
}

function horizontalAxes(r: Rect): number[] {
  return [r.y, r.y + r.height / 2, r.y + r.height];
}

// The nearest signed offset (candidate axis − dragged axis) across the full
// 3×3 pairing that falls within the threshold; 0 when nothing is in range.
function nearestOffset(draggedAxes: number[], candidateAxes: number[][], threshold: number): number {
  let best = 0;
  let bestAbs = Infinity;
  for (const cand of candidateAxes) {
    for (const ca of cand) {
      for (const da of draggedAxes) {
        const delta = ca - da;
        const abs = Math.abs(delta);
        if (abs <= threshold && abs < bestAbs) {
          bestAbs = abs;
          best = delta;
        }
      }
    }
  }
  return best;
}

/**
 * Align the dragged rect against the candidate rects. Returns the snap offset
 * for each axis (independently resolved, nearest match wins) and a guide line
 * for every candidate axis that coincides with the dragged rect once snapped —
 * each guide spanning the dragged rect plus all candidates sharing that line.
 */
export function computeAlignment(dragged: Rect, candidates: Rect[], threshold: number): AlignmentResult {
  const candVertical = candidates.map(verticalAxes);
  const candHorizontal = candidates.map(horizontalAxes);

  const dx = nearestOffset(verticalAxes(dragged), candVertical, threshold);
  const dy = nearestOffset(horizontalAxes(dragged), candHorizontal, threshold);

  // Guides are drawn from the final (snapped) dragged rect, so a vertical
  // guide's span already reflects the y-snap and vice versa.
  const final: Rect = { x: dragged.x + dx, y: dragged.y + dy, width: dragged.width, height: dragged.height };

  const guides: AlignmentGuide[] = [
    ...axisGuides('vertical', verticalAxes(final), candidates, verticalAxes,
      final.y, final.y + final.height, r => r.y, r => r.y + r.height),
    ...axisGuides('horizontal', horizontalAxes(final), candidates, horizontalAxes,
      final.x, final.x + final.width, r => r.x, r => r.x + r.width),
  ];

  return { dx, dy, guides };
}

// The edges a Resize Grip drag moves: the dragged corner's vertical edge
// (left or right) and horizontal edge (top or bottom).
export interface MovingEdges {
  vertical: 'left' | 'right';
  horizontal: 'top' | 'bottom';
}

/**
 * Align a resize against the candidate rects: only the two MOVING edges
 * participate — never the anchored edges or the resized rect's centers, which
 * would fight the anchor — while candidates still expose all three axes per
 * dimension. dx/dy are the offsets to apply to the moving edges (a left/top
 * snap shifts x/y and the size together; a right/bottom snap only the size).
 * Guides render from the snapped rect, exactly as in computeAlignment.
 */
export function computeResizeAlignment(
  rect: Rect,
  moving: MovingEdges,
  candidates: Rect[],
  threshold: number,
): AlignmentResult {
  const movingX = moving.vertical === 'left' ? rect.x : rect.x + rect.width;
  const movingY = moving.horizontal === 'top' ? rect.y : rect.y + rect.height;

  const dx = nearestOffset([movingX], candidates.map(verticalAxes), threshold);
  const dy = nearestOffset([movingY], candidates.map(horizontalAxes), threshold);

  const final: Rect = {
    x: moving.vertical === 'left' ? rect.x + dx : rect.x,
    y: moving.horizontal === 'top' ? rect.y + dy : rect.y,
    width: moving.vertical === 'left' ? rect.width - dx : rect.width + dx,
    height: moving.horizontal === 'top' ? rect.height - dy : rect.height + dy,
  };

  const guides: AlignmentGuide[] = [
    ...axisGuides('vertical', [movingX + dx], candidates, verticalAxes,
      final.y, final.y + final.height, r => r.y, r => r.y + r.height),
    ...axisGuides('horizontal', [movingY + dy], candidates, horizontalAxes,
      final.x, final.x + final.width, r => r.x, r => r.x + r.width),
  ];

  return { dx, dy, guides };
}

// One guide per distinct position where a dragged axis coincides with a
// candidate axis; the span covers the dragged rect and every coincident
// candidate on the perpendicular dimension.
function axisGuides(
  orientation: 'vertical' | 'horizontal',
  draggedAxes: number[],
  candidates: Rect[],
  candidateAxes: (r: Rect) => number[],
  draggedSpanMin: number,
  draggedSpanMax: number,
  candSpanMin: (r: Rect) => number,
  candSpanMax: (r: Rect) => number,
): AlignmentGuide[] {
  const groups = new Map<string, { position: number; start: number; end: number }>();
  for (const da of draggedAxes) {
    for (const cand of candidates) {
      for (const ca of candidateAxes(cand)) {
        if (Math.abs(da - ca) > GUIDE_EPSILON) continue;
        const key = ca.toFixed(2);
        const existing = groups.get(key);
        groups.set(key, {
          position: ca,
          start: Math.min(draggedSpanMin, candSpanMin(cand), existing?.start ?? Infinity),
          end: Math.max(draggedSpanMax, candSpanMax(cand), existing?.end ?? -Infinity),
        });
      }
    }
  }
  return [...groups.values()].map(g => ({ orientation, position: g.position, start: g.start, end: g.end }));
}
