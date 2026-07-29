import { HandleSide } from './node';

export interface Connection {
  id: string;
  sourceNodeId: string;
  sourceHandle: HandleSide;
  targetNodeId: string;
  targetHandle: HandleSide;
  // Connection Label: optional annotation text; absent means unlabeled
  label?: string;
}
