import { Rect } from './marquee';
import { unionBounds } from './bounds';

// Pure Align & Distribute geometry (spec #25, ADR-0018). Computes target
// positions for the Selection's roots — the Command layer turns them into
// move parts. No Angular, no DOM, canvas units throughout.
//
// Align flushes every rect to one edge or center-line of the roots' combined
// bounding box, along a single axis. Distribute sorts by center along the
// axis, anchors the two extremes, and equalizes the edge gaps between them —
// a negative gap (overflow) is accepted. Both return targets ONLY for rects
// that move, so callers can map results straight to Command parts and treat
// an empty list as a no-op.

export interface RootRect extends Rect {
  id: string;
}

export type AlignKind = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';
export type DistributeAxis = 'horizontal' | 'vertical';

export interface TargetPosition {
  id: string;
  x: number;
  y: number;
}

/** Target positions aligning the rects along one axis of their union box. */
export function alignRects(rects: readonly RootRect[], kind: AlignKind): TargetPosition[] {
  if (rects.length < 2) return [];
  const box = unionBounds(rects)!;

  return rects.flatMap(r => {
    let x = r.x;
    let y = r.y;
    switch (kind) {
      case 'left':
        x = box.x;
        break;
      case 'center':
        x = box.x + box.width / 2 - r.width / 2;
        break;
      case 'right':
        x = box.x + box.width - r.width;
        break;
      case 'top':
        y = box.y;
        break;
      case 'middle':
        y = box.y + box.height / 2 - r.height / 2;
        break;
      case 'bottom':
        y = box.y + box.height - r.height;
        break;
    }
    return x === r.x && y === r.y ? [] : [{ id: r.id, x, y }];
  });
}

/** Target positions equalizing the edge gaps between the rects on one axis. */
export function distributeRects(rects: readonly RootRect[], axis: DistributeAxis): TargetPosition[] {
  if (rects.length < 3) return [];
  const start = (r: RootRect) => (axis === 'horizontal' ? r.x : r.y);
  const size = (r: RootRect) => (axis === 'horizontal' ? r.width : r.height);

  // Stable sort by center: ties keep the caller-given order (in practice
  // graph order — the factories filter the nodes array)
  const sorted = [...rects].sort((a, b) => start(a) + size(a) / 2 - (start(b) + size(b) / 2));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const middles = sorted.slice(1, -1);

  const middlesSize = middles.reduce((sum, r) => sum + size(r), 0);
  const gap = (start(last) - (start(first) + size(first)) - middlesSize) / (rects.length - 1);

  const targets: TargetPosition[] = [];
  let cursor = start(first) + size(first);
  for (const r of middles) {
    const pos = cursor + gap;
    cursor = pos + size(r);
    if (pos !== start(r)) {
      targets.push({
        id: r.id,
        x: axis === 'horizontal' ? pos : r.x,
        y: axis === 'vertical' ? pos : r.y,
      });
    }
  }
  return targets;
}
