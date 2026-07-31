import { Component, inject, ChangeDetectionStrategy, input } from '@angular/core';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideUndo2,
  lucideRedo2,
  lucideZoomIn,
  lucideZoomOut,
  lucideScan,
  lucideMaximize,
  lucideGroup,
  lucideUpload,
  lucideDownload,
  lucideFileDown,
  lucideCopy,
  lucideLink,
  lucideCloud,
  lucideFolderPlus,
  lucideMinus,
  lucideArrowRight,
  lucidePlay,
} from '@ng-icons/lucide';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmSeparator } from '@spartan-ng/helm/separator';
import {
  HlmDropdownMenu,
  HlmDropdownMenuTrigger,
  HlmDropdownMenuItem,
  HlmDropdownMenuLabel,
} from '@spartan-ng/helm/dropdown-menu';
import { GraphService } from '../../services/graph.service';
import { HistoryService } from '../../services/history.service';
import { ExportService } from '../../services/export.service';
import { CollectionService } from '../../services/collection.service';
import { ImportDialogService } from '../../services/import-dialog.service';
import { ExportDialogService } from '../../services/export-dialog.service';
import {
  CreateGroupCommand,
  buildSetNodesColorCommand,
  buildSetConnectionsColorCommand,
  buildSetConnectionsArrowheadCommand,
} from '../../services/commands';
import { NODE_PALETTE } from '../../models/node';
import { ArrowheadType, ArrowheadEnd, effectiveArrowhead } from '../../models/connection';

