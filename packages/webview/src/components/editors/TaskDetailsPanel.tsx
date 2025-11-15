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
  lane: 'onEntries' | 'onExits';
  catalogs: Record<string, any[]>;
  onUpdateTask: (updatedTask: ExecutionTask) => void;
}

export function TaskDetailsPanel({
  task,
  taskIndex,
  stateKey,
  workflowName,
  lane,
  catalogs,
  onUpdateTask,
}: TaskDetailsPanelProps) {
  const { postMessage } = useBridge();

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

  const handleTaskRefChange = (value: string) => {
    setTaskRefInput(value);
    const updatedTask: ExecutionTask = {
      ...task,
      task: { ref: value } as TaskRef,
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
          onClose={() => setShowTaskCreationModal(false)}
          onCreate={(taskName, taskType) => {
            postMessage({
              type: 'task:create',
              taskName,
              taskType,
              openInQuickEditor: true
            });
            setShowTaskCreationModal(false);
          }}
        />
      )}
    </div>
  );
}
