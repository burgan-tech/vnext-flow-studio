import React, { useState, useEffect, useCallback } from 'react';
import type { Workflow, ScriptCode } from '@amorphie-workflow/core';
import { decodeBase64, encodeBase64 } from '../../utils/base64Utils';

interface TimeoutConfigPopupProps {
  transitionId: string;
  workflow: Workflow;
  onClose: () => void;
  onApply: (transitionId: string, timer: ScriptCode) => void;
}

type TimerMode = 'simple' | 'advanced';

// Template for static timer code
const STATIC_TIMER_TEMPLATE = `using System.Threading.Tasks;
using BBT.Workflow.Scripting;
using BBT.Workflow.Definitions.Timer;

public class StaticTimer : ITimerMapping
{
    public async Task<TimerSchedule> Handler(ScriptContext context)
    {
        // Static duration: {{DURATION}}
        return TimerSchedule.FromDuration("{{DURATION}}", resetOnEntry: {{RESET}});
    }
}
`;

// Regex to detect and parse static timer code
const STATIC_TIMER_PATTERN = /TimerSchedule\.FromDuration\s*\(\s*"([^"]+)"(?:\s*,\s*resetOnEntry:\s*(true|false))?\s*\)/;

/**
 * Parse existing timer code to extract duration and reset values if it's a static timer
 */
function parseStaticTimer(code: string): { duration: string; reset: boolean } | null {
  const decoded = decodeBase64(code);
  const match = STATIC_TIMER_PATTERN.exec(decoded);
  if (match) {
    return {
      duration: match[1],
      reset: match[2] === 'true'
    };
  }
  return null;
}

/**
 * Generate static timer code from duration and reset values
 */
function generateStaticTimerCode(duration: string, reset: boolean): string {
  return STATIC_TIMER_TEMPLATE
    .replace(/\{\{DURATION\}\}/g, duration)
    .replace('{{RESET}}', reset ? 'true' : 'false');
}

/**
 * Check if the code is custom (not a static timer)
 */
function isCustomCode(code: string | undefined): boolean {
  if (!code) return false;
  const decoded = decodeBase64(code);
  // If it contains ITimerMapping but doesn't match static pattern, it's custom
  if (decoded.includes('ITimerMapping') && !STATIC_TIMER_PATTERN.test(decoded)) {
    return true;
  }
  // If it contains other complex patterns, it's custom
  if (decoded.includes('context.Instance') || decoded.includes('DateTime.') || decoded.includes('switch')) {
    return true;
  }
  return false;
}