@Component({
  selector: 'app-toolbar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon, HlmButton, HlmSeparator, HlmDropdownMenu, HlmDropdownMenuTrigger, HlmDropdownMenuItem, HlmDropdownMenuLabel],
  providers: [
    provideIcons({
      lucideUndo2,
      lucideRedo2,
      lucideZoomIn,
      lucideZoomOut,
      lucideScan,
      lucideMaximize,
      lucideGroup,
      lucideUpload,
      lucideDownload,
      lucideFileDown,
      lucideCopy,
      lucideLink,
      lucideCloud,
      lucideFolderPlus,
      lucideMinus,
      lucideArrowRight,
      lucidePlay,
    }),
  ],
  template: `
    <div class="flex items-center justify-between gap-2 px-4 py-1.5 bg-card border-b border-border">
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium text-muted-foreground">{{ graphService.nodeCount() }} nodes</span>
      </div>

      <div class="flex items-center gap-1">
        <button hlmBtn variant="ghost" size="icon" (click)="undo()" [disabled]="!historyService.canUndo()" title="Undo (Ctrl+Z)" aria-label="Undo">
          <ng-icon name="lucideUndo2" />
        </button>
        <button hlmBtn variant="ghost" size="icon" (click)="redo()" [disabled]="!historyService.canRedo()" title="Redo (Ctrl+Shift+Z)" aria-label="Redo">
          <ng-icon name="lucideRedo2" />
        </button>
        @if (graphService.selectedNodes().length > 0) {
          <hlm-separator orientation="vertical" class="mx-1" />
          <div class="flex items-center gap-1.5" title="Background color">
            <button
              class="swatch swatch-default"
              [class.active]="sharedNodeColor() === null"
              title="Default"
              aria-label="Default color"
              (click)="setColor(null)"
            ></button>
            @for (color of palette; track color) {
              <button
                class="swatch"
                [class.active]="sharedNodeColor() === color"
                [style.background]="color"
                [title]="color"
                [attr.aria-label]="color"
                (click)="setColor(color)"
              ></button>
            }
          </div>
        }
        @if (graphService.selectedConnections().length > 0) {
          <hlm-separator orientation="vertical" class="mx-1" />
          <div class="flex items-center gap-1.5" title="Connection color">
            <button
              class="swatch swatch-default"
              [class.active]="sharedConnectionColor() === null"
              title="Default"
              aria-label="Default color"
              (click)="setConnectionColor(null)"
            ></button>
            @for (color of palette; track color) {
              <button
                class="swatch"
                [class.active]="sharedConnectionColor() === color"
                [style.background]="color"
                [title]="color"
                [attr.aria-label]="color"
                (click)="setConnectionColor(color)"
              ></button>
            }
          </div>
          <hlm-separator orientation="vertical" class="mx-1" />
          <div class="flex items-center gap-0.5" title="Start arrowhead (source end)" aria-label="Start arrowhead">
            @for (opt of arrowheadOptions; track opt.type) {
              <button
                class="ah-btn"
                [class.active]="sharedArrowhead('start') === opt.type"
                [title]="opt.label"
                [attr.aria-label]="'Start ' + opt.label"
                (click)="setArrowhead('start', opt.type)"
              >
                <ng-icon [name]="opt.icon" class="flip-x" />
              </button>
            }
          </div>
          <div class="flex items-center gap-0.5" title="End arrowhead (target end)" aria-label="End arrowhead">
            @for (opt of arrowheadOptions; track opt.type) {
              <button
                class="ah-btn"
                [class.active]="sharedArrowhead('end') === opt.type"
                [title]="opt.label"
                [attr.aria-label]="'End ' + opt.label"
                (click)="setArrowhead('end', opt.type)"
              >
                <ng-icon [name]="opt.icon" />
              </button>
            }
          </div>
        }
      </div>

      <div class="flex items-center gap-1">
        <button hlmBtn variant="ghost" size="icon" (click)="zoomIn()" title="Zoom In" aria-label="Zoom in">
          <ng-icon name="lucideZoomIn" />
        </button>
        <button hlmBtn variant="ghost" size="icon" (click)="zoomOut()" title="Zoom Out" aria-label="Zoom out">
          <ng-icon name="lucideZoomOut" />
        </button>
        <button hlmBtn variant="ghost" size="icon" (click)="resetView()" title="Reset View" aria-label="Reset view">
          <ng-icon name="lucideScan" />
        </button>
        <button hlmBtn variant="ghost" size="icon" (click)="zoomToFit()" title="Zoom to Fit" aria-label="Zoom to fit">
          <ng-icon name="lucideMaximize" />
        </button>
        <span class="min-w-10 text-center text-sm font-medium text-muted-foreground">{{ zoomPercent() }}%</span>
        <hlm-separator orientation="vertical" class="mx-1" />
        <button hlmBtn variant="ghost" size="icon" (click)="addGroup()" title="Add Group" aria-label="Add group">
          <ng-icon name="lucideGroup" />
        </button>
        @if (scratchMode()) {
          <button hlmBtn variant="ghost" size="icon" (click)="openImport()" title="Import" aria-label="Import">
            <ng-icon name="lucideUpload" />
          </button>
          <button hlmBtn variant="ghost" size="icon" [hlmDropdownMenuTrigger]="exportMenu" title="Export" aria-label="Export">
            <ng-icon name="lucideDownload" />
          </button>
          <button
            hlmBtn
            variant="ghost"
            size="icon"
            [hlmDropdownMenuTrigger]="saveAsProjectMenu"
            [disabled]="collectionService.collections().length === 0"
            [title]="collectionService.collections().length === 0 ? 'Create a collection first' : 'Save as project'"
            aria-label="Save as project"
          >
            <ng-icon name="lucideFolderPlus" />
          </button>
        }
      </div>
    </div>

    <ng-template #exportMenu>
      <div hlmDropdownMenu class="w-56">
        <button hlmDropdownMenuItem (triggered)="openExportDialog()">
          <ng-icon name="lucideFileDown" />
          <span>Export as…</span>
        </button>
        <button hlmDropdownMenuItem (triggered)="copyJson()">
          <ng-icon name="lucideCopy" />
          <span>Copy JSON</span>
        </button>
        <button hlmDropdownMenuItem (triggered)="copyLink()">
          <ng-icon name="lucideLink" />
          <span>Copy link</span>
        </button>
        <button hlmDropdownMenuItem disabled>
          <ng-icon name="lucideCloud" />
          <span class="flex flex-col">
            <span>Export to Drive</span>
            <span class="text-xs text-muted-foreground">Sign in required — coming soon</span>
          </span>
        </button>
      </div>
    </ng-template>

    <ng-template #saveAsProjectMenu>
      <div hlmDropdownMenu class="w-56">
        <div hlmDropdownMenuLabel>Save to collection</div>
        @for (collection of collectionService.collections(); track collection.id) {
          <button hlmDropdownMenuItem (triggered)="saveAsProject(collection.id)">
            <span class="truncate">{{ collection.name }}</span>
          </button>
        }
      </div>
    </ng-template>
  `,
  styles: [`
    :host {
      display: block;
    }
    .swatch {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      border: 2px solid var(--border);
      padding: 0;
      cursor: pointer;
      transition: transform 0.15s ease, border-color 0.15s ease;
    }
    .swatch:hover {
      transform: scale(1.2);
    }
    .swatch.active {
      border-color: var(--primary);
      box-shadow: 0 0 0 2px color-mix(in oklch, var(--primary) 30%, transparent);
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
      border: 1px dashed var(--muted-foreground);
    }
    .ah-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 26px;
      height: 26px;
      border-radius: 6px;
      border: 1px solid transparent;
      background: transparent;
      color: var(--muted-foreground);
      cursor: pointer;
      transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
    }
    .ah-btn:hover {
      color: var(--foreground);
      background: var(--accent);
    }
    .ah-btn.active {
      color: var(--primary);
      border-color: var(--primary);
      background: color-mix(in oklch, var(--primary) 15%, transparent);
    }
    .flip-x {
      transform: scaleX(-1);
    }
  `],
})
export class ToolbarComponent {
  graphService = inject(GraphService);
  historyService = inject(HistoryService);
  collectionService = inject(CollectionService);
  private exportService = inject(ExportService);
  private importDialogService = inject(ImportDialogService);
  private exportDialogService = inject(ExportDialogService);
  private router = inject(Router);

