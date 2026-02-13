import React, { useState } from 'react';

interface TaskCreationModalProps {
  onClose: () => void;
  onCreate: (taskName: string, taskType: string, version: string) => void;
  workflowDomain?: string;
}

// Task type enum values - must match @amorphie-flow-studio/core/types/task.ts
const TASK_TYPES = [
  { value: '1', label: 'Dapr HTTP Endpoint' },
  { value: '2', label: 'Dapr Binding' },
  { value: '3', label: 'Dapr Service' },
  { value: '4', label: 'Dapr PubSub' },
  { value: '5', label: 'Human Task' },
  { value: '6', label: 'HTTP Task' },
  { value: '7', label: 'Script Task' },
  { value: '10', label: 'Notification Task' },
  { value: '11', label: 'Start Flow Task' },
  { value: '12', label: 'Trigger Transition Task' },
  { value: '13', label: 'Get Instance Data Task' },
  { value: '14', label: 'Sub Process Task' },
];

export function TaskCreationModal({ onClose, onCreate, workflowDomain }: TaskCreationModalProps) {
  const [taskName, setTaskName] = useState('');
  const [taskType, setTaskType] = useState('6'); // Default to HTTP Task
  const [version, setVersion] = useState('1.0.0');
  const [nameError, setNameError] = useState('');
  const [versionError, setVersionError] = useState('');

  const validateTaskName = (name: string): boolean => {
    if (!name || name.trim() === '') {
      setNameError('Task name is required');
      return false;
    }

    // Must be lowercase with hyphens (kebab-case)
    const validPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;
    if (!validPattern.test(name)) {
      setNameError('Task name must be lowercase with hyphens (e.g., my-task-name)');
      return false;
    }

    setNameError('');
    return true;
  };

  const validateVersion = (ver: string): boolean => {
    if (!ver || ver.trim() === '') {
      setVersionError('Version is required');
      return false;
    }

    // Validate semantic version format (X.Y.Z)
    const semverPattern = /^\d+\.\d+\.\d+$/;
    if (!semverPattern.test(ver)) {
      setVersionError('Version must follow semantic versioning (e.g., 1.0.0)');
      return false;
    }

    setVersionError('');
    return true;
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setTaskName(value);
    if (value) {
      validateTaskName(value);
    } else {
      setNameError('');
    }
  };

  const handleVersionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setVersion(value);
    if (value) {
      validateVersion(value);
    } else {
      setVersionError('');
    }
  };

  const handleCreate = () => {
    const nameValid = validateTaskName(taskName);
    const versionValid = validateVersion(version);

    if (nameValid && versionValid) {
      onCreate(taskName, taskType, version);
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleCreate();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="comment-modal-overlay" onClick={onClose}>
      <div
        className="comment-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ width: '500px', maxWidth: '90vw' }}
      >
        <div className="comment-modal__header">
          <h2 className="comment-modal__title">Create New Task</h2>
          <button
            className="comment-modal__close-btn"
            onClick={onClose}
            aria-label="Close"
            type="button"
          >
            ×
          </button>
        </div>

        <div className="comment-modal__content" style={{ padding: '20px' }}>
          {/* Domain Display */}
          {workflowDomain && (
            <div style={{ marginBottom: '20px', padding: '12px', backgroundColor: '#f1f5f9', borderRadius: '4px' }}>
              <div style={{ fontSize: '12px', fontWeight: 500, color: '#64748b', marginBottom: '4px' }}>
                Domain
              </div>
              <div style={{ fontSize: '14px', color: '#1e293b', fontFamily: 'monospace' }}>
                {workflowDomain}
              </div>
            </div>
          )}

          {/* Task Name */}
          <div style={{ marginBottom: '20px' }}>
            <label
              htmlFor="task-name"
              style={{
                display: 'block',
                marginBottom: '8px',
                fontWeight: 500,
                color: '#1e293b'
              }}
            >
              Task Name *
            </label>
            <input
              id="task-name"
              type="text"
              value={taskName}
              onChange={handleNameChange}
              onKeyDown={handleKeyDown}
              placeholder="my-task-name"
              autoFocus
              style={{
                width: '100%',
                padding: '8px 12px',
                border: nameError ? '1px solid #ef4444' : '1px solid #cbd5e1',
                borderRadius: '4px',
                fontSize: '14px',
                fontFamily: 'var(--vscode-font-family)',
                backgroundColor: '#ffffff',
                color: '#1e293b'
              }}
            />
            {nameError && (
              <div style={{
                marginTop: '6px',
                fontSize: '12px',
                color: '#ef4444'
              }}>
                {nameError}
              </div>
            )}
            <div style={{
              marginTop: '6px',
              fontSize: '12px',
              color: '#64748b'
            }}>
              Use lowercase letters, numbers, and hyphens
            </div>
          </div>

          {/* Version */}
          <div style={{ marginBottom: '20px' }}>
            <label
              htmlFor="task-version"
              style={{
                display: 'block',
                marginBottom: '8px',
                fontWeight: 500,
                color: '#1e293b'
              }}
            >
              Version *
            </label>
            <input
              id="task-version"
              type="text"
              value={version}
              onChange={handleVersionChange}
              onKeyDown={handleKeyDown}
              placeholder="1.0.0"
              style={{
                width: '100%',
                padding: '8px 12px',
                border: versionError ? '1px solid #ef4444' : '1px solid #cbd5e1',
                borderRadius: '4px',
                fontSize: '14px',
                fontFamily: 'var(--vscode-font-family)',
                backgroundColor: '#ffffff',
                color: '#1e293b'
              }}
            />
            {versionError && (
              <div style={{
                marginTop: '6px',
                fontSize: '12px',
                color: '#ef4444'
              }}>
                {versionError}
              </div>
            )}
            <div style={{
              marginTop: '6px',
              fontSize: '12px',
              color: '#64748b'
            }}>
              Semantic versioning format (e.g., 1.0.0)
            </div>
          </div>

          {/* Task Type */}
          <div style={{ marginBottom: '20px' }}>
            <label
              htmlFor="task-type"
              style={{
                display: 'block',
                marginBottom: '8px',
                fontWeight: 500,
                color: '#1e293b'
              }}
            >
              Task Type *
            </label>
            <select
              id="task-type"
              value={taskType}
              onChange={(e) => setTaskType(e.target.value)}
              onKeyDown={handleKeyDown}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #cbd5e1',
                borderRadius: '4px',
                fontSize: '14px',
                fontFamily: 'var(--vscode-font-family)',
                backgroundColor: '#ffffff',
                color: '#1e293b',
                cursor: 'pointer'
              }}
            >
              {TASK_TYPES.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="comment-modal__footer">
          <button
            className="comment-modal__btn comment-modal__btn--secondary"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="comment-modal__btn comment-modal__btn--primary"
            onClick={handleCreate}
            disabled={!taskName || !version || !!nameError || !!versionError}
            type="button"
          >
            Create Task
          </button>
        </div>
      </div>
    </div>
  );
}
