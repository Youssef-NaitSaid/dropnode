import { Component, inject, OnInit, ChangeDetectionStrategy, viewChild } from '@angular/core';
import { CanvasComponent } from '../canvas/canvas';
import { ToolbarComponent } from '../toolbar/toolbar';
import { ToastComponent } from '../toast/toast';
import { ImportDialogComponent } from '../import-dialog/import-dialog';
import { SidebarComponent } from '../sidebar/sidebar';
import { UrlLoaderService } from '../../services/url-loader.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CanvasComponent, ToolbarComponent, ToastComponent, ImportDialogComponent, SidebarComponent],
  template: `
    <div class="app-frame">
      <app-sidebar />
      <div class="app-main">
        <app-toolbar (importRequested)="onImportRequested()" />
        <app-canvas />
      </div>
    </div>
    <app-toast />
    <app-import-dialog #importDialog />
  `,
  styles: [`
    :host {
      display: block;
      width: 100vw;
      height: 100vh;
      overflow: hidden;
    }
    .app-frame {
      display: flex;
      width: 100%;
      height: 100%;
    }
    .app-main {
      display: flex;
      flex-direction: column;
      flex: 1 1 auto;
      min-width: 0;
      height: 100%;
    }
    .app-main app-canvas {
      flex: 1 1 auto;
      min-height: 0;
    }
  `],
})
export class AppShellComponent implements OnInit {
  private urlLoader = inject(UrlLoaderService);
  private importDialog = viewChild<ImportDialogComponent>('importDialog');

  ngOnInit(): void {
    this.urlLoader.load();
  }

  onImportRequested(): void {
    this.importDialog()?.open();
  }
}
