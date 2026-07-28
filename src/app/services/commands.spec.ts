import { TestBed } from '@angular/core/testing';
import { GraphService } from './graph.service';
import {
  CreateNodeCommand,
  MoveNodeCommand,
  RenameNodeCommand,
  DeleteNodeCommand,
  CreateConnectionCommand,
  DeleteConnectionCommand,
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
      expect(node.label).toBe('Test Node');
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
      expect(node!.label).toBe('Test');
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
    it('execute renames node', () => {
      const node = graphService.createNode('Old Label', 0, 0);
      const cmd = new RenameNodeCommand(graphService, node.id, 'New Label');

      cmd.execute();
      expect(graphService.nodes().find(n => n.id === node.id)?.label).toBe('New Label');
    });

    it('undo restores original label', () => {
      const node = graphService.createNode('Original', 0, 0);
      const cmd = new RenameNodeCommand(graphService, node.id, 'Modified');

      cmd.execute();
      expect(graphService.nodes().find(n => n.id === node.id)?.label).toBe('Modified');

      cmd.undo();
      expect(graphService.nodes().find(n => n.id === node.id)?.label).toBe('Original');
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
      expect(restored?.label).toBe('Node 1');
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
});
