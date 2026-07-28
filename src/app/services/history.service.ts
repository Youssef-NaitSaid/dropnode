import { Injectable, signal } from '@angular/core';
import { Command } from '../models/command';

@Injectable({ providedIn: 'root' })
export class HistoryService {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];

  readonly canUndo = signal(false);
  readonly canRedo = signal(false);

  execute(command: Command): void {
    command.execute();
    this.undoStack.push(command);
    this.redoStack = [];
    this.updateSignals();
  }

  undo(): void {
    const command = this.undoStack.pop();
    if (!command) return;
    command.undo();
    this.redoStack.push(command);
    this.updateSignals();
  }

  redo(): void {
    const command = this.redoStack.pop();
    if (!command) return;
    command.execute();
    this.undoStack.push(command);
    this.updateSignals();
  }

  pushWithoutExecute(command: Command): void {
    this.undoStack.push(command);
    this.redoStack = [];
    this.updateSignals();
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.updateSignals();
  }

  private updateSignals(): void {
    this.canUndo.set(this.undoStack.length > 0);
    this.canRedo.set(this.redoStack.length > 0);
  }
}
