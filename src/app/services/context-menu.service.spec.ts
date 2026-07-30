import { TestBed } from '@angular/core/testing';
import { ContextMenuService } from './context-menu.service';
import { GraphService } from './graph.service';
import { HistoryService } from './history.service';
import { textFromString } from '../models/text';

describe('ContextMenuService', () => {
  let service: ContextMenuService;
  let graphService: GraphService;
  let historyService: HistoryService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ContextMenuService);
    graphService = TestBed.inject(GraphService);
    historyService = TestBed.inject(HistoryService);
  });

  describe('openFor selection rules', () => {
    it('right-click on a node selects it before the menu opens', () => {
      const node = graphService.createNode('A', 0, 0);

      service.openFor({ kind: 'node', nodeId: node.id }, 10, 10);

      expect(graphService.selectedNodeId()).toBe(node.id);
    });

    it('right-click on a Group selects it (Groups are nodes)', () => {
      const group = graphService.createGroup('G', 0, 0);

      service.openFor({ kind: 'node', nodeId: group.id }, 10, 10);

      expect(graphService.selectedNodeId()).toBe(group.id);
    });

    it('right-click on a connection selects it and deselects any node', () => {
      const a = graphService.createNode('A', 0, 0);
      const b = graphService.createNode('B', 300, 0);
      const conn = graphService.createConnection(a.id, 'right', b.id, 'left')!;
      graphService.selectNode(a.id);

      service.openFor({ kind: 'connection', connectionId: conn.id }, 10, 10);

      expect(graphService.selectedConnectionId()).toBe(conn.id);
      expect(graphService.selectedNodeId()).toBeNull();
    });

    it('right-click on empty Canvas clears the selection', () => {
      const node = graphService.createNode('A', 0, 0);
      graphService.selectNode(node.id);

      service.openFor({ kind: 'canvas' }, 10, 10);

      expect(graphService.selectedNodeId()).toBeNull();
      expect(graphService.selectedConnectionId()).toBeNull();
    });

    it('opening a menu never touches History', () => {
      const node = graphService.createNode('A', 0, 0);

      service.openFor({ kind: 'node', nodeId: node.id }, 10, 10);
      service.openFor({ kind: 'canvas' }, 10, 10);

      expect(historyService.canUndo()).toBe(false);
    });

    it('exposes the kind of the last-opened target for the menu template', () => {
      const node = graphService.createNode('A', 0, 0);

      service.openFor({ kind: 'canvas' }, 0, 0);
      expect(service.menuKind()).toBe('canvas');

      service.openFor({ kind: 'node', nodeId: node.id }, 0, 0);
      expect(service.menuKind()).toBe('node');
    });

    it('reports whether the node target is a Group (drives the "Add node" item)', () => {
      const node = graphService.createNode('A', 0, 0);
      const group = graphService.createGroup('G', 0, 0);

      service.openFor({ kind: 'node', nodeId: group.id }, 0, 0);
      expect(service.targetIsGroup()).toBe(true);

      service.openFor({ kind: 'node', nodeId: node.id }, 0, 0);
      expect(service.targetIsGroup()).toBe(false);

      service.openFor({ kind: 'canvas' }, 0, 0);
      expect(service.targetIsGroup()).toBe(false);
    });
  });

  describe('addNode', () => {
    it('creates a "New Node" centered on the right-click point as one undo step', () => {
      service.openFor({ kind: 'canvas' }, 200, 120);
      service.addNode();

      expect(graphService.nodes().length).toBe(1);
      const node = graphService.nodes()[0];
      expect(node.text).toEqual(textFromString('New Node'));
      // 160x48 node centered on the point → point minus 60/24
      expect(node.x).toBe(140);
      expect(node.y).toBe(96);
      expect(node.width).toBe(160);
      expect(node.height).toBe(48);
      expect(node.parentId).toBeUndefined();

      historyService.undo();
      expect(graphService.nodes().length).toBe(0);
    });

    it('creates a child of the Group when the target is a Group', () => {
      const group = graphService.createGroup('G', 0, 0);
      service.openFor({ kind: 'node', nodeId: group.id }, 200, 120);
      service.addNode();

      const child = graphService.nodes().find(n => n.parentId === group.id);
      expect(child).toBeTruthy();
      expect(child!.text).toEqual(textFromString('New Node'));
      expect(child!.x).toBe(140);
      expect(child!.y).toBe(96);
    });
  });

  describe('addGroup', () => {
    it('creates a "New Group" centered on the right-click point as one undo step', () => {
      service.openFor({ kind: 'canvas' }, 400, 300);
      service.addGroup();

      expect(graphService.nodes().length).toBe(1);
      const group = graphService.nodes()[0];
      expect(group.label).toBe('New Group');
      expect(group.kind).toBe('group');
      // 320x200 group centered on the point → point minus 160/100
      expect(group.x).toBe(240);
      expect(group.y).toBe(200);
      expect(group.width).toBe(320);
      expect(group.height).toBe(200);

      historyService.undo();
      expect(graphService.nodes().length).toBe(0);
    });
  });

  describe('deleteTarget', () => {
    it('deletes a Node and cascades its Connections as one undo step', () => {
      const a = graphService.createNode('A', 0, 0);
      const b = graphService.createNode('B', 300, 0);
      graphService.createConnection(a.id, 'right', b.id, 'left');
      service.openFor({ kind: 'node', nodeId: a.id }, 10, 10);

      service.deleteTarget();

      expect(graphService.nodes().find(n => n.id === a.id)).toBeUndefined();
      expect(graphService.connections().length).toBe(0);

      historyService.undo();
      expect(graphService.nodes().find(n => n.id === a.id)).toBeTruthy();
      expect(graphService.connections().length).toBe(1);
    });

    it('deletes only the Connection when the target is a Connection', () => {
      const a = graphService.createNode('A', 0, 0);
      const b = graphService.createNode('B', 300, 0);
      const conn = graphService.createConnection(a.id, 'right', b.id, 'left')!;
      service.openFor({ kind: 'connection', connectionId: conn.id }, 10, 10);

      service.deleteTarget();

      expect(graphService.connections().length).toBe(0);
      expect(graphService.nodes().length).toBe(2);
    });
  });

  describe('rename / editText requests', () => {
    it('rename exposes the Group id to edit and never touches History', () => {
      const group = graphService.createGroup('G', 0, 0);
      service.openFor({ kind: 'node', nodeId: group.id }, 10, 10);

      service.rename();

      expect(service.renameRequest()).toBe(group.id);
      expect(historyService.canUndo()).toBe(false);
    });

    it('rename is a no-op for a regular node (nodes carry Text, not a Label)', () => {
      const node = graphService.createNode('A', 0, 0);
      service.openFor({ kind: 'node', nodeId: node.id }, 10, 10);

      service.rename();

      expect(service.renameRequest()).toBeNull();
    });

    it('a rename request is cleared once consumed', () => {
      const group = graphService.createGroup('G', 0, 0);
      service.openFor({ kind: 'node', nodeId: group.id }, 10, 10);
      service.rename();

      service.clearRenameRequest();

      expect(service.renameRequest()).toBeNull();
    });

    it('editText on a regular node exposes the node id and never touches History', () => {
      const node = graphService.createNode('A', 0, 0);
      service.openFor({ kind: 'node', nodeId: node.id }, 10, 10);

      service.editText();

      expect(service.editTextRequest()).toBe(node.id);
      expect(service.connectionTextRequest()).toBeNull();
      expect(historyService.canUndo()).toBe(false);
    });

    it('editText on a Group is a no-op (Groups are renamed, not text-edited)', () => {
      const group = graphService.createGroup('G', 0, 0);
      service.openFor({ kind: 'node', nodeId: group.id }, 10, 10);

      service.editText();

      expect(service.editTextRequest()).toBeNull();
    });

    it('an editText request is cleared once consumed', () => {
      const node = graphService.createNode('A', 0, 0);
      service.openFor({ kind: 'node', nodeId: node.id }, 10, 10);
      service.editText();

      service.clearEditTextRequest();

      expect(service.editTextRequest()).toBeNull();
    });

    it('editText on a Connection exposes the connection id and never touches History', () => {
      const a = graphService.createNode('A', 0, 0);
      const b = graphService.createNode('B', 300, 0);
      const conn = graphService.createConnection(a.id, 'right', b.id, 'left')!;
      service.openFor({ kind: 'connection', connectionId: conn.id }, 10, 10);

      service.editText();

      expect(service.connectionTextRequest()).toBe(conn.id);
      expect(service.editTextRequest()).toBeNull();
      expect(historyService.canUndo()).toBe(false);
    });

    it('a connection editText request is cleared once consumed', () => {
      const a = graphService.createNode('A', 0, 0);
      const b = graphService.createNode('B', 300, 0);
      const conn = graphService.createConnection(a.id, 'right', b.id, 'left')!;
      service.openFor({ kind: 'connection', connectionId: conn.id }, 10, 10);
      service.editText();

      service.clearConnectionTextRequest();

      expect(service.connectionTextRequest()).toBeNull();
    });
  });
});
