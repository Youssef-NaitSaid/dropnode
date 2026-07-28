export type HandleSide = 'top' | 'right' | 'bottom' | 'left';

export interface GraphNode {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}
