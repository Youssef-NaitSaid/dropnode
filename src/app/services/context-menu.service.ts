import { Injectable, inject, signal, computed } from '@angular/core';
import { GraphService } from './graph.service';
import { HistoryService } from './history.service';
import { CreateNodeCommand, CreateGroupCommand, DeleteNodeCompoundCommand, DeleteConnectionCommand } from './commands';

/** What a right-click landed on, and — for the empty Canvas — nothing more. */
export type ContextTarget =
  | { kind: 'canvas' }
  | { kind: 'node'; nodeId: string }
  | { kind: 'connection'; connectionId: string };

// New Node / New Group placement, centered on the right-click point. The Node
// x-offset is 60 (matching the existing double-click create), not width/2.
const NODE_OFFSET_X = 60;
const NODE_OFFSET_Y = 24;
const GROUP_OFFSET_X = 160;
const GROUP_OFFSET_Y = 100;

@Injectable({ providedIn: 'root' })
export class ContextMenuService {
  private graphService = inject(GraphService);
  private historyService = inject(HistoryService);

  // The context the currently-open menu acts on, plus the canvas-coordinate
  // point of the right-click (where empty-Canvas creations are centered).
  private target = signal<ContextTarget | null>(null);
  private pointX = 0;
  private pointY = 0;

  // Requests for the thin UI to open an existing inline editor. The Node and
  // Connection-Layer components watch these and clear them once consumed.
  readonly renameRequest = signal<string | null>(null);
  readonly editTextRequest = signal<string | null>(null);
  readonly connectionTextRequest = signal<string | null>(null);

  // Which menu the thin UI should render for the currently-open context.
  readonly menuKind = computed(() => this.target()?.kind ?? null);

  // A node target shows "Add node" only when it is a Group. Reads nodes()
  // inside the computed so it stays correct if the target Group is mutated.
  readonly targetIsGroup = computed(() => {
    const t = this.target();
    return t?.kind === 'node' && this.isGroup(t.nodeId);
  });

  /**
   * Prime the menu for a right-click: select the target first (mirroring
   * left-click's exclusive selection), or clear selection on empty Canvas.
   */
  openFor(target: ContextTarget, canvasX: number, canvasY: number): void {
    this.target.set(target);
    this.pointX = canvasX;
    this.pointY = canvasY;

    switch (target.kind) {
      case 'node':
        this.graphService.selectNode(target.nodeId);
        break;
      case 'connection':
        this.graphService.selectConnection(target.connectionId);
        break;
      case 'canvas':
        this.graphService.selectNode(null);
        break;
    }
  }

  /**
   * Create a "New Node" (160x48) centered on the right-click point. When the
   * menu was opened on a Group, the node becomes a child of that Group.
   */
  addNode(): void {
    const target = this.target();
    if (!target) return;
    const parentId =
      target.kind === 'node' && this.isGroup(target.nodeId) ? target.nodeId : undefined;
    this.historyService.execute(
      new CreateNodeCommand(
        this.graphService,
        'New Node',
        this.pointX - NODE_OFFSET_X,
        this.pointY - NODE_OFFSET_Y,
        parentId,
      ),
    );
  }

  /** Create a "New Group" (320x200) centered on the right-click point. */
  addGroup(): void {
    this.historyService.execute(
      new CreateGroupCommand(
        this.graphService,
        'New Group',
        this.pointX - GROUP_OFFSET_X,
        this.pointY - GROUP_OFFSET_Y,
      ),
    );
  }

  private isGroup(nodeId: string): boolean {
    return this.graphService.nodes().find(n => n.id === nodeId)?.kind === 'group';
  }

  /**
   * Delete the target — a Node with its Connections (one compound undo step),
   * or a lone Connection — matching the Delete/Backspace shortcut exactly.
   */
  deleteTarget(): void {
    const target = this.target();
    if (!target) return;
    if (target.kind === 'node') {
      this.historyService.execute(new DeleteNodeCompoundCommand(this.graphService, target.nodeId));
    } else if (target.kind === 'connection') {
      this.historyService.execute(new DeleteConnectionCommand(this.graphService, target.connectionId));
    }
  }

  /** Ask the UI to open the target Group's inline Label editor (Groups only). */
  rename(): void {
    const target = this.target();
    if (target?.kind === 'node' && this.isGroup(target.nodeId)) {
      this.renameRequest.set(target.nodeId);
    }
  }

  clearRenameRequest(): void {
    this.renameRequest.set(null);
  }

  /** Ask the UI to open the target Node's or Connection's Text editor. */
  editText(): void {
    const target = this.target();
    if (target?.kind === 'node' && !this.isGroup(target.nodeId)) {
      this.editTextRequest.set(target.nodeId);
    } else if (target?.kind === 'connection') {
      this.connectionTextRequest.set(target.connectionId);
    }
  }

  clearEditTextRequest(): void {
    this.editTextRequest.set(null);
  }

  clearConnectionTextRequest(): void {
    this.connectionTextRequest.set(null);
  }
}
