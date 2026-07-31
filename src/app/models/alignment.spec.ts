import { describe, it, expect } from 'vitest';
import { computeAlignment, ALIGNMENT_SNAP_THRESHOLD } from './alignment';
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
