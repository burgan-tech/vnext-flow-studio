import React, { useState } from 'react';
import type { SubFlowConfig } from '@amorphie-flow-studio/core';
import { ReferenceSelector, type AvailableComponent } from './ReferenceSelector';

export interface SubFlowEditorProps {
  /** Current subflow configuration value */
  value: SubFlowConfig | null;
  /** Available workflows from catalog */
  availableWorkflows?: AvailableComponent[];
  /** Callback when configuration changes */
  onChange: (value: SubFlowConfig | null) => void;
  /** Callback for loading mapping from file */
  onLoadMappingFromFile?: () => void;
  /** Whether the editor is disabled */
  disabled?: boolean;
}

const SUBFLOW_TYPES = [
  { value: 'C', label: 'Core', description: 'Core workflow type' },
  { value: 'F', label: 'Flow', description: 'Standard flow' },
  { value: 'S', label: 'SubFlow', description: 'Reusable subflow' },
  { value: 'P', label: 'Sub Process', description: 'Sub-process workflow' }
] as const;

/**
 * Editor for SubFlowConfig - allows selecting subflow type, process reference, and mapping
 */
export function SubFlowEditor({
  value,
  availableWorkflows = [],
  onChange,
  onLoadMappingFromFile,
  disabled = false
}: SubFlowEditorProps) {
  const [showMappingEditor, setShowMappingEditor] = useState(false);

  // Handle type change
  const handleTypeChange = (type: 'C' | 'F' | 'S' | 'P') => {
    if (!value) {
      // Initialize with minimal valid config
      onChange({
        type,
        process: { key: '', domain: '', flow: 'sys-flows', version: '' },
        mapping: { location: './src/mappings/subflow-mapping.csx', code: '' }
      });
    } else {
      onChange({ ...value, type });
    }
  };

  // Handle mapping location change
  const handleMappingLocationChange = (location: string) => {
    if (!value) return;
    onChange({
      ...value,
      mapping: { ...value.mapping, location }
    });
  };

  // Handle mapping code change
  const handleMappingCodeChange = (code: string) => {
    if (!value) return;
    onChange({
      ...value,
      mapping: { ...value.mapping, code }
    });
  };

  // Decode mapping code for display
  const decodedCode = React.useMemo(() => {
    if (!value?.mapping?.code) return '';
    try {
      return atob(value.mapping.code);
    } catch {
      return value.mapping.code;
    }
  }, [value?.mapping?.code]);

  // Handle clear
  const handleClear = () => {
    onChange(null);
  };

  // Convert process to ComponentReference format for ReferenceSelector
  const processAsComponentRef = React.useMemo(() => {
    if (!value?.process) return null;
    if ('ref' in value.process) {
      // ref-style references not supported by ReferenceSelector
      return null;
    }
    return {
      key: value.process.key || '',
      domain: value.process.domain || '',
      flow: value.process.flow || 'sys-flows',
      version: value.process.version || ''
    };
  }, [value?.process]);

  return (
    <div className="property-panel__group subflow-editor">
      {!value ? (
        <div className="property-panel__field">
          <p className="property-panel__muted">
            No subflow configured.
          </p>
          {!disabled && (
            <button
              type="button"
              className="property-panel__button"
              onClick={() => handleTypeChange('S')}
              style={{ width: '100%', marginTop: '8px' }}
            >
              + Configure Subflow
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Header with Clear button */}
          <div className="property-panel__field">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label style={{ margin: 0, fontWeight: 'bold' }}>Subflow Configuration</label>
              {!disabled && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="property-panel__button"
                  style={{ fontSize: '11px', padding: '2px 8px' }}
                  title="Clear subflow configuration"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Type Selector */}
          <div className="property-panel__field">
            <label>Subflow Type:</label>
            <select
              className="property-panel__select"
              value={value.type}
              onChange={(e) => handleTypeChange(e.target.value as 'C' | 'F' | 'S' | 'P')}
              disabled={disabled}
            >
              {SUBFLOW_TYPES.map(({ value: typeValue, label, description }) => (
                <option key={typeValue} value={typeValue} title={description}>
                  {label} ({typeValue})
                </option>
              ))}
            </select>
            <small className="property-panel__help">
              {SUBFLOW_TYPES.find(t => t.value === value.type)?.description}
            </small>
          </div>

          {/* Process Reference Selector */}
          <ReferenceSelector
            label="Process Reference"
            value={processAsComponentRef}
            availableComponents={availableWorkflows}
            componentType="Workflow"
            defaultFlow="sys-flows"
            onChange={(ref) => {
              if (ref) {
                onChange({
                  ...value,
                  process: {
                    key: ref.key,
                    domain: ref.domain,
                    flow: ref.flow,
                    version: ref.version
                  }
                });
              }
            }}
            required
            placeholder="Search workflows..."
            helpText="Select the workflow/subflow to invoke"
            disabled={disabled}
          />

          {/* Mapping Configuration */}
          <div className="property-panel__field">
            <label>Mapping Script:</label>

            {/* Location Input */}
            <input
              type="text"
              className="property-panel__input"
              value={value.mapping.location}
              onChange={(e) => handleMappingLocationChange(e.target.value)}
              placeholder="./src/mappings/subflow-mapping.csx"
              disabled={disabled}
              style={{ fontSize: '12px', marginBottom: '4px' }}
            />
            <small className="property-panel__help">
              Path to the C# mapping script file
            </small>

            {/* Code Editor Toggle */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button
                type="button"
                className="property-panel__button"
                onClick={() => setShowMappingEditor(!showMappingEditor)}
                disabled={disabled}
                style={{ fontSize: '11px' }}
              >
                {showMappingEditor ? 'Hide Code' : 'Show Code'}
              </button>
              {onLoadMappingFromFile && (
                <button
                  type="button"
                  className="property-panel__button"
                  onClick={onLoadMappingFromFile}
                  disabled={disabled}
                  style={{ fontSize: '11px' }}
                >
                  Load from File
                </button>
              )}
            </div>

            {/* Simple Code Editor */}
            {showMappingEditor && (
              <div style={{ marginTop: '8px' }}>
                <textarea
                  className="property-panel__textarea"
                  value={decodedCode}
                  onChange={(e) => {
                    const newCode = e.target.value;
                    const encoded = btoa(newCode);
                    handleMappingCodeChange(encoded);
                  }}
                  placeholder="// C# mapping code&#10;return new {&#10;    // Map data here&#10;};"
                  disabled={disabled}
                  rows={10}
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    width: '100%',
                    resize: 'vertical'
                  }}
                />
                <small className="property-panel__help">
                  C# code for mapping data to/from the subflow
                </small>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
