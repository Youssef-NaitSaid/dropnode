import { Component, signal, computed, inject, effect, ChangeDetectionStrategy, OnDestroy } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideX, lucideDownload } from '@ng-icons/lucide';
import { HlmButton } from '@spartan-ng/helm/button';
import { ExportService } from '../../services/export.service';
import { GraphService } from '../../services/graph.service';
import { ExportTheme } from '../../models/export-image';

type ExportFormat = 'png' | 'json';

const PREVIEW_DEBOUNCE_MS = 150;

/**
 * The "Export as…" dialog (issue #15): format (PNG | JSON), Export Theme
 * (dark | light, PNG only), and a live preview fed by the real snapshot
 * pipeline — what is previewed is byte-for-byte what downloads. Thin shell:
 * every decision lives in ExportService and the export-image model.
 */
@Component({
  selector: 'app-export-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon, HlmButton],
  providers: [provideIcons({ lucideX, lucideDownload })],
  template: `
    @if (isOpen()) {
      <div class="fixed inset-0 z-100 flex items-center justify-center bg-black/60 p-4" (click)="close()">
        <div
          class="w-[560px] max-w-[92vw] rounded-xl border border-border bg-card text-card-foreground p-6 shadow-2xl"
          (click)="$event.stopPropagation()"
          role="dialog"
          aria-modal="true"
          aria-label="Export as"
        >
          <div class="flex items-center justify-between mb-5">
            <h2 class="text-lg font-semibold">Export as…</h2>
            <button hlmBtn variant="ghost" size="icon-sm" (click)="close()" aria-label="Close">
              <ng-icon name="lucideX" />
            </button>
          </div>

          <div class="flex items-center gap-6 mb-4">
            <div class="flex items-center gap-2">
              <span class="text-sm text-muted-foreground">Export as</span>
              <div class="flex gap-1 rounded-lg bg-muted p-1">
                <button
                  hlmBtn
                  [variant]="format() === 'png' ? 'secondary' : 'ghost'"
                  size="sm"
                  (click)="setFormat('png')"
                >PNG</button>
                <button
                  hlmBtn
                  [variant]="format() === 'json' ? 'secondary' : 'ghost'"
                  size="sm"
                  (click)="setFormat('json')"
                >JSON</button>
              </div>
            </div>

            @if (format() === 'png') {
              <div class="flex items-center gap-2">
                <span class="text-sm text-muted-foreground">Theme</span>
                <div class="flex gap-1 rounded-lg bg-muted p-1">
                  <button
                    hlmBtn
                    [variant]="theme() === 'dark' ? 'secondary' : 'ghost'"
                    size="sm"
                    (click)="setTheme('dark')"
                  >Dark</button>
                  <button
                    hlmBtn
                    [variant]="theme() === 'light' ? 'secondary' : 'ghost'"
                    size="sm"
                    (click)="setTheme('light')"
                  >Light</button>
                </div>
              </div>
            }
          </div>

          <!-- Preview: the artifact itself, never an approximation -->
          <div class="mb-5 h-[320px] overflow-auto rounded-lg border border-border bg-background/60 p-2">
            @if (format() === 'png') {
              @if (previewUrl(); as url) {
                <img [src]="url" alt="PNG export preview" class="mx-auto max-w-full object-contain" />
              } @else if (previewError()) {
                <p class="p-4 text-sm text-destructive">{{ previewError() }}</p>
              } @else {
                <p class="p-4 text-sm text-muted-foreground">Rendering preview…</p>
              }
            } @else {
              <pre class="m-0 whitespace-pre font-mono text-xs text-muted-foreground">{{ jsonPreview() }}</pre>
            }
          </div>

          <div class="flex justify-end gap-2">
            <button hlmBtn variant="outline" (click)="close()">Cancel</button>
            <button hlmBtn (click)="download()">
              <ng-icon name="lucideDownload" />
              Download {{ format() === 'png' ? 'PNG' : 'JSON' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ExportDialogComponent implements OnDestroy {
  private exportService = inject(ExportService);
  private graphService = inject(GraphService);

  isOpen = signal(false);
  format = signal<ExportFormat>('png');
  theme = signal<ExportTheme>('dark');
  previewUrl = signal<string | null>(null);
  previewError = signal<string | null>(null);

  /** Filename context: set when opened from the open Project's Sidebar row. */
  private projectId: string | undefined;
  private debounceId: ReturnType<typeof setTimeout> | null = null;
  private renderTicket = 0;

  jsonPreview = computed(() =>
    JSON.stringify(this.graphService.exportGraph(), null, 2),
  );

  constructor() {
    // Regenerate the PNG preview (debounced) whenever the dialog is open in
    // PNG mode and the Export Theme changes.
    effect(() => {
      if (!this.isOpen() || this.format() !== 'png') return;
      const theme = this.theme();
      this.schedulePreview(theme);
    });
  }

  /** Stateless dialog: every open resets to PNG + dark (spec decision). */
  open(projectId?: string): void {
    this.projectId = projectId;
    this.format.set('png');
    this.theme.set('dark');
    this.clearPreview();
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
    this.cancelPending();
    this.clearPreview();
  }

  setFormat(format: ExportFormat): void {
    this.format.set(format);
  }

  setTheme(theme: ExportTheme): void {
    this.theme.set(theme);
  }

  download(): void {
    if (this.format() === 'json') {
      // Always the live graph — exactly what the preview showed; the
      // projectId only names the file (auto-save can lag the editor).
      this.exportService.exportToFile(this.projectId);
    } else {
      this.exportService.exportPngToFile(this.theme(), this.projectId);
    }
    this.close();
  }

  private schedulePreview(theme: ExportTheme): void {
    this.cancelPending();
    const ticket = ++this.renderTicket;
    this.debounceId = setTimeout(async () => {
      try {
        const blob = await this.exportService.renderPng(theme);
        if (ticket !== this.renderTicket) return; // superseded by a newer request
        this.replacePreviewUrl(URL.createObjectURL(blob));
        this.previewError.set(null);
      } catch {
        if (ticket !== this.renderTicket) return;
        this.replacePreviewUrl(null);
        this.previewError.set('Preview failed — the graph must be on screen');
      }
    }, PREVIEW_DEBOUNCE_MS);
  }

  private cancelPending(): void {
    if (this.debounceId !== null) {
      clearTimeout(this.debounceId);
      this.debounceId = null;
    }
    this.renderTicket++;
  }

  private replacePreviewUrl(url: string | null): void {
    const previous = this.previewUrl();
    if (previous) URL.revokeObjectURL(previous);
    this.previewUrl.set(url);
  }

  private clearPreview(): void {
    this.replacePreviewUrl(null);
    this.previewError.set(null);
  }

  ngOnDestroy(): void {
    this.cancelPending();
    this.clearPreview();
  }
}
