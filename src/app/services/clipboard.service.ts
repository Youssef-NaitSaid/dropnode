import { Injectable, inject, signal, computed } from '@angular/core';
import { GraphNode } from '../models/node';
import { Connection } from '../models/connection';
import { GraphService } from './graph.service';
import { HistoryService } from './history.service';
import { CompoundCommand, DeleteNodeCommand, InsertElementsCommand } from './commands';

// A captured set of elements plus the root (the copied Node or Group) whose
// copy gets selected after a paste.
interface ClipboardEntry {
  nodes: GraphNode[];
  connections: Connection[];
  rootId: string;
}

// Duplicate stagger and repeat-paste cascade step, in canvas units
const DUPLICATE_OFFSET = 24;

/**
 * The Clipboard (ADR-0011): an in-memory, single-entry, session-scoped
 * holding area for the most recently Cut or Copied Node or Group. Duplicate
 * lives here too but never reads or writes the Clipboard entry.
 */
@Injectable({ providedIn: 'root' })
export class ClipboardService {
  private graphService = inject(GraphService);
  private historyService = inject(HistoryService);

  private entry = signal<ClipboardEntry | null>(null);

  readonly canPaste = computed(() => this.entry() !== null);

  // Last known cursor position (raw, cheap to store on every mousemove) and
  // the repeat-paste cascade: unchanged anchor → +24,+24 per repeat. The
  // Canvas registers a resolver converting the raw point to canvas
  // coordinates lazily at paste time, keeping mousemove reflow-free.
  private cursorX = 0;
  private cursorY = 0;
  private cursorResolver: ((point: { x: number; y: number }) => { x: number; y: number } | null) | null = null;
  private lastPasteAnchor: { x: number; y: number } | null = null;
  private cascadeCount = 0;

  // A pending Alt+drag duplicate, created transiently and committed on drop
  private spawned: {
    nodes: GraphNode[]; connections: Connection[]; rootId: string; sourceId: string;
  } | null = null;

  /**
   * Capture a Node — or a Group with its children and internal Connections —
   * onto the Clipboard. No graph mutation, nothing on History.
   */
  copy(nodeId: string): void {
    const captured = this.capture(nodeId);
    if (captured) this.entry.set(captured);
  }

  /**
   * Capture like copy, then remove the captured set plus every Connection
   * touching any member, as one compound undo step. Unlike Delete, cutting
   * a Group removes its children instead of releasing them.
   */
  cut(nodeId: string): void {
    const captured = this.capture(nodeId);
    if (!captured) return;
    this.entry.set(captured);

    // Children first, then the root: each DeleteNodeCommand captures its own
    // Connections, and reverse-order undo restores the Group before the
    // children re-claim their parentId.
    const parts = captured.nodes
      .filter(n => n.id !== nodeId)
      .map(n => new DeleteNodeCommand(this.graphService, n.id));
    parts.push(new DeleteNodeCommand(this.graphService, nodeId));
    this.historyService.execute(new CompoundCommand('Cut', parts));
  }

  /**
   * Paste the Clipboard entry centered on a canvas point (the Context Menu
   * path). With a parentGroupId, pasted regular top-level nodes become
   * children of that Group; a pasted Group always lands parentless.
   */
  pasteAt(x: number, y: number, parentGroupId?: string): void {
    const entry = this.entry();
    if (!entry) return;

    const materialized = this.materialize(entry, parentGroupId);
    const bounds = this.boundsOf(materialized.nodes);
    const dx = x - (bounds.minX + bounds.maxX) / 2;
    const dy = y - (bounds.minY + bounds.maxY) / 2;
    for (const node of materialized.nodes) {
      node.x += dx;
      node.y += dy;
    }

    this.historyService.execute(new InsertElementsCommand(
      this.graphService, 'Paste', materialized.nodes, materialized.connections, materialized.rootId,
    ));
  }

  /** The Canvas pushes the raw cursor position here on every mousemove. */
  setCursorPosition(x: number, y: number): void {
    this.cursorX = x;
    this.cursorY = y;
  }

  /** Converts the raw cursor point to canvas coordinates at paste time. */
  registerCursorResolver(
    resolver: (point: { x: number; y: number }) => { x: number; y: number } | null,
  ): void {
    this.cursorResolver = resolver;
  }

  /**
   * Ctrl+V: paste centered on the tracked cursor position. Repeated pastes
   * at an unchanged cursor cascade by +24,+24 so copies never stack
   * invisibly. Canvas paste — parent references are stripped.
   */
  pasteAtCursor(): void {
    if (!this.entry()) return;

    const anchor = this.lastPasteAnchor;
    if (anchor && anchor.x === this.cursorX && anchor.y === this.cursorY) {
      this.cascadeCount++;
    } else {
      this.cascadeCount = 0;
      this.lastPasteAnchor = { x: this.cursorX, y: this.cursorY };
    }
    const raw = { x: this.cursorX, y: this.cursorY };
    const point = this.cursorResolver ? this.cursorResolver(raw) : raw;
    if (!point) return;
    const offset = this.cascadeCount * DUPLICATE_OFFSET;
    this.pasteAt(point.x + offset, point.y + offset);
  }

  /**
   * Duplicate: an immediate copy at +24,+24 keeping the original's parentId
   * (a sibling), selected, one undo step. Never reads or writes the Clipboard.
   */
  duplicate(nodeId: string): void {
    const materialized = this.materializeLiveCopy(nodeId, DUPLICATE_OFFSET, DUPLICATE_OFFSET);
    if (!materialized) return;
    this.historyService.execute(new InsertElementsCommand(
      this.graphService, 'Duplicate', materialized.nodes, materialized.connections, materialized.rootId,
    ));
  }

