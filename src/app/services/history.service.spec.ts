import { TestBed } from '@angular/core/testing';
import { HistoryService } from './history.service';
import { Command } from '../models/command';

describe('HistoryService', () => {
  let service: HistoryService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(HistoryService);
  });

  const createMockCommand = (executeFn?: () => void, undoFn?: () => void): Command => ({
    description: 'Mock Command',
    execute: executeFn || (() => {}),
    undo: undoFn || (() => {}),
  });

  describe('execute', () => {
    it('adds command to undo stack', () => {
      const cmd = createMockCommand();
      service.execute(cmd);

      expect(service.canUndo()).toBe(true);
    });

    it('calls command.execute()', () => {
      let executed = false;
      const cmd = createMockCommand(() => { executed = true; });

      service.execute(cmd);
      expect(executed).toBe(true);
    });

    it('clears redo stack', () => {
      const cmd1 = createMockCommand();
      const cmd2 = createMockCommand();

      service.execute(cmd1);
      service.undo();
      expect(service.canRedo()).toBe(true);

      service.execute(cmd2);
      expect(service.canRedo()).toBe(false);
    });
  });

  describe('undo', () => {
    it('pops from undo stack and calls command.undo()', () => {
      let undone = false;
      const cmd = createMockCommand(() => {}, () => { undone = true; });

      service.execute(cmd);
      service.undo();

      expect(undone).toBe(true);
      expect(service.canUndo()).toBe(false);
    });

    it('pushes to redo stack', () => {
      const cmd = createMockCommand();
      service.execute(cmd);

      expect(service.canRedo()).toBe(false);
      service.undo();
      expect(service.canRedo()).toBe(true);
    });

    it('does nothing on empty stack', () => {
      expect(() => service.undo()).not.toThrow();
      expect(service.canUndo()).toBe(false);
      expect(service.canRedo()).toBe(false);
    });
  });

  describe('redo', () => {
    it('pops from redo stack and calls command.execute()', () => {
      let executeCount = 0;
      const cmd = createMockCommand(() => { executeCount++; });

      service.execute(cmd);
      expect(executeCount).toBe(1);

      service.undo();
      expect(executeCount).toBe(1);

      service.redo();
      expect(executeCount).toBe(2);
    });

    it('pushes to undo stack', () => {
      const cmd = createMockCommand();
      service.execute(cmd);
      service.undo();

      expect(service.canUndo()).toBe(false);
      service.redo();
      expect(service.canUndo()).toBe(true);
    });

    it('does nothing on empty stack', () => {
      expect(() => service.redo()).not.toThrow();
      expect(service.canUndo()).toBe(false);
      expect(service.canRedo()).toBe(false);
    });
  });

  describe('canUndo / canRedo signals', () => {
    it('update correctly after execute', () => {
      expect(service.canUndo()).toBe(false);
      expect(service.canRedo()).toBe(false);

      const cmd = createMockCommand();
      service.execute(cmd);

      expect(service.canUndo()).toBe(true);
      expect(service.canRedo()).toBe(false);
    });

    it('update correctly after undo', () => {
      const cmd = createMockCommand();
      service.execute(cmd);

      service.undo();
      expect(service.canUndo()).toBe(false);
      expect(service.canRedo()).toBe(true);
    });

    it('update correctly after redo', () => {
      const cmd = createMockCommand();
      service.execute(cmd);
      service.undo();

      service.redo();
      expect(service.canUndo()).toBe(true);
      expect(service.canRedo()).toBe(false);
    });

    it('handles multiple commands', () => {
      const cmd1 = createMockCommand();
      const cmd2 = createMockCommand();

      service.execute(cmd1);
      expect(service.canUndo()).toBe(true);

      service.execute(cmd2);
      expect(service.canUndo()).toBe(true);

      service.undo();
      expect(service.canUndo()).toBe(true);
      expect(service.canRedo()).toBe(true);

      service.undo();
      expect(service.canUndo()).toBe(false);
      expect(service.canRedo()).toBe(true);
    });
  });

  describe('pushWithoutExecute', () => {
    it('pushes command to undo stack without calling execute()', () => {
      let executed = false;
      const cmd = createMockCommand(() => { executed = true; });

      service.pushWithoutExecute(cmd);

      expect(executed).toBe(false);
      expect(service.canUndo()).toBe(true);
    });

    it('clears the redo stack', () => {
      const cmd1 = createMockCommand();
      const cmd2 = createMockCommand();

      service.execute(cmd1);
      service.undo();
      expect(service.canRedo()).toBe(true);

      service.pushWithoutExecute(cmd2);
      expect(service.canRedo()).toBe(false);
    });

    it('makes canUndo true and canRedo false', () => {
      expect(service.canUndo()).toBe(false);
      expect(service.canRedo()).toBe(false);

      const cmd = createMockCommand();
      service.pushWithoutExecute(cmd);

      expect(service.canUndo()).toBe(true);
      expect(service.canRedo()).toBe(false);
    });
  });

  describe('clear', () => {
    it('empties both stacks', () => {
      const cmd1 = createMockCommand();
      const cmd2 = createMockCommand();

      service.execute(cmd1);
      service.execute(cmd2);
      service.undo();

      expect(service.canUndo()).toBe(true);
      expect(service.canRedo()).toBe(true);

      service.clear();

      expect(service.canUndo()).toBe(false);
      expect(service.canRedo()).toBe(false);
    });
  });
});
