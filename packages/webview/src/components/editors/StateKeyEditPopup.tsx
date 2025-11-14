import React, { useState, useEffect, useCallback } from 'react';
import type { Workflow } from '@amorphie-workflow/core';

interface StateKeyEditPopupProps {
  currentKey: string;
  workflow: Workflow;
  onClose: () => void;
  onApply: (oldKey: string, newKey: string) => void;
}

export function StateKeyEditPopup({ currentKey, workflow, onClose, onApply }: StateKeyEditPopupProps) {
  const [newKey, setNewKey] = useState(currentKey);
  const [error, setError] = useState<string | null>(null);

  // Validate key
  const validateKey = useCallback((key: string): string | null => {
    if (!key || key.trim() === '') {
      return 'State key is required';
    }

    // Check format (alphanumeric, hyphens, underscores only)
    if (!/^[a-zA-Z0-9_-]+$/.test(key)) {
      return 'Key can only contain letters, numbers, hyphens, and underscores';
    }

    // Check uniqueness (case-insensitive)
    if (key.toLowerCase() !== currentKey.toLowerCase()) {
      const exists = workflow.attributes?.states?.some(
        s => s.key.toLowerCase() === key.toLowerCase()
      );
      if (exists) {
        return 'A state with this key already exists';
      }
    }

    return null;
  }, [currentKey, workflow]);

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
      onApply(currentKey, newKey);
    }
    onClose();
  }, [newKey, currentKey, validateKey, onApply, onClose]);

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

  return (
    <div className="state-edit-popup-overlay" onClick={onClose}>
      <div className="state-edit-popup" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="state-edit-popup__header">
          <h3 className="state-edit-popup__title">Edit State Key</h3>
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
              State Key <span className="state-edit-popup__required">*</span>
            </label>
            <input
              type="text"
              className={`state-edit-popup__input ${error ? 'state-edit-popup__input--error' : ''}`}
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="Enter state key"
              autoFocus
            />
            {error && (
              <p className="state-edit-popup__error">{error}</p>
            )}
            <p className="state-edit-popup__help">
              Key must be unique and contain only letters, numbers, hyphens, and underscores.
              All references will be automatically updated.
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
