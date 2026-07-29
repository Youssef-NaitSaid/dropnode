import { TestBed } from '@angular/core/testing';
import { ExportService } from './export.service';
import { GraphService } from './graph.service';
import { CollectionService } from './collection.service';
import { NODE_PALETTE } from '../models/node';
import { ToastService } from '../components/toast/toast';

describe('ExportService', () => {
  let service: ExportService;
  let graphService: GraphService;
  let collectionService: CollectionService;
  let toastService: ToastService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(ExportService);
    graphService = TestBed.inject(GraphService);
    collectionService = TestBed.inject(CollectionService);
    toastService = TestBed.inject(ToastService);
  });

  describe('exportToFile', () => {
    let capturedBlob: Blob | null;
    let clickedAnchor: HTMLAnchorElement | null;
    let clickSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      capturedBlob = null;
      clickedAnchor = null;
      // jsdom has no object URL support; stub the blob-download mechanism
      URL.createObjectURL = vi.fn((blob: Blob) => {
        capturedBlob = blob;
        return 'blob:mock-url';
      }) as typeof URL.createObjectURL;
      URL.revokeObjectURL = vi.fn() as typeof URL.revokeObjectURL;
      clickSpy = vi
        .spyOn(HTMLAnchorElement.prototype, 'click')
        .mockImplementation(function (this: HTMLAnchorElement) {
          clickedAnchor = this;
        });
    });

    afterEach(() => {
      clickSpy.mockRestore();
    });

    it('downloads the Graph State as pretty-printed JSON named dropnode-graph.json', async () => {
      const node1 = graphService.createNode('Node 1', 0, 0);
      const node2 = graphService.createNode('Node 2', 100, 100);
      graphService.createConnection(node1.id, 'right', node2.id, 'left');

      service.exportToFile();

      expect(clickedAnchor?.download).toBe('dropnode-graph.json');
      expect(capturedBlob).not.toBeNull();
      const text = await capturedBlob!.text();
      expect(text).toBe(JSON.stringify(graphService.exportGraph(), null, 2));
      expect(JSON.parse(text).nodes.length).toBe(2);
      expect(JSON.parse(text).connections.length).toBe(1);
    });

    it('shows a success toast', () => {
      service.exportToFile();

      expect(toastService.message()).toBe('Graph exported to file');
      expect(toastService.type()).toBe('success');
    });
  });

  describe('copyJson', () => {
    it('writes the pretty-printed Graph State JSON to the clipboard and shows a success toast', async () => {
      const node = graphService.createNode('Clipboard Node', 10, 20);
      const writeText = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });

      await service.copyJson();

      expect(writeText).toHaveBeenCalledTimes(1);
      const written = writeText.mock.calls[0][0];
      expect(written).toBe(JSON.stringify(graphService.exportGraph(), null, 2));
      expect(JSON.parse(written).nodes[0].id).toBe(node.id);
      expect(toastService.message()).toBe('Copied to clipboard');
      expect(toastService.type()).toBe('success');

      vi.unstubAllGlobals();
    });

    it('shows an error toast when the clipboard write fails', async () => {
      const writeText = vi.fn().mockRejectedValue(new Error('denied'));
      vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });

      await service.copyJson();

      expect(toastService.message()).toBe('Failed to copy to clipboard');
      expect(toastService.type()).toBe('error');

      vi.unstubAllGlobals();
    });
  });

  describe('copyLink', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
      window.history.pushState({}, '', '/');
    });

    it('copies the app URL with the Graph State in the data query parameter and shows a success toast', async () => {
      graphService.createNode('Link Node', 5, 15);
      const writeText = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });

      await service.copyLink();

      const link = writeText.mock.calls[0][0] as string;
      expect(link).toBe(
        window.location.origin +
          window.location.pathname +
          '?data=' +
          encodeURIComponent(JSON.stringify(graphService.exportGraph(), null, 2)),
      );
      expect(toastService.message()).toBe('Link copied to clipboard');
      expect(toastService.type()).toBe('success');
    });

    it('round-trips: opening the copied link loads the identical Graph State', async () => {
      const node1 = graphService.createNode('Alpha', 0, 0);
      const node2 = graphService.createNode('Beta & Gamma?', 100, 100);
      graphService.createConnection(node1.id, 'bottom', node2.id, 'top');
      const exported = graphService.exportGraph();
      const writeText = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });

      await service.copyLink();
      const link = writeText.mock.calls[0][0] as string;

      // Simulate opening the link: the ?data param goes through the startup loader
      window.history.pushState({}, '', link);
      graphService.clearGraph();
      const result = graphService.loadFromUrlParam();

      expect(result.loaded).toBe(true);
      expect(graphService.exportGraph()).toEqual(exported);
    });

    it('drops any existing query parameters from the copied link', async () => {
      window.history.pushState({}, '', '/?data=old&foo=1');
      const writeText = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });

      await service.copyLink();

      const link = writeText.mock.calls[0][0] as string;
      expect(link).not.toContain('foo=');
      expect(new URL(link).searchParams.getAll('data').length).toBe(1);
    });

    it('shows an error toast when the clipboard write fails', async () => {
      const writeText = vi.fn().mockRejectedValue(new Error('denied'));
      vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });

      await service.copyLink();

      expect(toastService.message()).toBe('Failed to copy link to clipboard');
      expect(toastService.type()).toBe('error');
    });
  });

  describe('project and collection export (from the store, not the editor)', () => {
    let capturedBlob: Blob | null;
    let clickedAnchor: HTMLAnchorElement | null;
    let clickSpy: ReturnType<typeof vi.spyOn>;

    const storedGraph = () => ({
      nodes: [{ id: 'node_9_9', label: 'Stored', x: 1, y: 2, width: 160, height: 48 }],
      connections: [],
    });

    beforeEach(() => {
      capturedBlob = null;
      clickedAnchor = null;
      URL.createObjectURL = vi.fn((blob: Blob) => {
        capturedBlob = blob;
        return 'blob:mock-url';
      }) as typeof URL.createObjectURL;
      URL.revokeObjectURL = vi.fn() as typeof URL.revokeObjectURL;
      clickSpy = vi
        .spyOn(HTMLAnchorElement.prototype, 'click')
        .mockImplementation(function (this: HTMLAnchorElement) {
          clickedAnchor = this;
        });
    });

    afterEach(() => {
      clickSpy.mockRestore();
      vi.unstubAllGlobals();
    });

    it('exportProjectToFile downloads the stored graph named after the project, slugged', async () => {
      const col = collectionService.createCollection('C');
      const proj = collectionService.createProject(col.id, 'Onboarding Flow!', storedGraph());
      // The editor holds a different graph — the export must read the store.
      graphService.createNode('Editor-only', 0, 0);

      service.exportProjectToFile(proj.id);

      expect(clickedAnchor?.download).toBe('onboarding-flow.json');
      const text = await capturedBlob!.text();
      expect(JSON.parse(text)).toEqual(storedGraph());
      expect(toastService.type()).toBe('success');
    });

    it('falls back to a default filename when the name slugs to nothing', () => {
      const col = collectionService.createCollection('C');
      const proj = collectionService.createProject(col.id, '???');

      service.exportProjectToFile(proj.id);

      expect(clickedAnchor?.download).toBe('project.json');
    });

    it('copyProjectJson writes the stored graph to the clipboard', async () => {
      const col = collectionService.createCollection('C');
      const proj = collectionService.createProject(col.id, 'P', storedGraph());
      const writeText = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });

      await service.copyProjectJson(proj.id);

      expect(JSON.parse(writeText.mock.calls[0][0])).toEqual(storedGraph());
      expect(toastService.type()).toBe('success');
    });

    it('copyProjectLink produces a root share link carrying the stored graph', async () => {
      const col = collectionService.createCollection('C');
      const proj = collectionService.createProject(col.id, 'P', storedGraph());
      const writeText = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });

      await service.copyProjectLink(proj.id);

      const link = writeText.mock.calls[0][0] as string;
      const url = new URL(link);
      expect(url.pathname).toBe('/');
      expect(JSON.parse(decodeURIComponent(url.searchParams.get('data')!))).toEqual(storedGraph());
    });

    it('exportCollectionToFile downloads the envelope named after the collection', async () => {
      const col = collectionService.createCollection('Client Work');
      collectionService.createProject(col.id, 'P1', storedGraph());

      service.exportCollectionToFile(col.id);

      expect(clickedAnchor?.download).toBe('client-work.dropnode-collection.json');
      const text = await capturedBlob!.text();
      expect(JSON.parse(text)).toEqual({
        name: 'Client Work',
        projects: [{ name: 'P1', graph: storedGraph() }],
      });
      expect(toastService.message()).toBe('Collection exported to file');
      expect(toastService.type()).toBe('success');
    });
  });

  describe('Group and color round-trip', () => {
    it('kind, parentId, and color survive export and re-import', () => {
      const group = graphService.createGroup('My Group', 0, 0);
      const child = graphService.createNode('Child', 50, 50);
      graphService.setNodeParent(child.id, group.id);
      graphService.setNodeColor(child.id, NODE_PALETTE[4]);

      const exported = graphService.exportGraph();
      graphService.clearGraph();
      const result = graphService.importGraph(exported);

      expect(result.success).toBe(true);
      const importedGroup = graphService.nodes().find(n => n.id === group.id);
      const importedChild = graphService.nodes().find(n => n.id === child.id);
      expect(importedGroup?.kind).toBe('group');
      expect(importedChild?.parentId).toBe(group.id);
      expect(importedChild?.color).toBe(NODE_PALETTE[4]);
    });

    it('payloads without the optional fields import as plain nodes', () => {
      const result = graphService.importGraph({
        nodes: [
          { id: 'n1', label: 'Old', x: 0, y: 0, width: 160, height: 48 },
        ],
        connections: [],
      });

      expect(result.success).toBe(true);
      const node = graphService.nodes()[0];
      expect(node.kind).toBeUndefined();
      expect(node.parentId).toBeUndefined();
      expect(node.color).toBeUndefined();
    });

    it('exported Graph State is a copy: mutating it does not affect editor state', () => {
      const group = graphService.createGroup('G', 0, 0);
      const exported = graphService.exportGraph();

      exported.nodes[0].label = 'Mutated';

      expect(graphService.nodes().find(n => n.id === group.id)?.label).toBe('G');
    });
  });
});
