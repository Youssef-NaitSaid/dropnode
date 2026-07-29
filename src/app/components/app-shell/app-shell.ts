import { Component, inject, ChangeDetectionStrategy, viewChild, effect } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastComponent } from '../toast/toast';
import { ImportDialogComponent } from '../import-dialog/import-dialog';
import { SidebarComponent } from '../sidebar/sidebar';
import { ImportDialogService } from '../../services/import-dialog.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, ToastComponent, ImportDialogComponent, SidebarComponent],
  template: `
    <div class="app-frame">
      <app-sidebar />
      <div class="app-main">
        <router-outlet />
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
  `],
})
export class AppShellComponent {
  private importDialogService = inject(ImportDialogService);
  private importDialog = viewChild<ImportDialogComponent>('importDialog');

  constructor() {
    // The toolbar (Scratch Canvas) and Sidebar Project rows both request the
    // import dialog through the service; the shell owns the single instance.
    effect(() => {
      if (this.importDialogService.openRequests() > 0) {
        this.importDialog()?.open();
      }
    });
  }
}
