import React, { useState, useEffect, useCallback } from 'react';
import type { Workflow, TimerConfig } from '@amorphie-workflow/core';

interface TimeoutConfigPopupProps {
  transitionId: string;
  workflow: Workflow;
  onClose: () => void;
  onApply: (transitionId: string, timer: TimerConfig) => void;
}

export function TimeoutConfigPopup({ transitionId, workflow, onClose, onApply }: TimeoutConfigPopupProps) {
  const [duration, setDuration] = useState('');
  const [reset, setReset] = useState<'N' | 'R'>('N');
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [transitionKey, setTransitionKey] = useState('');
  const [, setTransitionType] = useState<'local' | 'shared' | 'start'>('local');
  const [initialTimer, setInitialTimer] = useState<TimerConfig | null>(null);

  // Load current timer config based on transition ID
  useEffect(() => {
    const localMatch = /^t:local:([^:]+):(.+)$/.exec(transitionId);
    const sharedMatch = /^t:shared:([^:]+):/.exec(transitionId);
    const startMatch = /^t:start:(.+)$/.exec(transitionId);

    let currentTimer: TimerConfig | null = null;

    if (localMatch) {
      const [, from, tKey] = localMatch;
      setTransitionType('local');
      setTransitionKey(tKey);
      const state = workflow.attributes?.states?.find(s => s.key === from);
      const transition = state?.transitions?.find(t => t.key === tKey);
      currentTimer = transition?.timer || null;
    } else if (sharedMatch) {
      const [, tKey] = sharedMatch;
      setTransitionType('shared');
      setTransitionKey(tKey);
      const transition = workflow.attributes?.sharedTransitions?.find(t => t.key === tKey);
      currentTimer = transition?.timer || null;
    } else if (startMatch) {
      const [, tKey] = startMatch;
      setTransitionType('start');
      setTransitionKey(tKey);
      currentTimer = workflow.attributes?.startTransition?.timer || null;
    }

    setInitialTimer(currentTimer);
    if (currentTimer) {
      setDuration(currentTimer.duration || '');
      setReset(currentTimer.reset === 'R' ? 'R' : 'N');
    } else {
      // Default values for new timer
      setDuration('PT1H');
      setReset('N');
    }
  }, [transitionId, workflow]);

  // Mark as dirty when values change
  useEffect(() => {
    const hasChanges =
      !initialTimer ||
      initialTimer.duration !== duration ||
      initialTimer.reset !== reset;
    setIsDirty(hasChanges);
  }, [duration, reset, initialTimer]);

  // Validate duration (basic ISO 8601 duration format check)
  const validateDuration = useCallback((value: string): string | null => {
    if (!value || value.trim() === '') {
      return 'Duration is required';
    }

    // Basic ISO 8601 duration format validation (PT#H#M#S, PT#M, PT#S, etc.)
    const iso8601Pattern = /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/;
    if (!iso8601Pattern.test(value)) {
      return 'Duration must be in ISO 8601 format (e.g., PT1H30M for 1 hour 30 minutes)';
    }

    // Ensure at least one time component is present after 'T'
    if (value.startsWith('PT') && value.length <= 2) {
      return 'Duration must specify at least one time component';
    }

    return null;
  }, []);

  // Validate on change
  useEffect(() => {
    setError(validateDuration(duration));
  }, [duration, validateDuration]);

  const handleApply = useCallback(() => {
    const validationError = validateDuration(duration);
    if (validationError) {
      setError(validationError);
      return;
    }

    const timerConfig: TimerConfig = {
      duration: duration.trim(),
      reset,
    };

    onApply(transitionId, timerConfig);
    onClose();
  }, [duration, reset, validateDuration, onApply, onClose, transitionId]);

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

  // Helper function to set common duration presets
  const setPreset = (preset: string) => {
    setDuration(preset);
  };

  return (
    <div className="state-edit-popup-overlay" onClick={onClose}>
      <div className="state-edit-popup state-edit-popup--medium" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="state-edit-popup__header">
          <h3 className="state-edit-popup__title">
            Timeout Configuration: {transitionKey}
            {isDirty && <span className="state-edit-popup__dirty"> *</span>}
          </h3>
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
              Duration <span className="state-edit-popup__required">*</span>
            </label>
            <input
              type="text"
              className={`state-edit-popup__input ${error ? 'state-edit-popup__input--error' : ''}`}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="PT1H30M"
              autoFocus
            />
            {error && (
              <p className="state-edit-popup__error">{error}</p>
            )}
            <p className="state-edit-popup__help">
              ISO 8601 duration format. Examples: PT30S (30 seconds), PT5M (5 minutes), PT1H (1 hour), PT1H30M (1.5 hours)
            </p>

            {/* Quick presets */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="state-edit-popup__btn state-edit-popup__btn--secondary"
                onClick={() => setPreset('PT30S')}
                style={{ padding: '4px 8px', fontSize: '12px' }}
              >
                30s
              </button>
              <button
                type="button"
                className="state-edit-popup__btn state-edit-popup__btn--secondary"
                onClick={() => setPreset('PT1M')}
                style={{ padding: '4px 8px', fontSize: '12px' }}
              >
                1m
              </button>
              <button
                type="button"
                className="state-edit-popup__btn state-edit-popup__btn--secondary"
                onClick={() => setPreset('PT5M')}
                style={{ padding: '4px 8px', fontSize: '12px' }}
              >
                5m
              </button>
              <button
                type="button"
                className="state-edit-popup__btn state-edit-popup__btn--secondary"
                onClick={() => setPreset('PT15M')}
                style={{ padding: '4px 8px', fontSize: '12px' }}
              >
                15m
              </button>
              <button
                type="button"
                className="state-edit-popup__btn state-edit-popup__btn--secondary"
                onClick={() => setPreset('PT30M')}
                style={{ padding: '4px 8px', fontSize: '12px' }}
              >
                30m
              </button>
              <button
                type="button"
                className="state-edit-popup__btn state-edit-popup__btn--secondary"
                onClick={() => setPreset('PT1H')}
                style={{ padding: '4px 8px', fontSize: '12px' }}
              >
                1h
              </button>
              <button
                type="button"
                className="state-edit-popup__btn state-edit-popup__btn--secondary"
                onClick={() => setPreset('PT24H')}
                style={{ padding: '4px 8px', fontSize: '12px' }}
              >
                24h
              </button>
            </div>
          </div>

          <div className="state-edit-popup__field" style={{ marginTop: '16px' }}>
            <label className="state-edit-popup__label">
              Reset Strategy
            </label>
            <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="reset"
                  value="N"
                  checked={reset === 'N'}
                  onChange={(e) => setReset(e.target.value as 'N')}
                  style={{ marginRight: '8px' }}
                />
                <span>No Reset (N)</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="reset"
                  value="R"
                  checked={reset === 'R'}
                  onChange={(e) => setReset(e.target.value as 'R')}
                  style={{ marginRight: '8px' }}
                />
                <span>Reset (R)</span>
              </label>
            </div>
            <p className="state-edit-popup__help">
              Choose whether the timer should reset when the state is re-entered.
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
            disabled={!!error}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
