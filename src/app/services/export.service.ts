import { Injectable, inject } from '@angular/core';
import { GraphService } from './graph.service';
import { CollectionService } from './collection.service';
import { GraphState } from '../models/graph-state';
import { ToastService } from '../components/toast/toast';

@Injectable({ providedIn: 'root' })
export class ExportService {
  private graphService = inject(GraphService);
  private collectionService = inject(CollectionService);
  private toastService = inject(ToastService);

  private graphAsJson(graph?: GraphState): string {
    return JSON.stringify(graph ?? this.graphService.exportGraph(), null, 2);
  }

  /** Filename-safe slug of a Project/Collection name; names are free-form. */
  private slug(name: string, fallback: string): string {
    const slugged = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return slugged || fallback;
  }

  private download(json: string, filename: string): void {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Current editor graph (Scratch Canvas toolbar) ────────────────

  exportToFile(): void {
    this.download(this.graphAsJson(), 'dropnode-graph.json');
    this.toastService.show('Graph exported to file', 'success');
  }

  copyJson(): Promise<void> {
    return this.copyToClipboard(this.graphAsJson(), 'Copied to clipboard', 'Failed to copy to clipboard');
  }

  copyLink(): Promise<void> {
    return this.copyGraphLink(this.graphAsJson());
  }

  // ── Stored project graphs (Sidebar row actions, no navigation) ───

  exportProjectToFile(projectId: string): void {
    const project = this.collectionService.getProject(projectId);
    const graph = this.collectionService.getProjectGraph(projectId);
    if (!project || !graph) return;
    this.download(this.graphAsJson(graph), this.slug(project.name, 'project') + '.json');
    this.toastService.show('Graph exported to file', 'success');
  }

  copyProjectJson(projectId: string): Promise<void> {
    const graph = this.collectionService.getProjectGraph(projectId);
    if (!graph) return Promise.resolve();
    return this.copyToClipboard(this.graphAsJson(graph), 'Copied to clipboard', 'Failed to copy to clipboard');
  }

  copyProjectLink(projectId: string): Promise<void> {
    const graph = this.collectionService.getProjectGraph(projectId);
    if (!graph) return Promise.resolve();
    return this.copyGraphLink(this.graphAsJson(graph));
  }

  // ── Collection envelope ──────────────────────────────────────────

  exportCollectionToFile(collectionId: string): void {
    const collection = this.collectionService.getCollection(collectionId);
    if (!collection) return;
    const envelope = this.collectionService.exportCollection(collectionId);
    this.download(
      JSON.stringify(envelope, null, 2),
      this.slug(collection.name, 'collection') + '.dropnode-collection.json',
    );
    this.toastService.show('Collection exported to file', 'success');
  }

  // ── Internals ────────────────────────────────────────────────────

  private copyToClipboard(text: string, successMsg: string, errorMsg: string): Promise<void> {
    return navigator.clipboard.writeText(text).then(
      () => this.toastService.show(successMsg, 'success'),
      () => this.toastService.show(errorMsg, 'error'),
    );
  }

  /**
   * Share links always target the root path: ?data is only honored on `/`
   * (the Scratch Canvas), never on a /p/:projectId route (ADR-0007).
   */
  private copyGraphLink(json: string): Promise<void> {
    const link = window.location.origin + '/?data=' + encodeURIComponent(json);
    return this.copyToClipboard(link, 'Link copied to clipboard', 'Failed to copy link to clipboard');
  }
}
