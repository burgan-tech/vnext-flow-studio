import React, { useState, useEffect } from 'react';
import type { ExecutionTask, TaskDefinition } from '@amorphie-flow-studio/core';
import { isTaskRef } from './utils';
import { RuleEditor } from './RuleEditor';
import { ReferenceSelector, type ComponentReference } from './ReferenceSelector';
import { ScriptSelector, type ScriptItem } from './ScriptSelector';

interface ExecutionTaskListEditorProps {
  title: string;
  tasks?: ExecutionTask[];
  availableTasks: TaskDefinition[];
  availableMappers?: ScriptItem[];
  onLoadFromFile?: (taskIndex: number) => void;
  onChange: (tasks?: ExecutionTask[]) => void;
}

export const ExecutionTaskListEditor: React.FC<ExecutionTaskListEditorProps> = ({
  title,
  tasks = [],
  availableTasks,
  availableMappers = [],
  onLoadFromFile,
  onChange
}) => {
  // State for mapping code texts (decoded from Base64)
  const [mappingTexts, setMappingTexts] = useState<string[]>([]);
  // State for tracking which tasks are expanded
  const [expandedTasks, setExpandedTasks] = useState<Set<number>>(new Set());

  // Decode Base64 mapping codes when tasks change
  useEffect(() => {
    const decodedTexts = tasks.map(task => {
      const code = task.mapping?.code || '';
      if (code) {
        try {
          // Check if it looks like Base64 and decode it
          const isBase64 = /^[A-Za-z0-9+/]*={0,2}$/.test(code) && code.length % 4 === 0 && code.length > 10;
          if (isBase64) {
            return atob(code);
          } else {
            return code;
          }
        } catch {
          return code;
        }
      }
      return '';
    });
    setMappingTexts(decodedTexts);
  }, [tasks]);

  const handleTaskChange = (index: number, task: ExecutionTask) => {
    console.log('🔍 handleTaskChange called:', { index, taskMapping: task.mapping });
    const sortedTasks = [...tasks].sort((a, b) => a.order - b.order);
    sortedTasks[index] = task;
    console.log('🔍 Calling onChange with updated tasks:', sortedTasks.length, 'tasks');
    onChange(sortedTasks);
  };

  const handleMappingCodeChange = (index: number, code: string) => {
    console.log('🔍 handleMappingCodeChange called:', { index, codeLength: code?.length, codePreview: code?.substring(0, 50) });

    // Update the mapping text state
    const newMappingTexts = [...mappingTexts];
    newMappingTexts[index] = code;
    setMappingTexts(newMappingTexts);

    // Update the task with the new code (raw text, encoding will happen on save)
    const sortedTasks = [...tasks].sort((a, b) => a.order - b.order);
    if (sortedTasks[index]) {
      const updatedTask = {
        ...sortedTasks[index],
        mapping: {
          ...sortedTasks[index].mapping,
          code: code
        }
      };
      console.log('🔍 Updating task with new code:', { taskIndex: index, newCodeLength: code?.length });
      handleTaskChange(index, updatedTask);
    } else {
      console.log('❌ No task found at index:', index);
    }
  };

  const handleAddTask = () => {
    const newTask: ExecutionTask = {
      order: tasks.length + 1,
      task: { ref: '' },
      mapping: { location: './src/mappings/new.csx', code: '' }
    };
    onChange([...tasks, newTask]);

    // Auto-expand the newly added task
    setExpandedTasks(prev => {
      const newSet = new Set(prev);
      newSet.add(tasks.length);
      return newSet;
    });
  };

  const handleRemoveTask = (index: number) => {
    const sortedTasks = [...tasks].sort((a, b) => a.order - b.order);
    const newTasks = sortedTasks.filter((_, i) => i !== index);
    // Reorder remaining tasks
    newTasks.forEach((task, i) => {
      task.order = i + 1;
    });
    onChange(newTasks.length > 0 ? newTasks : undefined);

    // Remove from expanded state
    setExpandedTasks(prev => {
      const newSet = new Set(prev);
      newSet.delete(index);
      return newSet;
    });
  };

  const toggleTaskExpansion = (index: number) => {
    setExpandedTasks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
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
      {title && (
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
      )}

      {tasks.length === 0 ? (
        <p className="property-panel__muted">No tasks defined.</p>
      ) : (
        [...tasks].sort((a, b) => a.order - b.order).map((task, index) => {
          const isExpanded = expandedTasks.has(index);
          return (
          <div key={index} className="property-panel__task-item">
            <div className="property-panel__task-header">
              <button
                type="button"
                onClick={() => toggleTaskExpansion(index)}
                className="property-panel__task-toggle"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  color: 'inherit'
                }}
              >
                <span style={{ marginRight: '4px' }}>{isExpanded ? '▼' : '▶'}</span>
                <span>Task #{task.order}</span>
              </button>
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

            {isExpanded && (
              <div className="property-panel__task-content">
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

            <ReferenceSelector
              label="Task"
              value={isTaskRef(task.task) ? task.task as ComponentReference : null}
              availableComponents={availableTasks}
              componentType="Task"
              defaultFlow="sys-tasks"
              required={true}
              onChange={(reference) => {
                handleTaskChange(index, {
                  ...task,
                  task: reference || { key: '', domain: '', flow: 'sys-tasks', version: '1.0.0' }
                });
              }}
              helpText="Select a task definition to execute"
            />

            {availableMappers.length > 0 ? (
              <ScriptSelector
                label="Mapper Script"
                value={task.mapping?.location || null}
                availableScripts={availableMappers}
                scriptType="mapper"
                onChange={(location, script) => {
                  if (location && script) {
                    // Update both location and load the script content
                    handleTaskChange(index, {
                      ...task,
                      mapping: {
                        location: script.location,
                        code: script.content // Use plain content, will be encoded on save
                      }
                    });
                    // Also update the mapping text state
                    const newMappingTexts = [...mappingTexts];
                    newMappingTexts[index] = script.content;
                    setMappingTexts(newMappingTexts);
                  } else {
                    handleTaskChange(index, {
                      ...task,
                      mapping: { location: '', code: '' }
                    });
                  }
                }}
                helpText="Select a mapper script from available scripts in the workspace"
              />
            ) : (
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
            )}

            <div className="property-panel__field">
              <label>Code (Base64 or inline):</label>
              <RuleEditor
                title=""
                rule={task.mapping ? { location: task.mapping.location, code: task.mapping.code } : undefined}
                inlineText={mappingTexts[index] || ''}
                hideLocation={true}
                taskType={(() => {
                  // Try to get task type from available tasks
                  if (isTaskRef(task.task)) {
                    const taskDef = availableTasks.find(t => t.key === task.task.ref);
                    return taskDef?.type;
                  } else {
                    return task.task.type;
                  }
                })()}
                onChange={(mapping) => {
                  if (mapping) {
                    handleTaskChange(index, {
                      ...task,
                      mapping: { location: mapping.location, code: mapping.code }
                    });
                  } else {
                    handleTaskChange(index, {
                      ...task,
                      mapping: { location: '', code: '' }
                    });
                  }
                }}
                onInlineChange={(code) => handleMappingCodeChange(index, code)}
              />
            </div>
              </div>
            )}

          </div>
        );})
      )}
    </div>
  );
};
