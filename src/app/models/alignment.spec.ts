import { describe, it, expect } from 'vitest';
import { computeAlignment, computeResizeAlignment, ALIGNMENT_SNAP_THRESHOLD } from './alignment';
import { Rect } from './marquee';

// The dragged rect used across most cases: left=100, centerX=150, right=200;
// top=100, centerY=120, bottom=140. Every expected value below is worked out
// by hand from these axes — an independent source of truth, never recomputed
// the way the implementation does.
const dragged = (): Rect => ({ x: 100, y: 100, width: 100, height: 40 });
const T = ALIGNMENT_SNAP_THRESHOLD; // 6 canvas units

describe('computeAlignment', () => {
  it('returns no offset and no guides when there are no candidates', () => {
    expect(computeAlignment(dragged(), [], T)).toEqual({ dx: 0, dy: 0, guides: [] });
  });

  it('snaps left-edge to left-edge and draws the vertical guide spanning both', () => {
    // candidate left=104 → delta +4 (within 6); no other axis is closer
    const candidate: Rect = { x: 104, y: 300, width: 60, height: 30 };
    expect(computeAlignment(dragged(), [candidate], T)).toEqual({
      dx: 4,
      dy: 0,
      guides: [{ orientation: 'vertical', position: 104, start: 100, end: 330 }],
    });
  });

  it('snaps horizontal-center to horizontal-center', () => {
    // candidate centerX=148 → dragged centerX 150 delta -2, the nearest pair
    const candidate: Rect = { x: 118, y: 300, width: 60, height: 30 };
    expect(computeAlignment(dragged(), [candidate], T)).toEqual({
      dx: -2,
      dy: 0,
      guides: [{ orientation: 'vertical', position: 148, start: 100, end: 330 }],
    });
  });

  it('snaps a left edge onto a candidate right edge (edge-to-opposite-edge)', () => {
    // candidate right=102 → dragged left 100 delta +2
    const candidate: Rect = { x: 60, y: 300, width: 42, height: 20 };
    expect(computeAlignment(dragged(), [candidate], T)).toEqual({
      dx: 2,
      dy: 0,
      guides: [{ orientation: 'vertical', position: 102, start: 100, end: 320 }],
    });
  });

  it('snaps a top edge onto a candidate vertical center (edge-to-center)', () => {
    // candidate centerY=97 → dragged top 100 delta -3; candidate x is far, no X snap
    const candidate: Rect = { x: 400, y: 85, width: 20, height: 24 };
    expect(computeAlignment(dragged(), [candidate], T)).toEqual({
      dx: 0,
      dy: -3,
      guides: [{ orientation: 'horizontal', position: 97, start: 100, end: 420 }],
    });
  });

  it('snaps both axes at once, emitting one vertical and one horizontal guide', () => {
    // left→left delta +3; top→top delta -3
    const candidate: Rect = { x: 103, y: 97, width: 40, height: 30 };
    expect(computeAlignment(dragged(), [candidate], T)).toEqual({
      dx: 3,
      dy: -3,
      guides: [
        { orientation: 'vertical', position: 103, start: 97, end: 137 },
        { orientation: 'horizontal', position: 97, start: 103, end: 203 },
      ],
    });
  });

  it('lets the nearest candidate win on a shared axis', () => {
    // A: left=102 (delta +2). B: left=105 (delta +5). Nearest is A.
    const a: Rect = { x: 102, y: 300, width: 40, height: 20 };
    const b: Rect = { x: 105, y: 400, width: 40, height: 20 };
    expect(computeAlignment(dragged(), [a, b], T)).toEqual({
      dx: 2,
      dy: 0,
      guides: [{ orientation: 'vertical', position: 102, start: 100, end: 320 }],
    });
  });

  it('does not snap to a candidate just beyond the threshold', () => {
    // Only axis in range would be left=107 (delta +7 > 6); width keeps the
    // other axes far from the dragged centre/right
    const candidate: Rect = { x: 107, y: 300, width: 20, height: 20 };
    expect(computeAlignment(dragged(), [candidate], T)).toEqual({ dx: 0, dy: 0, guides: [] });
  });

  it('snaps a candidate sitting exactly at the threshold distance', () => {
    // left=106 → delta +6 == threshold, inclusive
    const candidate: Rect = { x: 106, y: 300, width: 20, height: 20 };
    expect(computeAlignment(dragged(), [candidate], T)).toEqual({
      dx: 6,
      dy: 0,
      guides: [{ orientation: 'vertical', position: 106, start: 100, end: 320 }],
    });
  });

  it('spans one guide across every candidate sharing the aligned position', () => {
    // Two candidates share left=104; the single guide spans down to the lower one
    const a: Rect = { x: 104, y: 300, width: 40, height: 20 };
    const b: Rect = { x: 104, y: 500, width: 40, height: 20 };
    expect(computeAlignment(dragged(), [a, b], T)).toEqual({
      dx: 4,
      dy: 0,
      guides: [{ orientation: 'vertical', position: 104, start: 100, end: 520 }],
    });
  });

  it('shows a guide at rest (dx 0) when already aligned within threshold', () => {
    const candidate: Rect = { x: 100, y: 300, width: 40, height: 20 };
    expect(computeAlignment(dragged(), [candidate], T)).toEqual({
      dx: 0,
      dy: 0,
      guides: [{ orientation: 'vertical', position: 100, start: 100, end: 320 }],
    });
  });
});

