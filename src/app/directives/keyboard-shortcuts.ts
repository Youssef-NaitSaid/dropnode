import { Directive, inject, HostListener } from '@angular/core';
import { GraphService } from '../services/graph.service';
import { HistoryService } from '../services/history.service';
import { DeleteNodeCompoundCommand } from '../services/commands';

@Directive({
  selector: '[appKeyboardShortcuts]',
  standalone: true,
})
export class KeyboardShortcuts {
  private graphService = inject(GraphService);
  private historyService = inject(HistoryService);

  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    // Don't handle shortcuts when typing in an input
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
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

    // Delete/Backspace: Delete selected node
    if (event.key === 'Delete' || event.key === 'Backspace') {
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
