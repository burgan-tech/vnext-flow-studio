import React, { useState } from 'react';

interface TaskCreationModalProps {
  onClose: () => void;
  onCreate: (taskName: string, taskType: string) => void;
}

const TASK_TYPES = [
  { value: 'http', label: 'HTTP Task' },
  { value: 'service', label: 'Service Task' },
  { value: 'script', label: 'Script Task' },
  { value: 'subprocess', label: 'Subprocess Task' },
  { value: 'user', label: 'User Task' },
  { value: 'manual', label: 'Manual Task' },
  { value: 'business-rule', label: 'Business Rule Task' },
  { value: 'send', label: 'Send Task' },
  { value: 'receive', label: 'Receive Task' }
];

export function TaskCreationModal({ onClose, onCreate }: TaskCreationModalProps) {
  const [taskName, setTaskName] = useState('');
  const [taskType, setTaskType] = useState('http');
  const [error, setError] = useState('');

  const validateTaskName = (name: string): boolean => {
    if (!name || name.trim() === '') {
      setError('Task name is required');
      return false;
    }

    // Must be lowercase with hyphens (kebab-case)
    const validPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;
    if (!validPattern.test(name)) {
      setError('Task name must be lowercase with hyphens (e.g., my-task-name)');
      return false;
    }

    setError('');
    return true;
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setTaskName(value);
    if (value) {
      validateTaskName(value);
    } else {
      setError('');
    }
  };

  const handleCreate = () => {
    if (validateTaskName(taskName)) {
      onCreate(taskName, taskType);
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
                border: error ? '1px solid #ef4444' : '1px solid #cbd5e1',
                borderRadius: '4px',
                fontSize: '14px',
                fontFamily: 'var(--vscode-font-family)',
                backgroundColor: '#ffffff',
                color: '#1e293b'
              }}
            />
            {error && (
              <div style={{
                marginTop: '6px',
                fontSize: '12px',
                color: '#ef4444'
              }}>
                {error}
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
            disabled={!taskName || !!error}
            type="button"
          >
            Create Task
          </button>
        </div>
      </div>
    </div>
  );
}
