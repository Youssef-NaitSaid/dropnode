import { Component, inject, ChangeDetectionStrategy, output } from '@angular/core';
import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { GraphService } from '../../services/graph.service';
import { HistoryService } from '../../services/history.service';
import { ExportService } from '../../services/export.service';
import { CreateGroupCommand, SetNodeColorCommand } from '../../services/commands';
import { NODE_PALETTE } from '../../models/node';

@Component({
  selector: 'app-toolbar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CdkMenu, CdkMenuItem, CdkMenuTrigger],
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
        @if (graphService.selectedNodeId(); as selectedId) {
          <span class="toolbar-divider"></span>
          <div class="swatch-row" title="Background color">
            <button
              class="swatch swatch-default"
              [class.active]="!selectedColor()"
              title="Default"
              (click)="setColor(null)"
            ></button>
            @for (color of palette; track color) {
              <button
                class="swatch"
                [class.active]="selectedColor() === color"
                [style.background]="color"
                [title]="color"
                (click)="setColor(color)"
              ></button>
            }
          </div>
        }
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
        <button class="tool-btn" (click)="addGroup()" title="Add Group">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="1.5" y="1.5" width="13" height="13" rx="2" stroke-dasharray="3 2"/>
            <rect x="5" y="6.5" width="6" height="4" rx="1" fill="currentColor" stroke="none"/>
          </svg>
        </button>
        <button class="tool-btn" (click)="openImport()" title="Import">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 1l4 4H9v5H7V5H4l4-4zM2 11v3h12v-3h-1.5v1.5h-9V11H2z"/>
          </svg>
        </button>
        <button class="tool-btn" [cdkMenuTriggerFor]="exportMenu" title="Export">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 12L4 8h2.5V3h3v5H12L8 12zM2 13v1.5h12V13H2z"/>
          </svg>
        </button>
      </div>
    </div>

    <ng-template #exportMenu>
      <div class="export-menu" cdkMenu>
        <button class="export-menu-item" cdkMenuItem (cdkMenuItemTriggered)="exportToFile()">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 12L4 8h2.5V3h3v5H12L8 12zM2 13v1.5h12V13H2z"/>
          </svg>
          <span>Export JSON file</span>
        </button>
        <button class="export-menu-item" cdkMenuItem (cdkMenuItemTriggered)="copyJson()">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4 2v10h8V2H4zm1 1h6v8H5V3zM2 4v10h8v-1H3V4H2z"/>
          </svg>
          <span>Copy JSON</span>
        </button>
        <button class="export-menu-item" cdkMenuItem (cdkMenuItemTriggered)="copyLink()">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M9.4 3.7a2.5 2.5 0 013.54 3.54l-2.12 2.12a2.5 2.5 0 01-3.54 0l1.06-1.06a1 1 0 001.42 0l2.12-2.12a1 1 0 00-1.42-1.42l-.9.9-1.06-1.06.9-.9zM6.6 12.3a2.5 2.5 0 01-3.54-3.54l2.12-2.12a2.5 2.5 0 013.54 0L7.66 7.7a1 1 0 00-1.42 0l-2.12 2.12a1 1 0 001.42 1.42l.9-.9 1.06 1.06-.9.9z"/>
          </svg>
          <span>Copy link</span>
        </button>
        <button class="export-menu-item" cdkMenuItem [cdkMenuItemDisabled]="true">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M12.2 6.53a4 4 0 00-7.7-.98A3 3 0 004.5 11.5h7a2.5 2.5 0 00.7-4.97zM11.5 10h-7a1.5 1.5 0 01-.1-3l1.06-.07.3-.86a2.5 2.5 0 014.82.61l.14.92.93.05a1 1 0 01-.15 2.35z"/>
          </svg>
          <span class="export-menu-item-text">
            <span>Export to Drive</span>
            <span class="export-menu-hint">Sign in required — coming soon</span>
          </span>
        </button>
      </div>
    </ng-template>
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
    .export-menu {
      display: flex;
      flex-direction: column;
      min-width: 220px;
      margin-top: 4px;
      padding: 4px;
      background: rgba(30, 30, 55, 0.98);
      backdrop-filter: blur(8px);
      border: 1px solid #3a3a5c;
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    }
    .export-menu-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      border: none;
      border-radius: 6px;
      background: transparent;
      color: #b0b0cc;
      font-size: 13px;
      font-weight: 500;
      text-align: left;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .export-menu-item svg {
      flex-shrink: 0;
      color: #8888aa;
    }
    .export-menu-item:hover:not([aria-disabled='true']),
    .export-menu-item:focus-visible {
      background: #2a2a4a;
      color: #f0f0f5;
      outline: none;
    }
    .export-menu-item[aria-disabled='true'] {
      opacity: 0.45;
      cursor: not-allowed;
    }
    .export-menu-item-text {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .export-menu-hint {
      font-size: 11px;
      font-weight: 400;
      color: #8888aa;
    }
    .swatch-row {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .swatch {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      border: 2px solid #3a3a5c;
      padding: 0;
      cursor: pointer;
      transition: transform 0.15s ease, border-color 0.15s ease;
    }
    .swatch:hover {
      transform: scale(1.2);
    }
    .swatch.active {
      border-color: #6c63ff;
      box-shadow: 0 0 0 2px rgba(108, 99, 255, 0.3);
    }
    .swatch-default {
      background: #f0f0f5;
      position: relative;
    }
    .swatch-default::after {
      content: '';
      position: absolute;
      inset: 3px;
      border-radius: 50%;
      border: 1px dashed #8888aa;
    }
  `],
})
export class ToolbarComponent {
  graphService = inject(GraphService);
  historyService = inject(HistoryService);
  private exportService = inject(ExportService);

  importRequested = output<void>();

  palette = NODE_PALETTE;

  zoomPercent = () => Math.round(this.graphService.viewportState().zoom * 100);

  selectedColor = () => this.graphService.selectedNode()?.color ?? null;

  setColor(color: string | null): void {
    const selectedId = this.graphService.selectedNodeId();
    if (!selectedId) return;
    if ((this.graphService.selectedNode()?.color ?? null) === color) return;
    this.historyService.execute(new SetNodeColorCommand(this.graphService, selectedId, color));
  }

  addGroup(): void {
    // Center the new Group in the Viewport (canvas area, not the window —
    // the toolbar overlaps the top of the window)
    const canvasRect = document.querySelector('.canvas-container')?.getBoundingClientRect();
    const screenCenterX = canvasRect ? canvasRect.width / 2 : window.innerWidth / 2;
    const screenCenterY = canvasRect ? canvasRect.height / 2 : window.innerHeight / 2;
    const vp = this.graphService.viewportState();
    const centerX = (screenCenterX - vp.panX) / vp.zoom;
    const centerY = (screenCenterY - vp.panY) / vp.zoom;
    this.historyService.execute(
      new CreateGroupCommand(this.graphService, 'New Group', centerX - 160, centerY - 100)
    );
  }

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

  exportToFile(): void {
    this.exportService.exportToFile();
  }

  copyJson(): void {
    this.exportService.copyJson();
  }

  copyLink(): void {
    this.exportService.copyLink();
  }
}
