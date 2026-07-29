import { Injectable, inject } from '@angular/core';
import { GraphService } from './graph.service';
import { ToastService } from '../components/toast/toast';

@Injectable({ providedIn: 'root' })
export class UrlLoaderService {
  private graphService = inject(GraphService);
  private toastService = inject(ToastService);

  /** Returns true when a graph was loaded from the ?data parameter. */
  load(): boolean {
    const result = this.graphService.loadFromUrlParam();
    if (result.loaded) {
      this.toastService.show('Graph loaded from URL', 'success');
    } else if (result.error) {
      this.toastService.show('URL data invalid: ' + result.error, 'error');
    }
    return result.loaded;
  }
}
