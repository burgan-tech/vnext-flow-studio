import React, { useState, useCallback, useEffect } from 'react';
import type { Workflow, ViewRef } from '@amorphie-workflow/core';
import { ViewSearchPanel } from './ViewSearchPanel';

interface StateViewEditPopupProps {
  stateKey: string;
  workflow: Workflow;
  availableViews: any[];
  onClose: () => void;
  onApply: (stateKey: string, view: ViewRef | null) => void;
}

/**
 * Parse view reference string into ViewRef object
 */
function parseViewRef(ref: string): ViewRef | null {
  if (!ref) return null;

  // Check if it's a full reference: domain/flow/key@version
  const fullRefMatch = /^(.+?)\/(.+?)\/(.+?)@(.+)$/.exec(ref);
  if (fullRefMatch) {
    const [, domain, flow, key, version] = fullRefMatch;
    return { key, domain, flow, version };
  }

  // Otherwise, treat as simple key reference
  return { ref };
}

/**
 * Format ViewRef as string for display
 */
function formatViewRef(viewRef: ViewRef | null | undefined): string {
  if (!viewRef) return '';
  if ('ref' in viewRef) {
    return viewRef.ref || '';
  }
  if (viewRef.domain && viewRef.version) {
    const flow = viewRef.flow || 'sys-views';
    return `${viewRef.domain}/${flow}/${viewRef.key}@${viewRef.version}`;
  }
  return viewRef.key || '';
}

export function StateViewEditPopup({
  stateKey,
  workflow,
  availableViews,
  onClose,
  onApply
}: StateViewEditPopupProps) {
  const state = workflow.attributes?.states?.find(s => s.key === stateKey);

  const [selectedViewRef, setSelectedViewRef] = useState<string>(
    () => formatViewRef(state?.view)
  );
  const [isDirty, setIsDirty] = useState(false);

  const handleViewChange = useCallback((ref: string) => {
    setSelectedViewRef(ref);
    setIsDirty(true);
  }, []);

  const handleApply = useCallback(() => {
    const viewRef = parseViewRef(selectedViewRef);
    onApply(stateKey, viewRef);
    onClose();
  }, [stateKey, selectedViewRef, onApply, onClose]);

  const handleCancel = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleClear = useCallback(() => {
    onApply(stateKey, null);
    onClose();
  }, [stateKey, onApply, onClose]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCancel();
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        handleApply();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleApply, handleCancel]);

  if (!state) {
    return null;
  }

  return (
    <div className="state-edit-popup-overlay" onClick={onClose}>
      <div className="state-edit-popup" onClick={(e) => e.stopPropagation()}>
        <div className="state-edit-popup__header">
          <h2>Edit View Component</h2>
          <button
            className="state-edit-popup__close-btn"
            onClick={onClose}
            title="Close (Esc)"
            aria-label="Close"
            type="button"
          >
            ×
          </button>
        </div>

        <div className="state-edit-popup__content">
          <div className="state-edit-popup__info">
            <strong>State:</strong> {stateKey}
          </div>

          <ViewSearchPanel
            availableViews={availableViews}
            selectedViewRef={selectedViewRef}
            onSelectView={handleViewChange}
          />
        </div>

        <div className="state-edit-popup__footer">
          <small className="state-edit-popup__help">
            Ctrl/Cmd+Enter to apply • Esc to cancel
          </small>
          <button
            className="state-edit-popup__btn state-edit-popup__btn--secondary"
            onClick={handleClear}
          >
            Clear View
          </button>
          <button
            className="state-edit-popup__btn state-edit-popup__btn--secondary"
            onClick={handleCancel}
          >
            Cancel
          </button>
          <button
            className="state-edit-popup__btn state-edit-popup__btn--primary"
            onClick={handleApply}
            disabled={!isDirty}
          >
            Apply Changes {isDirty && '*'}
          </button>
        </div>
      </div>
    </div>
  );
}
