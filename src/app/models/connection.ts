import { HandleSide } from './node';
import { Text } from './text';

export interface Connection {
  id: string;
  sourceNodeId: string;
  sourceHandle: HandleSide;
  targetNodeId: string;
  targetHandle: HandleSide;
  // Optional Text shown at the curve midpoint; absent means unannotated
  text?: Text;
}
