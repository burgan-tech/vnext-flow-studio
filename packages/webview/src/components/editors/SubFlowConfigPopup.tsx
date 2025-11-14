import React, { useState, useCallback, useEffect, useMemo } from 'react';
import type { Workflow, SubFlowConfig, Mapping, ProcessRef } from '@amorphie-workflow/core';
import type { AvailableComponent } from './ReferenceSelector';
import { WorkflowSearchPanel } from './WorkflowSearchPanel';
import { MappingSection, type MappingData } from './MappingSection';
import { Settings, ArrowDownToLine } from 'lucide-react';

interface SubFlowConfigPopupProps {
  stateKey: string;
  workflow: Workflow;
  availableWorkflows: AvailableComponent[];
  availableMappers: any[];
  onClose: () => void;
  onApply: (stateKey: string, config: SubFlowConfig | null) => void;
}

const SUBFLOW_TYPES = [
  { value: 'C', label: 'Core', description: 'Core workflow type' },
  { value: 'F', label: 'Flow', description: 'Standard flow' },
  { value: 'S', label: 'SubFlow', description: 'Reusable subflow' },
  { value: 'P', label: 'Sub Process', description: 'Sub-process workflow' }
] as const;

type ActiveTab = 'settings' | 'input';

/**
 * Convert Mapping to MappingData format
 */
function mappingToData(mapping: Mapping | null | undefined): MappingData {
  if (!mapping) {
    return { mode: 'none' };
  }

  // Check if it has a mapper reference (location ends with .mapper.json)
  if (mapping.location?.endsWith('.mapper.json')) {
    return {
      mode: 'mapper',
      mapperRef: mapping.location,
      location: mapping.location,
      code: mapping.code
    };
  }

  // Otherwise it's code mode
  return {
    mode: mapping.code ? 'code' : 'none',
    code: mapping.code,
    location: mapping.location
  };
}

/**
 * Convert MappingData to Mapping format
 */
function dataToMapping(data: MappingData): Mapping | null {
  if (data.mode === 'none') {
    return null;
  }

  if (data.mode === 'mapper') {
    return {
      location: data.mapperRef || data.location || '',
      code: data.code || ''
    };
  }

  // Code mode
  return {
    location: data.location || './src/mappings/subflow-mapping.csx',
    code: data.code || ''
  };
}

/**
 * Format ProcessRef as string for display
 */
function formatProcessRef(process: ProcessRef | null | undefined): string {
  if (!process) return '';
  if ('ref' in process) {
    return process.ref || '';
  }
  if (process.domain && process.version) {
    const flow = process.flow || 'sys-flows';
    return `${process.domain}/${flow}/${process.key}@${process.version}`;
  }
  return process.key || '';
}

/**
 * Parse process reference string into ProcessRef object
 */
