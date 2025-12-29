import React, { useState, useEffect } from 'react';
import type { ExecutionTask, TaskRef, Mapping } from '@amorphie-workflow/core';
import { MappingSection, type MappingData } from './MappingSection';
import { TaskSearchPanel } from './TaskSearchPanel';
import { TaskCreationModal } from './TaskCreationModal';
import { useBridge } from '../../hooks/useBridge';

interface TaskDetailsPanelProps {
  task: ExecutionTask | null;
  taskIndex: number | null;
  stateKey: string;
  workflowName?: string;
  workflowDomain?: string;
  lane: 'onEntries' | 'onExits';
  catalogs: Record<string, any[]>;
  onUpdateTask: (updatedTask: ExecutionTask) => void;
}

export function TaskDetailsPanel({
  task,
  taskIndex,
  stateKey,
  workflowName,
  workflowDomain,
  lane,
  catalogs,
  onUpdateTask,
}: TaskDetailsPanelProps) {
  const { postMessage, onMessage } = useBridge();

  // Debug: Log catalogs
  console.log('[TaskDetailsPanel] Catalogs received:', {
    mapper: catalogs.mapper?.length || 0,
    task: catalogs.task?.length || 0
  });

  const [taskRefInput, setTaskRefInput] = useState('');
  const [inputMapping, setInputMapping] = useState<MappingData>({
    mode: 'code',
    code: '',
    location: '',
  });
  const [showTaskCreationModal, setShowTaskCreationModal] = useState(false);

  // Listen for task:created messages to auto-populate task reference
  useEffect(() => {
    const unsubscribe = onMessage((message) => {
      if (message.type === 'task:created' && message.success && task && taskIndex !== null) {
        // Create normalized task reference with key, domain, version, flow
        if (message.key && message.domain && message.version) {
          const updatedTask: ExecutionTask = {
            ...task,
            task: {
              key: message.key,
              domain: message.domain,
              version: message.version,
              flow: message.flow || 'sys-tasks'
            } as TaskRef,
          };
          onUpdateTask(updatedTask);
          setTaskRefInput(message.key);
        }
      }
    });

    return unsubscribe;
  }, [onMessage, task, taskIndex, onUpdateTask]);

  // Update local state when task or taskIndex changes
  useEffect(() => {
    if (!task || taskIndex === null) {
      setTaskRefInput('');
      setInputMapping({ mode: 'code', code: '', location: '' });
      return;
    }

    // Extract task reference (always set, even if empty)
    let taskRef = '';
    if (typeof task.task === 'object' && task.task !== null) {
      if ('ref' in task.task) {
        taskRef = task.task.ref || '';
      } else if ('key' in task.task) {
        taskRef = task.task.key || '';
      }
    }
    setTaskRefInput(taskRef);

    // Extract mapping info
    if (task.mapping) {
      setInputMapping({
        mode: 'code',
        code: task.mapping.code || '',
        location: task.mapping.location || '',
      });
    } else {
      // Clear mapping if task doesn't have one
      setInputMapping({ mode: 'code', code: '', location: '' });
    }
  }, [task, taskIndex]);

  // Update mapping code when catalog script is updated (for readonly display)
  useEffect(() => {
    const scriptLocation = inputMapping.location;

    // Check if this is any script file (.mapper.json, .csx, .cs, .js)
    const isScriptFile = scriptLocation && (
      scriptLocation.endsWith('.mapper.json') ||
      scriptLocation.endsWith('.csx') ||
      scriptLocation.endsWith('.cs') ||
      scriptLocation.endsWith('.js')
    );

    if (isScriptFile && inputMapping.code) {
      // Find the script in the catalog
      const catalogScript = catalogs.mapper?.find(m => m.location === scriptLocation);
      if (catalogScript && catalogScript.base64 && catalogScript.base64 !== inputMapping.code) {
        // Script was updated in catalog, refresh the readonly display
        console.log('[TaskDetailsPanel] Updating readonly script display for:', scriptLocation);
        console.log('[TaskDetailsPanel] Old code length:', inputMapping.code?.length, 'New code length:', catalogScript.base64.length);
        setInputMapping(prev => ({
          ...prev,
          code: catalogScript.base64
        }));
      }
    }
  }, [catalogs.mapper, inputMapping.location, inputMapping.code]);

  if (!task || taskIndex === null) {
    return (
      <div className="task-details-panel">
        <div className="task-details-panel__empty">
          <p>No task selected</p>
          <p>Select a task from the list to edit its details</p>
        </div>
      </div>
    );
  }

  const handleTaskRefChange = (value: string, taskData?: { key: string; domain?: string; flow?: string; version?: string }) => {
    setTaskRefInput(taskData?.key || value);

    // If we have structured task data, use key/domain/flow/version format
    // Otherwise fall back to ref format (for manual entry of file paths)
    const taskRef: TaskRef = taskData && taskData.key
      ? {
          key: taskData.key,
          domain: taskData.domain || '',
          flow: taskData.flow || 'sys-tasks',
          version: taskData.version || '1.0.0'
        }
      : { ref: value };

    const updatedTask: ExecutionTask = {
      ...task,
      task: taskRef,
    };
    onUpdateTask(updatedTask);
  };

  const handleInputMappingChange = (data: MappingData) => {
    setInputMapping(data);
    const updatedTask: ExecutionTask = {
      ...task,
      mapping: {
        location: data.location || '',
        code: data.code || '',
      } as Mapping,
    };
    onUpdateTask(updatedTask);
  };

  return (
    <div className="task-details-panel">
      <div className="task-details-panel__header">
        <h3 className="task-details-panel__title">Task Details</h3>
        <span className="task-details-panel__order-badge">Order: {task.order}</span>
      </div>

      <div className="task-details-panel__content">
        {/* Task Reference Section with Search */}
        <TaskSearchPanel
          availableTasks={catalogs.task || []}
          selectedTaskRef={taskRefInput}
          onSelectTask={handleTaskRefChange}
          onCreateNewTask={() => {
            setShowTaskCreationModal(true);
          }}
        />

        {/* Task Mapping */}
        <MappingSection
          type="input"
          value={inputMapping}
          onChange={handleInputMappingChange}
          availableMappers={catalogs.mapper || []}
          stateKey={stateKey}
          workflowName={workflowName}
          lane={lane}
          taskIndex={taskIndex}
        />
      </div>

      {/* Task Creation Modal */}
      {showTaskCreationModal && (
        <TaskCreationModal
          workflowDomain={workflowDomain}
          onClose={() => setShowTaskCreationModal(false)}
          onCreate={(taskName, taskType, version) => {
            postMessage({
              type: 'task:create',
              taskName,
              taskType,
              version,
              domain: workflowDomain,
              openInQuickEditor: true
            });
            setShowTaskCreationModal(false);
          }}
        />
      )}
    </div>
  );
}
