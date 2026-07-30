import { HandleSide } from './node';
import { TEXT_POSITION_MIN, TEXT_POSITION_MAX, TEXT_POSITION_DEFAULT } from './connection';

// Pure Connection curve geometry (ADR-0013). The single source of truth for
// the cubic bezier a Connection renders as, the point-at-t evaluation the
// Text card centers on, and the cursor→textPosition projection used while
// dragging the card. No Angular, no DOM — everything here is unit-testable.

export interface Point {
  x: number;
  y: number;
}

export interface Curve {
  start: Point;
  cp1: Point;
  cp2: Point;
  end: Point;
}

// A dragged Text card within this radius (canvas units) of the curve midpoint
// snaps back to it — the Snap Zone idiom applied to the default position.
export const TEXT_POSITION_SNAP_RADIUS = 15;

function controlPoint(pos: Point, handle: HandleSide, offset: number): Point {
  switch (handle) {
    case 'top': return { x: pos.x, y: pos.y - offset };
    case 'right': return { x: pos.x + offset, y: pos.y };
    case 'bottom': return { x: pos.x, y: pos.y + offset };
    case 'left': return { x: pos.x - offset, y: pos.y };
  }
}

/** The cubic bezier for a Connection: control points extend perpendicular to
 *  each Handle's edge, offset clamped between 40 and 150 (distance x 0.4). */
export function connectionCurve(
  start: Point,
  end: Point,
  startHandle: HandleSide,
  endHandle: HandleSide,
): Curve {
  const distance = Math.sqrt((end.x - start.x) ** 2 + (end.y - start.y) ** 2);
  const offset = Math.min(Math.max(distance * 0.4, 40), 150);
  return {
    start,
    end,
    cp1: controlPoint(start, startHandle, offset),
    cp2: controlPoint(end, endHandle, offset),
  };
}

/** Cubic bezier point at parameter t. */
export function pointAt(curve: Curve, t: number): Point {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return {
    x: a * curve.start.x + b * curve.cp1.x + c * curve.cp2.x + d * curve.end.x,
    y: a * curve.start.y + b * curve.cp1.y + c * curve.cp2.y + d * curve.end.y,
  };
}

function distanceSq(a: Point, b: Point): number {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}

// Nearest t on the curve to the given point: coarse sampling then local
// refinement — plenty of precision for a drag target, with no root-finding.
function nearestT(curve: Curve, point: Point): number {
  const COARSE_STEPS = 100;
  let bestT = 0;
  let bestDist = Infinity;
  for (let i = 0; i <= COARSE_STEPS; i++) {
    const t = i / COARSE_STEPS;
    const dist = distanceSq(pointAt(curve, t), point);
    if (dist < bestDist) {
      bestDist = dist;
      bestT = t;
    }
  }
  let step = 1 / COARSE_STEPS;
  for (let i = 0; i < 20; i++) {
    step /= 2;
    for (const candidate of [bestT - step, bestT + step]) {
      const t = Math.min(Math.max(candidate, 0), 1);
      const dist = distanceSq(pointAt(curve, t), point);
      if (dist < bestDist) {
        bestDist = dist;
        bestT = t;
      }
    }
  }
  return bestT;
}

/** The textPosition for a cursor point while dragging a Text card: the nearest
 *  t on the curve, clamped to [TEXT_POSITION_MIN, TEXT_POSITION_MAX], snapping
 *  to the midpoint when the projected point lands inside the snap radius. */
export function textPositionFromPoint(curve: Curve, point: Point): number {
  const t = Math.min(Math.max(nearestT(curve, point), TEXT_POSITION_MIN), TEXT_POSITION_MAX);
  const midpoint = pointAt(curve, TEXT_POSITION_DEFAULT);
  if (distanceSq(pointAt(curve, t), midpoint) <= TEXT_POSITION_SNAP_RADIUS ** 2) {
    return TEXT_POSITION_DEFAULT;
  }
  return t;
}
