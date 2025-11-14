import React, { useState } from 'react';
import type { ExecutionTask } from '@amorphie-workflow/core';

interface TaskListPanelProps {
  tasks: ExecutionTask[];
  selectedIndex: number | null;
  onSelectTask: (index: number) => void;
  onAddTask: () => void;
  onDeleteTask: (index: number) => void;
  onReorderTasks: (newOrder: ExecutionTask[]) => void;
}

export function TaskListPanel({
  tasks,
  selectedIndex,
  onSelectTask,
  onAddTask,
  onDeleteTask,
  onReorderTasks,
}: TaskListPanelProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.currentTarget.innerHTML);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const reordered = [...tasks];
    const [movedTask] = reordered.splice(draggedIndex, 1);
    reordered.splice(dropIndex, 0, movedTask);

    onReorderTasks(reordered);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const getTaskLabel = (task: ExecutionTask): string => {
    if (typeof task.task === 'object' && task.task !== null) {
      if ('ref' in task.task && task.task.ref) {
        return task.task.ref;
      }
      if ('key' in task.task && task.task.key) {
        return task.task.key;
      }
    }
    return 'Untitled Task';
  };

  const getValidationStatus = (task: ExecutionTask): 'valid' | 'warning' | 'error' => {
    // Basic validation logic
    const hasTaskRef = typeof task.task === 'object' && task.task !== null &&
                       (('ref' in task.task && task.task.ref) || ('key' in task.task && task.task.key));
    const hasMapping = task.mapping && (task.mapping.location || task.mapping.code);

    if (!hasTaskRef) return 'error';
    if (!hasMapping) return 'warning';
    return 'valid';
  };

  return (
    <div className="task-list-panel">
      <div className="task-list-panel__header">
        <h3 className="task-list-panel__title">Tasks</h3>
        <span className="task-list-panel__count">{tasks.length}</span>
      </div>

      <div className="task-list-panel__list">
        {tasks.length === 0 ? (
          <div className="task-list-panel__empty">
            <p>No tasks yet.</p>
            <p>Click &quot;+ Add Task&quot; to begin.</p>
          </div>
        ) : (
          tasks.map((task, index) => {
            const validationStatus = getValidationStatus(task);
            const isSelected = selectedIndex === index;
            const isDragging = draggedIndex === index;
            const isDragOver = dragOverIndex === index;

            return (
              <div
                key={index}
                className={`task-list-panel__item ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''}`}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                onClick={() => onSelectTask(index)}
              >
                <div className="task-list-panel__item-main">
                  <span className="task-list-panel__item-order">{task.order}</span>
                  <div className="task-list-panel__item-content">
                    <div className="task-list-panel__item-label">{getTaskLabel(task)}</div>
                    <div className="task-list-panel__item-meta">
                      {task.mapping?.location && (
                        <span className="task-list-panel__item-mapping-hint" title={task.mapping.location}>
                          {task.mapping.location.split('/').pop()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="task-list-panel__item-actions">
                    <span
                      className={`task-list-panel__item-status task-list-panel__item-status--${validationStatus}`}
                      title={validationStatus === 'error' ? 'Missing task reference' : validationStatus === 'warning' ? 'Missing mapping' : 'Valid'}
                    >
                      {validationStatus === 'error' ? '🔴' : validationStatus === 'warning' ? '🟡' : '🟢'}
                    </span>
                    <button
                      type="button"
                      className="task-list-panel__item-delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        console.log('[TaskListPanel] Delete clicked for index:', index);
                        onDeleteTask(index);
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                      }}
                      draggable={false}
                      title="Delete task"
                    >
                      ×
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="task-list-panel__footer">
        <button
          type="button"
          className="task-list-panel__add-btn"
          onClick={onAddTask}
        >
          <span className="task-list-panel__add-icon">+</span>
          Add Task
        </button>
      </div>
    </div>
  );
}
