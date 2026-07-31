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
