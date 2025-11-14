import React, { useMemo } from 'react';
import type { Workflow, State, ExecutionTask, TaskRef } from '@amorphie-workflow/core';

interface StateReferencesPopupProps {
  state: State;
  workflow: Workflow;
  onClose: () => void;
}

function formatTaskRef(task: TaskRef | string): string {
  if (typeof task === 'string') {
    return task;
  } else if ('ref' in task && task.ref) {
    return task.ref;
  } else if ('key' in task) {
    return `${task.domain}/${task.flow}/${task.key}@${task.version}`;
  }
  return 'Unknown';
}

export function StateReferencesPopup({ state, workflow, onClose }: StateReferencesPopupProps) {
  // Calculate references
  const references = useMemo(() => {
    const stateKey = state.key;

    // Tasks
    const onEntries = state.onEntries || [];
    const onExits = state.onExits || [];

    // Schemas
    const schemas: string[] = [];
    if (state.schema) {
      if (typeof state.schema === 'object' && 'ref' in state.schema && state.schema.ref) {
        schemas.push(state.schema.ref);
      } else if (typeof state.schema === 'object' && 'key' in state.schema) {
        schemas.push(`${state.schema.domain}/${state.schema.flow}/${state.schema.key}@${state.schema.version}`);
      }
    }

    // Views (from Component Resolver - just show the view ref if it exists)
    const views: string[] = [];
    if (state.view) {
      if (typeof state.view === 'object' && 'ref' in state.view && state.view.ref) {
        views.push(state.view.ref);
      } else if (typeof state.view === 'object' && 'key' in state.view) {
        views.push(`${state.view.domain}/${state.view.flow}/${state.view.key}@${state.view.version}`);
      }
    }

    // Incoming transitions (states that transition to this state)
    const incomingTransitions: { from: string; transitionKey: string; type: 'local' | 'shared' | 'start' | 'timeout' }[] = [];

    // Check start transition
    if (workflow.attributes?.startTransition?.target === stateKey) {
      incomingTransitions.push({
        from: '__start__',
        transitionKey: 'start',
        type: 'start'
      });
    }

    // Check timeout
    if (workflow.attributes?.timeout?.target === stateKey) {
      incomingTransitions.push({
        from: '__timeout__',
        transitionKey: 'timeout',
        type: 'timeout'
      });
    }

    // Check regular transitions
    for (const s of workflow.attributes?.states || []) {
      for (const t of s.transitions || []) {
        if (t.target === stateKey) {
          incomingTransitions.push({
            from: s.key,
            transitionKey: t.key,
            type: 'local'
          });
        }
      }
    }

    // Check shared transitions
    for (const st of workflow.attributes?.sharedTransitions || []) {
      if (st.target === stateKey) {
        // Find all states where this shared transition is available
        for (const availableState of st.availableIn || []) {
          incomingTransitions.push({
            from: availableState,
            transitionKey: st.key,
            type: 'shared'
          });
        }
      }
    }

    // Outgoing transitions
    const outgoingTransitions: { to: string; transitionKey: string; type: 'local' | 'shared' }[] = [];

    for (const t of state.transitions || []) {
      outgoingTransitions.push({
        to: t.target,
        transitionKey: t.key,
        type: 'local'
      });
    }

    // Check shared transitions available from this state
    for (const st of workflow.attributes?.sharedTransitions || []) {
      if (st.availableIn?.includes(stateKey)) {
        outgoingTransitions.push({
          to: st.target,
          transitionKey: st.key,
          type: 'shared'
        });
      }
    }

    return {
      onEntries,
      onExits,
      schemas,
      views,
      incomingTransitions,
      outgoingTransitions
    };
  }, [state, workflow]);

  return (
    <div className="state-edit-popup-overlay" onClick={onClose}>
      <div className="state-edit-popup state-edit-popup--large" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="state-edit-popup__header">
          <h3 className="state-edit-popup__title">
            State References: {state.key}
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
        <div className="state-edit-popup__content state-edit-popup__content--scrollable">
          {/* Tasks Section */}
          <div className="state-references__section">
            <h4 className="state-references__section-title">📋 Tasks</h4>

            {references.onEntries.length > 0 && (
              <div className="state-references__subsection">
                <h5 className="state-references__subsection-title">On Entry ({references.onEntries.length})</h5>
                <ul className="state-references__list">
                  {references.onEntries.map((task, i) => (
                    <li key={i} className="state-references__item">
                      <span className="state-references__badge">{task.order}</span>
                      {formatTaskRef(task.task)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {references.onExits.length > 0 && (
              <div className="state-references__subsection">
                <h5 className="state-references__subsection-title">On Exit ({references.onExits.length})</h5>
                <ul className="state-references__list">
                  {references.onExits.map((task, i) => (
                    <li key={i} className="state-references__item">
                      <span className="state-references__badge">{task.order}</span>
                      {formatTaskRef(task.task)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {references.onEntries.length === 0 && references.onExits.length === 0 && (
              <p className="state-references__empty">No tasks attached to this state</p>
            )}
          </div>

          {/* Schemas Section */}
          <div className="state-references__section">
            <h4 className="state-references__section-title">📄 Schemas</h4>
            {references.schemas.length > 0 ? (
              <ul className="state-references__list">
                {references.schemas.map((schema, i) => (
                  <li key={i} className="state-references__item">{schema}</li>
                ))}
              </ul>
            ) : (
              <p className="state-references__empty">No schemas attached to this state</p>
            )}
          </div>

          {/* Views Section */}
          <div className="state-references__section">
            <h4 className="state-references__section-title">🎨 Views</h4>
            {references.views.length > 0 ? (
              <ul className="state-references__list">
                {references.views.map((view, i) => (
                  <li key={i} className="state-references__item">{view}</li>
                ))}
              </ul>
            ) : (
              <p className="state-references__empty">No views attached to this state</p>
            )}
          </div>

          {/* Incoming Transitions */}
          <div className="state-references__section">
            <h4 className="state-references__section-title">⬅️ Incoming Transitions ({references.incomingTransitions.length})</h4>
            {references.incomingTransitions.length > 0 ? (
              <ul className="state-references__list">
                {references.incomingTransitions.map((trans, i) => (
                  <li key={i} className="state-references__item">
                    <span className="state-references__transition-badge state-references__transition-badge--{trans.type}">
                      {trans.type}
                    </span>
                    <strong>{trans.from}</strong> → {state.key}
                    <span className="state-references__transition-key">({trans.transitionKey})</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="state-references__empty">No incoming transitions</p>
            )}
          </div>

          {/* Outgoing Transitions */}
          <div className="state-references__section">
            <h4 className="state-references__section-title">➡️ Outgoing Transitions ({references.outgoingTransitions.length})</h4>
            {references.outgoingTransitions.length > 0 ? (
              <ul className="state-references__list">
                {references.outgoingTransitions.map((trans, i) => (
                  <li key={i} className="state-references__item">
                    <span className="state-references__transition-badge state-references__transition-badge--{trans.type}">
                      {trans.type}
                    </span>
                    {state.key} → <strong>{trans.to}</strong>
                    <span className="state-references__transition-key">({trans.transitionKey})</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="state-references__empty">No outgoing transitions</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="state-edit-popup__footer">
          <button
            type="button"
            className="state-edit-popup__btn state-edit-popup__btn--primary"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
