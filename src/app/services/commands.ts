import { Command } from '../models/command';
import { GraphNode, HandleSide } from '../models/node';
import { Connection } from '../models/connection';
import { GraphService } from './graph.service';

export class CreateNodeCommand implements Command {
  description = 'Create Node';
  private node: GraphNode | null = null;

  constructor(
    private graphService: GraphService,
    private label: string,
    private x: number,
    private y: number,
    private parentId?: string,
  ) {}

  execute(): void {
    this.node = this.graphService.createNode(this.label, this.x, this.y);
    if (this.parentId) {
      this.graphService.setNodeParent(this.node.id, this.parentId);
    }
  }

  undo(): void {
    if (this.node) {
      this.graphService.deleteNode(this.node.id);
    }
  }

  getNode(): GraphNode | null {
    return this.node;
  }
}

export class MoveNodeCommand implements Command {
  description = 'Move Node';
  private originalX = 0;
  private originalY = 0;

  constructor(
    private graphService: GraphService,
    private nodeId: string,
    private newX: number,
    private newY: number,
    explicitOriginalX?: number,
    explicitOriginalY?: number,
  ) {
    if (explicitOriginalX !== undefined && explicitOriginalY !== undefined) {
      this.originalX = explicitOriginalX;
      this.originalY = explicitOriginalY;
    } else {
      const node = this.graphService.nodes().find(n => n.id === nodeId);
      if (node) {
        this.originalX = node.x;
        this.originalY = node.y;
      }
    }
  }

  execute(): void {
    this.graphService.updateNodePosition(this.nodeId, this.newX, this.newY);
  }

  undo(): void {
    this.graphService.updateNodePosition(this.nodeId, this.originalX, this.originalY);
  }
}

export class RenameNodeCommand implements Command {
  description = 'Rename Node';
  private originalLabel = '';

  constructor(
    private graphService: GraphService,
    private nodeId: string,
    private newLabel: string,
  ) {
    const node = this.graphService.nodes().find(n => n.id === nodeId);
    if (node) {
      this.originalLabel = node.label;
    }
  }

  execute(): void {
    this.graphService.updateNodeLabel(this.nodeId, this.newLabel);
  }

  undo(): void {
    this.graphService.updateNodeLabel(this.nodeId, this.originalLabel);
  }
}

export class DeleteNodeCommand implements Command {
  description = 'Delete Node';
  private deletedNode: GraphNode | null = null;
  private removedConnections: Connection[] = [];
  private releasedChildIds: string[] = [];

  constructor(
    private graphService: GraphService,
    private nodeId: string,
  ) {}

  execute(): void {
    const result = this.graphService.deleteNode(this.nodeId);
    this.deletedNode = result.node;
    this.removedConnections = result.removedConnections;
    this.releasedChildIds = result.releasedChildIds;
  }

  undo(): void {
    if (!this.deletedNode) return;
    // Re-create the node and re-parent the children it had released
    this.graphService.nodes.update(nodes => [
      ...nodes.map(n =>
        this.releasedChildIds.includes(n.id) ? { ...n, parentId: this.nodeId } : n
      ),
      { ...this.deletedNode! },
    ]);
    // Re-create removed connections
    if (this.removedConnections.length > 0) {
      this.graphService.connections.update(conns => [
        ...conns,
        ...this.removedConnections.map(c => ({ ...c })),
      ]);
    }
  }
}

export class CreateConnectionCommand implements Command {
  description = 'Create Connection';
  private connection: Connection | null = null;

  constructor(
    private graphService: GraphService,
    private sourceNodeId: string,
    private sourceHandle: HandleSide,
    private targetNodeId: string,
    private targetHandle: HandleSide,
  ) {}

  execute(): void {
    this.connection = this.graphService.createConnection(
      this.sourceNodeId, this.sourceHandle,
      this.targetNodeId, this.targetHandle
    );
  }

  undo(): void {
    if (this.connection) {
      this.graphService.deleteConnection(this.connection.id);
    }
  }

  getConnection(): Connection | null {
    return this.connection;
  }
}

export class DeleteConnectionCommand implements Command {
  description = 'Delete Connection';
  private deletedConnection: Connection | null = null;

  constructor(
    private graphService: GraphService,
    private connectionId: string,
  ) {}