function parseProcessRef(ref: string): ProcessRef | null {
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

export function SubFlowConfigPopup({
  stateKey,
  workflow,
  availableWorkflows,
  availableMappers,
  onClose,
  onApply
}: SubFlowConfigPopupProps) {
  const state = workflow.attributes?.states?.find(s => s.key === stateKey);

  // Initialize from existing config or create new
  const [subFlowType, setSubFlowType] = useState<'C' | 'F' | 'S' | 'P'>(
    () => state?.subFlow?.type || 'S'
  );
  const [processRef, setProcessRef] = useState<string>(
    () => formatProcessRef(state?.subFlow?.process)
  );
  const [inputMapping, setInputMapping] = useState<MappingData>(
    () => mappingToData(state?.subFlow?.inputMapping)
  );
  const [outputMapping, setOutputMapping] = useState<MappingData>(
    () => mappingToData(state?.subFlow?.outputMapping)
  );

  const [activeTab, setActiveTab] = useState<ActiveTab>('settings');
  const [isDirty, setIsDirty] = useState(false);

  // Track changes
  useEffect(() => {
    setIsDirty(true);
  }, [subFlowType, processRef, inputMapping]);

  const handleApply = useCallback(() => {
    const parsedProcessRef = parseProcessRef(processRef);

    // Build SubFlowConfig
    const config: SubFlowConfig = {
      type: subFlowType,
      process: parsedProcessRef || { key: '', domain: '', flow: 'sys-flows', version: '' },
      inputMapping: dataToMapping(inputMapping),
      outputMapping: null // Output mapping not supported yet
    };

    onApply(stateKey, config);
    onClose();
  }, [stateKey, subFlowType, processRef, inputMapping, onApply, onClose]);

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

  // Check if configuration is valid
  const isValid = useMemo(() => {
    // Must have a non-empty process reference
    return processRef && processRef.trim().length > 0;
  }, [processRef]);

  if (!state) {
    return null;
  }

  return (
    <>
      <div className="subflow-config-popup-overlay" onClick={onClose} />
      <div className="subflow-config-popup" onClick={(e) => e.stopPropagation()}>
        <div className="subflow-config-popup__header">
          <h2 className="subflow-config-popup__title">
            Configure SubFlow: {stateKey}
            {isDirty && <span className="subflow-config-popup__dirty-indicator">*</span>}
          </h2>
          <button
            className="subflow-config-popup__close-btn"
            onClick={onClose}
            title="Close (Esc)"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="subflow-config-popup__tabs">
          <button
            className={`subflow-config-popup__tab ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <Settings size={16} />
            Settings
          </button>
          <button
            className={`subflow-config-popup__tab ${activeTab === 'input' ? 'active' : ''}`}
            onClick={() => setActiveTab('input')}
          >
            <ArrowDownToLine size={16} />
            Input Mapping
          </button>
        </div>

        {/* Content */}
        <div className="subflow-config-popup__content">
          {activeTab === 'settings' && (
            <div className="subflow-settings">
              <div className="subflow-settings__section">
                <label className="subflow-settings__label">
                  SubFlow Type <span className="subflow-settings__required">*</span>
                </label>
                <select
                  className="subflow-settings__select"
                  value={subFlowType}
                  onChange={(e) => setSubFlowType(e.target.value as 'C' | 'F' | 'S' | 'P')}
                >
                  {SUBFLOW_TYPES.map(({ value, label, description }) => (
                    <option key={value} value={value} title={description}>
                      {label} ({value})
                    </option>
                  ))}
                </select>
                <small className="subflow-settings__help">
                  {SUBFLOW_TYPES.find(t => t.value === subFlowType)?.description}
                </small>
              </div>

              <div className="subflow-settings__section">
                <WorkflowSearchPanel
                  availableWorkflows={availableWorkflows}
                  selectedWorkflowRef={processRef}
                  onSelectWorkflow={setProcessRef}
                />
              </div>

              {!processRef && (
                <div className="subflow-settings__empty">
                  <p>⚠️ Please select a workflow process to continue</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'input' && (
            <MappingSection
              type="input"
              value={inputMapping}
              onChange={setInputMapping}
              availableMappers={availableMappers}
              stateKey={stateKey}
              workflowName={workflow.key}
            />
          )}
        </div>

        {/* Footer */}
        <div className="subflow-config-popup__footer">
          <small className="subflow-config-popup__hint">
            Ctrl/Cmd+Enter to apply • Esc to cancel
          </small>
          <button
            className="subflow-config-popup__btn subflow-config-popup__btn--secondary"
            onClick={handleClear}
          >
            Clear SubFlow
          </button>
          <button
            className="subflow-config-popup__btn subflow-config-popup__btn--secondary"
            onClick={handleCancel}
          >
            Cancel
          </button>
          <button
            className="subflow-config-popup__btn subflow-config-popup__btn--primary"
            onClick={handleApply}
            disabled={!isValid || !isDirty}
          >
            Apply Changes {isDirty && '*'}
          </button>
        </div>
      </div>
    </>
  );
}
