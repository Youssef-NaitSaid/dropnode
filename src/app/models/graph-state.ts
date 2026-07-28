import { GraphNode } from './node';
import { Connection } from './connection';

export interface GraphState {
  nodes: GraphNode[];
  connections: Connection[];
}
