/**
 * Types for undo/redo history management
 */

export interface HistoryEntry {
  /** Unique identifier for this history entry */
  id: string;
  /** Unix timestamp when this entry was created */
  timestamp: number;
  /** Category of action that created this entry */
  type: HistoryActionType;
  /** Human-readable description of the action */
  description: string;
  /** JSON string of the Workflow before the action */
  workflowSnapshot: string;
}

export type HistoryActionType =
  | 'state:add'
  | 'state:remove'
  | 'state:update'
  | 'transition:add'
  | 'transition:remove'
  | 'transition:update'
  | 'transition:shared'
  | 'workflow:start'
  | 'workflow:cancel'
  | 'workflow:settings'
  | 'batch';

export interface HistoryState {
  /** Stack of entries that can be undone */
  undoStack: HistoryEntry[];
  /** Stack of entries that can be redone */
  redoStack: HistoryEntry[];
  /** Maximum number of entries to keep (default: 50) */
  maxEntries: number;
}
