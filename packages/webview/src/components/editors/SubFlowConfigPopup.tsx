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
  { value: 'S', label: 'SubFlow', description: 'Blocks parent until completion (synchronous execution)' },
  { value: 'P', label: 'Sub Process', description: 'Runs in parallel without blocking parent (asynchronous execution)' }
] as const;

type ActiveTab = 'settings' | 'mapping';

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

  // Filter workflows to only show SubFlows (type 'S') and SubProcesses (type 'P')
  const subflowWorkflows = useMemo(() => {
    console.log('[SubFlowConfigPopup] Filtering workflows. Total:', availableWorkflows.length);
    if (availableWorkflows.length > 0) {
      console.log('[SubFlowConfigPopup] First workflow sample:', {
        key: availableWorkflows[0]?.key,
        type: availableWorkflows[0]?.attributes?.type,
        hasAttributes: !!availableWorkflows[0]?.attributes
      });
    }

    const filtered = availableWorkflows.filter((w: any) => {
      const type = w.attributes?.type;
      const isSubflow = type === 'S' || type === 'P';
      if (!isSubflow && w.key) {
        console.log('[SubFlowConfigPopup] Filtering OUT workflow:', w.key, 'type:', type);
      }
      return isSubflow;
    });

    console.log('[SubFlowConfigPopup] SubFlow/SubProcess workflows found:', filtered.length);
    if (filtered.length > 0) {
      console.log('[SubFlowConfigPopup] SubFlow keys:', filtered.map((w: any) => `${w.key} (${w.attributes?.type})`));
    }

    return filtered;
  }, [availableWorkflows]);

  // Initialize from existing config or create new
  const [subFlowType, setSubFlowType] = useState<'C' | 'F' | 'S' | 'P'>(
    () => state?.subFlow?.type || 'S'
  );
  const [processRef, setProcessRef] = useState<string>(
    () => formatProcessRef(state?.subFlow?.process)
  );
  const [mapping, setMapping] = useState<MappingData>(
    () => mappingToData(state?.subFlow?.mapping)
  );

  const [activeTab, setActiveTab] = useState<ActiveTab>('settings');
  const [isDirty, setIsDirty] = useState(false);

  // Filter available mappers based on subprocess type
  const filteredMappers = useMemo(() => {
    console.log('[SubFlowConfigPopup] Filtering mappers for type:', subFlowType);
    console.log('[SubFlowConfigPopup] Available mappers:', availableMappers.length);
    console.log('[SubFlowConfigPopup] First mapper sample:', {
      location: availableMappers[0]?.location,
      hasContent: !!availableMappers[0]?.content,
      contentLength: availableMappers[0]?.content?.length || 0
    });

    if (subFlowType === 'P') {
      // SubProcess type: only show ISubProcessMapping scripts
      const filtered = availableMappers.filter(mapper => {
        if (!mapper.content) {
          console.log('[SubFlowConfigPopup] Mapper has no content:', mapper.location);
          return false;
        }
        const content = mapper.content;
        const matches = content.includes('ISubProcessMapping') ||
                       content.includes(': ISubProcessMapping') ||
                       content.includes(':ISubProcessMapping');
        if (matches) {
          console.log('[SubFlowConfigPopup] Found ISubProcessMapping:', mapper.location);
        }
        return matches;
      });
      console.log('[SubFlowConfigPopup] Filtered to', filtered.length, 'ISubProcessMapping scripts');
      return filtered;
    } else if (subFlowType === 'S') {
      // SubFlow type: only show ISubFlowMapping scripts (strict)
      const filtered = availableMappers.filter(mapper => {
        if (!mapper.content) return false;
        const content = mapper.content;
        // Only include ISubFlowMapping scripts
        const matches = content.includes('ISubFlowMapping') ||
                       content.includes(': ISubFlowMapping') ||
                       content.includes(':ISubFlowMapping');
        if (matches) {
          console.log('[SubFlowConfigPopup] Found ISubFlowMapping:', mapper.location);
        }
        return matches;
      });
      console.log('[SubFlowConfigPopup] Filtered to', filtered.length, 'ISubFlowMapping scripts');
      return filtered;
    }
    // For other types (C, F), show all mappers
    console.log('[SubFlowConfigPopup] No filtering, showing all', availableMappers.length, 'mappers');
    return availableMappers;
  }, [subFlowType, availableMappers]);

  // Clear mapping if it's no longer valid for the selected type
  useEffect(() => {
    if (mapping.mode === 'code' && mapping.location) {
      // Find the current mapper in filtered list
      const currentMapper = filteredMappers.find(m => m.location === mapping.location);
      if (!currentMapper) {
        // Current mapping is not valid for this type, clear it
        setMapping({ mode: 'none' });
      }
    }
  }, [subFlowType, filteredMappers, mapping]);

  // Update mapping code when catalog script is updated (for readonly display)
  useEffect(() => {
    // Get the location to check (either from mapperRef or location)
    const scriptLocation = mapping.mapperRef || mapping.location;

    // Check if this is any script file (.mapper.json, .csx, .cs, .js)
    const isScriptFile = scriptLocation && (
      scriptLocation.endsWith('.mapper.json') ||
      scriptLocation.endsWith('.csx') ||
      scriptLocation.endsWith('.cs') ||
      scriptLocation.endsWith('.js')
    );

    if (isScriptFile && mapping.code) {
      // Find the script in the catalog
      const catalogScript = availableMappers.find(m => m.location === scriptLocation);
      if (catalogScript && catalogScript.base64 && catalogScript.base64 !== mapping.code) {
        // Script was updated in catalog, refresh the readonly display
        console.log('[SubFlowConfigPopup] Updating readonly script display for:', scriptLocation);
        console.log('[SubFlowConfigPopup] Old code length:', mapping.code?.length, 'New code length:', catalogScript.base64.length);
        setMapping(prev => ({
          ...prev,
          code: catalogScript.base64
        }));
      }
    }
  }, [availableMappers, mapping.mapperRef, mapping.location, mapping.code]);

  // Track changes
  useEffect(() => {
    setIsDirty(true);
  }, [subFlowType, processRef, mapping]);

  const handleApply = useCallback(() => {
    const parsedProcessRef = parseProcessRef(processRef);
    const mappingData = dataToMapping(mapping);

    // Build SubFlowConfig
    const config: SubFlowConfig = {
      type: subFlowType,
      process: parsedProcessRef || { key: '', domain: '', flow: 'sys-flows', version: '' },
      mapping: mappingData || { location: '', code: '' }
    };

    onApply(stateKey, config);
    onClose();
  }, [stateKey, subFlowType, processRef, mapping, onApply, onClose]);

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
    <div className="subflow-config-popup-overlay" onClick={onClose}>
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
            className={`subflow-config-popup__tab ${activeTab === 'mapping' ? 'active' : ''}`}
            onClick={() => setActiveTab('mapping')}
          >
            <ArrowDownToLine size={16} />
            Mapping
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
                  availableWorkflows={subflowWorkflows}
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

          {activeTab === 'mapping' && (
            <div className="subflow-mapping-section">
              {subFlowType === 'P' && (
                <div className="subflow-mapping-hint" style={{
                  padding: '8px 12px',
                  marginBottom: '12px',
                  backgroundColor: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: '4px',
                  fontSize: '13px',
                  color: '#1e40af'
                }}>
                  <strong>SubProcess Mapping:</strong> Only scripts implementing <code>ISubProcessMapping</code> are shown.
                  SubProcess runs in parallel and only uses <code>InputHandler</code>.
                </div>
              )}
              {subFlowType === 'S' && (
                <div className="subflow-mapping-hint" style={{
                  padding: '8px 12px',
                  marginBottom: '12px',
                  backgroundColor: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '4px',
                  fontSize: '13px',
                  color: '#15803d'
                }}>
                  <strong>SubFlow Mapping:</strong> Only scripts implementing <code>ISubFlowMapping</code> are shown.
                  SubFlow blocks parent workflow and uses both <code>InputHandler</code> and <code>OutputHandler</code>.
                </div>
              )}
              <MappingSection
                type="input"
                value={mapping}
                onChange={setMapping}
                availableMappers={filteredMappers}
                stateKey={stateKey}
                workflowName={workflow.key}
                interfaceType={subFlowType === 'S' ? 'ISubFlowMapping' : subFlowType === 'P' ? 'ISubProcessMapping' : 'none'}
              />
            </div>
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
    </div>
  );
}
