import React from 'react';
import type { ExecutionTask, TaskDefinition } from '@amorphie-flow-studio/core';
import { isTaskRef } from './utils';

interface ExecutionTaskListEditorProps {
  title: string;
  tasks?: ExecutionTask[];
  availableTasks: TaskDefinition[];
  onLoadFromFile?: (taskIndex: number) => void;
  onChange: (tasks?: ExecutionTask[]) => void;
}

export const ExecutionTaskListEditor: React.FC<ExecutionTaskListEditorProps> = ({
  title,
  tasks = [],
  availableTasks,
  onLoadFromFile,
  onChange
}) => {

  const handleTaskChange = (index: number, task: ExecutionTask) => {
    const sortedTasks = [...tasks].sort((a, b) => a.order - b.order);
    sortedTasks[index] = task;
    onChange(sortedTasks);
  };

  const handleAddTask = () => {
    const newTask: ExecutionTask = {
      order: tasks.length + 1,
      task: { ref: '' },
      mapping: { location: './src/mappings/new.csx', code: '' }
    };
    onChange([...tasks, newTask]);
  };

  const handleRemoveTask = (index: number) => {
    const sortedTasks = [...tasks].sort((a, b) => a.order - b.order);
    const newTasks = sortedTasks.filter((_, i) => i !== index);
    // Reorder remaining tasks
    newTasks.forEach((task, i) => {
      task.order = i + 1;
    });
    onChange(newTasks.length > 0 ? newTasks : undefined);
  };

  const handleMoveTask = (index: number, direction: 'up' | 'down') => {
    const sortedTasks = [...tasks].sort((a, b) => a.order - b.order);
    const newIndex = direction === 'up' ? index - 1 : index + 1;

    if (newIndex < 0 || newIndex >= sortedTasks.length) return;

    // Swap orders
    const temp = sortedTasks[index].order;
    sortedTasks[index].order = sortedTasks[newIndex].order;
    sortedTasks[newIndex].order = temp;

    onChange(sortedTasks);
  };

  const handleOrderChange = (index: number, newOrder: number) => {
    const sortedTasks = [...tasks].sort((a, b) => a.order - b.order);
    const task = sortedTasks[index];
    if (!task) return;

    const updatedTasks = [...sortedTasks];
    updatedTasks[index] = { ...task, order: newOrder };
    onChange(updatedTasks);
  };


  return (
    <div className="property-panel__group">
      <div className="property-panel__group-header">
        <span>{title}</span>
        <button
          type="button"
          onClick={handleAddTask}
          className="property-panel__add-button"
        >
          +
        </button>
      </div>

      {tasks.length === 0 ? (
        <p className="property-panel__muted">No tasks defined.</p>
      ) : (
        [...tasks].sort((a, b) => a.order - b.order).map((task, index) => (
          <div key={index} className="property-panel__task-item">
            <div className="property-panel__task-header">
              <span>Task #{index + 1}</span>
              <div className="property-panel__task-actions">
                <button
                  type="button"
                  onClick={() => handleMoveTask(index, 'up')}
                  disabled={index === 0}
                  className="property-panel__action-button"
                  title="Move up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => handleMoveTask(index, 'down')}
                  disabled={index === tasks.length - 1}
                  className="property-panel__action-button"
                  title="Move down"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => handleRemoveTask(index)}
                  className="property-panel__remove-button"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="property-panel__field">
              <label>Order:</label>
              <input
                type="number"
                min="1"
                value={task.order}
                onChange={(e) => handleOrderChange(index, parseInt(e.target.value, 10) || 1)}
                className="property-panel__input"
              />
            </div>

            <div className="property-panel__field">
              <label>Task Type:</label>
              <select
                value={isTaskRef(task.task) ? 'full' : 'ref'}
                onChange={(e) => {
                  if (e.target.value === 'full') {
                    handleTaskChange(index, {
                      ...task,
                      task: { key: '', domain: '', flow: 'sys-tasks', version: '1.0.0' }
                    });
                  } else {
                    handleTaskChange(index, {
                      ...task,
                      task: { ref: '' }
                    });
                  }
                }}
                className="property-panel__select"
              >
                <option value="ref">Path Reference</option>
                <option value="full">Full Reference</option>
              </select>
            </div>

            {isTaskRef(task.task) ? (
              <>
                <div className="property-panel__field">
                  <label>Key:</label>
                  <input
                    type="text"
                    value={task.task.key}
                    onChange={(e) =>
                      handleTaskChange(index, {
                        ...task,
                        task: { ...task.task, key: e.target.value } as any
                      })
                    }
                    placeholder="Task key"
                    className="property-panel__input"
                  />
                </div>
                <div className="property-panel__field">
                  <label>Domain:</label>
                  <input
                    type="text"
                    value={task.task.domain}
                    onChange={(e) =>
                      handleTaskChange(index, {
                        ...task,
                        task: { ...task.task, domain: e.target.value } as any
                      })
                    }
                    placeholder="Domain"
                    className="property-panel__input"
                  />
                </div>
                <div className="property-panel__field">
                  <label>Flow:</label>
                  <input
                    type="text"
                    value={task.task.flow}
                    onChange={(e) =>
                      handleTaskChange(index, {
                        ...task,
                        task: { ...task.task, flow: e.target.value } as any
                      })
                    }
                    placeholder="sys-tasks"
                    className="property-panel__input"
                  />
                </div>
                <div className="property-panel__field">
                  <label>Version:</label>
                  <input
                    type="text"
                    value={task.task.version}
                    onChange={(e) =>
                      handleTaskChange(index, {
                        ...task,
                        task: { ...task.task, version: e.target.value } as any
                      })
                    }
                    placeholder="1.0.0"
                    className="property-panel__input"
                  />
                </div>
              </>
            ) : (
              <div className="property-panel__field">
                <label>Task Path:</label>
                {availableTasks.length > 0 ? (
                  <>
                    <select
                      value={task.task.ref}
                      onChange={(e) =>
                        handleTaskChange(index, {
                          ...task,
                          task: { ref: e.target.value }
                        })
                      }
                      className="property-panel__select"
                    >
                      <option value="">Select a task...</option>
                      {availableTasks.map((availableTask) => {
                        const path = (availableTask as any).path || `Tasks/${availableTask.key}.json`;
                        return (
                          <option key={path} value={path}>
                            {path} ({availableTask.key} v{availableTask.version})
                          </option>
                        );
                      })}
                    </select>
                    <small className="property-panel__help">
                      Or enter a custom path:
                    </small>
                  </>
                ) : null}
                <input
                  type="text"
                  value={task.task.ref}
                  onChange={(e) =>
                    handleTaskChange(index, {
                      ...task,
                      task: { ref: e.target.value }
                    })
                  }
                  placeholder="e.g., Tasks/validate.json"
                  className="property-panel__input"
                />
                <small className="property-panel__help">
                  Path to the task definition file relative to project root
                </small>
              </div>
            )}

            <div className="property-panel__field">
              <label>Mapping Location:</label>
              <div className="property-panel__input-group">
                <input
                  type="text"
                  value={task.mapping.location}
                  onChange={(e) =>
                    handleTaskChange(index, {
                      ...task,
                      mapping: { ...task.mapping, location: e.target.value }
                    })
                  }
                  placeholder="./src/mappings/example.csx"
                  className="property-panel__input"
                />
                {onLoadFromFile && (
                  <button
                    type="button"
                    onClick={() => onLoadFromFile(index)}
                    className="property-panel__action-button"
                    title="Load from file"
                  >
                    📁
                  </button>
                )}
              </div>
            </div>

          </div>
        ))
      )}
    </div>
  );
};