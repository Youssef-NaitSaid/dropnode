import { Directive, inject, HostListener } from '@angular/core';
import { GraphService } from '../services/graph.service';
import { HistoryService } from '../services/history.service';
import { SidebarService } from '../services/sidebar.service';
import { ClipboardService } from '../services/clipboard.service';
import { DeleteConnectionCommand, DeleteNodeCompoundCommand } from '../services/commands';

@Directive({
  selector: '[appKeyboardShortcuts]',
  standalone: true,
})
export class KeyboardShortcuts {
  private graphService = inject(GraphService);
  private historyService = inject(HistoryService);
  private sidebarService = inject(SidebarService);
  private clipboardService = inject(ClipboardService);

  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    // Don't handle shortcuts when typing in an input
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    // Ctrl+B: Toggle the Sidebar (a UI preference — never touches History)
    if (event.ctrlKey && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'b') {
      event.preventDefault();
      this.sidebarService.toggle();
      return;
    }

    // Ctrl+Shift+Z: Redo (check before Ctrl+Z)
    if (event.ctrlKey && event.shiftKey && event.key === 'Z') {
      event.preventDefault();
      this.historyService.redo();
      return;
    }

    // Ctrl+Z: Undo
    if (event.ctrlKey && event.key === 'z') {
      event.preventDefault();
      this.historyService.undo();
      return;
    }

    // Clipboard shortcuts apply to the selected Node or Group only; no
    // selection (or an empty Clipboard for paste) is a silent no-op
    if (event.ctrlKey && !event.shiftKey && !event.altKey) {
      const key = event.key.toLowerCase();
      const selectedId = this.graphService.selectedNodeId();

      // Ctrl+X: Cut the selected Node or Group
      if (key === 'x') {
        if (selectedId) {
          event.preventDefault();
          this.clipboardService.cut(selectedId);
        }
        return;
      }

      // Ctrl+C: Copy the selected Node or Group (never touches History)
      if (key === 'c') {
        if (selectedId) {
          event.preventDefault();
          this.clipboardService.copy(selectedId);
        }
        return;
      }

      // Ctrl+V: Paste at the cursor, cascading on repeat pastes
      if (key === 'v') {
        event.preventDefault();
        this.clipboardService.pasteAtCursor();
        return;
      }

      // Ctrl+D: Duplicate the selected Node or Group (Clipboard untouched);
      // preventDefault suppresses the browser's bookmark dialog
      if (key === 'd') {
        event.preventDefault();
        if (selectedId) {
          this.clipboardService.duplicate(selectedId);
        }
        return;
      }
    }

    // Shift+1 / Shift+2: frame the whole graph / the current selection in the
    // Viewport. Keyed off event.code (not event.key) so the shifted glyph and
    // keyboard layout don't matter. Pure Viewport change — no History entry.
    if (event.shiftKey && !event.ctrlKey && !event.altKey && (event.code === 'Digit1' || event.code === 'Digit2')) {
      const rect = document.querySelector('.canvas-container')?.getBoundingClientRect();
      if (!rect) return;
      event.preventDefault();
      if (event.code === 'Digit1') {
        this.graphService.zoomToFit(rect.width, rect.height);
      } else {
        this.graphService.zoomToSelection(rect.width, rect.height);
      }
      return;
    }

    // Delete/Backspace: delete whichever single element is selected
    if (event.key === 'Delete' || event.key === 'Backspace') {
      const selectedConnectionId = this.graphService.selectedConnectionId();
      if (selectedConnectionId) {
        event.preventDefault();
        const cmd = new DeleteConnectionCommand(this.graphService, selectedConnectionId);
        this.historyService.execute(cmd);
        return;
      }
      const selectedId = this.graphService.selectedNodeId();
      if (selectedId) {
        event.preventDefault();
        const cmd = new DeleteNodeCompoundCommand(this.graphService, selectedId);
        this.historyService.execute(cmd);
      }
      return;
    }

    // Escape: Deselect
    if (event.key === 'Escape') {
      this.graphService.selectNode(null);
      (document.activeElement as HTMLElement)?.blur();
      return;
    }
  }
}
