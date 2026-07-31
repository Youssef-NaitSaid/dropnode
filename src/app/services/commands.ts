import { Command } from '../models/command';
import { GraphNode, HandleSide, oppositeHandle } from '../models/node';
import { Connection, ArrowheadType, ArrowheadEnd, effectiveArrowhead, defaultArrowhead } from '../models/connection';
import { Text } from '../models/text';
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

// Groups only — regular nodes carry Text, changed via SetNodeTextCommand
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
      this.originalLabel = node.label ?? '';
    }
  }

  execute(): void {
    this.graphService.updateNodeLabel(this.nodeId, this.newLabel);
  }

  undo(): void {
    this.graphService.updateNodeLabel(this.nodeId, this.originalLabel);
  }
}

// One Text edit session commits as exactly one of these; unchanged content
// never constructs a command (the editor guards that)
export class SetNodeTextCommand implements Command {
  description = 'Set Node Text';
  private originalText: Text = [];

  constructor(
    private graphService: GraphService,
    private nodeId: string,
    private newText: Text,
  ) {
    const node = this.graphService.nodes().find(n => n.id === nodeId);
    this.originalText = structuredClone(node?.text ?? []);
  }

  execute(): void {
    this.graphService.setNodeText(this.nodeId, this.newText);
  }

  undo(): void {
    this.graphService.setNodeText(this.nodeId, this.originalText);
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

export class SetConnectionTextCommand implements Command {
  description = 'Set Connection Text';
  private originalText: Text | null;
  // Captured alongside the Text: clearing discards the position (ADR-0013),
  // so one undo must restore the annotation at its exact previous spot
  private originalPosition: number | null;

  constructor(
    private graphService: GraphService,
    private connectionId: string,
    private newText: Text | null,
  ) {
    const conn = this.graphService.connections().find(c => c.id === connectionId);
    this.originalText = conn?.text ? structuredClone(conn.text) : null;
    this.originalPosition = conn?.textPosition ?? null;
  }

  execute(): void {
    this.graphService.setConnectionText(this.connectionId, this.newText);
  }

  undo(): void {
    // An absent original Text is restored by committing null (which clears it)
    this.graphService.setConnectionText(this.connectionId, this.originalText);
    if (this.originalText !== null) {
      this.graphService.setConnectionTextPosition(this.connectionId, this.originalPosition);
    }
  }
}

// One Text card drag commits as exactly one of these, pushed on mouseup only
// if the drag crossed the 2px threshold (the drag itself updates transiently)
export class MoveConnectionTextCommand implements Command {
  description = 'Move Connection Text';
  private originalPosition: number | null;

  constructor(
    private graphService: GraphService,
    private connectionId: string,
    private newPosition: number,
    explicitOriginalPosition?: number | null,
  ) {
    if (explicitOriginalPosition !== undefined) {
      this.originalPosition = explicitOriginalPosition;
    } else {
      const conn = this.graphService.connections().find(c => c.id === connectionId);
      this.originalPosition = conn?.textPosition ?? null;
    }
  }

  execute(): void {
    this.graphService.setConnectionTextPosition(this.connectionId, this.newPosition);
  }

  undo(): void {
    // A null original means the Text sat at the midpoint (absent field)
    this.graphService.setConnectionTextPosition(this.connectionId, this.originalPosition);
  }
}

export class SetConnectionColorCommand implements Command {
  description = 'Set Connection Color';
  private originalColor: string | null;

  constructor(
    private graphService: GraphService,
    private connectionId: string,
    private newColor: string | null,
  ) {
    const conn = this.graphService.connections().find(c => c.id === connectionId);
    this.originalColor = conn?.color ?? null;
  }

  execute(): void {
    this.graphService.setConnectionColor(this.connectionId, this.newColor);
  }

  undo(): void {
    this.graphService.setConnectionColor(this.connectionId, this.originalColor);
  }
}

export class SetConnectionArrowheadCommand implements Command {
  description = 'Set Connection Arrowhead';
  private originalType: ArrowheadType;

  constructor(
    private graphService: GraphService,
    private connectionId: string,
    private end: ArrowheadEnd,
    private newType: ArrowheadType,
  ) {
    const conn = this.graphService.connections().find(c => c.id === connectionId);
    // Capture the effective value so undo restores the exact rendered state,
    // whether the original was stored explicitly or left at its default.
    this.originalType = conn ? effectiveArrowhead(conn, end) : defaultArrowhead(end);
  }

  execute(): void {
    this.graphService.setConnectionArrowhead(this.connectionId, this.end, this.newType);
  }

  undo(): void {
    this.graphService.setConnectionArrowhead(this.connectionId, this.end, this.originalType);
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

// Quick-add: dropping a connection drag in empty space (no snap) spawns a
// default "New Node" anchored so its incoming Handle — the one opposite the
// source Handle, matching the ghost bezier — sits exactly at the drop point,
// already connected. Spawn, parenting, and Connection are one undo step; the
// auto-opened Text edit commits separately as its own SetNodeTextCommand.
export class QuickAddNodeCommand implements Command {
  description = 'Quick-add Node';
  private node: GraphNode | null = null;

  constructor(
    private graphService: GraphService,
    private sourceNodeId: string,
    private sourceHandle: HandleSide,
    private dropX: number,
    private dropY: number,
  ) {}

  execute(): void {
    const width = 160;
    const height = 48;
    // Position the node so its incoming Handle lands on the drop point
    let x: number;
    let y: number;
    switch (this.sourceHandle) {
      case 'right': // incoming left Handle
        x = this.dropX;
        y = this.dropY - height / 2;
        break;
      case 'left': // incoming right Handle
        x = this.dropX - width;
        y = this.dropY - height / 2;
        break;
      case 'bottom': // incoming top Handle
        x = this.dropX - width / 2;
        y = this.dropY;
        break;
      case 'top': // incoming bottom Handle
        x = this.dropX - width / 2;
        y = this.dropY - height;
        break;
    }

    this.node = this.graphService.createNode('New Node', x, y);
    // Containment by drop point, except when the source IS that Group: a
    // Group can never connect to its own child, and the Connection — what
    // the gesture was about — wins over parenting
    const group = this.graphService.findGroupAt(this.dropX, this.dropY);
    if (group && group.id !== this.sourceNodeId) {
      this.graphService.setNodeParent(this.node.id, group.id);
    }
    this.graphService.createConnection(
      this.sourceNodeId, this.sourceHandle,
      this.node.id, oppositeHandle(this.sourceHandle),
    );
    // Selection lives in execute so redo re-selects (Paste precedent)
    this.graphService.selectNode(this.node.id);
  }

  undo(): void {
    if (!this.node) return;
    // deleteNode cascade-deletes the Connection created alongside
    this.graphService.deleteNode(this.node.id);
    if (this.graphService.selectedNodeId() === this.node.id) {
      this.graphService.selectNode(null);
    }
  }

  getNodeId(): string | null {
    return this.node?.id ?? null;
  }
}

// Inserts a prepared set of elements (ids already generated) as one undo
// step — the single Command behind Paste, Duplicate, and Alt+drag duplicate.
// undo removes exactly the set without a prior execute, so Alt+drag can
// create transiently during the gesture and push-without-execute on drop.
export class InsertElementsCommand implements Command {
  private nodes: GraphNode[];
  private connections: Connection[];

  constructor(
    private graphService: GraphService,
    public description: string,
    nodes: GraphNode[],
    connections: Connection[],
    private primaryNodeId: string,
  ) {
    // Deep copy so later graph mutations can't alias into the redo snapshot
    this.nodes = structuredClone(nodes);
    this.connections = structuredClone(connections);
  }

  execute(): void {
    this.graphService.nodes.update(nodes => [...nodes, ...structuredClone(this.nodes)]);
    if (this.connections.length > 0) {
      this.graphService.connections.update(conns => [...conns, ...structuredClone(this.connections)]);
    }
    this.graphService.selectNode(this.primaryNodeId);
  }

  undo(): void {
    const nodeIds = new Set(this.nodes.map(n => n.id));
    const connIds = new Set(this.connections.map(c => c.id));
    this.graphService.nodes.update(nodes => nodes.filter(n => !nodeIds.has(n.id)));
    this.graphService.connections.update(conns => conns.filter(c => !connIds.has(c.id)));
    if (nodeIds.has(this.graphService.selectedNodeId() ?? '')) {
      this.graphService.selectNode(null);
    }
    const selectedConn = this.graphService.selectedConnectionId();
    if (selectedConn && connIds.has(selectedConn)) {
      this.graphService.selectedConnectionId.set(null);
    }
  }
}
