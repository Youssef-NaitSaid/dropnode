import { Text } from './text';

export type HandleSide = 'top' | 'right' | 'bottom' | 'left';

// Curated background palette, retuned for the refined-dark canvas: light,
// vivid pastels that stay legible with dark node text and pop on near-black.
// An absent color means the default node background.
export const NODE_PALETTE: readonly string[] = [
  '#ff8fa3', '#ffb37a', '#ffe08a', '#9fe0a3',
  '#86dced', '#9fb4ff', '#c3a3ff', '#f2a3e8',
];

export interface GraphNode {
  id: string;
  // Text carried by a regular node (required for regular nodes; never on Groups)
  text?: Text;
  // Plain Label of a Group (required for Groups; never on regular nodes)
  label?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  // 'group' marks a Group; absent means a regular node
  kind?: 'group';
  // Id of the Group this node belongs to; Groups themselves never have one
  parentId?: string;
  // Background color from NODE_PALETTE; absent means default
  color?: string;
}
