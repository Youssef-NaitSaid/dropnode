import { Injectable, signal, type Signal } from '@angular/core';

/**
 * Cross-component glue for the single import dialog hosted in the app shell.
 * Both the toolbar (Scratch Canvas) and the Sidebar (Project rows) request
 * opening through this service; the shell reacts to the counter.
 */
@Injectable({ providedIn: 'root' })
export class ImportDialogService {
  private readonly _openRequests = signal(0);

  /** Monotonic counter; each increment is one open request. */
  readonly openRequests: Signal<number> = this._openRequests.asReadonly();

  requestOpen(): void {
    this._openRequests.update(n => n + 1);
  }
}
