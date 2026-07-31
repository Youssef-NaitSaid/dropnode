import { GraphNode } from './node';
import { ViewportState, ZOOM_MIN, ZOOM_MAX } from './viewport-state';

// A rectangle in Canvas units.
export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Framing fills at most this fraction of each viewport axis, leaving a margin
// so content isn't flush against the edges. Zoom stays within the editor's
// shared [ZOOM_MIN, ZOOM_MAX] range.
const FRAME_FILL = 0.9;

/** Raw bounding box of all Nodes (Groups included — they are Nodes); null when there are none. */
export function graphBounds(nodes: readonly GraphNode[]): Bounds | null {
  if (nodes.length === 0) return null;
  const minX = Math.min(...nodes.map(n => n.x));
  const minY = Math.min(...nodes.map(n => n.y));
  const maxX = Math.max(...nodes.map(n => n.x + n.width));
  const maxY = Math.max(...nodes.map(n => n.y + n.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Union of one or more rects; null when the list is empty. */
export function unionBounds(rects: readonly Bounds[]): Bounds | null {
  if (rects.length === 0) return null;
  const minX = Math.min(...rects.map(r => r.x));
  const minY = Math.min(...rects.map(r => r.y));
  const maxX = Math.max(...rects.map(r => r.x + r.width));
  const maxY = Math.max(...rects.map(r => r.y + r.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * A Viewport that frames `bounds` centered in a `viewWidth` x `viewHeight`
 * region, filling at most 90% of each axis (a ~10% margin). Zoom is capped at
 * `maxZoom` so framing never over-magnifies, then clamped to the editor's
 * [0.1, 5] range. A zero-width or zero-height bounds (e.g. a straight
 * Connection) does not constrain that axis. This is bounds-centered — a third
 * centering behavior beside cursor-centered wheel zoom and origin-centered
 * toolbar zoom.
 */
export function frameViewport(
  bounds: Bounds,
  viewWidth: number,
  viewHeight: number,
  maxZoom: number,
): ViewportState {
  const fitX = bounds.width > 0 ? (FRAME_FILL * viewWidth) / bounds.width : Infinity;
  const fitY = bounds.height > 0 ? (FRAME_FILL * viewHeight) / bounds.height : Infinity;
  let zoom = Math.min(fitX, fitY);
  if (!Number.isFinite(zoom)) zoom = maxZoom; // a point: nothing constrains the fit
  zoom = Math.min(zoom, maxZoom);
  zoom = Math.min(Math.max(zoom, ZOOM_MIN), ZOOM_MAX);

  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  return {
    panX: viewWidth / 2 - centerX * zoom,
    panY: viewHeight / 2 - centerY * zoom,
    zoom,
  };
}