  /** True on `/` — Import/Export/Save-as-project only exist for the Scratch Canvas. */
  scratchMode = input<boolean>(false);

  palette = NODE_PALETTE;

  // Start icons are the same glyphs flipped horizontally (see .flip-x) so they
  // point backward along the curve, teaching the source→target direction.
  arrowheadOptions: { type: ArrowheadType; icon: string; label: string }[] = [
    { type: 'none', icon: 'lucideMinus', label: 'None' },
    { type: 'arrow', icon: 'lucideArrowRight', label: 'Arrow' },
    { type: 'triangle', icon: 'lucidePlay', label: 'Triangle' },
  ];

  // Re-exposed for the template's active-state checks
  effectiveArrowhead = effectiveArrowhead;

  zoomPercent = () => Math.round(this.graphService.viewportState().zoom * 100);

  // A styling control reads as active only when ALL its targets share the
  // value (ADR-0015); undefined means a mixed set — nothing highlights.
  sharedNodeColor = (): string | null | undefined => {
    const nodes = this.graphService.selectedNodes();
    if (nodes.length === 0) return undefined;
    const first = nodes[0].color ?? null;
    return nodes.every(n => (n.color ?? null) === first) ? first : undefined;
  };

  sharedConnectionColor = (): string | null | undefined => {
    const conns = this.graphService.selectedConnections();
    if (conns.length === 0) return undefined;
    const first = conns[0].color ?? null;
    return conns.every(c => (c.color ?? null) === first) ? first : undefined;
  };

  sharedArrowhead = (end: ArrowheadEnd): ArrowheadType | undefined => {
    const conns = this.graphService.selectedConnections();
    if (conns.length === 0) return undefined;
    const first = effectiveArrowhead(conns[0], end);
    return conns.every(c => effectiveArrowhead(c, end) === first) ? first : undefined;
  };

  // Bulk styling (ADR-0015): one compound Command over all selected targets;
  // the factories return null when nothing would change — no dead undo steps.
  setColor(color: string | null): void {
    const cmd = buildSetNodesColorCommand(
      this.graphService, this.graphService.selectedNodeIds(), color,
    );
    if (cmd) this.historyService.execute(cmd);
  }

  setConnectionColor(color: string | null): void {
    const cmd = buildSetConnectionsColorCommand(
      this.graphService, this.graphService.selectedConnectionIds(), color,
    );
    if (cmd) this.historyService.execute(cmd);
  }

  setArrowhead(end: ArrowheadEnd, type: ArrowheadType): void {
    const cmd = buildSetConnectionsArrowheadCommand(
      this.graphService, this.graphService.selectedConnectionIds(), end, type,
    );
    if (cmd) this.historyService.execute(cmd);
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

  // Frame the whole graph. Measures the visible canvas region from the canvas
  // container (the toolbar overlaps the window top, so the window is wrong).
  zoomToFit(): void {
    const rect = document.querySelector('.canvas-container')?.getBoundingClientRect();
    if (!rect) return;
    this.graphService.zoomToFit(rect.width, rect.height);
  }

  undo(): void {
    this.historyService.undo();
  }

  redo(): void {
    this.historyService.redo();
  }

  openImport(): void {
    this.importDialogService.requestOpen();
  }

  /** Keep the scratch graph as a Project in the chosen Collection. */
  saveAsProject(collectionId: string): void {
    const project = this.collectionService.saveScratchAsProject(
      collectionId,
      this.graphService.exportGraph(),
    );
    this.router.navigate(['/p', project.id]);
  }

  /** File downloads (JSON and PNG) go through the "Export as…" dialog. */
  openExportDialog(): void {
    this.exportDialogService.requestOpen();
  }

  copyJson(): void {
    this.exportService.copyJson();
  }

  copyLink(): void {
    this.exportService.copyLink();
  }
}
