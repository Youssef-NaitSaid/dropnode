import {
  Component, inject, signal, ChangeDetectionStrategy,
  HostListener, ElementRef, viewChild,
} from '@angular/core';
import { GraphService } from '../../services/graph.service';
import { HistoryService } from '../../services/history.service';
import {
  CreateNodeCommand,
  MoveNodeCommand,
  RenameNodeCommand,
  CreateConnectionCommand,
  DeleteConnectionCommand,
} from '../../services/commands';
import { NodeComponent } from '../node/node';
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
        <app-connection-layer #connectionLayer (connectionDelete)="onConnectionDelete($event)" />

        <div class="nodes-container">
          @for (node of graphService.nodes(); track node.id) {
            <app-node
              [node]="node"
              [isSelected]="graphService.selectedNodeId() === node.id"
              [snapTarget]="currentSnapTarget"
              (startMove)="onNodeStartMove($event)"
              (rename)="onNodeRename($event)"
              (handleDragStart)="onHandleDragStart($event)"
              (sizeChanged)="onNodeSizeChanged($event)"
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
      background: #1a1a2e;
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

  // Node drag state
  private isDraggingNode = false;
  private dragNodeId: string | null = null;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragNodeStartX = 0;
  private dragNodeStartY = 0;
  private hasMoved = false;

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
    }
    this.hasMoved = false;
    this.graphService.selectNode(event.nodeId);
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
      this.graphService.updateNodePosition(this.dragNodeId, newX, newY);
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
      const container = document.querySelector('.canvas-container');
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const screenX = event.clientX - rect.left;
      const screenY = event.clientY - rect.top;
      const canvasPos = this.screenToCanvas(screenX, screenY);

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
      if (node) {
        // Node is already at the new position. We create a MoveNodeCommand with
        // explicit original coordinates so undo restores the drag-start position.
        const cmd = new MoveNodeCommand(
          this.graphService,
          this.dragNodeId,
          node.x,
          node.y,
          this.dragNodeStartX,
          this.dragNodeStartY,
        );
        // Push to history without re-executing via pushWithoutExecute (node is already at target position)
        this.historyService.pushWithoutExecute(cmd);
      }
    }
    this.isDraggingNode = false;
    this.dragNodeId = null;
    this.hasMoved = false;

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

  onConnectionDelete(connectionId: string): void {
    const cmd = new DeleteConnectionCommand(this.graphService, connectionId);
    this.historyService.execute(cmd);
  }

  onNodeSizeChanged(event: { nodeId: string; width: number; height: number }): void {
    this.graphService.updateNodeSize(event.nodeId, event.width, event.height);
  }
}
