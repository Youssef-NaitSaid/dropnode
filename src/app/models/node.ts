export type HandleSide = 'top' | 'right' | 'bottom' | 'left';

// Curated background palette. An absent color means the default node background.
export const NODE_PALETTE: readonly string[] = [
  '#ffadad', '#ffd6a5', '#fdffb6', '#caffbf',
  '#9bf6ff', '#a0c4ff', '#bdb2ff', '#ffc6ff',
];

export interface GraphNode {
  id: string;
  label: string;
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
