import { Injectable, signal, computed } from '@angular/core';
import { GraphNode, HandleSide } from '../models/node';
import { Connection } from '../models/connection';
import { GraphState } from '../models/graph-state';
import { ViewportState } from '../models/viewport-state';

@Injectable({ providedIn: 'root' })
export class GraphService {
  // Core state signals
  readonly nodes = signal<GraphNode[]>([]);
  readonly connections = signal<Connection[]>([]);
  readonly viewportState = signal<ViewportState>({ panX: 0, panY: 0, zoom: 1 });
  readonly selectedNodeId = signal<string | null>(null);

  // Computed signals
  readonly nodeCount = computed(() => this.nodes().length);
  readonly selectedNode = computed(() => {
    const id = this.selectedNodeId();
    return id ? this.nodes().find(n => n.id === id) ?? null : null;
  });

  private idCounter = 0;

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${++this.idCounter}`;
  }

  // Node operations
  createNode(label: string, x: number, y: number, width = 160, height = 48): GraphNode {
    const node: GraphNode = {
      id: this.generateId('node'),
      label,
      x,
      y,
      width,
      height,
    };
    this.nodes.update(nodes => [...nodes, node]);
    return node;
  }

  updateNodePosition(id: string, x: number, y: number): void {
    this.nodes.update(nodes =>
      nodes.map(n => n.id === id ? { ...n, x, y } : n)
    );
  }

  updateNodeSize(id: string, width: number, height: number): void {
    this.nodes.update(nodes =>
      nodes.map(n => n.id === id ? { ...n, width, height } : n)
    );
  }

  updateNodeLabel(id: string, label: string): void {
    this.nodes.update(nodes =>
      nodes.map(n => n.id === id ? { ...n, label } : n)
    );
  }

  deleteNode(id: string): { node: GraphNode; removedConnections: Connection[] } {
    const node = this.nodes().find(n => n.id === id);
    if (!node) throw new Error(`Node ${id} not found`);

    const removedConnections = this.connections().filter(
      c => c.sourceNodeId === id || c.targetNodeId === id
    );

    this.connections.update(conns =>
      conns.filter(c => c.sourceNodeId !== id && c.targetNodeId !== id)
    );
    this.nodes.update(nodes => nodes.filter(n => n.id !== id));

    if (this.selectedNodeId() === id) {
      this.selectedNodeId.set(null);
    }

    return { node, removedConnections };
  }

  // Connection operations
  createConnection(
    sourceNodeId: string,
    sourceHandle: HandleSide,
    targetNodeId: string,
    targetHandle: HandleSide
  ): Connection | null {
    // Prevent self-connections
    if (sourceNodeId === targetNodeId) return null;

    // Prevent duplicate connections
    const exists = this.connections().some(
      c => c.sourceNodeId === sourceNodeId &&
           c.sourceHandle === sourceHandle &&
           c.targetNodeId === targetNodeId &&
           c.targetHandle === targetHandle
    );
    if (exists) return null;

    const connection: Connection = {
      id: this.generateId('conn'),
      sourceNodeId,
      sourceHandle,
      targetNodeId,
      targetHandle,
    };
    this.connections.update(conns => [...conns, connection]);
    return connection;
  }

  deleteConnection(id: string): Connection | undefined {
    const conn = this.connections().find(c => c.id === id);
    if (!conn) return undefined;
    this.connections.update(conns => conns.filter(c => c.id !== id));
    return conn;
  }

  // Selection
  selectNode(id: string | null): void {
    this.selectedNodeId.set(id);
  }

  // Viewport
  setViewport(state: Partial<ViewportState>): void {
    this.viewportState.update(current => ({ ...current, ...state }));
  }

  resetViewport(): void {
    this.viewportState.set({ panX: 0, panY: 0, zoom: 1 });
  }

  zoomBy(delta: number, centerX: number, centerY: number): void {
    const current = this.viewportState();
    const newZoom = Math.min(Math.max(current.zoom + delta, 0.1), 5);
    const zoomRatio = newZoom / current.zoom;

    // Zoom centered on the given point
    const newPanX = centerX - (centerX - current.panX) * zoomRatio;
    const newPanY = centerY - (centerY - current.panY) * zoomRatio;

    this.viewportState.set({ panX: newPanX, panY: newPanY, zoom: newZoom });
  }

  // Handle position computation
  getHandlePosition(nodeId: string, handle: HandleSide): { x: number; y: number } | null {
    const node = this.nodes().find(n => n.id === nodeId);
    if (!node) return null;

    switch (handle) {
      case 'top':
        return { x: node.x + node.width / 2, y: node.y };
      case 'right':
        return { x: node.x + node.width, y: node.y + node.height / 2 };
      case 'bottom':
        return { x: node.x + node.width / 2, y: node.y + node.height };
      case 'left':
        return { x: node.x, y: node.y + node.height / 2 };
    }
  }

  // Import/Export
  importGraph(state: GraphState): { success: boolean; error?: string } {
    const validation = this.validateGraphState(state);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    this.nodes.set([...state.nodes]);
    this.connections.set([...state.connections]);
    this.selectedNodeId.set(null);
    return { success: true };
  }

  exportGraph(): GraphState {
    return {
      nodes: this.nodes().map(n => ({ ...n })),
      connections: this.connections().map(c => ({ ...c })),
    };
  }

  private validateGraphState(state: unknown): { valid: boolean; error?: string } {
    if (!state || typeof state !== 'object') {
      return { valid: false, error: 'Invalid graph state: not an object' };
    }

    const s = state as Record<string, unknown>;

    if (!Array.isArray(s['nodes'])) {
      return { valid: false, error: 'Invalid graph state: nodes must be an array' };
    }
    if (!Array.isArray(s['connections'])) {
      return { valid: false, error: 'Invalid graph state: connections must be an array' };
    }

    const nodesArr = s['nodes'] as unknown[];
    const connsArr = s['connections'] as unknown[];
    const nodeIds = new Set<string>();
    const validHandles: HandleSide[] = ['top', 'right', 'bottom', 'left'];

    for (let i = 0; i < nodesArr.length; i++) {
      const node = nodesArr[i] as Record<string, unknown>;
      if (!node || typeof node !== 'object') {
        return { valid: false, error: `Invalid node at index ${i}: not an object` };
      }
      if (typeof node['id'] !== 'string' || !node['id']) {
        return { valid: false, error: `Invalid node at index ${i}: missing or invalid id` };
      }
      const nodeId = node['id'] as string;
      if (nodeIds.has(nodeId)) {
        return { valid: false, error: `Duplicate node id: ${nodeId}` };
      }
      if (typeof node['label'] !== 'string') {
        return { valid: false, error: `Invalid node ${nodeId}: label must be a string` };
      }
      if (typeof node['x'] !== 'number' || typeof node['y'] !== 'number') {
        return { valid: false, error: `Invalid node ${nodeId}: x and y must be numbers` };
      }
      if (typeof node['width'] !== 'number' || typeof node['height'] !== 'number') {
        return { valid: false, error: `Invalid node ${nodeId}: width and height must be numbers` };
      }
      nodeIds.add(nodeId);
    }

    for (let i = 0; i < connsArr.length; i++) {
      const conn = connsArr[i] as Record<string, unknown>;
      if (!conn || typeof conn !== 'object') {
        return { valid: false, error: `Invalid connection at index ${i}: not an object` };
      }
      if (typeof conn['id'] !== 'string' || !conn['id']) {
        return { valid: false, error: `Invalid connection at index ${i}: missing or invalid id` };
      }
      const connId = conn['id'] as string;
      if (typeof conn['sourceNodeId'] !== 'string' || !nodeIds.has(conn['sourceNodeId'] as string)) {
        return { valid: false, error: `Invalid connection ${connId}: sourceNodeId references non-existent node` };
      }
      if (typeof conn['targetNodeId'] !== 'string' || !nodeIds.has(conn['targetNodeId'] as string)) {
        return { valid: false, error: `Invalid connection ${connId}: targetNodeId references non-existent node` };
      }
      if (!validHandles.includes(conn['sourceHandle'] as HandleSide)) {
        return { valid: false, error: `Invalid connection ${connId}: invalid sourceHandle` };
      }
      if (!validHandles.includes(conn['targetHandle'] as HandleSide)) {
        return { valid: false, error: `Invalid connection ${connId}: invalid targetHandle` };
      }
    }

    return { valid: true };
  }

  // URL parameter loading
  loadFromUrlParam(): { loaded: boolean; error?: string } {
    if (typeof window === 'undefined') return { loaded: false };

    const params = new URLSearchParams(window.location.search);
    const dataParam = params.get('data');

    if (!dataParam) return { loaded: false };

    try {
      const decoded = decodeURIComponent(dataParam);
      const parsed = JSON.parse(decoded);
      const result = this.importGraph(parsed);
      return { loaded: result.success, error: result.error };
    } catch (e) {
      return { loaded: false, error: 'Failed to parse URL data parameter' };
    }
  }

  // Clear all
  clearGraph(): void {
    this.nodes.set([]);
    this.connections.set([]);
    this.selectedNodeId.set(null);
  }
}
