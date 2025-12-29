import type { Workflow, HistoryEntry, HistoryActionType } from '@amorphie-flow-studio/core';

/**
 * Manages undo/redo history for workflow changes.
 *
 * Uses two stacks:
 * - undoStack: entries that can be undone (most recent at end)
 * - redoStack: entries that can be redone (most recent at end)
 *
 * When a new action is performed:
 * 1. Current state is pushed to undoStack
 * 2. redoStack is cleared
 *
 * When undo is performed:
 * 1. Pop from undoStack, push current state to redoStack
 * 2. Return the popped state to restore
 *
 * When redo is performed:
 * 1. Pop from redoStack, push current state to undoStack
 * 2. Return the popped state to restore
 */
export class HistoryManager {
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  private maxEntries: number;

  constructor(maxEntries: number = 50) {
    this.maxEntries = maxEntries;
  }

  /**
   * Generate a unique ID for history entries
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Push the current workflow state before a mutation.
   * Call this BEFORE making changes to capture the "before" state.
   *
   * @param type - Category of the action
   * @param description - Human-readable description
   * @param workflow - Current workflow state (will be snapshotted)
   */
  pushState(type: HistoryActionType, description: string, workflow: Workflow): void {
    const entry: HistoryEntry = {
      id: this.generateId(),
      timestamp: Date.now(),
      type,
      description,
      workflowSnapshot: JSON.stringify(workflow),
    };

    this.undoStack.push(entry);

    // Clear redo stack when new action is performed
    this.redoStack = [];

    // Prune old entries if over limit
    while (this.undoStack.length > this.maxEntries) {
      this.undoStack.shift();
    }
  }

  /**
   * Undo the last action.
   *
   * @param currentWorkflow - The current workflow state to save for redo
   * @returns The workflow to restore, or null if nothing to undo
   */
  undo(currentWorkflow: Workflow): Workflow | null {
    const entry = this.undoStack.pop();
    if (!entry) {
      return null;
    }

    // Push current state to redo stack
    const redoEntry: HistoryEntry = {
      id: this.generateId(),
      timestamp: Date.now(),
      type: entry.type,
      description: entry.description,
      workflowSnapshot: JSON.stringify(currentWorkflow),
    };
    this.redoStack.push(redoEntry);

    // Return the previous state
    return JSON.parse(entry.workflowSnapshot) as Workflow;
  }

  /**
   * Redo the last undone action.
   *
   * @param currentWorkflow - The current workflow state to save for undo
   * @returns The workflow to restore, or null if nothing to redo
   */
  redo(currentWorkflow: Workflow): Workflow | null {
    const entry = this.redoStack.pop();
    if (!entry) {
      return null;
    }

    // Push current state to undo stack
    const undoEntry: HistoryEntry = {
      id: this.generateId(),
      timestamp: Date.now(),
      type: entry.type,
      description: entry.description,
      workflowSnapshot: JSON.stringify(currentWorkflow),
    };
    this.undoStack.push(undoEntry);

    // Return the redo state
    return JSON.parse(entry.workflowSnapshot) as Workflow;
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * Get description of the action that would be undone
   */
  getUndoDescription(): string | undefined {
    const entry = this.undoStack[this.undoStack.length - 1];
    return entry?.description;
  }

  /**
   * Get description of the action that would be redone
   */
  getRedoDescription(): string | undefined {
    const entry = this.redoStack[this.redoStack.length - 1];
    return entry?.description;
  }

  /**
   * Clear all history (e.g., when file is reloaded from disk)
   */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  /**
   * Get the current history state for debugging
   */
  getState(): { undoCount: number; redoCount: number } {
    return {
      undoCount: this.undoStack.length,
      redoCount: this.redoStack.length,
    };
  }
}
