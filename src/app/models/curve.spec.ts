import { describe, it, expect } from 'vitest';
import { connectionCurve, pointAt, textPositionFromPoint } from './curve';
import { TEXT_POSITION_MIN, TEXT_POSITION_MAX, TEXT_POSITION_DEFAULT } from './connection';

// A horizontal right→left curve: start (0,0), end (100,0), distance 100,
// control offset clamp(100 * 0.4, 40, 150) = 40 → cp1 (40,0), cp2 (60,0).
// Every curve point lies on y = 0 with x strictly increasing, so projections
// have an independently checkable ground truth.
const flatCurve = () =>
  connectionCurve({ x: 0, y: 0 }, { x: 100, y: 0 }, 'right', 'left');

describe('connectionCurve', () => {
  it('extends control points perpendicular to each Handle edge, offset clamped at 40 minimum', () => {
    const curve = flatCurve();
    expect(curve.cp1).toEqual({ x: 40, y: 0 });
    expect(curve.cp2).toEqual({ x: 60, y: 0 });
  });

  it('caps the control offset at 150 for long curves', () => {
    const curve = connectionCurve({ x: 0, y: 0 }, { x: 1000, y: 0 }, 'right', 'left');
    expect(curve.cp1).toEqual({ x: 150, y: 0 });
    expect(curve.cp2).toEqual({ x: 850, y: 0 });
  });

  it('offsets vertically for top/bottom Handles', () => {
    const curve = connectionCurve({ x: 0, y: 0 }, { x: 0, y: 100 }, 'bottom', 'top');
    expect(curve.cp1).toEqual({ x: 0, y: 40 });
    expect(curve.cp2).toEqual({ x: 0, y: 60 });
  });
});

describe('pointAt', () => {
  it('returns the start point at t = 0 and the end point at t = 1', () => {
    const curve = flatCurve();
    expect(pointAt(curve, 0)).toEqual({ x: 0, y: 0 });
    expect(pointAt(curve, 1)).toEqual({ x: 100, y: 0 });
  });

  it('returns the known bezier midpoint at t = 0.5', () => {
    // (start + 3·cp1 + 3·cp2 + end) / 8 = (0 + 120 + 180 + 100) / 8 = 50
    expect(pointAt(flatCurve(), 0.5)).toEqual({ x: 50, y: 0 });
  });
});

describe('textPositionFromPoint', () => {
  it('snaps to the midpoint when the projected point is within 15 canvas units of it', () => {
    // Cursor above x = 60: nearest curve point is (60, 0), 10 units from the
    // midpoint (50, 0) — inside the snap radius
    const t = textPositionFromPoint(flatCurve(), { x: 60, y: 5 });
    expect(t).toBe(TEXT_POSITION_DEFAULT);
  });

  it('does not snap when the projected point is farther than 15 canvas units from the midpoint', () => {
    // Nearest curve point is (70, 0), 20 units from the midpoint
    const t = textPositionFromPoint(flatCurve(), { x: 70, y: 0 });
    expect(t).toBeGreaterThan(TEXT_POSITION_DEFAULT);
  });

  it('projects the cursor to the nearest point on the curve', () => {
    const curve = flatCurve();
    const t = textPositionFromPoint(curve, { x: 85, y: 10 });
    // On this flat curve the nearest point to (85, 10) sits at x = 85
    expect(pointAt(curve, t).x).toBeCloseTo(85, 0);
    expect(pointAt(curve, t).y).toBe(0);
  });

  it('clamps to the maximum when the cursor is past the target endpoint', () => {
    const t = textPositionFromPoint(flatCurve(), { x: 250, y: 0 });
    expect(t).toBe(TEXT_POSITION_MAX);
  });

  it('clamps to the minimum when the cursor is before the source endpoint', () => {
    const t = textPositionFromPoint(flatCurve(), { x: -250, y: 0 });
    expect(t).toBe(TEXT_POSITION_MIN);
  });
});