describe('computeResizeAlignment', () => {
  // The rect being resized: left=100, right=195; top=100, bottom=140.
  // An 'se' grip drag moves the right and bottom edges; 'nw' the left and top.
  const rect = (): Rect => ({ x: 100, y: 100, width: 95, height: 40 });
  const se = { vertical: 'right', horizontal: 'bottom' } as const;
  const nw = { vertical: 'left', horizontal: 'top' } as const;

  it('returns no offset and no guides when there are no candidates', () => {
    expect(computeResizeAlignment(rect(), se, [], T)).toEqual({ dx: 0, dy: 0, guides: [] });
  });

  it('snaps the moving right edge onto a candidate left edge', () => {
    // candidate left=198 → moving right edge 195, dx +3; guide spans both rects
    const candidate: Rect = { x: 198, y: 300, width: 50, height: 30 };
    expect(computeResizeAlignment(rect(), se, [candidate], T)).toEqual({
      dx: 3,
      dy: 0,
      guides: [{ orientation: 'vertical', position: 198, start: 100, end: 330 }],
    });
  });

  it('snaps the moving edge onto a candidate center (edge-to-center)', () => {
    // candidate centerX=192 → moving right edge 195, dx -3
    const candidate: Rect = { x: 160, y: 300, width: 64, height: 20 };
    expect(computeResizeAlignment(rect(), se, [candidate], T)).toEqual({
      dx: -3,
      dy: 0,
      guides: [{ orientation: 'vertical', position: 192, start: 100, end: 320 }],
    });
  });

  it('never snaps the anchored edge or the centers of the resized rect', () => {
    // candidate left=98 sits 2 from the ANCHORED left edge (would snap a move)
    // but 97 from the moving right edge → resize must ignore it
    const candidate: Rect = { x: 98, y: 300, width: 20, height: 20 };
    expect(computeResizeAlignment(rect(), se, [candidate], T)).toEqual({ dx: 0, dy: 0, guides: [] });
  });

  it('applies a west-edge snap to x and width together', () => {
    // nw grip: moving left edge 100 → candidate left 104, dx +4
    const candidate: Rect = { x: 104, y: 300, width: 40, height: 20 };
    expect(computeResizeAlignment(rect(), nw, [candidate], T)).toEqual({
      dx: 4,
      dy: 0,
      guides: [{ orientation: 'vertical', position: 104, start: 100, end: 320 }],
    });
  });

  it('snaps both moving edges at once from one corner', () => {
    // candidate left=198 (dx +3) and top=137 (dy -3 for the bottom edge)
    const candidate: Rect = { x: 198, y: 137, width: 50, height: 63 };
    expect(computeResizeAlignment(rect(), se, [candidate], T)).toEqual({
      dx: 3,
      dy: -3,
      guides: [
        { orientation: 'vertical', position: 198, start: 100, end: 200 },
        { orientation: 'horizontal', position: 137, start: 100, end: 248 },
      ],
    });
  });

  it('does not snap a candidate just beyond the threshold', () => {
    // candidate left=202 → delta 7 > 6; every other axis is farther still
    const candidate: Rect = { x: 202, y: 300, width: 20, height: 20 };
    expect(computeResizeAlignment(rect(), se, [candidate], T)).toEqual({ dx: 0, dy: 0, guides: [] });
  });

  it('reports guides for exact coincidences at threshold 0 (post-clamp rendering)', () => {
    // The caller re-runs with the applied rect and threshold 0, so a snap the
    // service clamped away yields no guide while an exact landing keeps one
    const already: Rect = { x: 100, y: 100, width: 98, height: 40 }; // right edge 198
    const candidate: Rect = { x: 198, y: 300, width: 50, height: 30 };
    expect(computeResizeAlignment(already, se, [candidate], 0)).toEqual({
      dx: 0,
      dy: 0,
      guides: [{ orientation: 'vertical', position: 198, start: 100, end: 330 }],
    });
  });
});