export function TimeoutConfigPopup({ transitionId, workflow, onClose, onApply }: TimeoutConfigPopupProps) {
  const [mode, setMode] = useState<TimerMode>('simple');
  const [duration, setDuration] = useState('PT1H');
  const [reset, setReset] = useState(false);
  const [customCode, setCustomCode] = useState('');
  const [location, setLocation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [transitionKey, setTransitionKey] = useState('');
  const [initialTimer, setInitialTimer] = useState<ScriptCode | null>(null);

  // Load current timer config based on transition ID
  useEffect(() => {
    const localMatch = /^t:local:([^:]+):(.+)$/.exec(transitionId);
    const sharedMatch = /^t:shared:([^:]+):/.exec(transitionId);
    const startMatch = /^t:start:(.+)$/.exec(transitionId);

    let currentTimer: ScriptCode | null = null;

    if (localMatch) {
      const [, from, tKey] = localMatch;
      setTransitionKey(tKey);
      const state = workflow.attributes?.states?.find(s => s.key === from);
      const transition = state?.transitions?.find(t => t.key === tKey);
      currentTimer = transition?.timer || null;
    } else if (sharedMatch) {
      const [, tKey] = sharedMatch;
      setTransitionKey(tKey);
      const transition = workflow.attributes?.sharedTransitions?.find(t => t.key === tKey);
      currentTimer = transition?.timer || null;
    } else if (startMatch) {
      const [, tKey] = startMatch;
      setTransitionKey(tKey);
      currentTimer = workflow.attributes?.startTransition?.timer || null;
    }

    setInitialTimer(currentTimer);

    if (currentTimer) {
      setLocation(currentTimer.location || '');

      // Try to parse as static timer
      const parsed = currentTimer.code ? parseStaticTimer(currentTimer.code) : null;

      if (parsed && !isCustomCode(currentTimer.code)) {
        // It's a static timer - use simple mode
        setMode('simple');
        setDuration(parsed.duration);
        setReset(parsed.reset);
        setCustomCode(decodeBase64(currentTimer.code || ''));
      } else if (currentTimer.code) {
        // It's custom code - use advanced mode
        setMode('advanced');
        setCustomCode(decodeBase64(currentTimer.code));
        // Try to extract duration for reference
        const durationMatch = /"(P[^"]+)"/.exec(currentTimer.code);
        if (durationMatch) {
          setDuration(durationMatch[1]);
        }
      } else {
        // No code yet - default to simple mode
        setMode('simple');
        setDuration('PT1H');
        setReset(false);
      }
    } else {
      // New timer - default values
      setMode('simple');
      setDuration('PT1H');
      setReset(false);
      setLocation(`./src/timers/${transitionKey || 'timer'}.csx`);
    }
  }, [transitionId, workflow, transitionKey]);

  // Update location when transition key changes
  useEffect(() => {
    if (!location && transitionKey) {
      setLocation(`./src/timers/${transitionKey}.csx`);
    }
  }, [transitionKey, location]);

  // Mark as dirty when values change
  useEffect(() => {
    if (!initialTimer) {
      setIsDirty(duration !== 'PT1H' || reset !== false || customCode !== '');
      return;
    }

    if (mode === 'simple') {
      const parsed = initialTimer.code ? parseStaticTimer(initialTimer.code) : null;
      const hasChanges = !parsed || parsed.duration !== duration || parsed.reset !== reset;
      setIsDirty(hasChanges);
    } else {
      const originalCode = decodeBase64(initialTimer.code || '');
      setIsDirty(customCode !== originalCode);
    }
  }, [mode, duration, reset, customCode, initialTimer]);

  // Validate duration (basic ISO 8601 duration format check)
  const validateDuration = useCallback((value: string): string | null => {
    if (!value || value.trim() === '') {
      return 'Duration is required';
    }

    // Basic ISO 8601 duration format validation
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
    if (mode === 'simple') {
      setError(validateDuration(duration));
    } else {
      // Validate custom code
      if (!customCode.trim()) {
        setError('Timer code is required');
      } else if (!customCode.includes('ITimerMapping')) {
        setError('Timer code must implement ITimerMapping interface');
      } else if (!customCode.includes('TimerSchedule')) {
        setError('Timer code must return a TimerSchedule');
      } else {
        setError(null);
      }
    }
  }, [mode, duration, customCode, validateDuration]);

  const handleApply = useCallback(() => {
    if (error) return;

    let code: string;
    if (mode === 'simple') {
      code = generateStaticTimerCode(duration.trim(), reset);
    } else {
      code = customCode;
    }

    const timerScript: ScriptCode = {
      location: location || `./src/timers/${transitionKey}.csx`,
      code: encodeBase64(code),
      encoding: 'B64',
      type: 'L'
    };

    onApply(transitionId, timerScript);
    onClose();
  }, [mode, duration, reset, customCode, location, transitionKey, error, onApply, onClose, transitionId]);

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

  // Switch to advanced mode with current code
  const switchToAdvanced = () => {
    if (mode === 'simple') {
      setCustomCode(generateStaticTimerCode(duration, reset));
    }
    setMode('advanced');
  };

  // Try to switch to simple mode (only if code is parseable)
  const switchToSimple = () => {
    const parsed = parseStaticTimer(customCode);
    if (parsed) {
      setDuration(parsed.duration);
      setReset(parsed.reset);
      setMode('simple');
    } else {
      setError('Cannot switch to Simple mode - code contains custom logic');
    }
  };

  return (
    <div className="state-edit-popup-overlay" onClick={onClose}>
      <div className="state-edit-popup state-edit-popup--medium" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="state-edit-popup__header">
          <h3 className="state-edit-popup__title">
            Timer Configuration: {transitionKey}
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

        {/* Mode Toggle */}
        <div style={{
          display: 'flex',
          gap: '8px',
          padding: '12px 16px',
          borderBottom: '1px solid #e2e8f0',
          backgroundColor: '#f8fafc'
        }}>
          <button
            type="button"
            className={`state-edit-popup__btn ${mode === 'simple' ? 'state-edit-popup__btn--primary' : 'state-edit-popup__btn--secondary'}`}
            onClick={() => mode === 'advanced' ? switchToSimple() : null}
            style={{ flex: 1, padding: '8px' }}
          >
            Simple (Static Duration)
          </button>
          <button
            type="button"
            className={`state-edit-popup__btn ${mode === 'advanced' ? 'state-edit-popup__btn--primary' : 'state-edit-popup__btn--secondary'}`}
            onClick={switchToAdvanced}
            style={{ flex: 1, padding: '8px' }}
          >
            Advanced (Custom Code)
          </button>
        </div>

        {/* Content */}
        <div className="state-edit-popup__content">
          {/* Location field - common to both modes */}
          <div className="state-edit-popup__field">
            <label className="state-edit-popup__label">
              Script Location
            </label>
            <input
              type="text"
              className="state-edit-popup__input"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="./src/timers/my-timer.csx"
            />
            <p className="state-edit-popup__help">
              File path for the timer script (relative to workflow file)
            </p>
          </div>

          {mode === 'simple' ? (
            <>
              <div className="state-edit-popup__field" style={{ marginTop: '16px' }}>
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
                  ISO 8601 duration format. Examples: PT30S (30 seconds), PT5M (5 minutes), PT1H (1 hour)
                </p>

                {/* Quick presets */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                  {['PT30S', 'PT1M', 'PT5M', 'PT15M', 'PT30M', 'PT1H', 'PT24H'].map(preset => (
                    <button
                      key={preset}
                      type="button"
                      className="state-edit-popup__btn state-edit-popup__btn--secondary"
                      onClick={() => setPreset(preset)}
                      style={{ padding: '4px 8px', fontSize: '12px' }}
                    >
                      {preset.replace('PT', '').toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="state-edit-popup__field" style={{ marginTop: '16px' }}>
                <label className="state-edit-popup__label">
                  Reset on Re-entry
                </label>
                <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="reset"
                      checked={!reset}
                      onChange={() => setReset(false)}
                      style={{ marginRight: '8px' }}
                    />
                    <span>No Reset</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="reset"
                      checked={reset}
                      onChange={() => setReset(true)}
                      style={{ marginRight: '8px' }}
                    />
                    <span>Reset Timer</span>
                  </label>
                </div>
                <p className="state-edit-popup__help">
                  Choose whether the timer should reset when the state is re-entered.
                </p>
              </div>

              {/* Preview generated code */}
              <div className="state-edit-popup__field" style={{ marginTop: '16px' }}>
                <label className="state-edit-popup__label">
                  Generated Code Preview
                </label>
                <pre style={{
                  backgroundColor: '#1e293b',
                  color: '#e2e8f0',
                  padding: '12px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  overflow: 'auto',
                  maxHeight: '120px'
                }}>
                  {generateStaticTimerCode(duration, reset)}
                </pre>
              </div>
            </>
          ) : (
            <>
              <div className="state-edit-popup__field" style={{ marginTop: '16px' }}>
                <label className="state-edit-popup__label">
                  Timer Code <span className="state-edit-popup__required">*</span>
                </label>
                <textarea
                  className={`state-edit-popup__input ${error ? 'state-edit-popup__input--error' : ''}`}
                  value={customCode}
                  onChange={(e) => setCustomCode(e.target.value)}
                  placeholder="// Enter your custom timer code..."
                  style={{
                    minHeight: '250px',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    resize: 'vertical'
                  }}
                />
                {error && (
                  <p className="state-edit-popup__error">{error}</p>
                )}
                <p className="state-edit-popup__help">
                  C# code implementing ITimerMapping interface. Must return a TimerSchedule.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="state-edit-popup__footer">
          <small className="state-edit-popup__help">
            Ctrl/Cmd+Enter to apply
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
