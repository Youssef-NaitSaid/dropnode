import {
  Component, inject, signal, computed, ChangeDetectionStrategy,
  HostListener, ElementRef, viewChild,
} from '@angular/core';
import { GraphService } from '../../services/graph.service';
import { HistoryService } from '../../services/history.service';
import {
  CreateNodeCommand,
  MoveNodeCommand,
  MoveGroupCommand,
  RenameNodeCommand,
  ResizeNodeCommand,
  ChangeParentCommand,
  CompoundCommand,
  CreateConnectionCommand,
  DeleteConnectionCommand,
  SetConnectionLabelCommand,
  NodeRect,
} from '../../services/commands';
import { NodeComponent, GripCorner } from '../node/node';
import { ConnectionLayerComponent } from '../connection-layer/connection-layer';
import { HandleSide } from '../../models/node';

@Component({
  selector: 'app-canvas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NodeComponent, ConnectionLayerComponent],
  template: `
    <div
      class="canvas-container"
      [class.panning]="isPanning"
      (dblclick)="onCanvasDoubleClick($event)"
      (mousedown)="onCanvasMouseDown($event)"
      (wheel)="onWheel($event)"
    >
      <div
        class="canvas-transform"
        [style.transform]="transformStyle()"
      >
        <!-- ADR-0008 stacking: Group cards, then Connections, then regular nodes,
             so Connections stay clickable over a Group's rect -->
        <div class="nodes-container">
          @for (node of groupNodes(); track node.id) {
            <app-node
              [node]="node"
              [isSelected]="graphService.selectedNodeId() === node.id"
              [snapTarget]="currentSnapTarget"
              (startMove)="onNodeStartMove($event)"
              (rename)="onNodeRename($event)"
              (handleDragStart)="onHandleDragStart($event)"
              (sizeChanged)="onNodeSizeChanged($event)"
              (startResize)="onNodeStartResize($event)"
              (createChild)="onCreateChild($event)"
            />
          }
        </div>

        <app-connection-layer
          #connectionLayer
          (connectionSelect)="onConnectionSelect($event)"
          (labelCommit)="onConnectionLabelCommit($event)"
        />

        <div class="nodes-container">
          @for (node of regularNodes(); track node.id) {
            <app-node
              [node]="node"
              [isSelected]="graphService.selectedNodeId() === node.id"
              [snapTarget]="currentSnapTarget"
              (startMove)="onNodeStartMove($event)"
              (rename)="onNodeRename($event)"
              (handleDragStart)="onHandleDragStart($event)"
              (sizeChanged)="onNodeSizeChanged($event)"
              (startResize)="onNodeStartResize($event)"
              (createChild)="onCreateChild($event)"
            />
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }
    .canvas-container {
      width: 100%;
      height: 100%;
      background-color: #0e0e11;
      background-image:
        radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.05) 1px, transparent 0);
      background-size: 26px 26px;
      position: relative;
      overflow: hidden;
      cursor: grab;
    }
    .canvas-container.panning {
      cursor: grabbing;
    }
    .canvas-transform {
      position: absolute;
      top: 0;
      left: 0;
      transform-origin: 0 0;
      will-change: transform;
    }
    .nodes-container {
      position: absolute;
      top: 0;
      left: 0;
    }
  `],
})
export class CanvasComponent {
  graphService = inject(GraphService);
  private historyService = inject(HistoryService);

  private connectionLayer = viewChild<ConnectionLayerComponent>('connectionLayer');

  // Groups render beneath the connection layer, regular nodes above it (ADR-0008)
  groupNodes = computed(() => this.graphService.nodes().filter(n => n.kind === 'group'));
  regularNodes = computed(() => this.graphService.nodes().filter(n => n.kind !== 'group'));

  // Node drag state
  private isDraggingNode = false;
  private dragNodeId: string | null = null;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragNodeStartX = 0;
  private dragNodeStartY = 0;
  private hasMoved = false;
  private dragIsGroup = false;

