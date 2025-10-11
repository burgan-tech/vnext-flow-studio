import React, { useState } from 'react';
import type { SubFlowConfig } from '@amorphie-flow-studio/core';
import { ReferenceSelector, type AvailableComponent } from './ReferenceSelector';
import { RuleEditor } from './RuleEditor';
import { ScriptSelector, type ScriptItem } from './ScriptSelector';

export interface SubFlowEditorProps {
  /** Current subflow configuration value */
  value: SubFlowConfig | null;
  /** Available workflows from catalog */
  availableWorkflows?: AvailableComponent[];
  /** Available mapper scripts from catalog */
  availableMappers?: ScriptItem[];
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
  availableMappers = [],
  onChange,
  onLoadMappingFromFile,
  disabled = false
}: SubFlowEditorProps) {
  const [mappingText, setMappingText] = useState('');

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

  // Handle mapping code change
  const handleMappingCodeChange = (code: string) => {
    if (!value) return;
    // Don't encode here - let parent handle encoding on save
    onChange({
      ...value,
      mapping: { ...value.mapping, code }
    });
  };

  // Decode mapping code for display
  React.useEffect(() => {
    if (value?.mapping?.code) {
      try {
        const decoded = decodeURIComponent(escape(atob(value.mapping.code)));
        setMappingText(decoded);
      } catch {
        try {
          const decoded = atob(value.mapping.code);
          setMappingText(decoded);
        } catch {
          setMappingText(value.mapping.code);
        }
      }
    } else {
      setMappingText('');
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
          {availableMappers.length > 0 ? (
            <>
              <ScriptSelector
                label="Mapper Script"
                value={value.mapping?.location || null}
                availableScripts={availableMappers}
                scriptType="mapper"
                onChange={(location, script) => {
                  if (location && script) {
                    // Update both location and load the script content
                    setMappingText(script.content);
                    onChange({
                      ...value,
                      mapping: {
                        location: script.location,
                        code: script.content // Use plain content, will be encoded on save
                      }
                    });
                  }
                }}
                helpText="Select a mapper script from available scripts in the workspace"
              />
              <RuleEditor
                title="Mapping Code"
                rule={value.mapping}
                inlineText={mappingText}
                onLoadFromFile={onLoadMappingFromFile}
                onChange={(rule) => {
                  if (rule) {
                    onChange({ ...value, mapping: rule });
                  }
                }}
                onInlineChange={(text) => {
                  setMappingText(text);
                  handleMappingCodeChange(text);
                }}
                hideLocation={true}
              />
            </>
          ) : (
            <RuleEditor
              title="Mapping Script"
              rule={value.mapping}
              inlineText={mappingText}
              onLoadFromFile={onLoadMappingFromFile}
              onChange={(rule) => {
                if (rule) {
                  onChange({ ...value, mapping: rule });
                }
              }}
              onInlineChange={(text) => {
                setMappingText(text);
                handleMappingCodeChange(text);
              }}
              hideLocation={false}
            />
          )}
        </>
      )}
    </div>
  );
}
