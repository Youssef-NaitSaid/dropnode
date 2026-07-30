import { Component, computed, effect, input, output, signal, ChangeDetectionStrategy, inject } from '@angular/core';
import { GraphNode, HandleSide, NODE_PALETTE } from '../../models/node';
import { Connection, ArrowheadType, effectiveArrowhead } from '../../models/connection';
import { Text, isTextEmpty } from '../../models/text';
import { GraphService } from '../../services/graph.service';
import { ContextMenuService } from '../../services/context-menu.service';
import { TextViewComponent } from '../text-view/text-view';
import { TextEditorComponent } from '../text-editor/text-editor';

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
  imports: [TextViewComponent, TextEditorComponent],
  template: `
    <svg class="connection-layer" [attr.width]="svgWidth()" [attr.height]="svgHeight()">
      <defs>
        @for (color of markerColors; track color) {
          <marker
            [attr.id]="markerId('arrow', color)"
            viewBox="0 0 10 10" refX="9" refY="5"
            markerWidth="7" markerHeight="7" orient="auto-start-reverse"
          >
            <path d="M1,1 L9,5 L1,9" fill="none" [attr.stroke]="color" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </marker>
          <marker
            [attr.id]="markerId('triangle', color)"
            viewBox="0 0 10 10" refX="9" refY="5"
            markerWidth="7" markerHeight="7" orient="auto-start-reverse"
          >
            <path d="M1,1 L9,5 L1,9 Z" [attr.fill]="color" />
          </marker>
        }
      </defs>
      @for (conn of connections(); track conn.id) {
        <path
          [attr.d]="getConnectionPath(conn)"
          [attr.data-connection-id]="conn.id"
          [attr.marker-start]="markerStart(conn)"
          [attr.marker-end]="markerEnd(conn)"
          class="connection-path"
          [class.selected]="isSelected(conn.id)"
          [style.stroke]="strokeColor(conn)"
          [style.filter]="isSelected(conn.id) ? glowFilter(conn) : null"
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

    <!-- Connection Text renders as DOM cards (ADR-0001 hybrid: text in DOM, curves in SVG) -->
    <div class="label-layer">
      @for (conn of connections(); track conn.id) {
        @if (editingConnectionId() === conn.id) {
          <div
            class="connection-text-card editing"
            [style.left.px]="getLabelMidpoint(conn).x"
            [style.top.px]="getLabelMidpoint(conn).y"
            (mousedown)="$event.stopPropagation()"
            (dblclick)="$event.stopPropagation()"
            (contextmenu)="$event.stopPropagation()"
          >
            <app-text-editor
              [text]="conn.text ?? []"
              (commit)="onTextEditorCommit(conn, $event)"
              (cancelled)="cancelTextEdit()"
            />
          </div>
        } @else if (conn.text) {
          <div
            class="connection-text-card"
            [attr.data-connection-id]="conn.id"
            [class.selected]="isSelected(conn.id)"
            [style.left.px]="getLabelMidpoint(conn).x"
            [style.top.px]="getLabelMidpoint(conn).y"
            (mousedown)="onConnectionMouseDown(conn, $event)"
            (dblclick)="onConnectionDoubleClick(conn, $event)"
          >
            <app-text-view [text]="conn.text" />
          </div>
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
      transition: stroke-width 0.15s ease, filter 0.15s ease;
    }
    .connection-path:hover {
      stroke-width: 3.5;
    }
    .connection-path.selected {
      stroke-width: 4;
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
    .connection-text-card {
      position: absolute;
      transform: translate(-50%, -50%);
      background: #1c1c22;
      border: 1px solid rgba(124, 92, 255, 0.45);
      border-radius: 10px;
      padding: 3px 10px;
      color: #e8e8ee;
      font-size: 12px;
      font-weight: 500;
      max-width: 240px;
      width: max-content;
      text-align: center;
      cursor: pointer;
      user-select: none;
      --tv-size-s: 10px;
      --tv-size-l: 15px;
    }
    .connection-text-card.selected {
      border-color: #7c5cff;
      box-shadow: 0 0 0 2px rgba(124, 92, 255, 0.4);
    }
    .connection-text-card.editing {
      border-color: #7c5cff;
      width: 240px;
      cursor: text;
      user-select: text;
    }
  `],
})
export class ConnectionLayerComponent {
  private graphService = inject(GraphService);

  nodes = this.graphService.nodes;
  connections = this.graphService.connections;

  // Default stroke when a Connection carries no color (matches the CSS fallback)
  private static readonly DEFAULT_STROKE = '#7c5cff';

  // SVG markers don't inherit stroke color, so one marker is emitted per
  // possible stroke color: the default plus every palette color.
  readonly markerColors: readonly string[] = [
    ConnectionLayerComponent.DEFAULT_STROKE,
    ...NODE_PALETTE,
  ];

  markerId(type: 'arrow' | 'triangle', color: string): string {
    return `ah-${type}-${color.replace('#', '')}`;
  }

  strokeColor(conn: Connection): string {
    return conn.color ?? ConnectionLayerComponent.DEFAULT_STROKE;
  }

  // A colored Connection keeps its own color when selected; the glow matches it
  glowFilter(conn: Connection): string {
    return `drop-shadow(0 0 4px ${this.strokeColor(conn)})`;
  }

  markerStart(conn: Connection): string | null {
    return this.markerRef(effectiveArrowhead(conn, 'start'), conn);
  }

  markerEnd(conn: Connection): string | null {
    return this.markerRef(effectiveArrowhead(conn, 'end'), conn);
  }

  // A shared marker (orient="auto-start-reverse") serves both endpoints: it
  // points outward at the start and into the target at the end.
  private markerRef(type: ArrowheadType, conn: Connection): string | null {
    if (type === 'none') return null;
    return `url(#${this.markerId(type, this.strokeColor(conn))})`;
  }

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

  // Connection whose Text is being edited inline, if any
  editingConnectionId = signal<string | null>(null);

  private contextMenuService = inject(ContextMenuService);

  constructor() {
    // The context menu's "Edit text" opens this Connection's inline editor
    effect(() => {
      const id = this.contextMenuService.connectionTextRequest();
      if (id && this.connections().some(c => c.id === id)) {
        this.editingConnectionId.set(id);
        this.contextMenuService.clearConnectionTextRequest();
      }
    });
  }

  connectionSelect = output<string>();
  // null means the Text was cleared (committing empty removes it)
  textCommit = output<{ connectionId: string; newText: Text | null }>();

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

  // Unlike Node Text, committing empty is meaningful: it removes the Text.
  // The editor only emits when the content changed.
  onTextEditorCommit(conn: Connection, newText: Text): void {
    this.editingConnectionId.set(null);
    const cleared = isTextEmpty(newText);
    // Emptying an already-unlabeled Connection changes nothing — no Command
    if (cleared && !conn.text) return;
    this.textCommit.emit({
      connectionId: conn.id,
      newText: cleared ? null : newText,
    });
  }

  cancelTextEdit(): void {
    this.editingConnectionId.set(null);
  }
}