  /**
   * Alt+drag start: spawn the copy at the source position and select it —
   * the drag then moves the copy transiently. Nothing on History until
   * commitSpawnedDuplicate records the drop.
   */
  spawnDuplicate(nodeId: string): { primaryId: string; isGroup: boolean } | null {
    const materialized = this.materializeLiveCopy(nodeId, 0, 0);
    if (!materialized) return null;

    this.spawned = { ...materialized, sourceId: nodeId };
    this.graphService.nodes.update(nodes => [...nodes, ...materialized.nodes]);
    if (materialized.connections.length > 0) {
      this.graphService.connections.update(conns => [...conns, ...materialized.connections]);
    }
    this.graphService.selectNode(materialized.rootId);
    const isGroup = materialized.nodes.find(n => n.id === materialized.rootId)?.kind === 'group';
    return { primaryId: materialized.rootId, isGroup };
  }

  /**
   * Alt+drag drop: snapshot the spawned elements as they now stand (position
   * and membership included) into one InsertElementsCommand, pushed without
   * re-executing — mirroring how moves are recorded.
   */
  commitSpawnedDuplicate(): void {
    const spawned = this.spawned;
    this.spawned = null;
    if (!spawned) return;

    const nodeIds = new Set(spawned.nodes.map(n => n.id));
    const connIds = new Set(spawned.connections.map(c => c.id));
    const nodes = this.graphService.nodes().filter(n => nodeIds.has(n.id));
    const connections = this.graphService.connections().filter(c => connIds.has(c.id));
    this.historyService.pushWithoutExecute(new InsertElementsCommand(
      this.graphService, 'Duplicate', nodes, connections, spawned.rootId,
    ));
  }

  /**
   * Alt+drag abort (no movement): remove the spawn and restore the source
   * selection — an aborted gesture behaves like a plain click. History
   * untouched.
   */
  cancelSpawnedDuplicate(): void {
    const spawned = this.spawned;
    this.spawned = null;
    if (!spawned) return;

    const nodeIds = new Set(spawned.nodes.map(n => n.id));
    const connIds = new Set(spawned.connections.map(c => c.id));
    this.graphService.nodes.update(nodes => nodes.filter(n => !nodeIds.has(n.id)));
    this.graphService.connections.update(conns => conns.filter(c => !connIds.has(c.id)));
    if (nodeIds.has(this.graphService.selectedNodeId() ?? '')) {
      this.graphService.selectNode(spawned.sourceId);
    }
  }

  // Capture the live element (not the Clipboard) and materialize a copy
  // offset by dx/dy; the root keeps its live parentId (sibling semantics).
  private materializeLiveCopy(
    nodeId: string,
    dx: number,
    dy: number,
  ): { nodes: GraphNode[]; connections: Connection[]; rootId: string } | null {
    const root = this.graphService.nodes().find(n => n.id === nodeId);
    if (!root) return null;

    const captured = this.capture(nodeId)!;
    const materialized = this.materialize(captured, root.parentId);
    for (const node of materialized.nodes) {
      node.x += dx;
      node.y += dy;
    }
    return materialized;
  }

  // Deep-cloned capture of the target Node, or the Group plus its children
  // and Connections whose BOTH endpoints are inside the captured set.
  private capture(nodeId: string): ClipboardEntry | null {
    const root = this.graphService.nodes().find(n => n.id === nodeId);
    if (!root) return null;

    const nodes = root.kind === 'group'
      ? [root, ...this.graphService.childrenOf(root.id)]
      : [root];
    const ids = new Set(nodes.map(n => n.id));
    const connections = this.graphService.connections().filter(
      c => ids.has(c.sourceNodeId) && ids.has(c.targetNodeId),
    );

    return structuredClone({ nodes, connections, rootId: root.id });
  }

  // Fresh ids for every element, internal references remapped; parentId is
  // remapped when its Group is in the set, else replaced by parentGroupId
  // (Group paste-target) or stripped (Canvas paste).
  private materialize(
    entry: ClipboardEntry,
    parentGroupId?: string,
  ): { nodes: GraphNode[]; connections: Connection[]; rootId: string } {
    const cloned: ClipboardEntry = structuredClone(entry);
    const idMap = new Map<string, string>();
    for (const node of cloned.nodes) {
      idMap.set(node.id, this.graphService.generateNodeId());
    }

    const nodes = cloned.nodes.map(node => {
      const { parentId, ...rest } = node;
      const remapped: GraphNode = { ...rest, id: idMap.get(node.id)! };
      if (parentId && idMap.has(parentId)) {
        remapped.parentId = idMap.get(parentId);
      } else if (parentGroupId && remapped.kind !== 'group') {
        remapped.parentId = parentGroupId;
      }
      return remapped;
    });

    const connections = cloned.connections.map(conn => ({
      ...conn,
      id: this.graphService.generateConnectionId(),
      sourceNodeId: idMap.get(conn.sourceNodeId)!,
      targetNodeId: idMap.get(conn.targetNodeId)!,
    }));

    return { nodes, connections, rootId: idMap.get(entry.rootId)! };
  }

  private boundsOf(nodes: GraphNode[]): { minX: number; minY: number; maxX: number; maxY: number } {
    return {
      minX: Math.min(...nodes.map(n => n.x)),
      minY: Math.min(...nodes.map(n => n.y)),
      maxX: Math.max(...nodes.map(n => n.x + n.width)),
      maxY: Math.max(...nodes.map(n => n.y + n.height)),
    };
  }
}
