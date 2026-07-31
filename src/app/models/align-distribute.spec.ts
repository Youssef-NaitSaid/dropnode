import { describe, it, expect } from 'vitest';
import { alignRects, distributeRects, RootRect } from './align-distribute';

// Three Selection roots with hand-worked axes (spec #25). Union box:
// left=50, right=280, top=100, bottom=360 → centerX=165, centerY=230.
//   a: left=100 right=200 top=100 bottom=140
//   b: left=220 right=280 top=160 bottom=180
//   c: left=50  right=130 top=300 bottom=360
const roots = (): RootRect[] => [
  { id: 'a', x: 100, y: 100, width: 100, height: 40 },
  { id: 'b', x: 220, y: 160, width: 60, height: 20 },
  { id: 'c', x: 50, y: 300, width: 80, height: 60 },
];

describe('alignRects', () => {
  it('returns nothing for fewer than two rects', () => {
    expect(alignRects([], 'left')).toEqual([]);
    expect(alignRects([{ id: 'a', x: 10, y: 10, width: 40, height: 20 }], 'left')).toEqual([]);
  });

  it('flushes left edges to the union left, skipping the already-flush extreme', () => {
    // c sits at the union left (50) and must not appear among the movers
    expect(alignRects(roots(), 'left')).toEqual([
      { id: 'a', x: 50, y: 100 },
      { id: 'b', x: 50, y: 160 },
    ]);
  });

  it('centers on the union horizontal center', () => {
    // centerX 165 → a: 165-50=115, b: 165-30=135, c: 165-40=125
    expect(alignRects(roots(), 'center')).toEqual([
      { id: 'a', x: 115, y: 100 },
      { id: 'b', x: 135, y: 160 },
      { id: 'c', x: 125, y: 300 },
    ]);
  });

  it('flushes right edges to the union right, skipping the extreme', () => {
    // union right 280 → a: 280-100=180, c: 280-80=200; b is the extreme
    expect(alignRects(roots(), 'right')).toEqual([
      { id: 'a', x: 180, y: 100 },
      { id: 'c', x: 200, y: 300 },
    ]);
  });

  it('flushes top edges to the union top, leaving x untouched', () => {
    expect(alignRects(roots(), 'top')).toEqual([
      { id: 'b', x: 220, y: 100 },
      { id: 'c', x: 50, y: 100 },
    ]);
  });

  it('centers on the union vertical middle', () => {
    // centerY 230 → a: 230-20=210, b: 230-10=220, c: 230-30=200
    expect(alignRects(roots(), 'middle')).toEqual([
      { id: 'a', x: 100, y: 210 },
      { id: 'b', x: 220, y: 220 },
      { id: 'c', x: 50, y: 200 },
    ]);
  });

  it('flushes bottom edges to the union bottom', () => {
    // union bottom 360 → a: 360-40=320, b: 360-20=340; c is the extreme
    expect(alignRects(roots(), 'bottom')).toEqual([
      { id: 'a', x: 100, y: 320 },
      { id: 'b', x: 220, y: 340 },
    ]);
  });

  it('returns nothing when every rect is already aligned', () => {
    const flush: RootRect[] = [
      { id: 'a', x: 40, y: 0, width: 30, height: 20 },
      { id: 'b', x: 40, y: 50, width: 60, height: 20 },
    ];
    expect(alignRects(flush, 'left')).toEqual([]);
  });
});

describe('distributeRects', () => {
  it('returns nothing for fewer than three rects', () => {
    expect(distributeRects([], 'horizontal')).toEqual([]);
    expect(
      distributeRects(
        [
          { id: 'a', x: 0, y: 0, width: 40, height: 40 },
          { id: 'b', x: 200, y: 0, width: 40, height: 40 },
        ],
        'horizontal',
      ),
    ).toEqual([]);
  });

  it('equalizes horizontal edge gaps, anchoring the two extremes', () => {
    // Sorted by centerX: r1 (20), r2 (60), r3 (220). Span between anchors:
    // r3.left 200 − r1.right 40 = 160; minus r2's width 20 → 140 over two
    // gaps = 70 each → r2.x = 40 + 70 = 110. y is untouched.
    const rects: RootRect[] = [
      { id: 'r1', x: 0, y: 0, width: 40, height: 40 },
      { id: 'r2', x: 50, y: 10, width: 20, height: 20 },
      { id: 'r3', x: 200, y: 20, width: 40, height: 40 },
    ];
    expect(distributeRects(rects, 'horizontal')).toEqual([{ id: 'r2', x: 110, y: 10 }]);
  });

  it('places several middles in center order along the axis', () => {
    // Sorted by centerX: r1 (5), r3 (50), r2 (105), r4 (170). Gap:
    // (160 − 10 − (20+10)) / 3 = 40 → r3.x = 10+40 = 50 (from 40),
    // r2.x = 50+20+40 = 110 (from 100); movers come back in center order.
    const rects: RootRect[] = [
      { id: 'r1', x: 0, y: 0, width: 10, height: 10 },
      { id: 'r2', x: 100, y: 0, width: 10, height: 10 },
      { id: 'r3', x: 40, y: 0, width: 20, height: 10 },
      { id: 'r4', x: 160, y: 0, width: 20, height: 10 },
    ];
    expect(distributeRects(rects, 'horizontal')).toEqual([
      { id: 'r3', x: 50, y: 0 },
      { id: 'r2', x: 110, y: 0 },
    ]);
  });

  it('equalizes vertical edge gaps on the y axis, leaving x untouched', () => {
    // Sorted by centerY: t1 (20), t2 (60), t3 (220); gap (200−40−20)/2 = 70
    // → t2.y = 40 + 70 = 110.
    const rects: RootRect[] = [
      { id: 't1', x: 0, y: 0, width: 40, height: 40 },
      { id: 't2', x: 10, y: 50, width: 20, height: 20 },
      { id: 't3', x: 20, y: 200, width: 40, height: 40 },
    ];
    expect(distributeRects(rects, 'vertical')).toEqual([{ id: 't2', x: 10, y: 110 }]);
  });

  it('accepts a negative gap when the rects overflow the span', () => {
    // roots() sorted by centerX: c (90), a (150), b (250). Gap:
    // (220 − 130 − 100) / 2 = −5 → a.x = 130 − 5 = 125; anchors stay.
    expect(distributeRects(roots(), 'horizontal')).toEqual([{ id: 'a', x: 125, y: 100 }]);
  });

  it('breaks center ties stably by the given order', () => {
    // tieA and tieB share centerX 65; tieA comes first in the input so it is
    // placed first. Gap: (170 − 10 − (30+10)) / 3 = 40 → tieA.x = 10+40 = 50
    // (no move), tieB.x = 50+30+40 = 120.
    const rects: RootRect[] = [
      { id: 'first', x: 0, y: 0, width: 10, height: 10 },
      { id: 'tieA', x: 50, y: 0, width: 30, height: 10 },
      { id: 'tieB', x: 60, y: 0, width: 10, height: 10 },
      { id: 'last', x: 170, y: 0, width: 10, height: 10 },
    ];
    expect(distributeRects(rects, 'horizontal')).toEqual([{ id: 'tieB', x: 120, y: 0 }]);
  });

  it('returns nothing when the gaps are already equal', () => {
    const rects: RootRect[] = [
      { id: 'a', x: 0, y: 0, width: 10, height: 10 },
      { id: 'b', x: 30, y: 5, width: 10, height: 10 },
      { id: 'c', x: 60, y: 10, width: 10, height: 10 },
    ];
    expect(distributeRects(rects, 'horizontal')).toEqual([]);
  });
});
