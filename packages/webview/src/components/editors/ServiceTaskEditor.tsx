import React, { useState, useCallback, useMemo } from 'react';
import type { State, TaskRef, DesignHints, TerminalConfig } from '@amorphie-flow-studio/core';
import { ReferenceSelector } from './ReferenceSelector';
// import { MappingEditor } from './MappingEditor'; // TODO: MappingEditor component not implemented yet

interface ServiceTaskEditorProps {
  state: State;
  hints: DesignHints;
  onChange: (state: State, hints: DesignHints) => void;
  registries: {
    tasks?: any[];
    functions?: any[];
    views?: any[];
  };
}

interface TerminalVisibility {
  success: boolean;
  timeout: boolean;
  error: boolean;
}

export function ServiceTaskEditor({ state, hints, onChange, registries }: ServiceTaskEditorProps) {
  const [activeTab, setActiveTab] = useState<'task' | 'terminals' | 'mapping'>('task');

  // Extract current task configuration
  const currentTask = useMemo(() => {
    return state.onEntries?.[0]?.task;
  }, [state.onEntries]);

  const currentMapping = useMemo(() => {
    return state.onEntries?.[0]?.mapping;
  }, [state.onEntries]);

  // Extract terminal visibility from hints
  const terminalVisibility = useMemo<TerminalVisibility>(() => {
    const visibility: TerminalVisibility = {
      success: true, // Always visible
      timeout: false,
      error: false
    };

    hints.terminals.forEach(terminal => {
      if (terminal.id === 'success') visibility.success = terminal.visible;
      if (terminal.id === 'timeout') visibility.timeout = terminal.visible;
      if (terminal.id === 'error') visibility.error = terminal.visible;
    });

    return visibility;
  }, [hints.terminals]);

  // Handle task selection
  const handleTaskChange = useCallback((taskRef: TaskRef | null) => {
    if (!taskRef) return;

    const newState = { ...state };

    // Ensure onEntries exists
    if (!newState.onEntries) {
      newState.onEntries = [];
    }

    // Update or create the first task entry
    if (newState.onEntries.length === 0) {
      newState.onEntries.push({
        order: 1,
        task: taskRef,
        mapping: {
          location: 'inline',
          code: '// Configure task input mapping\nreturn {};'
        }
      });
    } else {
      newState.onEntries[0] = {
        ...newState.onEntries[0],
        task: taskRef
      };
    }

    onChange(newState, hints);
  }, [state, hints, onChange]);

  // Handle mapping change
  const handleMappingChange = useCallback((mapping: { location: string; code: string }) => {
    const newState = { ...state };

    if (!newState.onEntries || newState.onEntries.length === 0) {
      console.error('No task entry to update mapping');
      return;
    }

    newState.onEntries[0] = {
      ...newState.onEntries[0],
      mapping
    };

    onChange(newState, hints);
  }, [state, hints, onChange]);

  // Handle terminal visibility toggle
  const handleTerminalToggle = useCallback((terminalId: string, visible: boolean) => {
    const newHints = { ...hints };
    const terminal = newHints.terminals.find(t => t.id === terminalId);

    if (terminal) {
      terminal.visible = visible;

      // If making a terminal visible that requires configuration
      if (visible && terminalId === 'timeout') {
        // Ensure a timeout transition exists in state
        const hasTimeoutTransition = state.transitions?.some(
          t => t.triggerType === 2
        );

        if (!hasTimeoutTransition) {
          const newState = { ...state };
          if (!newState.transitions) newState.transitions = [];

          // Add a default timeout transition
          newState.transitions.push({
            key: `${state.key}-timeout`,
            target: '', // User needs to connect it
            triggerType: 2,
            versionStrategy: 'Minor',
            timer: {
              reset: 'N',
              duration: 'PT5M' // Default 5 minutes
            }
          });

          // Update terminal binding
          newHints.terminalBindings['timeout'] = `${state.key}-timeout`;

          onChange(newState, newHints);
          return;
        }
      }
    }

    onChange(state, newHints);
  }, [state, hints, onChange]);

  // Handle adding additional tasks
  const handleAddTask = useCallback(() => {
    const newState = { ...state };
    if (!newState.onEntries) newState.onEntries = [];

    const nextOrder = newState.onEntries.length + 1;
    newState.onEntries.push({
      order: nextOrder,
      task: { ref: '' },
      mapping: {
        location: 'inline',
        code: '// Configure task input mapping\nreturn {};'
      }
    });

    onChange(newState, hints);
  }, [state, hints, onChange]);

  // Handle removing a task
  const handleRemoveTask = useCallback((index: number) => {
    const newState = { ...state };
    if (!newState.onEntries) return;

    newState.onEntries.splice(index, 1);

    // Re-order remaining tasks
    newState.onEntries.forEach((entry, idx) => {
      entry.order = idx + 1;
    });

    onChange(newState, hints);
  }, [state, hints, onChange]);

  return (
    <div className="service-task-editor">
      {/* Tab Navigation */}
      <div className="editor-tabs">
        <button
          className={`editor-tab ${activeTab === 'task' ? 'active' : ''}`}
          onClick={() => setActiveTab('task')}
        >
          Task Configuration
        </button>
        <button
          className={`editor-tab ${activeTab === 'terminals' ? 'active' : ''}`}
          onClick={() => setActiveTab('terminals')}
        >
          Terminals
        </button>
        <button
          className={`editor-tab ${activeTab === 'mapping' ? 'active' : ''}`}
          onClick={() => setActiveTab('mapping')}
        >
          Input Mapping
        </button>
      </div>

      {/* Tab Content */}
      <div className="editor-content">
        {activeTab === 'task' && (
          <div className="task-configuration">
            <h3>Service Task</h3>
            <p className="help-text">
              Select the task to execute when this state is entered.
            </p>

            {/* Primary Task */}
            <div className="form-group">
              <label>Primary Task</label>
              <ReferenceSelector
                type="task"
                value={currentTask}
                onChange={handleTaskChange}
                registries={registries}
                placeholder="Select or enter task reference"
              />
            </div>

            {/* Additional Tasks */}
            {state.onEntries && state.onEntries.length > 1 && (
              <div className="additional-tasks">
                <h4>Additional Tasks</h4>
                {state.onEntries.slice(1).map((entry, index) => (
                  <div key={index + 1} className="task-entry">
                    <div className="task-order">#{entry.order}</div>
                    <ReferenceSelector
                      type="task"
                      value={entry.task}
                      onChange={(taskRef) => {
                        const newState = { ...state };
                        if (newState.onEntries) {
                          newState.onEntries[index + 1].task = taskRef || { ref: '' };
                          onChange(newState, hints);
                        }
                      }}
                      registries={registries}
                      placeholder="Select or enter task reference"
                    />
                    <button
                      className="remove-task-btn"
                      onClick={() => handleRemoveTask(index + 1)}
                      title="Remove task"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              className="add-task-btn"
              onClick={handleAddTask}
            >
              + Add Task
            </button>
          </div>
        )}

        {activeTab === 'terminals' && (
          <div className="terminal-configuration">
            <h3>Terminal Configuration</h3>
            <p className="help-text">
              Configure which terminals are visible for connections.
            </p>

            <div className="terminal-list">
              {/* Success Terminal (always visible) */}
              <div className="terminal-item">
                <input
                  type="checkbox"
                  id="terminal-success"
                  checked={true}
                  disabled
                />
                <label htmlFor="terminal-success">
                  <span className="terminal-icon">✓</span>
                  Success
                  <span className="terminal-required">Required</span>
                </label>
                <p className="terminal-description">
                  Triggered when the task completes successfully
                </p>
              </div>

              {/* Timeout Terminal */}
              <div className="terminal-item">
                <input
                  type="checkbox"
                  id="terminal-timeout"
                  checked={terminalVisibility.timeout}
                  onChange={(e) => handleTerminalToggle('timeout', e.target.checked)}
                />
                <label htmlFor="terminal-timeout">
                  <span className="terminal-icon">⏱</span>
                  Timeout
                </label>
                <p className="terminal-description">
                  Triggered when the task execution times out
                </p>
                {terminalVisibility.timeout && (
                  <div className="terminal-config">
                    <label>Duration (ISO 8601)</label>
                    <input
                      type="text"
                      placeholder="PT5M"
                      defaultValue="PT5M"
                      className="duration-input"
                      onChange={(e) => {
                        // Update timeout duration in state
                        const newState = { ...state };
                        const timeoutTransition = newState.transitions?.find(
                          t => t.triggerType === 2
                        );
                        if (timeoutTransition && timeoutTransition.timer) {
                          timeoutTransition.timer.duration = e.target.value;
                          onChange(newState, hints);
                        }
                      }}
                    />
                    <span className="help-text">Examples: PT5M (5 min), PT1H (1 hour)</span>
                  </div>
                )}
              </div>

              {/* Error Terminal */}
              <div className="terminal-item">
                <input
                  type="checkbox"
                  id="terminal-error"
                  checked={terminalVisibility.error}
                  onChange={(e) => handleTerminalToggle('error', e.target.checked)}
                />
                <label htmlFor="terminal-error">
                  <span className="terminal-icon">⚠</span>
                  Error
                </label>
                <p className="terminal-description">
                  Triggered when the task encounters an error
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'mapping' && (
          <div className="mapping-configuration">
            <h3>Input Mapping</h3>
            <p className="help-text">
              Define how data is mapped to the task input parameters.
            </p>

            {currentMapping ? (
              <MappingEditor
                mapping={currentMapping}
                onChange={handleMappingChange}
                context={{
                  availableVariables: ['context', 'input', 'state'],
                  taskSchema: {} // Could be populated from task definition
                }}
              />
            ) : (
              <div className="no-mapping">
                <p>No task selected. Select a task first to configure mapping.</p>
              </div>
            )}

            {state.onEntries && state.onEntries.length > 1 && (
              <div className="additional-mappings">
                <h4>Additional Task Mappings</h4>
                {state.onEntries.slice(1).map((entry, index) => (
                  <div key={index + 1} className="mapping-entry">
                    <h5>Task #{entry.order} Mapping</h5>
                    {/* TODO: Re-enable when MappingEditor is implemented
                    <MappingEditor
                      mapping={entry.mapping || { location: 'inline', code: '' }}
                      onChange={(mapping) => {
                        const newState = { ...state };
                        if (newState.onEntries) {
                          newState.onEntries[index + 1].mapping = mapping;
                          onChange(newState, hints);
                        }
                      }}
                      context={{
                        availableVariables: ['context', 'input', 'state', `task${index + 1}Result`],
                        taskSchema: {}
                      }}
                    /> */}
                    <div style={{ padding: '10px', background: '#f0f0f0', borderRadius: '4px' }}>
                      MappingEditor component not yet implemented
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}