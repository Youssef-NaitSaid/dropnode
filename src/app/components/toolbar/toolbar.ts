import { Component, inject, ChangeDetectionStrategy, output } from '@angular/core';
import { GraphService } from '../../services/graph.service';
import { HistoryService } from '../../services/history.service';
import { ToastService } from '../toast/toast';

@Component({
  selector: 'app-toolbar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  template: `
    <div class="toolbar">
      <div class="toolbar-left">
        <span class="toolbar-title">dropnode</span>
        <span class="toolbar-divider"></span>
        <span class="node-count">{{ graphService.nodeCount() }} nodes</span>
      </div>

      <div class="toolbar-center">
        <button class="tool-btn" (click)="undo()" [disabled]="!historyService.canUndo()" title="Undo (Ctrl+Z)">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M7.5 3L3 7l4.5 4V8.5C11 8.5 13 10 13 13c0-4.5-2.5-6.5-5.5-6.5V3z"/>
          </svg>
        </button>
        <button class="tool-btn" (click)="redo()" [disabled]="!historyService.canRedo()" title="Redo (Ctrl+Shift+Z)">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8.5 3L13 7l-4.5 4V8.5C5 8.5 3 10 3 13c0-4.5 2.5-6.5 5.5-6.5V3z"/>
          </svg>
        </button>
      </div>

      <div class="toolbar-right">
        <button class="tool-btn" (click)="zoomIn()" title="Zoom In">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M7 1v6H1v2h6v6h2V9h6V7H9V1z"/>
          </svg>
        </button>
        <button class="tool-btn" (click)="zoomOut()" title="Zoom Out">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M1 7v2h14V7z"/>
          </svg>
        </button>
        <button class="tool-btn" (click)="resetView()" title="Reset View">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 2a6 6 0 100 12A6 6 0 008 2zm0 1.5a4.5 4.5 0 110 9 4.5 4.5 0 010-9zM7.25 5v2.75H5v1.5h2.25V12h1.5V9.25H11v-1.5H8.75V5z"/>
          </svg>
        </button>
        <span class="toolbar-divider"></span>
        <span class="zoom-label">{{ zoomPercent() }}%</span>
        <span class="toolbar-divider"></span>
        <button class="tool-btn" (click)="openImport()" title="Import">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 1l4 4H9v5H7V5H4l4-4zM2 11v3h12v-3h-1.5v1.5h-9V11H2z"/>
          </svg>
        </button>
        <button class="tool-btn" (click)="exportJson()" title="Export JSON">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 12L4 8h2.5V3h3v5H12L8 12zM2 13v1.5h12V13H2z"/>
          </svg>
        </button>
        <button class="tool-btn" (click)="copyToClipboard()" title="Copy to Clipboard">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4 2v10h8V2H4zm1 1h6v8H5V3zM2 4v10h8v-1H3V4H2z"/>
          </svg>
        </button>
      </div>
    </div>

  `,
  styles: [`
    :host {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 50;
    }
    .toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 16px;
      background: rgba(30, 30, 55, 0.95);
      backdrop-filter: blur(8px);
      border-bottom: 1px solid #3a3a5c;
    }
    .toolbar-left, .toolbar-center, .toolbar-right {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .toolbar-title {
      color: #e0e0f0;
      font-size: 16px;
      font-weight: 700;
      letter-spacing: -0.5px;
    }
    .toolbar-divider {
      width: 1px;
      height: 20px;
      background: #3a3a5c;
      margin: 0 4px;
    }
    .node-count {
      color: #b0b0cc;
      font-size: 13px;
      font-weight: 500;
    }
    .zoom-label {
      color: #b0b0cc;
      font-size: 13px;
      font-weight: 500;
      min-width: 40px;
      text-align: center;
    }
    .tool-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border: none;
      border-radius: 6px;
      background: transparent;
      color: #8888aa;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .tool-btn:hover:not(:disabled) {
      background: #2a2a4a;
      color: #f0f0f5;
    }
    .tool-btn:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }
  `],
})
export class ToolbarComponent {
  graphService = inject(GraphService);
  historyService = inject(HistoryService);
  private toastService = inject(ToastService);

  importRequested = output<void>();

  zoomPercent = () => Math.round(this.graphService.viewportState().zoom * 100);

  zoomIn(): void {
    this.graphService.zoomBy(0.1, 0, 0);
  }

  zoomOut(): void {
    this.graphService.zoomBy(-0.1, 0, 0);
  }

  resetView(): void {
    this.graphService.resetViewport();
  }

  undo(): void {
    this.historyService.undo();
  }

  redo(): void {
    this.historyService.redo();
  }

  openImport(): void {
    this.importRequested.emit();
  }

  exportJson(): void {
    const data = this.graphService.exportGraph();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dropnode-graph.json';
    a.click();
    URL.revokeObjectURL(url);
    this.toastService.show('Graph exported to file', 'success');
  }

  copyToClipboard(): void {
    const data = this.graphService.exportGraph();
    const json = JSON.stringify(data, null, 2);
    navigator.clipboard.writeText(json).then(
      () => this.toastService.show('Copied to clipboard', 'success'),
      () => this.toastService.show('Failed to copy to clipboard', 'error'),
    );
  }
}
