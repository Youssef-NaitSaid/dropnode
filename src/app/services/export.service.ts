import { Injectable, inject } from '@angular/core';
import { GraphService } from './graph.service';
import { ToastService } from '../components/toast/toast';

@Injectable({ providedIn: 'root' })
export class ExportService {
  private graphService = inject(GraphService);
  private toastService = inject(ToastService);

  private graphAsJson(): string {
    return JSON.stringify(this.graphService.exportGraph(), null, 2);
  }

  exportToFile(): void {
    const blob = new Blob([this.graphAsJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dropnode-graph.json';
    a.click();
    URL.revokeObjectURL(url);
    this.toastService.show('Graph exported to file', 'success');
  }

  private copyToClipboard(text: string, successMsg: string, errorMsg: string): Promise<void> {
    return navigator.clipboard.writeText(text).then(
      () => this.toastService.show(successMsg, 'success'),
      () => this.toastService.show(errorMsg, 'error'),
    );
  }

  copyJson(): Promise<void> {
    return this.copyToClipboard(this.graphAsJson(), 'Copied to clipboard', 'Failed to copy to clipboard');
  }

  copyLink(): Promise<void> {
    const link =
      window.location.origin +
      window.location.pathname +
      '?data=' +
      encodeURIComponent(this.graphAsJson());
    return this.copyToClipboard(link, 'Link copied to clipboard', 'Failed to copy link to clipboard');
  }
}