  // Resize drag state
  private isResizingNode = false;
  private resizeNodeId: string | null = null;
  private resizeCorner: GripCorner | null = null;
  private resizeAnchorX = 0;
  private resizeAnchorY = 0;
  private resizeMinWidth = 120;
  private resizeMinHeight = 48;
  private resizeStartRect: NodeRect | null = null;

  // Pan state
  protected isPanning = false;
  private panStartX = 0;
  private panStartY = 0;
  private panStartPanX = 0;
  private panStartPanY = 0;

  // Connection drag state — track source info for CreateConnectionCommand on drop
  private isDraggingConnection = false;
  private connectionSourceNodeId: string | null = null;
  private connectionSourceHandle: HandleSide | null = null;

  transformStyle = () => {
    const vp = this.graphService.viewportState();
    return `translate(${vp.panX}px, ${vp.panY}px) scale(${vp.zoom})`;
  };

  get currentSnapTarget() {
    return this.connectionLayer()?.snapTarget() ?? null;
  }

  private screenToCanvas(screenX: number, screenY: number): { x: number; y: number } {
    const vp = this.graphService.viewportState();
    return {
      x: (screenX - vp.panX) / vp.zoom,
      y: (screenY - vp.panY) / vp.zoom,
    };
  }

  private clientPointToCanvas(clientX: number, clientY: number): { x: number; y: number } | null {
    const container = document.querySelector('.canvas-container');
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    return this.screenToCanvas(clientX - rect.left, clientY - rect.top);
  }

  onCanvasDoubleClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).closest('app-node')) return;

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;
    const canvasPos = this.screenToCanvas(screenX, screenY);

    const cmd = new CreateNodeCommand(this.graphService, 'New Node', canvasPos.x - 60, canvasPos.y - 24);
    this.historyService.execute(cmd);
  }

  onCanvasMouseDown(event: MouseEvent): void {
    if ((event.target as HTMLElement).closest('app-node')) return;

    this.isPanning = true;
    this.panStartX = event.clientX;
    this.panStartY = event.clientY;
    const vp = this.graphService.viewportState();
    this.panStartPanX = vp.panX;
    this.panStartPanY = vp.panY;

    this.graphService.selectNode(null);
  }

  onWheel(event: WheelEvent): void {
    event.preventDefault();
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const centerX = event.clientX - rect.left;
    const centerY = event.clientY - rect.top;
    const delta = event.deltaY > 0 ? -0.1 : 0.1;
    this.graphService.zoomBy(delta, centerX, centerY);
  }

  // Node drag handling
  onNodeStartMove(event: { nodeId: string; event: MouseEvent }): void {
    this.isDraggingNode = true;
    this.dragNodeId = event.nodeId;
    this.dragStartX = event.event.clientX;
    this.dragStartY = event.event.clientY;
    const node = this.graphService.nodes().find(n => n.id === event.nodeId);
    if (node) {
      this.dragNodeStartX = node.x;
      this.dragNodeStartY = node.y;
      this.dragIsGroup = node.kind === 'group';
    }
    this.hasMoved = false;
    this.graphService.selectNode(event.nodeId);
  }

  // Resize grip drag start
  onNodeStartResize(event: {
    nodeId: string; corner: GripCorner; minWidth: number; minHeight: number; event: MouseEvent;
  }): void {
    const node = this.graphService.nodes().find(n => n.id === event.nodeId);
    if (!node) return;
    this.isResizingNode = true;
    this.resizeNodeId = event.nodeId;
    this.resizeCorner = event.corner;
    this.resizeMinWidth = event.minWidth;
    this.resizeMinHeight = event.minHeight;
    this.resizeStartRect = { x: node.x, y: node.y, width: node.width, height: node.height };
    // The opposite corner stays anchored during the drag
    this.resizeAnchorX = event.corner === 'nw' || event.corner === 'sw' ? node.x + node.width : node.x;
    this.resizeAnchorY = event.corner === 'nw' || event.corner === 'ne' ? node.y + node.height : node.y;
  }

  // Handle drag start (connection creation)
  onHandleDragStart(event: { nodeId: string; handle: HandleSide; event: MouseEvent }): void {
    event.event.stopPropagation();
    this.isDraggingConnection = true;
    this.connectionSourceNodeId = event.nodeId;
    this.connectionSourceHandle = event.handle;

    const layer = this.connectionLayer();
    if (layer) {
      layer.startConnectionDrag(event.nodeId, event.handle, event.event);
    }
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    if (this.isDraggingNode && this.dragNodeId) {
      const vp = this.graphService.viewportState();
      const dx = (event.clientX - this.dragStartX) / vp.zoom;
      const dy = (event.clientY - this.dragStartY) / vp.zoom;

      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        this.hasMoved = true;
      }

      const newX = this.dragNodeStartX + dx;
      const newY = this.dragNodeStartY + dy;
      if (this.dragIsGroup) {
        // Rigid move: children follow the Group, still bypassing History
        this.graphService.moveGroup(this.dragNodeId, newX, newY);
      } else {
        this.graphService.updateNodePosition(this.dragNodeId, newX, newY);
      }
    }

    if (this.isResizingNode && this.resizeNodeId && this.resizeCorner) {
      const cursor = this.clientPointToCanvas(event.clientX, event.clientY);
      if (cursor) {
        const width = Math.max(this.resizeMinWidth, Math.abs(cursor.x - this.resizeAnchorX));
        const height = Math.max(this.resizeMinHeight, Math.abs(cursor.y - this.resizeAnchorY));
        const west = this.resizeCorner === 'nw' || this.resizeCorner === 'sw';
        const north = this.resizeCorner === 'nw' || this.resizeCorner === 'ne';
        const rect: NodeRect = {
          x: west ? this.resizeAnchorX - width : this.resizeAnchorX,
          y: north ? this.resizeAnchorY - height : this.resizeAnchorY,
          width,
          height,
        };
        // Transient: the service clamps Groups around their children
        this.graphService.resizeNode(this.resizeNodeId, rect);
      }
    }

    if (this.isPanning) {
      const dx = event.clientX - this.panStartX;
      const dy = event.clientY - this.panStartY;
      this.graphService.setViewport({
        panX: this.panStartPanX + dx,
        panY: this.panStartPanY + dy,
      });
    }

    if (this.isDraggingConnection) {
      const canvasPos = this.clientPointToCanvas(event.clientX, event.clientY);
      if (!canvasPos) return;

      const layer = this.connectionLayer();
      if (layer) {
        layer.updateConnectionDrag(canvasPos.x, canvasPos.y);
      }
    }
  }

  @HostListener('document:mouseup', ['$event'])
  onMouseUp(_event: MouseEvent): void {
    // Finish node drag — record undo command
    if (this.isDraggingNode && this.dragNodeId && this.hasMoved) {
      const node = this.graphService.nodes().find(n => n.id === this.dragNodeId);
      if (node && this.dragIsGroup) {
        // A Group drag moved its children rigidly; one undo step for all of it
        const cmd = new MoveGroupCommand(
          this.graphService,
          this.dragNodeId,
          node.x,
          node.y,
          this.dragNodeStartX,
          this.dragNodeStartY,
        );
        this.historyService.pushWithoutExecute(cmd);
      } else if (node) {
        // Node is already at the new position. Membership follows containment:
        // the topmost Group under the node's center claims it on drop.
        const targetGroup = this.graphService.findGroupAt(
          node.x + node.width / 2,
          node.y + node.height / 2,
          node.id,
        );
        const newParentId = targetGroup?.id ?? null;
        const oldParentId = node.parentId ?? null;

        const moveCmd = new MoveNodeCommand(
          this.graphService,
          this.dragNodeId,
          node.x,
          node.y,
          this.dragNodeStartX,
          this.dragNodeStartY,
        );

        if (newParentId === oldParentId) {
          this.historyService.pushWithoutExecute(moveCmd);
        } else {
          // Entering a Group severs any Connections to it (sever-on-entry),
          // all one compound undo step with the move and the membership change
          const severCmds = newParentId === null ? [] : this.graphService.connections()
            .filter(c =>
              (c.sourceNodeId === node.id && c.targetNodeId === newParentId) ||
              (c.sourceNodeId === newParentId && c.targetNodeId === node.id)
            )
            .map(c => new DeleteConnectionCommand(this.graphService, c.id));
          const parentCmd = new ChangeParentCommand(this.graphService, node.id, newParentId);

          // The move already happened transiently; apply the remaining parts,
          // then push the compound without re-executing
          severCmds.forEach(c => c.execute());
          parentCmd.execute();
          this.historyService.pushWithoutExecute(
            new CompoundCommand('Move Node', [moveCmd, ...severCmds, parentCmd])
          );
        }
      }
    }
    this.isDraggingNode = false;
    this.dragNodeId = null;
    this.hasMoved = false;
    this.dragIsGroup = false;

    // Finish resize drag — one undo step, only if the final rect actually changed
    if (this.isResizingNode && this.resizeNodeId) {
      const start = this.resizeStartRect;
      const node = this.graphService.nodes().find(n => n.id === this.resizeNodeId);
      if (start && node) {
        const changed =
          Math.abs(node.width - start.width) > 2 ||
          Math.abs(node.height - start.height) > 2 ||
          Math.abs(node.x - start.x) > 2 ||
          Math.abs(node.y - start.y) > 2;
        if (changed) {
          const cmd = new ResizeNodeCommand(
            this.graphService,
            this.resizeNodeId,
            { x: node.x, y: node.y, width: node.width, height: node.height },
            start,
          );
          this.historyService.pushWithoutExecute(cmd);
        }
      }
      this.isResizingNode = false;
      this.resizeNodeId = null;
      this.resizeCorner = null;
      this.resizeStartRect = null;
    }

    if (this.isPanning) {
      this.isPanning = false;
    }

    // Finish connection drag — create connection via command
    if (this.isDraggingConnection) {
      this.isDraggingConnection = false;
      const layer = this.connectionLayer();
      if (layer) {
        const result = layer.endConnectionDrag();
        if (result && this.connectionSourceNodeId && this.connectionSourceHandle) {
          const cmd = new CreateConnectionCommand(
            this.graphService,
            this.connectionSourceNodeId,
            this.connectionSourceHandle,
            result.targetNodeId,
            result.targetHandle,
          );
          this.historyService.execute(cmd);
        }
      }
      this.connectionSourceNodeId = null;
      this.connectionSourceHandle = null;
    }
  }

  onNodeRename(event: { nodeId: string; newLabel: string }): void {
    const cmd = new RenameNodeCommand(this.graphService, event.nodeId, event.newLabel);
    this.historyService.execute(cmd);
  }

  // Double-click on a Group's body creates a child node at the cursor
  onCreateChild(event: { parentId: string; clientX: number; clientY: number }): void {
    const canvasPos = this.clientPointToCanvas(event.clientX, event.clientY);
    if (!canvasPos) return;

    const cmd = new CreateNodeCommand(
      this.graphService, 'New Node', canvasPos.x - 60, canvasPos.y - 24, event.parentId,
    );
    this.historyService.execute(cmd);
  }

  onConnectionSelect(connectionId: string): void {
    this.graphService.selectConnection(connectionId);
  }

  onConnectionLabelCommit(event: { connectionId: string; newLabel: string }): void {
    const cmd = new SetConnectionLabelCommand(this.graphService, event.connectionId, event.newLabel);
    this.historyService.execute(cmd);
  }

  onNodeSizeChanged(event: { nodeId: string; width: number; height: number }): void {
    this.graphService.updateNodeSize(event.nodeId, event.width, event.height);
  }
}
