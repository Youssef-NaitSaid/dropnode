import { TestBed } from '@angular/core/testing';
import { GraphService } from './graph.service';
import { GraphNode, HandleSide, NODE_PALETTE } from '../models/node';
import { Connection } from '../models/connection';
import { GraphState } from '../models/graph-state';

describe('GraphService', () => {
  let service: GraphService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GraphService);
  });

  describe('createNode', () => {
    it('creates a node with unique ID, correct label, position, and default dimensions', () => {
      const node = service.createNode('Test Node', 100, 200);

      expect(node.id).toMatch(/^node_\d+_\d+$/);
      expect(node.label).toBe('Test Node');
      expect(node.x).toBe(100);
      expect(node.y).toBe(200);
      expect(node.width).toBe(160);
      expect(node.height).toBe(48);
      expect(service.nodes().length).toBe(1);
      expect(service.nodes()[0].id).toBe(node.id);
    });

    it('creates multiple nodes with unique IDs', () => {
      const node1 = service.createNode('Node 1', 0, 0);
      const node2 = service.createNode('Node 2', 100, 100);

      expect(node1.id).not.toBe(node2.id);
      expect(service.nodes().length).toBe(2);
    });

    it('creates a node with custom dimensions', () => {
      const node = service.createNode('Custom', 50, 75, 200, 100);

      expect(node.width).toBe(200);
      expect(node.height).toBe(100);
    });
  });

  describe('updateNodePosition', () => {
    it('updates x/y coordinates of existing node', () => {
      const node = service.createNode('Test', 100, 200);
      service.updateNodePosition(node.id, 300, 400);

      const updated = service.nodes().find(n => n.id === node.id);
      expect(updated?.x).toBe(300);
      expect(updated?.y).toBe(400);
    });

    it('does not affect other nodes', () => {
      const node1 = service.createNode('Node 1', 0, 0);
      const node2 = service.createNode('Node 2', 100, 100);

      service.updateNodePosition(node1.id, 50, 50);

      const updated2 = service.nodes().find(n => n.id === node2.id);
      expect(updated2?.x).toBe(100);
      expect(updated2?.y).toBe(100);
    });
  });

  describe('updateNodeLabel', () => {
    it('updates label text', () => {
      const node = service.createNode('Old Label', 0, 0);
      service.updateNodeLabel(node.id, 'New Label');

      const updated = service.nodes().find(n => n.id === node.id);
      expect(updated?.label).toBe('New Label');
    });
  });

  describe('updateNodeSize', () => {
    it('updates width/height', () => {
      const node = service.createNode('Test', 0, 0);
      service.updateNodeSize(node.id, 250, 120);

      const updated = service.nodes().find(n => n.id === node.id);
      expect(updated?.width).toBe(250);
      expect(updated?.height).toBe(120);
    });
  });

  describe('deleteNode', () => {
    it('removes node from array', () => {
      const node = service.createNode('Test', 0, 0);
      expect(service.nodes().length).toBe(1);

      service.deleteNode(node.id);
      expect(service.nodes().length).toBe(0);
    });

    it('removes all connections referencing the deleted node', () => {
      const node1 = service.createNode('Node 1', 0, 0);
      const node2 = service.createNode('Node 2', 100, 0);
      const node3 = service.createNode('Node 3', 200, 0);

      service.createConnection(node1.id, 'right', node2.id, 'left');
      service.createConnection(node2.id, 'right', node3.id, 'left');
      expect(service.connections().length).toBe(2);

      service.deleteNode(node2.id);
      expect(service.connections().length).toBe(0);
      expect(service.nodes().length).toBe(2);
    });

    it('clears selection if deleted node was selected', () => {
      const node = service.createNode('Test', 0, 0);
      service.selectNode(node.id);
      expect(service.selectedNodeId()).toBe(node.id);

      service.deleteNode(node.id);
      expect(service.selectedNodeId()).toBeNull();
    });

    it('does not clear selection if different node was selected', () => {
      const node1 = service.createNode('Node 1', 0, 0);
      const node2 = service.createNode('Node 2', 100, 0);
      service.selectNode(node1.id);

      service.deleteNode(node2.id);
      expect(service.selectedNodeId()).toBe(node1.id);
    });

    it('throws error if node not found', () => {
      expect(() => service.deleteNode('nonexistent')).toThrowError('Node nonexistent not found');
    });

    it('returns the deleted node and removed connections', () => {
      const node1 = service.createNode('Node 1', 0, 0);
      const node2 = service.createNode('Node 2', 100, 0);
      const conn = service.createConnection(node1.id, 'right', node2.id, 'left');

      const result = service.deleteNode(node1.id);
      expect(result.node.id).toBe(node1.id);
      expect(result.removedConnections.length).toBe(1);
      expect(result.removedConnections[0].id).toBe(conn!.id);
    });
  });

  describe('createConnection', () => {
    it('creates connection between two different nodes', () => {
      const node1 = service.createNode('Node 1', 0, 0);
      const node2 = service.createNode('Node 2', 100, 0);

      const conn = service.createConnection(node1.id, 'right', node2.id, 'left');

      expect(conn).not.toBeNull();
      expect(conn!.id).toMatch(/^conn_\d+_\d+$/);
      expect(conn!.sourceNodeId).toBe(node1.id);
      expect(conn!.sourceHandle).toBe('right');
      expect(conn!.targetNodeId).toBe(node2.id);
      expect(conn!.targetHandle).toBe('left');
      expect(service.connections().length).toBe(1);
    });

    it('prevents self-connections', () => {
      const node = service.createNode('Test', 0, 0);
      const conn = service.createConnection(node.id, 'right', node.id, 'left');

      expect(conn).toBeNull();
      expect(service.connections().length).toBe(0);
    });

    it('prevents duplicate connections', () => {
      const node1 = service.createNode('Node 1', 0, 0);
      const node2 = service.createNode('Node 2', 100, 0);

      service.createConnection(node1.id, 'right', node2.id, 'left');
      const duplicate = service.createConnection(node1.id, 'right', node2.id, 'left');

      expect(duplicate).toBeNull();
      expect(service.connections().length).toBe(1);
    });

    it('allows connections with different handle sides', () => {
      const node1 = service.createNode('Node 1', 0, 0);
      const node2 = service.createNode('Node 2', 100, 0);

      const conn1 = service.createConnection(node1.id, 'right', node2.id, 'left');
      const conn2 = service.createConnection(node1.id, 'bottom', node2.id, 'top');

      expect(conn1).not.toBeNull();
      expect(conn2).not.toBeNull();
      expect(service.connections().length).toBe(2);
    });
  });

  describe('deleteConnection', () => {
    it('removes connection by ID', () => {
      const node1 = service.createNode('Node 1', 0, 0);
      const node2 = service.createNode('Node 2', 100, 0);
      const conn = service.createConnection(node1.id, 'right', node2.id, 'left');

      expect(service.connections().length).toBe(1);
      const deleted = service.deleteConnection(conn!.id);

      expect(deleted?.id).toBe(conn!.id);
      expect(service.connections().length).toBe(0);
    });

    it('returns undefined if connection not found', () => {
      const deleted = service.deleteConnection('nonexistent');
      expect(deleted).toBeUndefined();
    });
  });

  describe('setConnectionLabel', () => {
    it('sets a trimmed label on the connection', () => {
      const node1 = service.createNode('Node 1', 0, 0);
      const node2 = service.createNode('Node 2', 300, 0);
      const conn = service.createConnection(node1.id, 'right', node2.id, 'left');

      service.setConnectionLabel(conn!.id, '  depends on  ');

      expect(service.connections()[0].label).toBe('depends on');
    });

    it('clears the label field when committing empty or whitespace', () => {
      const node1 = service.createNode('Node 1', 0, 0);
      const node2 = service.createNode('Node 2', 300, 0);
      const conn = service.createConnection(node1.id, 'right', node2.id, 'left');
      service.setConnectionLabel(conn!.id, 'depends on');

      service.setConnectionLabel(conn!.id, '   ');

      expect('label' in service.connections()[0]).toBe(false);
    });

    it('is a silent no-op for an unknown connection id', () => {
      const node1 = service.createNode('Node 1', 0, 0);
      const node2 = service.createNode('Node 2', 300, 0);
      service.createConnection(node1.id, 'right', node2.id, 'left');

      expect(() => service.setConnectionLabel('nonexistent', 'x')).not.toThrow();
      expect(service.connections()[0].label).toBeUndefined();
    });

    it('createConnection never sets a label', () => {
      const node1 = service.createNode('Node 1', 0, 0);
      const node2 = service.createNode('Node 2', 300, 0);
      const conn = service.createConnection(node1.id, 'right', node2.id, 'left');

      expect('label' in conn!).toBe(false);
    });
  });

  describe('selectNode / clearSelection', () => {
    it('sets selectedNodeId', () => {
      const node = service.createNode('Test', 0, 0);
      service.selectNode(node.id);

      expect(service.selectedNodeId()).toBe(node.id);
    });

    it('clears selection when null is passed', () => {
      const node = service.createNode('Test', 0, 0);
      service.selectNode(node.id);
      service.selectNode(null);

      expect(service.selectedNodeId()).toBeNull();
    });

    it('selectedNode computed signal returns the selected node', () => {
      const node = service.createNode('Test', 0, 0);
      service.selectNode(node.id);

      expect(service.selectedNode()?.id).toBe(node.id);
    });

    it('selectedNode computed signal returns null when no selection', () => {
      expect(service.selectedNode()).toBeNull();
    });
  });

  describe('exclusive selection across Nodes and Connections', () => {
    function makeConnection() {
      const node1 = service.createNode('Node 1', 0, 0);
      const node2 = service.createNode('Node 2', 300, 0);
      const conn = service.createConnection(node1.id, 'right', node2.id, 'left');
      return { node1, node2, conn: conn! };
    }

    it('selectConnection sets selectedConnectionId', () => {
      const { conn } = makeConnection();
      service.selectConnection(conn.id);

      expect(service.selectedConnectionId()).toBe(conn.id);
    });

    it('selecting a Connection deselects the selected Node', () => {
      const { node1, conn } = makeConnection();
      service.selectNode(node1.id);

      service.selectConnection(conn.id);

      expect(service.selectedNodeId()).toBeNull();
      expect(service.selectedConnectionId()).toBe(conn.id);
    });

    it('selecting a Node deselects the selected Connection', () => {
      const { node1, conn } = makeConnection();
      service.selectConnection(conn.id);

      service.selectNode(node1.id);

      expect(service.selectedConnectionId()).toBeNull();
      expect(service.selectedNodeId()).toBe(node1.id);
    });

    it('selectNode(null) clears the Connection selection too', () => {
      const { conn } = makeConnection();
      service.selectConnection(conn.id);

      service.selectNode(null);

      expect(service.selectedConnectionId()).toBeNull();
      expect(service.selectedNodeId()).toBeNull();
    });

    it('deleting the selected Connection clears its selection', () => {
      const { conn } = makeConnection();
      service.selectConnection(conn.id);

      service.deleteConnection(conn.id);

      expect(service.selectedConnectionId()).toBeNull();
    });

    it('deleting a different Connection keeps the selection', () => {
      const { node1, node2, conn } = makeConnection();
      const other = service.createConnection(node1.id, 'top', node2.id, 'top');
      service.selectConnection(conn.id);

      service.deleteConnection(other!.id);

      expect(service.selectedConnectionId()).toBe(conn.id);
    });

    it('importGraph clears the Connection selection', () => {
      const { conn } = makeConnection();
      service.selectConnection(conn.id);

      service.importGraph({ nodes: [], connections: [] });

      expect(service.selectedConnectionId()).toBeNull();
    });

    it('clearGraph clears the Connection selection', () => {
      const { conn } = makeConnection();
      service.selectConnection(conn.id);

      service.clearGraph();

      expect(service.selectedConnectionId()).toBeNull();
    });
  });

  describe('viewport operations', () => {
    it('setViewport updates viewport state', () => {
      service.setViewport({ panX: 100, panY: 200, zoom: 2 });

      const vp = service.viewportState();
      expect(vp.panX).toBe(100);
      expect(vp.panY).toBe(200);
      expect(vp.zoom).toBe(2);
    });

    it('setViewport with partial state merges with current', () => {
      service.setViewport({ panX: 50 });
      expect(service.viewportState().panX).toBe(50);
      expect(service.viewportState().panY).toBe(0);
      expect(service.viewportState().zoom).toBe(1);
    });

    it('resetViewport resets to default', () => {
      service.setViewport({ panX: 100, panY: 200, zoom: 2 });
      service.resetViewport();

      const vp = service.viewportState();
      expect(vp.panX).toBe(0);
      expect(vp.panY).toBe(0);
      expect(vp.zoom).toBe(1);
    });

    it('zoomBy adjusts zoom level', () => {
      service.zoomBy(0.5, 0, 0);
      expect(service.viewportState().zoom).toBe(1.5);
    });

    it('zoomBy clamps to minimum 0.1', () => {
      service.zoomBy(-2, 0, 0);
      expect(service.viewportState().zoom).toBe(0.1);
    });

    it('zoomBy clamps to maximum 5', () => {
      service.zoomBy(10, 0, 0);
      expect(service.viewportState().zoom).toBe(5);
    });

    it('zoomBy centers on given point', () => {
      service.setViewport({ panX: 0, panY: 0, zoom: 1 });
      service.zoomBy(1, 100, 100); // zoom from 1 to 2, centered at (100, 100)

      const vp = service.viewportState();
      expect(vp.zoom).toBe(2);
      // At zoom 2, point (100, 100) should still be at screen position (100, 100)
      // newPanX = centerX - (centerX - oldPanX) * zoomRatio
      // newPanX = 100 - (100 - 0) * 2 = 100 - 200 = -100
      expect(vp.panX).toBe(-100);
      expect(vp.panY).toBe(-100);
    });
  });

  describe('getHandlePosition', () => {
    it('returns correct position for top handle', () => {
      const node = service.createNode('Test', 100, 200, 160, 48);
      const pos = service.getHandlePosition(node.id, 'top');

      expect(pos).toEqual({ x: 180, y: 200 }); // x = 100 + 160/2 = 180, y = 200
    });

    it('returns correct position for right handle', () => {
      const node = service.createNode('Test', 100, 200, 160, 48);
      const pos = service.getHandlePosition(node.id, 'right');

      expect(pos).toEqual({ x: 260, y: 224 }); // x = 100 + 160 = 260, y = 200 + 48/2 = 224
    });

    it('returns correct position for bottom handle', () => {
      const node = service.createNode('Test', 100, 200, 160, 48);
      const pos = service.getHandlePosition(node.id, 'bottom');

      expect(pos).toEqual({ x: 180, y: 248 }); // x = 100 + 160/2 = 180, y = 200 + 48 = 248
    });

    it('returns correct position for left handle', () => {
      const node = service.createNode('Test', 100, 200, 160, 48);
      const pos = service.getHandlePosition(node.id, 'left');

      expect(pos).toEqual({ x: 100, y: 224 }); // x = 100, y = 200 + 48/2 = 224
    });

    it('returns null for non-existent node', () => {
      const pos = service.getHandlePosition('nonexistent', 'top');
      expect(pos).toBeNull();
    });
  });

  describe('importGraph', () => {
    const validGraph: GraphState = {
      nodes: [
        { id: 'n1', label: 'Node 1', x: 0, y: 0, width: 160, height: 48 },
        { id: 'n2', label: 'Node 2', x: 200, y: 0, width: 160, height: 48 },
      ],
      connections: [
        { id: 'c1', sourceNodeId: 'n1', sourceHandle: 'right', targetNodeId: 'n2', targetHandle: 'left' },
      ],
    };

    it('valid graph state loads correctly', () => {
      const result = service.importGraph(validGraph);

      expect(result.success).toBe(true);
      expect(service.nodes().length).toBe(2);
      expect(service.connections().length).toBe(1);
      expect(service.selectedNodeId()).toBeNull();
    });

    it('missing nodes array rejected', () => {
      const result = service.importGraph({ connections: [] } as any);
      expect(result.success).toBe(false);
      expect(result.error).toContain('nodes must be an array');
    });

    it('missing connections array rejected', () => {
      const result = service.importGraph({ nodes: [] } as any);
      expect(result.success).toBe(false);
      expect(result.error).toContain('connections must be an array');
    });

    it('node with missing id rejected', () => {
      const result = service.importGraph({
        nodes: [{ label: 'Test', x: 0, y: 0, width: 160, height: 48 }],
        connections: [],
      } as any);
      expect(result.success).toBe(false);
      expect(result.error).toContain('missing or invalid id');
    });

    it('node with missing label rejected', () => {
      const result = service.importGraph({
        nodes: [{ id: 'n1', x: 0, y: 0, width: 160, height: 48 }],
        connections: [],
      } as any);
      expect(result.success).toBe(false);
      expect(result.error).toContain('label must be a string');
    });

    it('node with non-number x/y rejected', () => {
      const result = service.importGraph({
        nodes: [{ id: 'n1', label: 'Test', x: '0', y: 0, width: 160, height: 48 }],
        connections: [],
      } as any);
      expect(result.success).toBe(false);
      expect(result.error).toContain('x and y must be numbers');
    });

    it('duplicate node IDs rejected', () => {
      const result = service.importGraph({
        nodes: [
          { id: 'n1', label: 'Node 1', x: 0, y: 0, width: 160, height: 48 },
          { id: 'n1', label: 'Node 2', x: 100, y: 0, width: 160, height: 48 },
        ],
        connections: [],
      } as any);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Duplicate node id');
    });

    it('connection referencing non-existent node rejected', () => {
      const result = service.importGraph({
        nodes: [{ id: 'n1', label: 'Node 1', x: 0, y: 0, width: 160, height: 48 }],
        connections: [
          { id: 'c1', sourceNodeId: 'n1', sourceHandle: 'right', targetNodeId: 'n2', targetHandle: 'left' },
        ],
      } as any);
      expect(result.success).toBe(false);
      expect(result.error).toContain('non-existent node');
    });

    it('invalid handle side rejected', () => {
      const result = service.importGraph({
        nodes: [
          { id: 'n1', label: 'Node 1', x: 0, y: 0, width: 160, height: 48 },
          { id: 'n2', label: 'Node 2', x: 200, y: 0, width: 160, height: 48 },
        ],
        connections: [
          { id: 'c1', sourceNodeId: 'n1', sourceHandle: 'invalid' as any, targetNodeId: 'n2', targetHandle: 'left' },
        ],
      } as any);
      expect(result.success).toBe(false);
      expect(result.error).toContain('invalid sourceHandle');
    });

    it('non-string connection label rejected wholesale', () => {
      const result = service.importGraph({
        nodes: [
          { id: 'n1', label: 'Node 1', x: 0, y: 0, width: 160, height: 48 },
          { id: 'n2', label: 'Node 2', x: 200, y: 0, width: 160, height: 48 },
        ],
        connections: [
          { id: 'c1', sourceNodeId: 'n1', sourceHandle: 'right', targetNodeId: 'n2', targetHandle: 'left', label: 42 as any },
        ],
      } as any);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid connection c1: label must be a string');
    });

    it('string and empty-string connection labels import cleanly', () => {
      const result = service.importGraph({
        nodes: [
          { id: 'n1', label: 'Node 1', x: 0, y: 0, width: 160, height: 48 },
          { id: 'n2', label: 'Node 2', x: 200, y: 0, width: 160, height: 48 },
        ],
        connections: [
          { id: 'c1', sourceNodeId: 'n1', sourceHandle: 'right', targetNodeId: 'n2', targetHandle: 'left', label: 'depends on' },
          { id: 'c2', sourceNodeId: 'n2', sourceHandle: 'right', targetNodeId: 'n1', targetHandle: 'left', label: '' },
        ],
      });
      expect(result.success).toBe(true);
      expect(service.connections()[0].label).toBe('depends on');
      expect(service.connections()[1].label).toBe('');
    });

    it('empty graph (no nodes, no connections) is valid', () => {
      const result = service.importGraph({ nodes: [], connections: [] });
      expect(result.success).toBe(true);
      expect(service.nodes().length).toBe(0);
      expect(service.connections().length).toBe(0);
    });
  });

  describe('exportGraph', () => {
    it('produces correct JSON matching current state', () => {
      const node1 = service.createNode('Node 1', 0, 0);
      const node2 = service.createNode('Node 2', 100, 100);
      service.createConnection(node1.id, 'right', node2.id, 'left');

      const exported = service.exportGraph();

      expect(exported.nodes.length).toBe(2);
      expect(exported.connections.length).toBe(1);
      expect(exported.nodes[0].id).toBe(node1.id);
      expect(exported.nodes[1].id).toBe(node2.id);
      expect(exported.connections[0].sourceNodeId).toBe(node1.id);
      expect(exported.connections[0].targetNodeId).toBe(node2.id);
    });

    it('exported graph is a deep copy', () => {
      const node = service.createNode('Test', 0, 0);
      const exported = service.exportGraph();

      exported.nodes[0].label = 'Modified';
      expect(service.nodes()[0].label).toBe('Test');
    });

    it('Connection Labels survive an export/import round trip', () => {
      const node1 = service.createNode('Node 1', 0, 0);
      const node2 = service.createNode('Node 2', 300, 0);
      const conn = service.createConnection(node1.id, 'right', node2.id, 'left');
      service.setConnectionLabel(conn!.id, 'depends on');

      const exported = service.exportGraph();
      service.clearGraph();
      const result = service.importGraph(exported);

      expect(result.success).toBe(true);
      expect(service.connections()[0].label).toBe('depends on');
    });
  });

  describe('loadFromUrlParam', () => {
    it('loads graph from URL parameter', () => {
      const graphData = {
        nodes: [{ id: 'n1', label: 'Test', x: 0, y: 0, width: 160, height: 48 }],
        connections: [],
      };
      const encoded = encodeURIComponent(JSON.stringify(graphData));

      const searchSpy = vi.spyOn(URLSearchParams.prototype, 'get').mockImplementation(function(this: URLSearchParams, key: string) {
        if (key === 'data') return encoded;
        return null;
      });

      const result = service.loadFromUrlParam();

      expect(result.loaded).toBe(true);
      expect(service.nodes().length).toBe(1);
      expect(service.nodes()[0].id).toBe('n1');

      searchSpy.mockRestore();
    });

    it('returns loaded: false when no data parameter', () => {
      const searchSpy = vi.spyOn(URLSearchParams.prototype, 'get').mockReturnValue(null);

      const result = service.loadFromUrlParam();
      expect(result.loaded).toBe(false);

      searchSpy.mockRestore();
    });

    it('returns error for invalid JSON', () => {
      const searchSpy = vi.spyOn(URLSearchParams.prototype, 'get').mockReturnValue('invalid-json');

      const result = service.loadFromUrlParam();
      expect(result.loaded).toBe(false);
      expect(result.error).toContain('Failed to parse');

      searchSpy.mockRestore();
    });
  });

  describe('nodeCount', () => {
    it('computed signal updates when nodes change', () => {
      expect(service.nodeCount()).toBe(0);

      const node1 = service.createNode('Node 1', 0, 0);
      expect(service.nodeCount()).toBe(1);

      const node2 = service.createNode('Node 2', 100, 100);
      expect(service.nodeCount()).toBe(2);

      service.deleteNode(node1.id);
      expect(service.nodeCount()).toBe(1);

      service.deleteNode(node2.id);
      expect(service.nodeCount()).toBe(0);
    });
  });

  describe('clearGraph', () => {
    it('resets everything', () => {
      const node1 = service.createNode('Node 1', 0, 0);
      const node2 = service.createNode('Node 2', 100, 100);
      service.createConnection(node1.id, 'right', node2.id, 'left');
      service.selectNode(node1.id);

      service.clearGraph();

      expect(service.nodes().length).toBe(0);
      expect(service.connections().length).toBe(0);
      expect(service.selectedNodeId()).toBeNull();
      expect(service.nodeCount()).toBe(0);
    });
  });

  describe('createGroup', () => {
    it('creates a Group with kind group, node id pattern, and default size', () => {
      const group = service.createGroup('New Group', 100, 200);

      expect(group.id).toMatch(/^node_\d+_\d+$/);
      expect(group.kind).toBe('group');
      expect(group.label).toBe('New Group');
      expect(group.x).toBe(100);
      expect(group.y).toBe(200);
      expect(group.width).toBe(320);
      expect(group.height).toBe(200);
      expect(service.nodes().length).toBe(1);
    });
  });

  describe('setNodeParent', () => {
    it('makes a node a child of a Group and releases it with null', () => {
      const group = service.createGroup('G', 0, 0);
      const node = service.createNode('N', 50, 50);

      service.setNodeParent(node.id, group.id);
      expect(service.nodes().find(n => n.id === node.id)?.parentId).toBe(group.id);

      service.setNodeParent(node.id, null);
      expect(service.nodes().find(n => n.id === node.id)?.parentId).toBeUndefined();
    });

    it('throws for an unknown node id', () => {
      expect(() => service.setNodeParent('missing', null)).toThrow('Node missing not found');
    });

    it('throws when the parent is not a Group', () => {
      const a = service.createNode('A', 0, 0);
      const b = service.createNode('B', 100, 100);

      expect(() => service.setNodeParent(a.id, b.id)).toThrow(`Parent ${b.id} is not a Group`);
    });

    it('throws when trying to parent a Group', () => {
      const g1 = service.createGroup('G1', 0, 0);
      const g2 = service.createGroup('G2', 500, 500);

      expect(() => service.setNodeParent(g1.id, g2.id)).toThrow('A Group cannot have a parent');
    });
  });

  describe('childrenOf', () => {
    it('returns only the direct children of a Group', () => {
      const group = service.createGroup('G', 0, 0);
      const inside = service.createNode('In', 50, 50);
      service.createNode('Out', 900, 900);
      service.setNodeParent(inside.id, group.id);

      const children = service.childrenOf(group.id);
      expect(children.map(c => c.id)).toEqual([inside.id]);
    });
  });

  describe('createConnection Group/child ban', () => {
    it('returns null when connecting a Group to its own child', () => {
      const group = service.createGroup('G', 0, 0);
      const child = service.createNode('C', 50, 50);
      service.setNodeParent(child.id, group.id);

      expect(service.createConnection(group.id, 'right', child.id, 'left')).toBeNull();
      expect(service.createConnection(child.id, 'right', group.id, 'left')).toBeNull();
      expect(service.connections().length).toBe(0);
    });

    it('allows a Group to connect to a non-child node', () => {
      const group = service.createGroup('G', 0, 0);
      const outside = service.createNode('O', 900, 900);

      expect(service.createConnection(group.id, 'right', outside.id, 'left')).not.toBeNull();
    });

    it('allows a child to connect to a different Group', () => {
      const g1 = service.createGroup('G1', 0, 0);
      const g2 = service.createGroup('G2', 800, 0);
      const child = service.createNode('C', 50, 50);
      service.setNodeParent(child.id, g1.id);

      expect(service.createConnection(child.id, 'right', g2.id, 'left')).not.toBeNull();
    });
  });

  describe('findGroupAt', () => {
    it('returns the Group whose bounds contain the point', () => {
      const group = service.createGroup('G', 100, 100); // 320x200 -> 100..420, 100..300
      service.createNode('N', 900, 900);

      expect(service.findGroupAt(200, 200)?.id).toBe(group.id);
      expect(service.findGroupAt(50, 50)).toBeNull();
    });

    it('never returns a regular node', () => {
      service.createNode('N', 0, 0); // 160x48

      expect(service.findGroupAt(10, 10)).toBeNull();
    });

    it('returns the topmost (later in array) of overlapping Groups', () => {
      service.createGroup('Under', 0, 0);
      const top = service.createGroup('Over', 100, 100);

      expect(service.findGroupAt(150, 150)?.id).toBe(top.id);
    });

    it('excludes the given node id', () => {
      const group = service.createGroup('G', 0, 0);

      expect(service.findGroupAt(10, 10, group.id)).toBeNull();
    });
  });

  describe('moveGroup', () => {
    it('moves the Group and shifts its children by the same delta', () => {
      const group = service.createGroup('G', 100, 100);
      const child = service.createNode('C', 150, 150);
      const outside = service.createNode('O', 900, 900);
      service.setNodeParent(child.id, group.id);

      service.moveGroup(group.id, 300, 250);

      expect(service.nodes().find(n => n.id === group.id)).toMatchObject({ x: 300, y: 250 });
      expect(service.nodes().find(n => n.id === child.id)).toMatchObject({ x: 350, y: 300 });
      expect(service.nodes().find(n => n.id === outside.id)).toMatchObject({ x: 900, y: 900 });
    });
  });

  describe('deleteNode with Groups', () => {
    it('releases children in place when a Group is deleted', () => {
      const group = service.createGroup('G', 0, 0);
      const child = service.createNode('C', 50, 50);
      service.setNodeParent(child.id, group.id);

      const result = service.deleteNode(group.id);

      const released = service.nodes().find(n => n.id === child.id);
      expect(released?.parentId).toBeUndefined();
      expect(released).toMatchObject({ x: 50, y: 50 });
      expect(result.releasedChildIds).toEqual([child.id]);
    });

    it('reports no released children for a regular node', () => {
      const node = service.createNode('N', 0, 0);

      expect(service.deleteNode(node.id).releasedChildIds).toEqual([]);
    });
  });

  describe('resizeNode', () => {
    it('applies the requested rect to a regular node', () => {
      const node = service.createNode('N', 10, 20);

      const applied = service.resizeNode(node.id, { x: 10, y: 20, width: 300, height: 90 });

      expect(applied).toEqual({ x: 10, y: 20, width: 300, height: 90 });
      expect(service.nodes().find(n => n.id === node.id)).toMatchObject({ x: 10, y: 20, width: 300, height: 90 });
    });

    it('clamps a Group so it always contains its children plus padding', () => {
      const group = service.createGroup('G', 0, 0, 400, 300);
      const child = service.createNode('C', 200, 150, 160, 48);
      service.setNodeParent(child.id, group.id);

      // Try to shrink the bottom-right corner past the child (child spans 200..360 x, 150..198 y)
      const applied = service.resizeNode(group.id, { x: 0, y: 0, width: 150, height: 100 });

      expect(applied.width).toBe(360 + 16); // child right edge + padding
      expect(applied.height).toBe(198 + 16); // child bottom edge + padding
    });

    it('clamps the Group top-left edges against its children', () => {
      const group = service.createGroup('G', 0, 0, 400, 300);
      const child = service.createNode('C', 50, 50, 160, 48);
      service.setNodeParent(child.id, group.id);

      // Try to drag the top-left corner inward past the child
      const applied = service.resizeNode(group.id, { x: 100, y: 100, width: 300, height: 200 });

      expect(applied.x).toBe(50 - 16);
      expect(applied.y).toBe(50 - 16);
      expect(applied.x + applied.width).toBe(400);
      expect(applied.y + applied.height).toBe(300);
    });

    it('does not change membership when a Group is resized', () => {
      const group = service.createGroup('G', 0, 0, 400, 300);
      const child = service.createNode('C', 200, 150);
      service.setNodeParent(child.id, group.id);

      service.resizeNode(group.id, { x: 0, y: 0, width: 100, height: 80 });

      expect(service.nodes().find(n => n.id === child.id)?.parentId).toBe(group.id);
    });

    it('throws for an unknown node id', () => {
      expect(() => service.resizeNode('missing', { x: 0, y: 0, width: 100, height: 50 }))
        .toThrow('Node missing not found');
    });
  });

  describe('setNodeColor', () => {
    it('sets a palette color and clears it with null', () => {
      const node = service.createNode('N', 0, 0);

      service.setNodeColor(node.id, NODE_PALETTE[0]);
      expect(service.nodes().find(n => n.id === node.id)?.color).toBe(NODE_PALETTE[0]);

      service.setNodeColor(node.id, null);
      expect(service.nodes().find(n => n.id === node.id)?.color).toBeUndefined();
    });
  });

  describe('import validation for Groups and colors', () => {
    const baseNode = (over: Record<string, unknown>) => ({
      id: 'a', label: 'A', x: 0, y: 0, width: 160, height: 48, ...over,
    });
    const group = (over: Record<string, unknown>) => ({
      id: 'g', label: 'G', x: 0, y: 0, width: 320, height: 200, kind: 'group', ...over,
    });

    it('accepts a valid payload with a Group, a child, and a palette color', () => {
      const result = service.importGraph({
        nodes: [
          group({}),
          baseNode({ parentId: 'g', color: NODE_PALETTE[2] }),
        ],
        connections: [],
      } as GraphState);

      expect(result.success).toBe(true);
      expect(service.nodes().find(n => n.id === 'a')?.parentId).toBe('g');
    });

    it('rejects an unknown kind value', () => {
      const result = service.importGraph({
        nodes: [baseNode({ kind: 'frame' })],
        connections: [],
      } as unknown as GraphState);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid node a: kind must be 'group'");
    });

    it('rejects a color outside the palette', () => {
      const result = service.importGraph({
        nodes: [baseNode({ color: '#123456' })],
        connections: [],
      } as GraphState);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid node a: color must be a palette color');
    });

    it('rejects a parentId referencing a non-existent node', () => {
      const result = service.importGraph({
        nodes: [baseNode({ parentId: 'ghost' })],
        connections: [],
      } as GraphState);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid node a: parentId references non-existent node');
    });

    it('rejects a parentId referencing a regular node', () => {
      const result = service.importGraph({
        nodes: [baseNode({ id: 'b' }), baseNode({ parentId: 'b' })],
        connections: [],
      } as GraphState);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid node a: parentId must reference a Group');
    });

    it('rejects a Group carrying a parentId', () => {
      const result = service.importGraph({
        nodes: [group({}), group({ id: 'g2', parentId: 'g' })],
        connections: [],
      } as GraphState);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid node g2: a Group cannot have a parentId');
    });

    it('rejects a Connection linking a Group to its own child', () => {
      const result = service.importGraph({
        nodes: [group({}), baseNode({ parentId: 'g' })],
        connections: [
          { id: 'c1', sourceNodeId: 'g', sourceHandle: 'right', targetNodeId: 'a', targetHandle: 'left' },
        ],
      } as GraphState);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid connection c1: connects a Group to its own child');
    });

    it('keeps existing state untouched when the new rules reject a payload', () => {
      const keep = service.createNode('Keep', 0, 0);

      service.importGraph({
        nodes: [baseNode({ color: 'red' })],
        connections: [],
      } as GraphState);

      expect(service.nodes().map(n => n.id)).toEqual([keep.id]);
    });
  });
});
