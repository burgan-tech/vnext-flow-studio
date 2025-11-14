import React, { useState, useEffect, useCallback } from 'react';
import type { Workflow } from '@amorphie-workflow/core';

interface TransitionKeyEditPopupProps {
  transitionId: string;
  workflow: Workflow;
  onClose: () => void;
  onApply: (transitionId: string, newKey: string) => void;
}

export function TransitionKeyEditPopup({ transitionId, workflow, onClose, onApply }: TransitionKeyEditPopupProps) {
  const [newKey, setNewKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLocal, setIsLocal] = useState(false);
  const [isShared, setIsShared] = useState(false);
  const [fromState, setFromState] = useState('');
  const [currentKey, setCurrentKey] = useState('');

  // Parse transition ID and get current key
  useEffect(() => {
    const localMatch = /^t:local:([^:]+):(.+)$/.exec(transitionId);
    const sharedMatch = /^t:shared:([^:]+):/.exec(transitionId);
    const startMatch = /^t:start:(.+)$/.exec(transitionId);

    if (localMatch) {
      const [, from, tKey] = localMatch;
      setIsLocal(true);
      setFromState(from);
      setCurrentKey(tKey);
      setNewKey(tKey);
    } else if (sharedMatch) {
      const [, tKey] = sharedMatch;
      setIsShared(true);
      setCurrentKey(tKey);
      setNewKey(tKey);
    } else if (startMatch) {
      const [, tKey] = startMatch;
      setCurrentKey(tKey);
      setNewKey(tKey);
    }
  }, [transitionId]);

  // Validate key
  const validateKey = useCallback((key: string): string | null => {
    if (!key || key.trim() === '') {
      return 'Transition key is required';
    }

    // Check format (alphanumeric, hyphens, underscores only)
    if (!/^[a-zA-Z0-9_-]+$/.test(key)) {
      return 'Key can only contain letters, numbers, hyphens, and underscores';
    }

    // Check uniqueness
    if (key.toLowerCase() !== currentKey.toLowerCase()) {
      if (isLocal) {
        // Check within the same state's transitions
        const state = workflow.attributes?.states?.find(s => s.key === fromState);
        const exists = state?.transitions?.some(
          t => t.key.toLowerCase() === key.toLowerCase()
        );
        if (exists) {
          return 'A transition with this key already exists in this state';
        }
      } else if (isShared) {
        // Check within shared transitions
        const exists = workflow.attributes?.sharedTransitions?.some(
          t => t.key.toLowerCase() === key.toLowerCase()
        );
        if (exists) {
          return 'A shared transition with this key already exists';
        }
      } else {
        // Start transition
        const startKey = workflow.attributes?.startTransition?.key;
        if (startKey && startKey.toLowerCase() === key.toLowerCase()) {
          return 'A start transition with this key already exists';
        }
      }
    }

    return null;
  }, [currentKey, workflow, isLocal, isShared, fromState]);

  // Validate on change
  useEffect(() => {
    setError(validateKey(newKey));
  }, [newKey, validateKey]);

  const handleApply = useCallback(() => {
    const validationError = validateKey(newKey);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (newKey !== currentKey) {
      onApply(transitionId, newKey);
    }
    onClose();
  }, [newKey, currentKey, validateKey, onApply, onClose, transitionId]);

  // Handle ESC key to close, Ctrl/Cmd+Enter to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !error) {
        e.preventDefault();
        handleApply();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, handleApply, error]);

  const transitionType = isLocal ? 'Local' : isShared ? 'Shared' : 'Start';

  return (
    <div className="state-edit-popup-overlay" onClick={onClose}>
      <div className="state-edit-popup" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="state-edit-popup__header">
          <h3 className="state-edit-popup__title">Edit {transitionType} Transition Key</h3>
          <button
            className="state-edit-popup__close-btn"
            onClick={onClose}
            aria-label="Close"
            type="button"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="state-edit-popup__content">
          <div className="state-edit-popup__field">
            <label className="state-edit-popup__label">
              Transition Key <span className="state-edit-popup__required">*</span>
            </label>
            <input
              type="text"
              className={`state-edit-popup__input ${error ? 'state-edit-popup__input--error' : ''}`}
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="Enter transition key"
              autoFocus
            />
            {error && (
              <p className="state-edit-popup__error">{error}</p>
            )}
            <p className="state-edit-popup__help">
              Key must be unique within its scope and contain only letters, numbers, hyphens, and underscores.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="state-edit-popup__footer">
          <small className="state-edit-popup__help">
            Ctrl/Cmd+Enter to apply • Esc to cancel
          </small>
          <button
            type="button"
            className="state-edit-popup__btn state-edit-popup__btn--secondary"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="state-edit-popup__btn state-edit-popup__btn--primary"
            onClick={handleApply}
            disabled={!!error || newKey === currentKey}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
