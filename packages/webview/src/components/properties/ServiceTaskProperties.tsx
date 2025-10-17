import React, { useState, useCallback, useEffect } from 'react';
import type { State, ExecutionTask, Label, VersionStrategy } from '@amorphie-flow-studio/core';
import { useBridge } from '../../hooks/useBridge';
import {
  CollapsibleSection,
  LabelListEditor,
  ExecutionTaskListEditor
} from '../editors';

interface ServiceTaskPropertiesProps {
  state: State;
  stateKey: string;
  taskCatalog: any[];
  hasUnsavedChanges?: boolean;
  onSave?: () => void;
  onChange?: (state: State) => void;
}

const versionStrategies: VersionStrategy[] = ['Major', 'Minor'];

export function ServiceTaskProperties({ state, stateKey, taskCatalog, hasUnsavedChanges, onSave, onChange }: ServiceTaskPropertiesProps) {
  const { postMessage } = useBridge();
  const [stateDraft, setStateDraft] = useState<State | null>(null);

  // Initialize draft state
  useEffect(() => {
    const clone = JSON.parse(JSON.stringify(state)) as State;
    if (!Array.isArray(clone.labels)) {
      clone.labels = [];
    }
    // Ensure Service Task has exactly one onEntry task
    if (!clone.onEntries || clone.onEntries.length === 0) {
      clone.onEntries = [{
        order: 1,
        task: { ref: '' },
        mapping: {
          location: 'inline',
          code: '// Configure task input mapping'
        }
      }];
    }
    setStateDraft(clone);
  }, [state]);

  const handleSubmit = useCallback((event: React.FormEvent) => {
    event.preventDefault();
    if (!stateDraft) return;

    // Clean up the state before saving
    const cleanState = { ...stateDraft };

    // Ensure only one onEntry task for Service Task
    if (cleanState.onEntries && cleanState.onEntries.length > 1) {
      cleanState.onEntries = [cleanState.onEntries[0]];
    }

    // Send update
    postMessage({
      type: 'domain:updateState',
      stateKey: stateKey,
      state: cleanState
    });

    // Call onSave callback if provided
    if (onSave) {
      onSave();
    }
  }, [stateDraft, stateKey, postMessage, onSave]);

  if (!stateDraft) {
    return null;
  }

  const stateLabels = stateDraft.labels ?? [];

  return (
    <form className="service-task-properties property-panel__section" onSubmit={handleSubmit}>
      <div className="property-header">
        <h3 className="property-title">
          <span className="property-icon">⚙</span>
          Service Task: {stateDraft.key}
        </h3>
      </div>

      {/* Basic Properties */}
      <CollapsibleSection title="Basic Properties" defaultExpanded={true}>
        <label className="property-panel__field">
          <span>Key</span>
          <input
            type="text"
            value={stateDraft.key}
            onChange={(event) => {
              const newState = stateDraft ? { ...stateDraft, key: event.target.value } : null;
              if (newState) {
                setStateDraft(newState);
                if (onChange) {
                  onChange(newState);
                }
              }
            }}
          />
        </label>

        <label className="property-panel__field">
          <span>Version strategy</span>
          <select
            value={stateDraft.versionStrategy}
            onChange={(event) => {
              const newState = stateDraft
                ? { ...stateDraft, versionStrategy: event.target.value as VersionStrategy }
                : null;
              if (newState) {
                setStateDraft(newState);
                if (onChange) {
                  onChange(newState);
                }
              }
            }}
          >
            {versionStrategies.map((strategy) => (
              <option key={strategy} value={strategy}>
                {strategy}
              </option>
            ))}
          </select>
        </label>
      </CollapsibleSection>

      {/* Labels */}
      <CollapsibleSection title="Labels" defaultExpanded={false}>
        <LabelListEditor
          title=""
          labels={stateLabels}
          onChange={(labels) => {
            const newState = stateDraft ? { ...stateDraft, labels } : null;
            if (newState) {
              setStateDraft(newState);
              if (onChange) {
                onChange(newState);
              }
            }
          }}
        />
      </CollapsibleSection>

      {/* Service Task Configuration */}
      <CollapsibleSection
        title="Service Task Configuration"
        defaultExpanded={true}
        headerActions={null}
      >
        <div className="service-task-note">
          Service Tasks execute a single task when entering the state.
        </div>
        <ExecutionTaskListEditor
          title=""
          tasks={stateDraft.onEntries?.slice(0, 1)} // Only show first task
          availableTasks={taskCatalog}
          availableMappers={[]} // We'll pass empty for now
          onLoadFromFile={(taskIndex) => {
            postMessage({
              type: 'mapping:loadFromFile',
              stateKey: stateKey,
              list: 'onEntries',
              index: taskIndex
            });
          }}
          onChange={(tasks) => {
            if (!stateDraft) return;
            const next = { ...stateDraft } as State;
            if (!tasks || tasks.length === 0) {
              // Always keep at least one task for Service Task
              next.onEntries = [{
                order: 1,
                task: { ref: '' },
                mapping: {
                  location: 'inline',
                  code: '// Configure task input mapping'
                }
              }];
            } else {
              // Only keep the first task
              next.onEntries = [tasks[0]];
            }
            setStateDraft(next);
            if (onChange) {
              onChange(next);
            }
          }}
        />
      </CollapsibleSection>

      <button
        type="submit"
        className="property-panel__save"
      >
        {hasUnsavedChanges ? '● Save Service Task' : 'Save Service Task'}
      </button>
    </form>
  );
}