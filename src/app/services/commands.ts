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
  ) {}

  execute(): void {
    this.node = this.graphService.createNode(this.label, this.x, this.y);
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

  constructor(
    private graphService: GraphService,
    private nodeId: string,
  ) {}

  execute(): void {
    const result = this.graphService.deleteNode(this.nodeId);
    this.deletedNode = result.node;
    this.removedConnections = result.removedConnections;
  }

  undo(): void {
    if (!this.deletedNode) return;
    // Re-create the node
    this.graphService.nodes.update(nodes => [...nodes, { ...this.deletedNode! }]);
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
