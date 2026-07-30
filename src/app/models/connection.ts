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

export interface Connection {
  id: string;
  sourceNodeId: string;
  sourceHandle: HandleSide;
  targetNodeId: string;
  targetHandle: HandleSide;
  // Optional Text shown at the curve midpoint; absent means unannotated
  text?: Text;
  // Curve color from NODE_PALETTE; absent means the default stroke
  color?: string;
  // Arrowhead at the source endpoint; absent means DEFAULT_START_ARROWHEAD
  startArrowhead?: ArrowheadType;
  // Arrowhead at the target endpoint; absent means DEFAULT_END_ARROWHEAD
  endArrowhead?: ArrowheadType;
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
