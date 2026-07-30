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
