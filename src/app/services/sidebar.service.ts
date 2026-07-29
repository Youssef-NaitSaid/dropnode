import { Injectable, signal, type Signal } from '@angular/core';

/** Namespaced key — dropnode's only use of browser storage. */
export const SIDEBAR_STORAGE_KEY = 'dropnode:sidebar-collapsed';

/**
 * Owns the Sidebar's collapsed/expanded state and persists it to localStorage.
 * This is a transient UI preference, deliberately kept out of Graph State and
 * History — toggling it is never an undoable Command.
 */
@Injectable({ providedIn: 'root' })
export class SidebarService {
  private readonly _collapsed = signal<boolean>(this.readStoredState());

  /** True when the Sidebar is collapsed to the icon rail. Defaults to expanded. */
  readonly collapsed: Signal<boolean> = this._collapsed.asReadonly();

  toggle(): void {
    this.setCollapsed(!this._collapsed());
  }

  setCollapsed(collapsed: boolean): void {
    this._collapsed.set(collapsed);
    this.persist(collapsed);
  }

  /** Read the stored preference; any missing or malformed value means expanded. */
  private readStoredState(): boolean {
    try {
      const raw = localStorage.getItem(SIDEBAR_STORAGE_KEY);
      if (raw === 'true') return true;
      if (raw === 'false') return false;
      return false;
    } catch {
      return false;
    }
  }

  private persist(collapsed: boolean): void {
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed));
    } catch {
      // Storage unavailable (private mode / SSR) — state still works in-memory.
    }
  }
}
