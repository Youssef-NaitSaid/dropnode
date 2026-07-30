import { HandleSide } from './node';
import { Text } from './text';

// The three Arrowhead shapes a Connection endpoint may carry.
export type ArrowheadType = 'none' | 'arrow' | 'triangle';
export const ARROWHEAD_TYPES: readonly ArrowheadType[] = ['none', 'arrow', 'triangle'];

// Which endpoint of a Connection an Arrowhead sits on: 'start' = source, 'end' = target.
export type ArrowheadEnd = 'start' | 'end';

// Asymmetric defaults (ADR-0012): a Connection shows its source→target direction
// out of the box, so an absent start Arrowhead is 'none' but an absent end is 'arrow'.
export const DEFAULT_START_ARROWHEAD: ArrowheadType = 'none';
export const DEFAULT_END_ARROWHEAD: ArrowheadType = 'arrow';

// Text position along the curve (ADR-0013): a bezier parameter clamped away
// from the endpoints so the Text card never buries an Arrowhead or a node.
// Absent means the midpoint; only deviations are stored.
export const TEXT_POSITION_MIN = 0.1;
export const TEXT_POSITION_MAX = 0.9;
export const TEXT_POSITION_DEFAULT = 0.5;

export interface Connection {
  id: string;
  sourceNodeId: string;
  sourceHandle: HandleSide;
  targetNodeId: string;
  targetHandle: HandleSide;
  // Optional Text shown along the curve; absent means unannotated
  text?: Text;
  // Bezier parameter where the Text card sits (ADR-0013); absent means the
  // midpoint, and the field may only exist alongside text
  textPosition?: number;
  // Curve color from NODE_PALETTE; absent means the default stroke
  color?: string;
  // Arrowhead at the source endpoint; absent means DEFAULT_START_ARROWHEAD
  startArrowhead?: ArrowheadType;
  // Arrowhead at the target endpoint; absent means DEFAULT_END_ARROWHEAD
  endArrowhead?: ArrowheadType;
}

/** The position a Connection's Text actually occupies (stored value, or the midpoint). */
export function effectiveTextPosition(conn: Connection): number {
  return conn.textPosition ?? TEXT_POSITION_DEFAULT;
}

/** The default Arrowhead shape for an endpoint when no value is stored. */
export function defaultArrowhead(end: ArrowheadEnd): ArrowheadType {
  return end === 'start' ? DEFAULT_START_ARROWHEAD : DEFAULT_END_ARROWHEAD;
}

/** The Arrowhead a Connection actually shows at an endpoint (stored value, or the default). */
export function effectiveArrowhead(conn: Connection, end: ArrowheadEnd): ArrowheadType {
  const stored = end === 'start' ? conn.startArrowhead : conn.endArrowhead;
  return stored ?? defaultArrowhead(end);
}
