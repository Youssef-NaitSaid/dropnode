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
          [class.selected]="isSelected(conn.id)"
          (mousedown)="onConnectionMouseDown(conn, $event)"
          (dblclick)="onConnectionDoubleClick(conn, $event)"
        />
      }

      @if (dragState()) {
        <path
          [attr.d]="getGhostPath()"
          class="connection-ghost"
        />
      }
    </svg>

    <!-- Connection Labels are DOM pills (ADR-0001 hybrid: text in DOM, curves in SVG) -->
    <div class="label-layer">
      @for (conn of connections(); track conn.id) {
        @if (editingConnectionId() === conn.id) {
          <input
            class="connection-label-input"
            [style.left.px]="getLabelMidpoint(conn).x"
            [style.top.px]="getLabelMidpoint(conn).y"
            [value]="conn.label ?? ''"
            (blur)="finishLabelEdit(conn, $event)"
            (keydown.enter)="finishLabelEdit(conn, $event)"
            (keydown.escape)="cancelLabelEdit()"
            (mousedown)="$event.stopPropagation()"
            autofocus
          />
        } @else if (conn.label) {
          <div
            class="connection-label"
            [class.selected]="isSelected(conn.id)"
            [style.left.px]="getLabelMidpoint(conn).x"
            [style.top.px]="getLabelMidpoint(conn).y"
            (mousedown)="onConnectionMouseDown(conn, $event)"
            (dblclick)="onConnectionDoubleClick(conn, $event)"
          >{{ conn.label }}</div>
        }
      }
    </div>
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
      stroke: #7c5cff;
      stroke-width: 2.5;
      pointer-events: stroke;
      cursor: pointer;
      transition: stroke 0.15s ease;
    }
    .connection-path:hover {
      stroke: #9d85ff;
      stroke-width: 3.5;
    }
    .connection-path.selected {
      stroke: #7c5cff;
      stroke-width: 4;
      filter: drop-shadow(0 0 4px rgba(124, 92, 255, 0.6));
    }
    .connection-ghost {
      fill: none;
      stroke: #7c5cff;
      stroke-width: 2;
      stroke-dasharray: 8 4;
      opacity: 0.7;
      pointer-events: none;
    }
    .label-layer {
      position: absolute;
      top: 0;
      left: 0;
    }
    .connection-label {
      position: absolute;
      transform: translate(-50%, -50%);
      background: #1c1c22;
      border: 1px solid rgba(124, 92, 255, 0.45);
      border-radius: 999px;
      padding: 2px 10px;
      color: #e8e8ee;
      font-size: 12px;
      font-weight: 500;
      white-space: nowrap;
      cursor: pointer;
      user-select: none;
    }
    .connection-label.selected {
      border-color: #7c5cff;
      box-shadow: 0 0 0 2px rgba(124, 92, 255, 0.4);
    }
    .connection-label-input {
      position: absolute;
      transform: translate(-50%, -50%);
      background: #1c1c22;
      border: 1px solid #7c5cff;
      border-radius: 999px;
      padding: 2px 10px;
      color: #e8e8ee;
      font-size: 12px;
      font-weight: 500;
      outline: none;
      width: 120px;
      text-align: center;
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

  // Connection whose label is being edited inline, if any
  editingConnectionId = signal<string | null>(null);

  connectionSelect = output<string>();
  labelCommit = output<{ connectionId: string; newLabel: string }>();

  snapTarget = computed(() => {
    const state = this.dragState();
    if (!state || !state.targetNodeId || !state.targetHandle) return null;
    return { nodeId: state.targetNodeId, handle: state.targetHandle };
  });

  private getHandlePos(nodeId: string, handle: HandleSide): { x: number; y: number } {
    return this.graphService.getHandlePosition(nodeId, handle) ?? { x: 0, y: 0 };
  }

  getConnectionPath(conn: Connection): string {
    const { start, end, cp1, cp2 } = this.getConnectionGeometry(conn);
    return this.formatBezier(start, cp1, cp2, end);
  }

  // Cubic bezier midpoint (t = 0.5): (start + 3·cp1 + 3·cp2 + end) / 8
  getLabelMidpoint(conn: Connection): { x: number; y: number } {
    const { start, end, cp1, cp2 } = this.getConnectionGeometry(conn);
    return {
      x: (start.x + 3 * cp1.x + 3 * cp2.x + end.x) / 8,
      y: (start.y + 3 * cp1.y + 3 * cp2.y + end.y) / 8,
    };
  }

  private getConnectionGeometry(conn: Connection): {
    start: { x: number; y: number };
    end: { x: number; y: number };
    cp1: { x: number; y: number };
    cp2: { x: number; y: number };
  } {
    const start = this.getHandlePos(conn.sourceNodeId, conn.sourceHandle);
    const end = this.getHandlePos(conn.targetNodeId, conn.targetHandle);
    const distance = Math.sqrt((end.x - start.x) ** 2 + (end.y - start.y) ** 2);
    const offset = Math.min(Math.max(distance * 0.4, 40), 150);
    const cp1 = this.getControlPoint(start, conn.sourceHandle, offset);
    const cp2 = this.getControlPoint(end, conn.targetHandle, offset);
    return { start, end, cp1, cp2 };
  }

  isSelected(connectionId: string): boolean {
    return this.graphService.selectedConnectionId() === connectionId;
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
    return this.formatBezier(start, cp1, cp2, end);
  }

  private formatBezier(
    start: { x: number; y: number },
    cp1: { x: number; y: number },
    cp2: { x: number; y: number },
    end: { x: number; y: number },
  ): string {
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

  onConnectionMouseDown(conn: Connection, event: MouseEvent): void {
    event.stopPropagation();
    this.connectionSelect.emit(conn.id);
  }

  onConnectionDoubleClick(conn: Connection, event: MouseEvent): void {
    event.stopPropagation();
    this.editingConnectionId.set(conn.id);
  }

  finishLabelEdit(conn: Connection, event: Event): void {
    // Enter commits and clears the editing flag; the input's follow-up blur lands here too
    if (this.editingConnectionId() !== conn.id) return;
    this.editingConnectionId.set(null);
    const input = event.target as HTMLInputElement;
    const newLabel = input.value.trim();
    const current = this.connections().find(c => c.id === conn.id);
    if (!current) return;
    // Unlike Node labels, committing empty is meaningful: it removes the label
    if (newLabel !== (current.label ?? '')) {
      this.labelCommit.emit({ connectionId: conn.id, newLabel });
    }
  }

  cancelLabelEdit(): void {
    this.editingConnectionId.set(null);
  }
}
