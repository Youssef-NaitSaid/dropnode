import {
  Component,
  ChangeDetectionStrategy,
  OnDestroy,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';
import { CanvasComponent } from '../canvas/canvas';
import { ToolbarComponent } from '../toolbar/toolbar';
import { GraphService } from '../../services/graph.service';
import { HistoryService } from '../../services/history.service';
import { CollectionService } from '../../services/collection.service';
import { UrlLoaderService } from '../../services/url-loader.service';

/**
 * The editor page behind both routes: `/` (Scratch Canvas) and
 * `/p/:projectId` (a Project). All decisions live in CollectionService;
 * this component only wires route params, Graph State loading, History
 * clearing, and the auto-save loop together.
 */
@Component({
  selector: 'app-editor-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CanvasComponent, ToolbarComponent],
  template: `
    <app-toolbar [scratchMode]="!projectId()" />
    <app-canvas />
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1 1 auto;
      min-width: 0;
      height: 100%;
    }
    app-canvas {
      flex: 1 1 auto;
      min-height: 0;
    }
  `],
})
export class EditorPageComponent implements OnDestroy {
  private graphService = inject(GraphService);
  private historyService = inject(HistoryService);
  private collectionService = inject(CollectionService);
  private urlLoader = inject(UrlLoaderService);

  /** Bound from the route param; undefined on the Scratch Canvas route. */
  projectId = input<string | undefined>(undefined);

  private currentProjectId: string | null = null;

  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingSave: (() => void) | null = null;

  constructor() {
    effect(() => {
      const id = this.projectId();
      untracked(() => this.activate(id));
    });

    // Auto-save: every Graph State or Viewport change persists the current
    // Project (debounced so per-mousemove drag frames coalesce). The Scratch
    // Canvas is never persisted — reload still clears it.
    effect(() => {
      const nodes = this.graphService.nodes();
      const connections = this.graphService.connections();
      const viewport = this.graphService.viewportState();
      const id = this.currentProjectId;
      if (!id) return;
      this.scheduleSave(() => {
        this.collectionService.saveProjectGraph(id, { nodes, connections });
        this.collectionService.saveProjectViewport(id, viewport);
      });
    });
  }

  ngOnDestroy(): void {
    this.flushSave();
    if (!this.currentProjectId) {
      // Leaving the Scratch Canvas keeps its graph for the session.
      this.collectionService.stashScratch(
        this.graphService.exportGraph(),
        this.graphService.viewportState(),
      );
    }
  }

  /** Switching Projects (or entering scratch) — History never crosses over. */
  private activate(projectId: string | undefined): void {
    this.flushSave();
    this.historyService.clear();

    if (projectId) {
      // Arm auto-save only after a successful load — otherwise the previous
      // project's canvas content would be saved into the wrong Project.
      this.currentProjectId = null;
      const graph = this.collectionService.getProjectGraph(projectId);
      const loaded = graph ? this.graphService.importGraph(graph).success : false;
      if (!loaded) {
        // Missing or corrupt stored graph (the guard only checks the Project
        // record) — show an empty canvas rather than another project's graph.
        this.graphService.clearGraph();
        this.graphService.resetViewport();
        return;
      }
      this.currentProjectId = projectId;
      this.graphService.setViewport(
        this.collectionService.getProjectViewport(projectId) ?? { panX: 0, panY: 0, zoom: 1 },
      );
      this.collectionService.markOpened(projectId);
      return;
    }

    this.currentProjectId = null;
    const loadedFromUrl = this.urlLoader.load();
    const snapshot = this.collectionService.takeScratchSnapshot();
    if (loadedFromUrl) return;
    if (snapshot) {
      this.graphService.importGraph(snapshot.graph);
      this.graphService.setViewport(snapshot.viewport);
    } else {
      this.graphService.clearGraph();
      this.graphService.resetViewport();
    }
  }

  private scheduleSave(save: () => void): void {
    this.pendingSave = save;
    if (this.saveTimer !== null) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.flushSave(), 300);
  }

  private flushSave(): void {
    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    this.pendingSave?.();
    this.pendingSave = null;
  }
}
