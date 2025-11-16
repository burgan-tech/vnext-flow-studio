import React, { useState, useEffect, useCallback } from 'react';
import type { Label, Workflow } from '@amorphie-workflow/core';
import { DEFAULT_LANGUAGES, DEFAULT_LANGUAGE_LABELS, ensureRequiredLanguages, validateRequiredLanguages } from '../../utils/languageConstants';

interface TransitionLabelEditPopupProps {
  transitionId: string;
  workflow: Workflow;
  onClose: () => void;
  onApply: (transitionId: string, labels: Label[]) => void;
}

const COMMON_LANGUAGES = ['en-US', 'tr-TR'];

export function TransitionLabelEditPopup({ transitionId, workflow, onClose, onApply }: TransitionLabelEditPopupProps) {
  const [labels, setLabels] = useState<Label[]>([{ label: '', language: 'en-US' }]);
  const [activeLanguage, setActiveLanguage] = useState<string>(DEFAULT_LANGUAGES[0]);
  const [isDirty, setIsDirty] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [transitionKey, setTransitionKey] = useState('');
  const [transitionType, setTransitionType] = useState<'local' | 'shared' | 'start'>('local');
  const [initialLabels, setInitialLabels] = useState<Label[]>([]);

  // Load current labels based on transition ID
  useEffect(() => {
    const localMatch = /^t:local:([^:]+):(.+)$/.exec(transitionId);
    const sharedMatch = /^t:shared:([^:]+):/.exec(transitionId);
    const startMatch = /^t:start:(.+)$/.exec(transitionId);

    let currentLabels: Label[] = [];

    if (localMatch) {
      const [, from, tKey] = localMatch;
      setTransitionType('local');
      setTransitionKey(tKey);
      const state = workflow.attributes?.states?.find(s => s.key === from);
      const transition = state?.transitions?.find(t => t.key === tKey);
      currentLabels = transition?.labels || [];
    } else if (sharedMatch) {
      const [, tKey] = sharedMatch;
      setTransitionType('shared');
      setTransitionKey(tKey);
      const transition = workflow.attributes?.sharedTransitions?.find(t => t.key === tKey);
      currentLabels = transition?.labels || [];
    } else if (startMatch) {
      const [, tKey] = startMatch;
      setTransitionType('start');
      setTransitionKey(tKey);
      currentLabels = workflow.attributes?.startTransition?.labels || [];
    }

    const labelsWithDefaults = currentLabels.length > 0 ? [...currentLabels] : [{ label: '', language: 'en-US' }];
    const labelsToUse = ensureRequiredLanguages(labelsWithDefaults);
    setLabels(labelsToUse);
    setInitialLabels(currentLabels);
    setActiveLanguage(DEFAULT_LANGUAGES[0]);
  }, [transitionId, workflow]);

  // Mark as dirty when labels change
  useEffect(() => {
    const hasChanges = JSON.stringify(labels) !== JSON.stringify(initialLabels);
    setIsDirty(hasChanges);
  }, [labels, initialLabels]);

  const handleLabelChange = useCallback((language: string, value: string) => {
    setLabels(prev => {
      const existing = prev.find(l => l.language === language);
      if (existing) {
        return prev.map(l => l.language === language ? { ...l, label: value } : l);
      } else {
        return [...prev, { language, label: value }];
      }
    });
  }, []);

  const handleAddLanguage = useCallback(() => {
    // Find first language not already in use
    const unusedLang = COMMON_LANGUAGES.find(lang => !labels.some(l => l.language === lang));
    const newLang = unusedLang || `lang-${labels.length + 1}`;

    setLabels(prev => [...prev, { language: newLang, label: '' }]);
    setActiveLanguage(newLang);
  }, [labels]);

  const handleRemoveLanguage = useCallback((language: string) => {
    // Prevent removal of required default languages
    if ((DEFAULT_LANGUAGES as readonly string[]).includes(language)) {
      return;
    }

    setLabels(prev => prev.filter(l => l.language !== language));

    // Switch to first remaining language
    if (activeLanguage === language) {
      const remaining = labels.filter(l => l.language !== language);
      if (remaining.length > 0) {
        setActiveLanguage(remaining[0].language);
      }
    }
  }, [labels, activeLanguage]);

  const handleApply = useCallback(() => {
    // Validate that all required languages have labels
    const validation = validateRequiredLanguages(labels);
    if (!validation.valid) {
      setValidationError(`Required languages are missing labels: ${validation.missingLanguages.join(', ')}`);
      return;
    }

    // Filter out empty labels from non-required languages
    const validLabels = labels.filter(l =>
      l.label.trim() !== '' || (DEFAULT_LANGUAGES as readonly string[]).includes(l.language)
    );
    onApply(transitionId, validLabels);
    onClose();
  }, [labels, onApply, onClose, transitionId]);

  // Handle ESC key to close, Ctrl/Cmd+Enter to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleApply();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, handleApply]);

  const activeLabel = labels.find(l => l.language === activeLanguage);
  const typeLabel = transitionType === 'local' ? 'Local' : transitionType === 'shared' ? 'Shared' : 'Start';

  return (
    <div className="state-edit-popup-overlay" onClick={onClose}>
      <div className="state-edit-popup state-edit-popup--medium" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="state-edit-popup__header">
          <h3 className="state-edit-popup__title">
            Edit {typeLabel} Transition Labels: {transitionKey}
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

        {/* Language Tabs */}
        <div className="state-edit-popup__tabs">
          {labels.map((label) => {
            const isRequired = (DEFAULT_LANGUAGES as readonly string[]).includes(label.language);
            const canRemove = !isRequired && labels.length > 1;
            return (
              <button
                key={label.language}
                type="button"
                className={`state-edit-popup__tab ${activeLanguage === label.language ? 'active' : ''}`}
                onClick={() => setActiveLanguage(label.language)}
              >
                {DEFAULT_LANGUAGE_LABELS[label.language] || label.language}
                {isRequired && <span className="state-edit-popup__tab-required" title="Required language">*</span>}
                {canRemove && (
                  <span
                    className="state-edit-popup__tab-remove"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveLanguage(label.language);
                    }}
                    title="Remove language"
                  >
                    ×
                  </span>
                )}
              </button>
            );
          })}
          <button
            type="button"
            className="state-edit-popup__tab state-edit-popup__tab--add"
            onClick={handleAddLanguage}
            title="Add language"
          >
            + Add Language
          </button>
        </div>

        {/* Content */}
        <div className="state-edit-popup__content">
          <div className="state-edit-popup__field">
            <label className="state-edit-popup__label">
              Label ({activeLanguage})
              {(DEFAULT_LANGUAGES as readonly string[]).includes(activeLanguage) && (
                <span className="state-edit-popup__required">*</span>
              )}
            </label>
            <input
              type="text"
              className="state-edit-popup__input"
              value={activeLabel?.label || ''}
              onChange={(e) => handleLabelChange(activeLanguage, e.target.value)}
              placeholder={`Enter label in ${activeLanguage}`}
              autoFocus
            />
            <p className="state-edit-popup__help">
              Labels are displayed on the transition edges for different languages. Languages marked with * are required.
            </p>
            {validationError && (
              <p style={{ color: '#dc2626', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                {validationError}
              </p>
            )}
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
            disabled={!!validationError}
          >
            Apply Changes
          </button>
        </div>
      </div>
    </div>
  );
}