  execute(): void {
    this.deletedConnection = this.graphService.deleteConnection(this.connectionId) ?? null;
  }

  undo(): void {
    if (!this.deletedConnection) return;
    this.graphService.connections.update(conns => [...conns, { ...this.deletedConnection! }]);
  }
}

export class SetConnectionLabelCommand implements Command {
  description = 'Set Connection Label';
  private originalLabel: string | undefined;

  constructor(
    private graphService: GraphService,
    private connectionId: string,
    private newLabel: string,
  ) {
    const conn = this.graphService.connections().find(c => c.id === connectionId);
    this.originalLabel = conn?.label;
  }

  execute(): void {
    this.graphService.setConnectionLabel(this.connectionId, this.newLabel);
  }

  undo(): void {
    // An absent original label is restored by committing empty (which clears it)
    this.graphService.setConnectionLabel(this.connectionId, this.originalLabel ?? '');
  }
}

// Compound command for deleting a node and its connections as a single undoable action
export class DeleteNodeCompoundCommand implements Command {
  description = 'Delete Node';
  private deleteNodeCmd: DeleteNodeCommand;

  constructor(
    private graphService: GraphService,
    private nodeId: string,
  ) {
    this.deleteNodeCmd = new DeleteNodeCommand(graphService, nodeId);
  }

  execute(): void {
    this.deleteNodeCmd.execute();
  }

  undo(): void {
    this.deleteNodeCmd.undo();
  }
}

export class CreateGroupCommand implements Command {
  description = 'Create Group';
  private group: GraphNode | null = null;

  constructor(
    private graphService: GraphService,
    private label: string,
    private x: number,
    private y: number,
  ) {}

  execute(): void {
    this.group = this.graphService.createGroup(this.label, this.x, this.y);
  }

  undo(): void {
    if (this.group) {
      this.graphService.deleteNode(this.group.id);
    }
  }
}

export class ChangeParentCommand implements Command {
  description = 'Change Group Membership';
  private originalParentId: string | null;

  constructor(
    private graphService: GraphService,
    private nodeId: string,
    private newParentId: string | null,
  ) {
    const node = this.graphService.nodes().find(n => n.id === nodeId);
    this.originalParentId = node?.parentId ?? null;
  }

  execute(): void {
    this.graphService.setNodeParent(this.nodeId, this.newParentId);
  }

  undo(): void {
    this.graphService.setNodeParent(this.nodeId, this.originalParentId);
  }
}

export class MoveGroupCommand implements Command {
  description = 'Move Group';

  constructor(
    private graphService: GraphService,
    private groupId: string,
    private newX: number,
    private newY: number,
    private originalX: number,
    private originalY: number,
  ) {}

  execute(): void {
    this.graphService.moveGroup(this.groupId, this.newX, this.newY);
  }

  undo(): void {
    this.graphService.moveGroup(this.groupId, this.originalX, this.originalY);
  }
}

export interface NodeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class ResizeNodeCommand implements Command {
  description = 'Resize Node';

  constructor(
    private graphService: GraphService,
    private nodeId: string,
    private newRect: NodeRect,
    private originalRect: NodeRect,
  ) {}

  execute(): void {
    this.graphService.resizeNode(this.nodeId, this.newRect);
  }

  undo(): void {
    this.graphService.resizeNode(this.nodeId, this.originalRect);
  }
}

export class SetNodeColorCommand implements Command {
  description = 'Set Node Color';
  private originalColor: string | null;

  constructor(
    private graphService: GraphService,
    private nodeId: string,
    private newColor: string | null,
  ) {
    const node = this.graphService.nodes().find(n => n.id === nodeId);
    this.originalColor = node?.color ?? null;
  }

  execute(): void {
    this.graphService.setNodeColor(this.nodeId, this.newColor);
  }

  undo(): void {
    this.graphService.setNodeColor(this.nodeId, this.originalColor);
  }
}

// Generic compound: executes parts in order, undoes them in reverse order.
// Used for drops that change membership and sever Group/child connections.
export class CompoundCommand implements Command {
  constructor(
    public description: string,
    private parts: Command[],
  ) {}

  execute(): void {
    for (const part of this.parts) {
      part.execute();
    }
  }

  undo(): void {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      this.parts[i].undo();
    }
  }
}
