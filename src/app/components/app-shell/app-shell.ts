import { Component, inject, OnInit, ChangeDetectionStrategy, viewChild } from '@angular/core';
import { CanvasComponent } from '../canvas/canvas';
import { ToolbarComponent } from '../toolbar/toolbar';
import { ToastComponent } from '../toast/toast';
import { ImportDialogComponent } from '../import-dialog/import-dialog';
import { UrlLoaderService } from '../../services/url-loader.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CanvasComponent, ToolbarComponent, ToastComponent, ImportDialogComponent],
  template: `
    <app-toolbar (importRequested)="onImportRequested()" />
    <app-canvas />
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
