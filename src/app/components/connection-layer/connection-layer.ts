import { Component, computed, input, output, signal, ChangeDetectionStrategy, inject } from '@angular/core';
import { GraphNode, HandleSide } from '../../models/node';
import { Connection } from '../../models/connection';
import { GraphService } from '../../services/graph.service';

interface DragState {
  sourceNodeId: string;
  sourceHandle: HandleSide;
  currentX: number;
  currentY: number;
  targetNodeId: string | null;
  targetHandle: HandleSide | null;
}

@Component({
  selector: 'app-connection-layer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg class="connection-layer" [attr.width]="svgWidth()" [attr.height]="svgHeight()">
      @for (conn of connections(); track conn.id) {
        <path
          [attr.d]="getConnectionPath(conn)"
          class="connection-path"
          (mousedown)="onConnectionClick(conn, $event)"
        />
      }

      @if (dragState()) {
        <path
          [attr.d]="getGhostPath()"
          class="connection-ghost"
        />
      }
    </svg>
  `,
  styles: [`
    .connection-layer {
      position: absolute;
      top: 0;
      left: 0;
      pointer-events: none;
      overflow: visible;
    }
    .connection-path {
      fill: none;
      stroke: #6c63ff;
      stroke-width: 2.5;
      pointer-events: stroke;
      cursor: pointer;
      transition: stroke 0.15s ease;
    }
    .connection-path:hover {
      stroke: #ff6b6b;
      stroke-width: 3.5;
    }
    .connection-ghost {
      fill: none;
      stroke: #6c63ff;
      stroke-width: 2;
      stroke-dasharray: 8 4;
      opacity: 0.7;
      pointer-events: none;
    }
  `],
})
export class ConnectionLayerComponent {
  private graphService = inject(GraphService);

  nodes = this.graphService.nodes;
  connections = this.graphService.connections;

  svgWidth = computed(() => {
    const nodes = this.nodes();
    if (nodes.length === 0) return 5000;
    const maxX = Math.max(...nodes.map(n => n.x + n.width));
    return Math.max(maxX + 1000, 5000);
  });

  svgHeight = computed(() => {
    const nodes = this.nodes();
    if (nodes.length === 0) return 5000;
    const maxY = Math.max(...nodes.map(n => n.y + n.height));
    return Math.max(maxY + 1000, 5000);
  });

  dragState = signal<DragState | null>(null);

  connectionDelete = output<string>();

  snapTarget = computed(() => {
    const state = this.dragState();
    if (!state || !state.targetNodeId || !state.targetHandle) return null;
    return { nodeId: state.targetNodeId, handle: state.targetHandle };
  });

  private getHandlePos(nodeId: string, handle: HandleSide): { x: number; y: number } {
    return this.graphService.getHandlePosition(nodeId, handle) ?? { x: 0, y: 0 };
  }

  getConnectionPath(conn: Connection): string {
    const start = this.getHandlePos(conn.sourceNodeId, conn.sourceHandle);
    const end = this.getHandlePos(conn.targetNodeId, conn.targetHandle);
    return this.buildBezierPath(start, end, conn.sourceHandle, conn.targetHandle);
  }

  getGhostPath(): string {
    const state = this.dragState();
    if (!state) return '';
    const start = this.getHandlePos(state.sourceNodeId, state.sourceHandle);
    const end = { x: state.currentX, y: state.currentY };
    const endHandle = state.targetHandle ?? this.getOppositeHandle(state.sourceHandle);
    return this.buildBezierPath(start, end, state.sourceHandle, endHandle);
  }

  private buildBezierPath(
    start: { x: number; y: number },
    end: { x: number; y: number },
    startHandle: HandleSide,
    endHandle: HandleSide,
  ): string {
    const distance = Math.sqrt((end.x - start.x) ** 2 + (end.y - start.y) ** 2);
    const offset = Math.min(Math.max(distance * 0.4, 40), 150);
    const cp1 = this.getControlPoint(start, startHandle, offset);
    const cp2 = this.getControlPoint(end, endHandle, offset);
    return `M ${start.x} ${start.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${end.x} ${end.y}`;
  }

  private getControlPoint(pos: { x: number; y: number }, handle: HandleSide, offset: number): { x: number; y: number } {
    switch (handle) {
      case 'top': return { x: pos.x, y: pos.y - offset };
      case 'right': return { x: pos.x + offset, y: pos.y };
      case 'bottom': return { x: pos.x, y: pos.y + offset };
      case 'left': return { x: pos.x - offset, y: pos.y };
    }
  }

  private getOppositeHandle(handle: HandleSide): HandleSide {
    switch (handle) {
      case 'top': return 'bottom';
      case 'right': return 'left';
      case 'bottom': return 'top';
      case 'left': return 'right';
    }
  }

  // Public API for CanvasComponent
  startConnectionDrag(nodeId: string, handle: HandleSide, _event: MouseEvent): void {
    const pos = this.getHandlePos(nodeId, handle);
    this.dragState.set({
      sourceNodeId: nodeId,
      sourceHandle: handle,
      currentX: pos.x,
      currentY: pos.y,
      targetNodeId: null,
      targetHandle: null,
    });
  }

  updateConnectionDrag(canvasX: number, canvasY: number): void {
    const state = this.dragState();
    if (!state) return;

    const snapThreshold = 30;
    let targetNodeId: string | null = null;
    let targetHandle: HandleSide | null = null;
    let minDist = snapThreshold;

    const sourceNode = this.nodes().find(n => n.id === state.sourceNodeId);
    for (const node of this.nodes()) {
      if (node.id === state.sourceNodeId) continue;
      // A Group and its own children are never snap targets of each other
      if (node.parentId === state.sourceNodeId || sourceNode?.parentId === node.id) continue;
      for (const side of ['top', 'right', 'bottom', 'left'] as HandleSide[]) {
        const handlePos = this.getHandlePos(node.id, side);
        const dist = Math.sqrt((canvasX - handlePos.x) ** 2 + (canvasY - handlePos.y) ** 2);
        if (dist < minDist) {
          minDist = dist;
          targetNodeId = node.id;
          targetHandle = side;
        }
      }
    }

    this.dragState.update(s => s ? {
      ...s,
      currentX: canvasX,
      currentY: canvasY,
      targetNodeId,
      targetHandle,
    } : null);
  }

  endConnectionDrag(): { targetNodeId: string; targetHandle: HandleSide } | null {
    const state = this.dragState();
    this.dragState.set(null);
    if (state && state.targetNodeId && state.targetHandle) {
      return { targetNodeId: state.targetNodeId, targetHandle: state.targetHandle };
    }
    return null;
  }

  onConnectionClick(conn: Connection, event: MouseEvent): void {
    event.stopPropagation();
    this.connectionDelete.emit(conn.id);
  }
}
