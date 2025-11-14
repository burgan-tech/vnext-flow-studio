import React from 'react';
import type { State, ExecutionTask } from '@amorphie-workflow/core';

interface TaskBadgesProps {
  state: State;
  onClick?: (lane: 'onEntries' | 'onExits') => void;
}

/**
 * Validate a task and return status
 */
function getTaskStatus(task: ExecutionTask): 'valid' | 'warning' | 'error' {
  // Check if task reference is missing
  if (!task.task) {
    return 'error';
  }

  // Extract task reference - can be object with 'ref', 'key', or a string
  let ref = '';
  if (typeof task.task === 'string') {
    ref = task.task;
  } else if (typeof task.task === 'object' && task.task !== null) {
    if ('ref' in task.task && task.task.ref) {
      ref = task.task.ref;
    } else if ('key' in task.task && task.task.key) {
      ref = task.task.key;
    }
  }

  // Check if task reference is empty
  if (!ref || ref.trim() === '') {
    return 'error';
  }

  // Check if mapping exists but has no code or location
  if (task.mapping) {
    if (!task.mapping.location && !task.mapping.code) {
      return 'warning';
    }
  }

  return 'valid';
}

/**
 * Get overall status for a list of tasks
 */
function getOverallStatus(tasks: ExecutionTask[]): 'valid' | 'warning' | 'error' | 'none' {
  if (!tasks || tasks.length === 0) return 'none';

  let hasError = false;
  let hasWarning = false;

  for (const task of tasks) {
    const status = getTaskStatus(task);
    if (status === 'error') hasError = true;
    if (status === 'warning') hasWarning = true;
  }

  if (hasError) return 'error';
  if (hasWarning) return 'warning';
  return 'valid';
}

export function TaskBadges({ state, onClick }: TaskBadgesProps) {
  const onEntries = state.onEntries || [];
  const onExits = state.onExits || [];

  const entriesStatus = getOverallStatus(onEntries);
  const exitsStatus = getOverallStatus(onExits);

  // Don't show badges if no tasks
  if (entriesStatus === 'none' && exitsStatus === 'none') {
    return null;
  }

  const getStatusIcon = (status: 'valid' | 'warning' | 'error' | 'none') => {
    switch (status) {
      case 'valid':
        return '🟢';
      case 'warning':
        return '🟡';
      case 'error':
        return '🔴';
      default:
        return '';
    }
  };

  return (
    <div className="task-badges">
      {entriesStatus !== 'none' && (
        <div
          className={`task-badge task-badge--${entriesStatus}`}
          onDoubleClick={(e) => {
            e.stopPropagation();
            onClick?.('onEntries');
          }}
          title={`${onEntries.length} onEntry task${onEntries.length !== 1 ? 's' : ''} (double-click to edit)`}
        >
          <span className="task-badge__icon">{getStatusIcon(entriesStatus)}</span>
          <span className="task-badge__label">Entry: {onEntries.length}</span>
        </div>
      )}
      {exitsStatus !== 'none' && (
        <div
          className={`task-badge task-badge--${exitsStatus}`}
          onDoubleClick={(e) => {
            e.stopPropagation();
            onClick?.('onExits');
          }}
          title={`${onExits.length} onExit task${onExits.length !== 1 ? 's' : ''} (double-click to edit)`}
        >
          <span className="task-badge__icon">{getStatusIcon(exitsStatus)}</span>
          <span className="task-badge__label">Exit: {onExits.length}</span>
        </div>
      )}
    </div>
  );
}
