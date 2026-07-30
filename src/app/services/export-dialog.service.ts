import { Injectable, signal, type Signal } from '@angular/core';

/**
 * Cross-component glue for the single "Export as…" dialog hosted in the app
 * shell. The toolbar (Scratch Canvas) and the Sidebar row of the currently
 * open Project request opening through this service; a projectId names the
 * downloaded file after the Project (the snapshot is always the on-screen graph).
 */
@Injectable({ providedIn: 'root' })
export class ExportDialogService {
  private readonly _openRequests = signal(0);
  private readonly _projectId = signal<string | undefined>(undefined);

  /** Monotonic counter; each increment is one open request. */
  readonly openRequests: Signal<number> = this._openRequests.asReadonly();
  /** The Project the current request came from, if any. */
  readonly projectId: Signal<string | undefined> = this._projectId.asReadonly();

  requestOpen(projectId?: string): void {
    this._projectId.set(projectId);
    this._openRequests.update(n => n + 1);
  }
}
