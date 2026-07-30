import { TestBed } from '@angular/core/testing';
import { GraphService } from './graph.service';
import { NODE_PALETTE } from '../models/node';
import { Text, textFromString } from '../models/text';
import {
  CreateNodeCommand,
  MoveNodeCommand,
  RenameNodeCommand,
  DeleteNodeCommand,
  CreateConnectionCommand,
  DeleteConnectionCommand,
  CreateGroupCommand,
  ChangeParentCommand,
  MoveGroupCommand,
  ResizeNodeCommand,
  SetNodeColorCommand,
  CompoundCommand,
  SetNodeTextCommand,
  SetConnectionTextCommand,
  InsertElementsCommand,
} from './commands';

describe('Commands', () => {
  let graphService: GraphService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    graphService = TestBed.inject(GraphService);
  });

  describe('CreateNodeCommand', () => {
    it('execute creates node', () => {
      const cmd = new CreateNodeCommand(graphService, 'Test Node', 100, 200);

      expect(graphService.nodes().length).toBe(0);
      cmd.execute();

      expect(graphService.nodes().length).toBe(1);
      const node = graphService.nodes()[0];
      expect(node.text).toEqual(textFromString('Test Node'));
      expect(node.x).toBe(100);
      expect(node.y).toBe(200);
    });

    it('undo removes node', () => {
      const cmd = new CreateNodeCommand(graphService, 'Test', 0, 0);
      cmd.execute();

      expect(graphService.nodes().length).toBe(1);
      const nodeId = graphService.nodes()[0].id;

      cmd.undo();
      expect(graphService.nodes().length).toBe(0);
    });

    it('getNode returns the created node', () => {
      const cmd = new CreateNodeCommand(graphService, 'Test', 0, 0);
      expect(cmd.getNode()).toBeNull();

      cmd.execute();
      const node = cmd.getNode();
      expect(node).not.toBeNull();
      expect(node!.text).toEqual(textFromString('Test'));
    });
  });

  describe('MoveNodeCommand', () => {
    it('execute moves node', () => {
      const node = graphService.createNode('Test', 0, 0);
      const cmd = new MoveNodeCommand(graphService, node.id, 100, 200);

      cmd.execute();
      const updated = graphService.nodes().find(n => n.id === node.id);
      expect(updated?.x).toBe(100);
      expect(updated?.y).toBe(200);
    });

    it('undo restores original position', () => {
      const node = graphService.createNode('Test', 50, 75);
      const cmd = new MoveNodeCommand(graphService, node.id, 200, 300);

      cmd.execute();
      expect(graphService.nodes().find(n => n.id === node.id)?.x).toBe(200);

      cmd.undo();
      expect(graphService.nodes().find(n => n.id === node.id)?.x).toBe(50);
      expect(graphService.nodes().find(n => n.id === node.id)?.y).toBe(75);
    });

    it('accepts explicit original position', () => {
      const node = graphService.createNode('Test', 0, 0);
      graphService.updateNodePosition(node.id, 100, 100);

      const cmd = new MoveNodeCommand(graphService, node.id, 200, 200, 0, 0);
      cmd.execute();
      expect(graphService.nodes().find(n => n.id === node.id)?.x).toBe(200);

      cmd.undo();
      expect(graphService.nodes().find(n => n.id === node.id)?.x).toBe(0);
    });
  });

  describe('RenameNodeCommand', () => {
    it('execute renames a Group Label', () => {
      const group = graphService.createGroup('Old Label', 0, 0);
      const cmd = new RenameNodeCommand(graphService, group.id, 'New Label');

      cmd.execute();
      expect(graphService.nodes().find(n => n.id === group.id)?.label).toBe('New Label');
    });

    it('undo restores original Group Label', () => {
      const group = graphService.createGroup('Original', 0, 0);
      const cmd = new RenameNodeCommand(graphService, group.id, 'Modified');

      cmd.execute();
      expect(graphService.nodes().find(n => n.id === group.id)?.label).toBe('Modified');

      cmd.undo();
      expect(graphService.nodes().find(n => n.id === group.id)?.label).toBe('Original');
    });
  });

  describe('SetNodeTextCommand', () => {
    const richText: Text = [
      { kind: 'paragraph', runs: [{ text: 'Title', size: 'L' }] },
      { kind: 'bullets', items: [[{ text: 'a', bold: true }], [{ text: 'b' }]] },
    ];

    it('execute replaces the node Text', () => {
      const node = graphService.createNode('Old', 0, 0);
      const cmd = new SetNodeTextCommand(graphService, node.id, richText);

      cmd.execute();
      expect(graphService.nodes().find(n => n.id === node.id)?.text).toEqual(richText);
    });

    it('undo restores the exact previous Text including formatting', () => {
      const node = graphService.createNode('N', 0, 0);
      const original: Text = [{ kind: 'paragraph', runs: [{ text: 'keep', highlight: true }] }];
      graphService.setNodeText(node.id, original);

      const cmd = new SetNodeTextCommand(graphService, node.id, richText);
      cmd.execute();
      cmd.undo();

      expect(graphService.nodes().find(n => n.id === node.id)?.text).toEqual(original);
    });

    it('redo (execute after undo) re-applies the new Text', () => {
      const node = graphService.createNode('N', 0, 0);
      const cmd = new SetNodeTextCommand(graphService, node.id, richText);

      cmd.execute();
      cmd.undo();
      cmd.execute();

      expect(graphService.nodes().find(n => n.id === node.id)?.text).toEqual(richText);
    });
  });

  describe('DeleteNodeCommand', () => {
    it('execute deletes node and connections', () => {
      const node1 = graphService.createNode('Node 1', 0, 0);
      const node2 = graphService.createNode('Node 2', 100, 0);
      graphService.createConnection(node1.id, 'right', node2.id, 'left');

      expect(graphService.nodes().length).toBe(2);
      expect(graphService.connections().length).toBe(1);

      const cmd = new DeleteNodeCommand(graphService, node1.id);
      cmd.execute();

      expect(graphService.nodes().length).toBe(1);
      expect(graphService.connections().length).toBe(0);
    });

    it('undo restores node and connections', () => {
      const node1 = graphService.createNode('Node 1', 0, 0);
      const node2 = graphService.createNode('Node 2', 100, 0);
      graphService.createConnection(node1.id, 'right', node2.id, 'left');

      const cmd = new DeleteNodeCommand(graphService, node1.id);
      cmd.execute();

      expect(graphService.nodes().length).toBe(1);
      expect(graphService.connections().length).toBe(0);

      cmd.undo();
      expect(graphService.nodes().length).toBe(2);
      expect(graphService.connections().length).toBe(1);

      const restored = graphService.nodes().find(n => n.id === node1.id);
      expect(restored?.text).toEqual(textFromString('Node 1'));
      expect(restored?.x).toBe(0);
      expect(restored?.y).toBe(0);
    });
  });

  describe('CreateConnectionCommand', () => {
    it('execute creates connection', () => {
      const node1 = graphService.createNode('Node 1', 0, 0);
      const node2 = graphService.createNode('Node 2', 100, 0);

      const cmd = new CreateConnectionCommand(graphService, node1.id, 'right', node2.id, 'left');
      cmd.execute();

      expect(graphService.connections().length).toBe(1);
      const conn = graphService.connections()[0];
      expect(conn.sourceNodeId).toBe(node1.id);
      expect(conn.targetNodeId).toBe(node2.id);
    });

    it('undo removes connection', () => {
      const node1 = graphService.createNode('Node 1', 0, 0);
      const node2 = graphService.createNode('Node 2', 100, 0);

      const cmd = new CreateConnectionCommand(graphService, node1.id, 'right', node2.id, 'left');
      cmd.execute();
      expect(graphService.connections().length).toBe(1);

      cmd.undo();
      expect(graphService.connections().length).toBe(0);
    });

    it('getConnection returns the created connection', () => {
      const node1 = graphService.createNode('Node 1', 0, 0);
      const node2 = graphService.createNode('Node 2', 100, 0);

      const cmd = new CreateConnectionCommand(graphService, node1.id, 'right', node2.id, 'left');
      expect(cmd.getConnection()).toBeNull();

      cmd.execute();
      const conn = cmd.getConnection();
      expect(conn).not.toBeNull();
      expect(conn!.sourceNodeId).toBe(node1.id);
    });
  });

  describe('DeleteConnectionCommand', () => {
    it('execute removes connection', () => {
      const node1 = graphService.createNode('Node 1', 0, 0);
      const node2 = graphService.createNode('Node 2', 100, 0);
      const conn = graphService.createConnection(node1.id, 'right', node2.id, 'left');

      expect(graphService.connections().length).toBe(1);

      const cmd = new DeleteConnectionCommand(graphService, conn!.id);
      cmd.execute();

      expect(graphService.connections().length).toBe(0);
    });

    it('undo restores connection', () => {
      const node1 = graphService.createNode('Node 1', 0, 0);
      const node2 = graphService.createNode('Node 2', 100, 0);
      const conn = graphService.createConnection(node1.id, 'right', node2.id, 'left');

      const cmd = new DeleteConnectionCommand(graphService, conn!.id);
      cmd.execute();
      expect(graphService.connections().length).toBe(0);

      cmd.undo();
      expect(graphService.connections().length).toBe(1);

      const restored = graphService.connections()[0];
      expect(restored.id).toBe(conn!.id);
      expect(restored.sourceNodeId).toBe(node1.id);
      expect(restored.targetNodeId).toBe(node2.id);
    });

    it('undo preserves the Connection Text', () => {
      const node1 = graphService.createNode('Node 1', 0, 0);
      const node2 = graphService.createNode('Node 2', 100, 0);
      const conn = graphService.createConnection(node1.id, 'right', node2.id, 'left');
      graphService.setConnectionText(conn!.id, textFromString('depends on'));

      const cmd = new DeleteConnectionCommand(graphService, conn!.id);
      cmd.execute();
      cmd.undo();

      expect(graphService.connections()[0].text).toEqual(textFromString('depends on'));
    });
  });

  describe('SetConnectionTextCommand', () => {
    const richText: Text = [{ kind: 'paragraph', runs: [{ text: 'new', italic: true }] }];

    it('execute sets the Text', () => {
      const node1 = graphService.createNode('Node 1', 0, 0);
      const node2 = graphService.createNode('Node 2', 100, 0);
      const conn = graphService.createConnection(node1.id, 'right', node2.id, 'left');

      const cmd = new SetConnectionTextCommand(graphService, conn!.id, richText);
      cmd.execute();

      expect(graphService.connections()[0].text).toEqual(richText);
    });

    it('undo restores the exact previous Text', () => {
      const node1 = graphService.createNode('Node 1', 0, 0);
      const node2 = graphService.createNode('Node 2', 100, 0);
      const conn = graphService.createConnection(node1.id, 'right', node2.id, 'left');
      const original: Text = [{ kind: 'paragraph', runs: [{ text: 'old', bold: true }] }];
      graphService.setConnectionText(conn!.id, original);

      const cmd = new SetConnectionTextCommand(graphService, conn!.id, richText);
      cmd.execute();
      expect(graphService.connections()[0].text).toEqual(richText);

      cmd.undo();
      expect(graphService.connections()[0].text).toEqual(original);
    });

    it('undo restores "no Text" when the Connection had none', () => {
      const node1 = graphService.createNode('Node 1', 0, 0);
      const node2 = graphService.createNode('Node 2', 100, 0);
      const conn = graphService.createConnection(node1.id, 'right', node2.id, 'left');

      const cmd = new SetConnectionTextCommand(graphService, conn!.id, richText);
      cmd.execute();
      cmd.undo();

      expect('text' in graphService.connections()[0]).toBe(false);
    });

    it('redo (execute after undo) re-applies the Text', () => {
      const node1 = graphService.createNode('Node 1', 0, 0);
      const node2 = graphService.createNode('Node 2', 100, 0);
      const conn = graphService.createConnection(node1.id, 'right', node2.id, 'left');
      graphService.setConnectionText(conn!.id, textFromString('old'));

      const cmd = new SetConnectionTextCommand(graphService, conn!.id, richText);
      cmd.execute();
      cmd.undo();
      cmd.execute();

      expect(graphService.connections()[0].text).toEqual(richText);
    });

    it('execute with null removes the Text; undo restores it', () => {
      const node1 = graphService.createNode('Node 1', 0, 0);
      const node2 = graphService.createNode('Node 2', 100, 0);
      const conn = graphService.createConnection(node1.id, 'right', node2.id, 'left');
      graphService.setConnectionText(conn!.id, textFromString('depends on'));

      const cmd = new SetConnectionTextCommand(graphService, conn!.id, null);
      cmd.execute();
      expect('text' in graphService.connections()[0]).toBe(false);

      cmd.undo();
      expect(graphService.connections()[0].text).toEqual(textFromString('depends on'));
    });
  });

  describe('Integration', () => {
    it('Create node → Move node → Undo move → Undo create → verify empty graph', () => {
      // Create node
      const createCmd = new CreateNodeCommand(graphService, 'Test', 0, 0);
      createCmd.execute();
      expect(graphService.nodes().length).toBe(1);
      const nodeId = graphService.nodes()[0].id;

      // Move node
      const moveCmd = new MoveNodeCommand(graphService, nodeId, 100, 100);
      moveCmd.execute();
      expect(graphService.nodes().find(n => n.id === nodeId)?.x).toBe(100);

      // Undo move
      moveCmd.undo();
      expect(graphService.nodes().find(n => n.id === nodeId)?.x).toBe(0);

      // Undo create
      createCmd.undo();
      expect(graphService.nodes().length).toBe(0);
      expect(graphService.connections().length).toBe(0);
    });

    it('Complex workflow: create multiple nodes and connections, delete, undo all', () => {
      // Create nodes
      const create1 = new CreateNodeCommand(graphService, 'Node 1', 0, 0);
      const create2 = new CreateNodeCommand(graphService, 'Node 2', 100, 0);
      create1.execute();
      create2.execute();

      const node1Id = graphService.nodes()[0].id;
      const node2Id = graphService.nodes()[1].id;

      // Create connection
      const createConn = new CreateConnectionCommand(graphService, node1Id, 'right', node2Id, 'left');
      createConn.execute();
      expect(graphService.connections().length).toBe(1);

      // Delete node 1 (should remove connection too)
      const deleteNode = new DeleteNodeCommand(graphService, node1Id);
      deleteNode.execute();
      expect(graphService.nodes().length).toBe(1);
      expect(graphService.connections().length).toBe(0);

      // Undo delete
      deleteNode.undo();
      expect(graphService.nodes().length).toBe(2);
      expect(graphService.connections().length).toBe(1);

      // Undo connection
      createConn.undo();
      expect(graphService.connections().length).toBe(0);

      // Undo creates
      create2.undo();
      create1.undo();
      expect(graphService.nodes().length).toBe(0);
    });
  });

  describe('CreateGroupCommand', () => {
    it('execute creates a Group, undo removes it', () => {
      const cmd = new CreateGroupCommand(graphService, 'New Group', 100, 100);

      cmd.execute();
      expect(graphService.nodes().length).toBe(1);
      expect(graphService.nodes()[0].kind).toBe('group');

      cmd.undo();
      expect(graphService.nodes().length).toBe(0);
    });
  });

  describe('CreateNodeCommand with parent', () => {
    it('creates the node already parented to the Group', () => {
      const group = graphService.createGroup('G', 0, 0);
      const cmd = new CreateNodeCommand(graphService, 'Child', 50, 50, group.id);

      cmd.execute();
      const child = graphService.nodes().find(n => n.parentId === group.id);
      expect(child).toBeDefined();
      expect(child?.text).toEqual(textFromString('Child'));
      expect(child?.parentId).toBe(group.id);

      cmd.undo();
      expect(graphService.nodes().length).toBe(1);
    });
  });

  describe('ChangeParentCommand', () => {
    it('execute joins the Group, undo restores no parent', () => {
      const group = graphService.createGroup('G', 0, 0);
      const node = graphService.createNode('N', 50, 50);
      const cmd = new ChangeParentCommand(graphService, node.id, group.id);

      cmd.execute();
      expect(graphService.nodes().find(n => n.id === node.id)?.parentId).toBe(group.id);

      cmd.undo();
      expect(graphService.nodes().find(n => n.id === node.id)?.parentId).toBeUndefined();
    });

    it('undo restores the previous Group', () => {
      const g1 = graphService.createGroup('G1', 0, 0);
      const g2 = graphService.createGroup('G2', 800, 0);
      const node = graphService.createNode('N', 50, 50);
      graphService.setNodeParent(node.id, g1.id);

      const cmd = new ChangeParentCommand(graphService, node.id, g2.id);
      cmd.execute();
      expect(graphService.nodes().find(n => n.id === node.id)?.parentId).toBe(g2.id);

      cmd.undo();
      expect(graphService.nodes().find(n => n.id === node.id)?.parentId).toBe(g1.id);
    });
  });

  describe('MoveGroupCommand', () => {
    it('execute moves Group and children rigidly, undo restores both', () => {
      const group = graphService.createGroup('G', 100, 100);
      const child = graphService.createNode('C', 150, 150);
      graphService.setNodeParent(child.id, group.id);

      const cmd = new MoveGroupCommand(graphService, group.id, 300, 250, 100, 100);
      cmd.execute();
      expect(graphService.nodes().find(n => n.id === child.id)).toMatchObject({ x: 350, y: 300 });

      cmd.undo();
      expect(graphService.nodes().find(n => n.id === group.id)).toMatchObject({ x: 100, y: 100 });
      expect(graphService.nodes().find(n => n.id === child.id)).toMatchObject({ x: 150, y: 150 });
    });
  });

  describe('ResizeNodeCommand', () => {
    it('execute applies the new rect, undo restores the original', () => {
      const node = graphService.createNode('N', 10, 20);
      const cmd = new ResizeNodeCommand(
        graphService, node.id,
        { x: 10, y: 20, width: 300, height: 90 },
        { x: 10, y: 20, width: 160, height: 48 },
      );

      cmd.execute();
      expect(graphService.nodes()[0]).toMatchObject({ width: 300, height: 90 });

      cmd.undo();
      expect(graphService.nodes()[0]).toMatchObject({ x: 10, y: 20, width: 160, height: 48 });
    });
  });

  describe('SetNodeColorCommand', () => {
    it('execute applies the color, undo restores the previous one', () => {
      const node = graphService.createNode('N', 0, 0);
      graphService.setNodeColor(node.id, NODE_PALETTE[1]);

      const cmd = new SetNodeColorCommand(graphService, node.id, NODE_PALETTE[3]);
      cmd.execute();
      expect(graphService.nodes()[0].color).toBe(NODE_PALETTE[3]);

      cmd.undo();
      expect(graphService.nodes()[0].color).toBe(NODE_PALETTE[1]);
    });

    it('undo removes the color when there was none', () => {
      const node = graphService.createNode('N', 0, 0);

      const cmd = new SetNodeColorCommand(graphService, node.id, NODE_PALETTE[0]);
      cmd.execute();
      cmd.undo();

      expect(graphService.nodes()[0].color).toBeUndefined();
    });
  });

  describe('CompoundCommand', () => {
    it('sever-on-entry: one undo restores position, membership, and Connections with original ids', () => {
      const group = graphService.createGroup('G', 0, 0, 400, 300);
      const node = graphService.createNode('N', 900, 900);
      const conn = graphService.createConnection(node.id, 'left', group.id, 'right')!;

      // Drop the connected node into the Group: move + sever + join as one step.
      // The move already happened transiently; the other parts are executed
      // before the compound is pushed without re-execution (canvas drop flow).
      graphService.updateNodePosition(node.id, 100, 100);
      const severPart = new DeleteConnectionCommand(graphService, conn.id);
      const parentPart = new ChangeParentCommand(graphService, node.id, group.id);
      const compound = new CompoundCommand('Move Node', [
        new MoveNodeCommand(graphService, node.id, 100, 100, 900, 900),
        severPart,
        parentPart,
      ]);
      severPart.execute();
      parentPart.execute();
      // State now matches the compound's outcome; undo must reverse all of it
      compound.undo();

      const restored = graphService.nodes().find(n => n.id === node.id);
      expect(restored).toMatchObject({ x: 900, y: 900 });
      expect(restored?.parentId).toBeUndefined();
      expect(graphService.connections().map(c => c.id)).toEqual([conn.id]);
    });

    it('redo after undo re-applies every part', () => {
      const group = graphService.createGroup('G', 0, 0, 400, 300);
      const node = graphService.createNode('N', 900, 900);
      const conn = graphService.createConnection(node.id, 'left', group.id, 'right')!;

      const compound = new CompoundCommand('Move Node', [
        new MoveNodeCommand(graphService, node.id, 100, 100),
        new DeleteConnectionCommand(graphService, conn.id),
        new ChangeParentCommand(graphService, node.id, group.id),
      ]);
      compound.execute();
      compound.undo();
      compound.execute();

      const moved = graphService.nodes().find(n => n.id === node.id);
      expect(moved).toMatchObject({ x: 100, y: 100 });
      expect(moved?.parentId).toBe(group.id);
      expect(graphService.connections().length).toBe(0);
    });
  });

  describe('DeleteNodeCommand with Groups', () => {
    it('undo of a Group deletion restores membership of released children', () => {
      const group = graphService.createGroup('G', 0, 0);
      const child = graphService.createNode('C', 50, 50);
      graphService.setNodeParent(child.id, group.id);

      const cmd = new DeleteNodeCommand(graphService, group.id);
      cmd.execute();
      expect(graphService.nodes().find(n => n.id === child.id)?.parentId).toBeUndefined();

      cmd.undo();
      expect(graphService.nodes().find(n => n.id === group.id)).toBeDefined();
      expect(graphService.nodes().find(n => n.id === child.id)?.parentId).toBe(group.id);
    });
  });

  // Serves Paste, Duplicate, and Alt+drag: inserts a prepared set of elements
  // (ids already generated) and undo removes exactly that set.
  describe('InsertElementsCommand', () => {
    it('execute inserts the prepared nodes and connections and selects the primary node', () => {
      const existing = graphService.createNode('Existing', 0, 0);
      const nodes = [
        { id: 'node_x_101', text: textFromString('A'), x: 10, y: 20, width: 160, height: 48 },
        { id: 'node_x_102', text: textFromString('B'), x: 300, y: 20, width: 160, height: 48 },
      ];
      const connections = [{
        id: 'conn_x_103',
        sourceNodeId: 'node_x_101', sourceHandle: 'right' as const,
        targetNodeId: 'node_x_102', targetHandle: 'left' as const,
      }];

      const cmd = new InsertElementsCommand(graphService, 'Paste', nodes, connections, 'node_x_101');
      cmd.execute();

      expect(graphService.nodes().map(n => n.id)).toEqual([existing.id, 'node_x_101', 'node_x_102']);
      expect(graphService.connections().map(c => c.id)).toEqual(['conn_x_103']);
      expect(graphService.selectedNodeId()).toBe('node_x_101');
    });

    it('undo removes exactly the inserted set and clears its selection', () => {
      const existing = graphService.createNode('Existing', 0, 0);
      const nodes = [{ id: 'node_x_201', text: textFromString('A'), x: 0, y: 0, width: 160, height: 48 }];

      const cmd = new InsertElementsCommand(graphService, 'Paste', nodes, [], 'node_x_201');
      cmd.execute();
      cmd.undo();

      expect(graphService.nodes().map(n => n.id)).toEqual([existing.id]);
      expect(graphService.selectedNodeId()).toBeNull();
    });

    it('redo re-inserts the identical elements with the same ids', () => {
      const nodes = [{ id: 'node_x_301', text: textFromString('A'), x: 5, y: 6, width: 160, height: 48 }];
      const cmd = new InsertElementsCommand(graphService, 'Duplicate', nodes, [], 'node_x_301');

      cmd.execute();
      cmd.undo();
      cmd.execute();

      expect(graphService.nodes().map(n => n.id)).toEqual(['node_x_301']);
      expect(graphService.nodes()[0]).toMatchObject({ x: 5, y: 6 });
    });

    it('undo works without a prior execute (push-without-execute pattern for Alt+drag)', () => {
      // The elements were created transiently during the drag, outside the command
      const spawned = graphService.createNode('Copy', 40, 40);
      const cmd = new InsertElementsCommand(
        graphService, 'Duplicate',
        [graphService.nodes().find(n => n.id === spawned.id)!], [], spawned.id,
      );

      cmd.undo();

      expect(graphService.nodes().length).toBe(0);
    });

    it('leaves unrelated selection untouched on undo', () => {
      const other = graphService.createNode('Other', 0, 0);
      const cmd = new InsertElementsCommand(
        graphService, 'Paste',
        [{ id: 'node_x_401', text: textFromString('A'), x: 0, y: 0, width: 160, height: 48 }],
        [], 'node_x_401',
      );
      cmd.execute();
      graphService.selectNode(other.id);

      cmd.undo();

      expect(graphService.selectedNodeId()).toBe(other.id);
    });
  });
});
