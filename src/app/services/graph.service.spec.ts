import { TestBed } from '@angular/core/testing';
import { GraphService } from './graph.service';
import { GraphNode, HandleSide } from '../models/node';
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
});
