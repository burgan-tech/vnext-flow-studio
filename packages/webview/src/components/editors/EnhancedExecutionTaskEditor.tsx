import React, { useState, useMemo } from 'react';
import { EnhancedMappingEditor } from './EnhancedMappingEditor';
import type { ExecutionTask, TaskComponentDefinition, State, Workflow } from '@amorphie-flow-studio/core';

interface EnhancedExecutionTaskEditorProps {
  title: string;
  tasks?: ExecutionTask[];
  availableTasks: TaskComponentDefinition[];
  onLoadFromFile?: (taskIndex: number) => void;
  onChange: (tasks?: ExecutionTask[]) => void;
  // Enhanced context
  currentState?: State;
  workflow?: Workflow;
}

interface TaskSearchResult {
  task: TaskComponentDefinition;
  relevanceScore: number;
  matchReasons: string[];
}

export const EnhancedExecutionTaskEditor: React.FC<EnhancedExecutionTaskEditorProps> = ({
  title,
  tasks = [],
  availableTasks,
  onLoadFromFile,
  onChange,
  currentState,
  workflow
}) => {
  const [expandedTasks, setExpandedTasks] = useState<Set<number>>(new Set());
  const [taskSearchQuery, setTaskSearchQuery] = useState<Record<number, string>>({});
  const [showMappingEditor, setShowMappingEditor] = useState<Record<number, boolean>>({});

  const sortedTasks = useMemo(() =>
    [...tasks].sort((a, b) => a.order - b.order),
    [tasks]
  );

  // Enhanced task search with relevance scoring
  const searchTasks = (query: string): TaskSearchResult[] => {
    if (!query.trim()) return [];

    const queryLower = query.toLowerCase();
    const results: TaskSearchResult[] = [];

    availableTasks.forEach(task => {
      let relevanceScore = 0;
      const matchReasons: string[] = [];

      // Exact key match
      if (task.key.toLowerCase() === queryLower) {
        relevanceScore += 100;
        matchReasons.push('Exact key match');
      }
      // Key starts with query
      else if (task.key.toLowerCase().startsWith(queryLower)) {
        relevanceScore += 80;
        matchReasons.push('Key starts with query');
      }
      // Key contains query
      else if (task.key.toLowerCase().includes(queryLower)) {
        relevanceScore += 60;
        matchReasons.push('Key contains query');
      }

      // Title matches
      if (task.title && task.title.toLowerCase().includes(queryLower)) {
        relevanceScore += 40;
        matchReasons.push('Title match');
      }

      // Tag matches
      if (task.tags) {
        task.tags.forEach(tag => {
          if (tag.toLowerCase().includes(queryLower)) {
            relevanceScore += 30;
            matchReasons.push('Tag match');
          }
        });
      }

      // Domain match
      if (task.domain.toLowerCase().includes(queryLower)) {
        relevanceScore += 20;
        matchReasons.push('Domain match');
      }

      if (relevanceScore > 0) {
        results.push({ task, relevanceScore, matchReasons });
      }
    });

    return results.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 10);
  };

  const handleTaskChange = (index: number, task: ExecutionTask) => {
    const newTasks = [...sortedTasks];
    newTasks[index] = task;
    onChange(newTasks);
  };

  const handleAddTask = () => {
    const newTask: ExecutionTask = {
      order: tasks.length + 1,
      task: { ref: '' },
      mapping: { location: './src/mappings/new.csx', code: '' }
    };
    onChange([...tasks, newTask]);

    // Auto-expand the new task
    setExpandedTasks(prev => new Set([...prev, tasks.length]));
  };

  const handleRemoveTask = (index: number) => {
    const newTasks = sortedTasks.filter((_, i) => i !== index);
    // Reorder remaining tasks
    newTasks.forEach((task, i) => {
      task.order = i + 1;
    });
    onChange(newTasks.length > 0 ? newTasks : undefined);

    // Clean up expanded state
    setExpandedTasks(prev => {
      const newSet = new Set(prev);
      newSet.delete(index);
      return newSet;
    });
  };

  const handleMoveTask = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= sortedTasks.length) return;

    // Swap orders
    const newTasks = [...sortedTasks];
    const temp = newTasks[index].order;
    newTasks[index].order = newTasks[newIndex].order;
    newTasks[newIndex].order = temp;

    onChange(newTasks);
  };

  const toggleTaskExpansion = (index: number) => {
    const newExpanded = new Set(expandedTasks);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedTasks(newExpanded);
  };

  const toggleMappingEditor = (index: number) => {
    setShowMappingEditor(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const selectTask = (taskIndex: number, selectedTask: TaskComponentDefinition) => {
    const currentTask = sortedTasks[taskIndex];
    if (!currentTask) return;

    const path = (selectedTask as any).path || `Tasks/${selectedTask.key}.json`;
    const updatedTask: ExecutionTask = {
      ...currentTask,
      task: { ref: path }
    };

    handleTaskChange(taskIndex, updatedTask);

    // Clear search query
    setTaskSearchQuery(prev => ({ ...prev, [taskIndex]: '' }));
  };

  const getMappingText = (mapping: { location: string; code: string }): string => {
    if (!mapping.code) return '';

    try {
      return atob(mapping.code);
    } catch {
      return mapping.code;
    }
  };

  const setMappingText = (taskIndex: number, text: string) => {
    const task = sortedTasks[taskIndex];
    if (!task) return;

    const updatedTask: ExecutionTask = {
      ...task,
      mapping: {
        ...task.mapping,
        code: btoa(text)
      }
    };

    handleTaskChange(taskIndex, updatedTask);
  };

  const createMappingFromTask = (task: ExecutionTask) => {
    return {
      location: task.mapping.location,
      code: task.mapping.code,
      enabled: true,
      type: 'mapping'
    };
  };

  return (
    <div className="property-panel__group">
      <div className="property-panel__group-header">
        <span>{title}</span>
        <button
          type="button"
          onClick={handleAddTask}
          className="property-panel__add-button"
          title="Add execution task"
        >
          +
        </button>
      </div>

      {tasks.length === 0 ? (
        <div className="property-panel__empty-state">
          <p className="property-panel__muted">No tasks defined.</p>
          <p className="property-panel__help">
            Tasks execute when entering a state, exiting a state, or during transitions.
          </p>
        </div>
      ) : (
        sortedTasks.map((task, index) => {
          const isExpanded = expandedTasks.has(index);
          const searchQuery = taskSearchQuery[index] || '';
          const searchResults = searchQuery ? searchTasks(searchQuery) : [];
          const mappingEditorOpen = showMappingEditor[index] || false;

          return (
            <div key={index} className="property-panel__task-item">
              <div className="property-panel__task-header">
                <button
                  type="button"
                  onClick={() => toggleTaskExpansion(index)}
                  className="property-panel__task-toggle"
                >
                  {isExpanded ? '📖' : '📄'} Task #{task.order}
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
                    title="Remove task"
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
                      onChange={(e) =>
                        handleTaskChange(index, {
                          ...task,
                          order: parseInt(e.target.value, 10) || 1
                        })
                      }
                      className="property-panel__input property-panel__input--small"
                    />
                  </div>

                  <div className="property-panel__field">
                    <label>Search Tasks:</label>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setTaskSearchQuery(prev => ({ ...prev, [index]: e.target.value }))}
                      placeholder="Search by name, domain, or tag..."
                      className="property-panel__input"
                    />
                    {searchResults.length > 0 && (
                      <div className="property-panel__search-results">
                        {searchResults.map((result, resultIndex) => (
                          <button
                            key={resultIndex}
                            type="button"
                            onClick={() => selectTask(index, result.task)}
                            className="property-panel__search-result-item"
                            title={`Score: ${result.relevanceScore} - ${result.matchReasons.join(', ')}`}
                          >
                            <div className="property-panel__search-result-main">
                              <span className="property-panel__search-result-key">{result.task.key}</span>
                              <span className="property-panel__search-result-version">v{result.task.version}</span>
                            </div>
                            <div className="property-panel__search-result-details">
                              <span className="property-panel__search-result-domain">{result.task.domain}</span>
                              {result.task.title && (
                                <span className="property-panel__search-result-title">{result.task.title}</span>
                              )}
                            </div>
                            <div className="property-panel__search-result-score">
                              Score: {result.relevanceScore}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="property-panel__field">
                    <label>Selected Task:</label>
                    <input
                      type="text"
                      value={task.task.ref || ''}
                      onChange={(e) =>
                        handleTaskChange(index, {
                          ...task,
                          task: { ref: e.target.value }
                        })
                      }
                      placeholder="e.g., Tasks/validate.json"
                      className="property-panel__input"
                    />
                  </div>

                  <div className="property-panel__mapping-section">
                    <div className="property-panel__section-header">
                      <span>Task Mapping</span>
                      <div className="property-panel__header-actions">
                        <button
                          type="button"
                          onClick={() => toggleMappingEditor(index)}
                          className="property-panel__action-button"
                          title={`${mappingEditorOpen ? 'Hide' : 'Show'} mapping editor`}
                        >
                          {mappingEditorOpen ? '📝' : '⚡'}
                        </button>
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

                    <div className="property-panel__field">
                      <label>Mapping Location:</label>
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
                    </div>

                    {mappingEditorOpen ? (
                      <EnhancedMappingEditor
                        mapping={createMappingFromTask(task)}
                        onMappingChange={(mapping) => {
                          handleTaskChange(index, {
                            ...task,
                            mapping: {
                              location: mapping.location,
                              code: mapping.code
                            }
                          });
                        }}
                        onError={(error) => console.error('Mapping editor error:', error)}
                        onMessage={(message) => console.log('Mapping editor message:', message)}
                        height="300px"
                        showTemplateSelector={true}
                        allowFullScreen={false}
                        currentState={currentState}
                        workflow={workflow}
                        availableTasks={availableTasks}
                        currentTask={availableTasks.find(t =>
                          (t as any).path === task.task.ref || t.key === task.task.ref
                        )}
                      />
                    ) : (
                      <div className="property-panel__field">
                        <label>Mapping Code Preview:</label>
                        <textarea
                          value={getMappingText(task.mapping)}
                          onChange={(e) => setMappingText(index, e.target.value)}
                          placeholder="Click the mapping editor button above for enhanced editing"
                          className="property-panel__textarea"
                          rows={3}
                          style={{ fontSize: '12px', fontFamily: 'monospace' }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}

      <div className="property-panel__help">
        <h4>💡 Task Tips:</h4>
        <ul>
          <li><strong>Order matters:</strong> Tasks execute in numerical order</li>
          <li><strong>Search & select:</strong> Use search to find tasks by name or domain</li>
          <li><strong>Mapping required:</strong> Each task needs input/output mapping</li>
          <li><strong>Use templates:</strong> Click the editor button for mapping templates</li>
        </ul>
      </div>
    </div>
  );
};
