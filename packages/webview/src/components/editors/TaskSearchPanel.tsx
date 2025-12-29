import React, { useState, useMemo } from 'react';
import type { TaskComponentDefinition } from '@amorphie-workflow/core';
import { useBridge } from '../../hooks/useBridge';

interface TaskSelection {
  key: string;
  domain?: string;
  flow?: string;
  version?: string;
}

interface TaskSearchPanelProps {
  availableTasks: TaskComponentDefinition[];
  selectedTaskRef: string;
  onSelectTask: (taskRef: string, taskData?: TaskSelection) => void;
  onCreateNewTask?: () => void;
}

export function TaskSearchPanel({
  availableTasks,
  selectedTaskRef,
  onSelectTask,
  onCreateNewTask,
}: TaskSearchPanelProps) {
  console.log('[TaskSearchPanel] Component rendering');
  const { postMessage } = useBridge();
  console.log('[TaskSearchPanel] useBridge postMessage type:', typeof postMessage);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Filter tasks based on search query
  const filteredTasks = useMemo(() => {
    if (!searchQuery) return availableTasks;

    const query = searchQuery.toLowerCase();
    return availableTasks.filter(task => {
      const key = task.key?.toLowerCase() || '';
      const domain = task.domain?.toLowerCase() || '';
      const flow = task.flow?.toLowerCase() || '';
      const description = task.attributes?.description?.toLowerCase() || '';
      const version = task.version?.toLowerCase() || '';

      return (
        key.includes(query) ||
        domain.includes(query) ||
        flow.includes(query) ||
        description.includes(query) ||
        version.includes(query)
      );
    });
  }, [availableTasks, searchQuery]);

  // Format task reference (domain/flow/key@version or just key)
  const formatTaskRef = (task: TaskComponentDefinition): string => {
    if (task.domain && task.version) {
      const flow = task.flow || 'sys-tasks';
      return `${task.domain}/${flow}/${task.key}@${task.version}`;
    }
    return task.key || '';
  };

  // Get display name for selected task
  const selectedTaskDisplay = useMemo(() => {
    if (!selectedTaskRef) return '';

    // Try to find the task in available tasks
    const task = availableTasks.find(t => {
      const fullRef = formatTaskRef(t);
      return fullRef === selectedTaskRef || t.key === selectedTaskRef;
    });

    if (task) {
      return task.key || selectedTaskRef;
    }

    return selectedTaskRef;
  }, [selectedTaskRef, availableTasks]);

  const handleSelectTask = (task: TaskComponentDefinition) => {
    const ref = formatTaskRef(task);
    // Pass both the display ref and the structured task data
    onSelectTask(ref, {
      key: task.key,
      domain: task.domain,
      flow: task.flow || 'sys-tasks',
      version: task.version
    });
    setIsDropdownOpen(false);
    setSearchQuery('');
  };

  const handleOpenTask = () => {
    console.log('[TaskSearchPanel] handleOpenTask called, selectedTaskRef:', selectedTaskRef);

    if (!selectedTaskRef) {
      console.log('[TaskSearchPanel] No selectedTaskRef, returning early');
      return;
    }

    // Find the task in available tasks to get complete info
    const task = availableTasks.find(t => {
      const fullRef = formatTaskRef(t);
      return fullRef === selectedTaskRef || t.key === selectedTaskRef;
    });

    console.log('[TaskSearchPanel] Found task:', task);

    if (task) {
      // Send complete task reference info
      const message = {
        type: 'task:open',
        taskRef: selectedTaskRef,
        domain: task.domain,
        flow: task.flow || 'sys-tasks',
        key: task.key,
        version: task.version || '1.0.0'
      };
      console.log('[TaskSearchPanel] Sending task:open message:', message);
      postMessage(message);
    } else {
      // Fallback: send just the ref string
      const message = {
        type: 'task:open',
        taskRef: selectedTaskRef
      };
      console.log('[TaskSearchPanel] Sending task:open message (fallback):', message);
      postMessage(message);
    }
  };

  return (
    <div className="task-search-panel">
      <label className="task-search-panel__label">
        Task Reference
        <span className="task-search-panel__required">*</span>
      </label>

      <div className="task-search-panel__input-container">
        <input
          type="text"
          className="task-search-panel__input"
          value={isDropdownOpen ? searchQuery : selectedTaskDisplay}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setIsDropdownOpen(true)}
          onBlur={() => {
            // Delay to allow click on dropdown items
            setTimeout(() => setIsDropdownOpen(false), 200);
          }}
          placeholder="Search tasks..."
        />
        {selectedTaskRef && !isDropdownOpen && (
          <button
            type="button"
            className="task-search-panel__view-btn"
            onClick={handleOpenTask}
            title="View task definition"
          >
            →
          </button>
        )}

        {isDropdownOpen && (
          <div className="task-search-panel__dropdown">
            {onCreateNewTask && (
              <>
                <button
                  type="button"
                  className="task-search-panel__create-btn"
                  onClick={() => {
                    setIsDropdownOpen(false);
                    onCreateNewTask();
                  }}
                >
                  + Create New Task
                </button>
                <div className="task-search-panel__divider" />
              </>
            )}

            {filteredTasks.length > 0 ? (
              <div className="task-search-panel__results">
                {filteredTasks.map((task, index) => (
                  <div
                    key={index}
                    className="task-search-panel__result-item"
                    onClick={() => handleSelectTask(task)}
                  >
                    <div className="task-search-panel__result-header">
                      <span className="task-search-panel__result-key">
                        {task.key}
                      </span>
                      {task.version && (
                        <span className="task-search-panel__result-version">
                          @{task.version}
                        </span>
                      )}
                    </div>
                    {task.domain && (
                      <div className="task-search-panel__result-path">
                        {task.domain}/{task.flow || 'sys-tasks'}
                      </div>
                    )}
                    {task.attributes?.description && (
                      <div className="task-search-panel__result-description">
                        {task.attributes.description}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="task-search-panel__empty">
                <p>No tasks found matching &quot;{searchQuery}&quot;</p>
              </div>
            )}
          </div>
        )}
      </div>

      <p className="task-search-panel__help">
        Select from available tasks or enter task key/reference manually
      </p>
    </div>
  );
}
