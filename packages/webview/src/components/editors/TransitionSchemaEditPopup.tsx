import React, { useState, useCallback, useEffect } from 'react';
import { ExternalLink } from 'lucide-react';
import type { Workflow, SchemaRef, Transition, SharedTransition } from '@amorphie-workflow/core';
import { SchemaSearchPanel } from './SchemaSearchPanel';

interface TransitionSchemaEditPopupProps {
  transitionId: string; // Edge ID like "t:local:StartForm:next" or "t:shared:timeout:..."
  workflow: Workflow;
  availableSchemas: any[];
  onClose: () => void;
  onApply: (transitionId: string, schema: SchemaRef | null) => void;
  postMessage: (message: any) => void;
}

/**
 * Format SchemaRef as string for display
 */
function formatSchemaRef(schemaRef: SchemaRef | null | undefined): string {
  if (!schemaRef) return '';
  if ('ref' in schemaRef) {
    return schemaRef.ref || '';
  }
  if (schemaRef.domain && schemaRef.version) {
    const flow = schemaRef.flow || 'sys-schemas';
    return `${schemaRef.domain}/${flow}/${schemaRef.key}@${schemaRef.version}`;
  }
  return schemaRef.key || '';
}

/**
 * Parse schema reference string into SchemaRef object
 */
function parseSchemaRef(ref: string): SchemaRef | null {
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
 * Get transition from workflow by edge ID
 */
function getTransitionByEdgeId(workflow: Workflow, edgeId: string): { transition: Transition | SharedTransition; isShared: boolean; fromState?: string } | null {
  // Check for local transition: t:local:from:key
  const localMatch = /^t:local:([^:]+):(.+)$/.exec(edgeId);
  if (localMatch) {
    const [, from, transitionKey] = localMatch;
    const state = workflow.attributes.states.find(s => s.key === from);
    const transition = state?.transitions?.find(t => t.key === transitionKey);
    if (transition) {
      return { transition, isShared: false, fromState: from };
    }
  }

  // Check for shared transition: t:shared:key:...
  const sharedMatch = /^t:shared:([^:]+):/.exec(edgeId);
  if (sharedMatch) {
    const [, transitionKey] = sharedMatch;
    const transition = workflow.attributes.sharedTransitions?.find(t => t.key === transitionKey);
    if (transition) {
      return { transition, isShared: true };
    }
  }

  // Check for start transition: t:start:key
  const startMatch = /^t:start:(.+)$/.exec(edgeId);
  if (startMatch && workflow.attributes?.startTransition) {
    return { transition: workflow.attributes.startTransition, isShared: false };
  }

  return null;
}

export function TransitionSchemaEditPopup({
  transitionId,
  workflow,
  availableSchemas,
  onClose,
  onApply,
  postMessage
}: TransitionSchemaEditPopupProps) {
  const transitionData = getTransitionByEdgeId(workflow, transitionId);

  console.log('[TransitionSchemaEditPopup] transitionId:', transitionId);
  console.log('[TransitionSchemaEditPopup] transitionData:', transitionData);
  console.log('[TransitionSchemaEditPopup] transition.schema:', transitionData?.transition?.schema);
  console.log('[TransitionSchemaEditPopup] availableSchemas count:', availableSchemas?.length);
  console.log('[TransitionSchemaEditPopup] availableSchemas:', availableSchemas);

  const [selectedSchema, setSelectedSchema] = useState<string>(
    () => {
      const formatted = transitionData ? formatSchemaRef(transitionData.transition.schema) : '';
      console.log('[TransitionSchemaEditPopup] formatted schema:', formatted);
      return formatted;
    }
  );
  const [isDirty, setIsDirty] = useState(false);

  const handleSchemaChange = useCallback((ref: string) => {
    setSelectedSchema(ref);
    setIsDirty(true);
  }, []);

  const handleApply = useCallback(() => {
    const schemaRef = parseSchemaRef(selectedSchema);
    onApply(transitionId, schemaRef);
    onClose();
  }, [transitionId, selectedSchema, onApply, onClose]);

  const handleCancel = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleClear = useCallback(() => {
    onApply(transitionId, null);
    onClose();
  }, [transitionId, onApply, onClose]);

  const handleOpenSchema = useCallback(() => {
    if (!transitionData?.transition?.schema) return;

    const schema = transitionData.transition.schema;
    postMessage({
      type: 'dependency:open',
      dependency: {
        type: 'Schema',
        key: schema.key,
        domain: schema.domain,
        flow: schema.flow,
        version: schema.version,
        ref: 'ref' in schema ? schema.ref : undefined
      }
    });
  }, [transitionData, postMessage]);

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

  if (!transitionData) {
    return null;
  }

  const transitionLabel = transitionData.isShared
    ? `Shared: ${transitionData.transition.key}`
    : transitionData.fromState
    ? `${transitionData.fromState} → ${transitionData.transition.target}`
    : `Start → ${transitionData.transition.target}`;

  return (
    <div className="state-edit-popup-overlay" onClick={onClose}>
      <div className="state-edit-popup" onClick={(e) => e.stopPropagation()}>
        <div className="state-edit-popup__header">
          <h2>Edit Transition Schema</h2>
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
            <strong>Transition:</strong> {transitionLabel}
          </div>

          {transitionData?.transition?.schema && (
            <div className="state-edit-popup__info" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
              <strong>Current Schema:</strong>
              <span>{formatSchemaRef(transitionData.transition.schema)}</span>
              <button
                className="state-edit-popup__btn state-edit-popup__btn--secondary"
                onClick={handleOpenSchema}
                title="Open schema file in new editor"
                style={{ padding: '4px 8px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <ExternalLink size={14} />
                Open Schema File
              </button>
            </div>
          )}

          <SchemaSearchPanel
            availableSchemas={availableSchemas}
            selectedSchemaRef={selectedSchema}
            onSelectSchema={handleSchemaChange}
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
            Clear Schema
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
