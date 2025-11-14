import React from 'react';
import type { ExecutionTask } from '@amorphie-workflow/core';

interface TransitionTaskBadgeProps {
  tasks: ExecutionTask[];
  onDoubleClick?: () => void;
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

export function TransitionTaskBadge({ tasks, onDoubleClick }: TransitionTaskBadgeProps) {
  const status = getOverallStatus(tasks);

  if (status === 'none') {
    return null;
  }

  return (
    <div
      className={`task-badge task-badge--${status}`}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDoubleClick?.();
      }}
      title={`${tasks.length} execution task${tasks.length !== 1 ? 's' : ''} (double-click to edit)`}
      style={{ cursor: 'pointer' }}
    >
      <span className="task-badge__icon">{getStatusIcon(status)}</span>
      <span className="task-badge__label">Tasks: {tasks.length}</span>
    </div>
  );
}
