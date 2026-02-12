import React, { useMemo, useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { FileText, Download, Upload, Key, RefreshCw, GitBranch } from 'lucide-react';
import { useBridge } from '../../hooks/useBridge';
import { ScriptSelector, type ScriptItem } from './ScriptSelector';
import { SaveScriptDialog } from './SaveScriptDialog';
import { OverrideScriptDialog } from './OverrideScriptDialog';

export type MappingMode = 'none' | 'mapper' | 'code';

/**
 * Check if a string is base64 encoded
 */
function isBase64(str: string): boolean {
  if (!str || str.length === 0) return false;

  // Check if it looks like base64 (only contains base64 chars)
  const base64Regex = /^[A-Za-z0-9+/]+={0,2}$/;
  if (!base64Regex.test(str)) return false;

  // Try to decode it and see if it's valid UTF-8
  try {
    const decoded = atob(str);
    // If it decodes successfully and contains printable characters, it's probably base64
    return decoded.length > 0;
  } catch {
    return false;
  }
}

/**
 * Decode base64 string to UTF-8
 */
function decodeBase64(str: string): string {
  try {
    return atob(str);
  } catch {
    return str; // Return original if decode fails
  }
}

/**
 * Encode UTF-8 string to base64
 */
function encodeBase64(str: string): string {
  try {
    return btoa(str);
  } catch {
    return str; // Return original if encode fails
  }
}

export interface MappingData {
  mode: MappingMode;
  mapperRef?: string | null;
  code?: string;
  location?: string;
}

interface MappingSectionProps {
  type: 'input' | 'output';
  value: MappingData;
  onChange: (data: MappingData) => void;
  availableMappers?: any[];
  stateKey?: string;
  workflowName?: string;
  lane?: 'onEntries' | 'onExits';
  taskIndex?: number | null;
  scriptType?: 'mapping' | 'rule'; // Optional: filter scripts by type (IMapping vs IConditionMapping)
  interfaceType?: 'IMapping' | 'ITransitionMapping' | 'ISubProcessMapping' | 'ISubFlowMapping' | 'none'; // Interface to search for in scripts, or 'none' to skip filtering
}

const TASK_MAPPING_TEMPLATES = [
  {
    name: 'Pass Through',
    description: 'Pass data through without modification',
    icon: FileText,
    code: `using System.Threading.Tasks;
using BBT.Workflow.Scripting;

public class PassThroughMapping : IMapping
{
    public Task<ScriptResponse> InputHandler(WorkflowTask task, ScriptContext context)
    {
        return Task.FromResult(new ScriptResponse
        {
            Data = context.Instance?.Data,
            Headers = null
        });
    }

    public Task<ScriptResponse> OutputHandler(ScriptContext context)
    {
        return Task.FromResult(new ScriptResponse
        {
            Data = context.Body,
            Headers = null
        });
    }
}`,
  },
  {
    name: 'GET Request',
    description: 'Configure HTTP GET with no request body',
    icon: Download,
    code: `using System.Threading.Tasks;
using BBT.Workflow.Scripting;
using BBT.Workflow.Definitions;

public class GetRequestMapping : IMapping
{
    public Task<ScriptResponse> InputHandler(WorkflowTask task, ScriptContext context)
    {
        var httpTask = task as HttpTask;
        httpTask.Method = "GET";

        // No request body for GET
        return Task.FromResult(new ScriptResponse
        {
            Data = new { },
            Headers = null
        });
    }

    public Task<ScriptResponse> OutputHandler(ScriptContext context)
    {
        var statusCode = context.Body?.statusCode ?? 500;

        if (statusCode == 200)
        {
            return Task.FromResult(new ScriptResponse
            {
                Data = new
                {
                    result = context.Body?.data ?? new { }
                }
            });
        }

        return Task.FromResult(new ScriptResponse
        {
            Data = new
            {
                error = $"Request failed with status: {statusCode}"
            }
        });
    }
}`,
  },
  {
    name: 'POST with Body',
    description: 'Configure HTTP POST with request body',
    icon: Upload,
    code: `using System.Threading.Tasks;
using BBT.Workflow.Scripting;
using BBT.Workflow.Definitions;

public class PostRequestMapping : IMapping
{
    public Task<ScriptResponse> InputHandler(WorkflowTask task, ScriptContext context)
    {
        var httpTask = task as HttpTask;

        var requestBody = new
        {
            method = "YourMethodName",
            @params = new
            {
                // Extract data from workflow context
                userId = context.Instance.Data?.applicant?.id,
                requestType = context.Instance.Data?.applicationType
            }
        };

        httpTask.SetBody(requestBody);

        return Task.FromResult(new ScriptResponse
        {
            Data = new { },
            Headers = null
        });
    }

    public Task<ScriptResponse> OutputHandler(ScriptContext context)
    {
        var statusCode = context.Body?.statusCode ?? 500;

        if (statusCode == 200)
        {
            var rawData = context.Body?.data;

            return Task.FromResult(new ScriptResponse
            {
                Data = new
                {
                    result = new
                    {
                        success = true,
                        data = rawData
                    }
                }
            });
        }

        return Task.FromResult(new ScriptResponse
        {
            Data = new
            {
                result = new
                {
                    success = false,
                    error = $"Failed with status: {statusCode}"
                }
            }
        });
    }
}`,
  },
  {
    name: 'Set Headers',
    description: 'Configure request headers dynamically',
    icon: Key,
    code: `using System.Threading.Tasks;
using System.Collections.Generic;
using BBT.Workflow.Scripting;
using BBT.Workflow.Definitions;

public class SetHeadersMapping : IMapping
{
    public Task<ScriptResponse> InputHandler(WorkflowTask task, ScriptContext context)
    {
        var httpTask = task as HttpTask;

        var headers = new Dictionary<string, string?>
        {
            ["user_reference"] = context.Instance.Data?.applicant?.identity?.citizenshipNumber,
            ["User"] = @"EBT\\WORKFLOW",
            ["Channel"] = "INTERNET",
            ["Branch"] = "1000"
        };

        httpTask.SetHeaders(headers);

        return Task.FromResult(new ScriptResponse
        {
            Data = new { },
            Headers = null
        });
    }

    public Task<ScriptResponse> OutputHandler(ScriptContext context)
    {
        return Task.FromResult(new ScriptResponse
        {
            Data = context.Body,
            Headers = null
        });
    }
}`,
  },
  {
    name: 'Transform Response',
    description: 'Extract and reshape response data',
    icon: RefreshCw,
    code: `using System.Threading.Tasks;
using BBT.Workflow.Scripting;

public class TransformResponseMapping : IMapping
{
    public Task<ScriptResponse> InputHandler(WorkflowTask task, ScriptContext context)
    {
        return Task.FromResult(new ScriptResponse
        {
            Data = context.Instance?.Data,
            Headers = null
        });
    }

    public Task<ScriptResponse> OutputHandler(ScriptContext context)
    {
        var statusCode = context.Body?.statusCode ?? 500;

        if (statusCode == 200)
        {
            // Extract nested data from response
            var responseData = context.Body?.data?.data?.raw;

            return Task.FromResult(new ScriptResponse
            {
                Data = new
                {
                    customer = new
                    {
                        profile = responseData ?? new { }
                    }
                }
            });
        }

        return Task.FromResult(new ScriptResponse
        {
            Data = new
            {
                customer = new
                {
                    profile = new { },
                    error = $"Service failed with status: {statusCode}"
                }
            }
        });
    }
}`,
  },
  {
    name: 'Conditional Logic',
    description: 'Apply conditional transformations',
    icon: GitBranch,
    code: `using System;
using System.Threading.Tasks;
using BBT.Workflow.Scripting;
using BBT.Workflow.Definitions;

public class ConditionalMapping : IMapping
{
    public Task<ScriptResponse> InputHandler(WorkflowTask task, ScriptContext context)
    {
        var httpTask = task as HttpTask;

        var requestBody = new
        {
            method = "ProcessRequest",
            @params = new
            {
                // Apply conditional logic based on context
                requestType = context.Instance.Data.applicationType == 40
                    ? "TypeA"
                    : "TypeB",
                value = context.Instance.Data?.approved == true
                    ? "Approved"
                    : "Pending"
            }
        };

        return Task.FromResult(new ScriptResponse
        {
            Data = requestBody,
            Headers = null
        });
    }

    public Task<ScriptResponse> OutputHandler(ScriptContext context)
    {
        var statusCode = context.Body?.statusCode ?? 500;
        var rawData = context.Body?.data;

        if (statusCode == 200 && rawData?.ErrCode == 200)
        {
            return Task.FromResult(new ScriptResponse
            {
                Data = new
                {
                    result = new
                    {
                        success = true,
                        processedAt = DateTime.Now,
                        data = rawData
                    }
                }
            });
        }

        return Task.FromResult(new ScriptResponse
        {
            Data = new
            {
                result = new
                {
                    success = false,
                    errorCode = rawData?.ErrCode,
                    errorMessage = rawData?.ErrMsg
                }
            }
        });
    }
}`,
  },
];

const TRANSITION_MAPPING_TEMPLATES = [
  {
    name: 'Data Transform',
    description: 'Transform data passing through transition',
    icon: RefreshCw,
    code: `using System;
using System.Dynamic;
using System.Threading.Tasks;
using BBT.Workflow.Scripting;

public class TransitionMapping : ITransitionMapping
{
    public async Task<dynamic> Handler(ScriptContext context)
    {
        dynamic data = new ExpandoObject();

        // Extract and transform data from context.Body
        data.amount = context.Body?.amount;
        data.currency = context.Body?.currency ?? "USD";
        data.processedAt = DateTime.UtcNow;

        return data;
    }
}`,
  },
];

const SUBFLOW_MAPPING_TEMPLATES = [
  {
    name: 'Pass Through',
    description: 'Pass data to/from subflow without modification',
    icon: FileText,
    code: `using System.Threading.Tasks;
using BBT.Workflow.Scripting;

public class SubFlowMapping : ISubFlowMapping
{
    public Task<ScriptResponse> InputHandler(ScriptContext context)
    {
        return Task.FromResult(new ScriptResponse
        {
            Data = context.Instance.Data,
            Headers = null
        });
    }

    public Task<ScriptResponse> OutputHandler(ScriptContext context)
    {
        return Task.FromResult(new ScriptResponse
        {
            Data = context.Body,
            Headers = null
        });
    }
}`,
  },
];

const SUBPROCESS_MAPPING_TEMPLATES = [
  {
    name: 'Pass Through',
    description: 'Pass data to subprocess without modification',
    icon: FileText,
    code: `using System.Threading.Tasks;
using BBT.Workflow.Scripting;

public class SubProcessMapping : ISubProcessMapping
{
    public Task<ScriptResponse> InputHandler(ScriptContext context)
    {
        return Task.FromResult(new ScriptResponse
        {
            Data = context.Instance.Data,
            Headers = null
        });
    }
}`,
  },
];

export function MappingSection({
  type,
  value,
  onChange,
  availableMappers = [],
  stateKey,
  workflowName,
  lane,
  taskIndex,
  scriptType = 'mapping', // Default to mapping scripts
  interfaceType = 'IMapping', // Default to IMapping
}: MappingSectionProps) {
  const { postMessage } = useBridge();
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showOverrideDialog, setShowOverrideDialog] = useState(false);
  const [templateToSave, setTemplateToSave] = useState<string>('');
  const [saveMode, setSaveMode] = useState<'create' | 'override'>('create');
  const [overrideLocation, setOverrideLocation] = useState<string | undefined>(undefined);
  const [hoveredTemplateIndex, setHoveredTemplateIndex] = useState<number | null>(null);
  const [previousBinding, setPreviousBinding] = useState<{ location: string; code: string } | null>(null);

  // Choose templates based on interface type
  const TEMPLATES =
    interfaceType === 'ISubFlowMapping' ? SUBFLOW_MAPPING_TEMPLATES :
    interfaceType === 'ISubProcessMapping' ? SUBPROCESS_MAPPING_TEMPLATES :
    interfaceType === 'ITransitionMapping' ? TRANSITION_MAPPING_TEMPLATES :
    interfaceType === 'none' ? [] :
    TASK_MAPPING_TEMPLATES;

  const title =
    interfaceType === 'ISubFlowMapping' ? 'SubFlow Mapping' :
    interfaceType === 'ISubProcessMapping' ? 'SubProcess Mapping' :
    interfaceType === 'ITransitionMapping' ? 'Transition Mapping' :
    (type === 'input' ? 'Input Mapping' : 'Output Mapping');
  const subtitle =
    interfaceType === 'ISubFlowMapping' ? 'Map data to/from subflow (blocks parent until complete)' :
    interfaceType === 'ISubProcessMapping' ? 'Map data to subprocess (runs in parallel)' :
    interfaceType === 'ITransitionMapping' ? 'Transform data as it passes through the transition' :
    (type === 'input' ? 'Map context data to task input' : 'Map task output back to context');

  // Filter to only show .mapper.json files (visual mapper files)
  const visualMappers = availableMappers.filter(m => {
    const location = m.location || '';
    return location.endsWith('.mapper.json');
  });

  // Filter to show only .csx files matching the interfaceType
  const csxScripts = useMemo(() => {
    console.log('[MappingSection] Filtering scripts - availableMappers:', availableMappers.length, 'interfaceType:', interfaceType);
    console.log('[MappingSection] Sample mapper:', availableMappers[0]);

    return availableMappers.filter(m => {
      const location = m.location || '';
      if (!location.endsWith('.csx')) return false;

      // If interfaceType is 'none', skip filtering (parent already filtered)
      if (interfaceType === 'none') {
        console.log('[MappingSection] ✓ No interface filtering (parent already filtered):', location);
        return true;
      }

      // If we have base64 content, check for interface implementation
      if (m.base64) {
        try {
          const code = atob(m.base64);
          // Search for interface implementation - match interface name anywhere after ':'
          // This handles: "class X : IMapping", "class X : ScriptBase, IMapping", etc.
          const interfacePattern = new RegExp(`:\\s*.*\\b${interfaceType}\\b`, 'i');
          const matches = interfacePattern.test(code);

          if (!matches) {
            console.log('[MappingSection] Script does not implement', interfaceType, ':', location);
          } else {
            console.log('[MappingSection] ✓ Script implements', interfaceType, ':', location);
            // Show the matching line for debugging
            const matchingLine = code.split('\n').find(line => /class.*:/.test(line));
            console.log('[MappingSection]   Class declaration:', matchingLine);
          }

          return matches;
        } catch (e) {
          console.warn('[MappingSection] Failed to decode script for interface check:', location, e);
          // If we can't decode, include it anyway for IMapping (backward compatibility)
          return interfaceType === 'IMapping';
        }
      }

      // If no content available, include for IMapping (backward compatibility), exclude for ITransitionMapping
      console.log('[MappingSection] No content for script, including based on interfaceType:', interfaceType, location);
      return interfaceType === 'IMapping';
    });
  }, [availableMappers, interfaceType]);

  // Decode code if it's base64 encoded
  const displayCode = useMemo(() => {
    const code = value.code || '';
    if (isBase64(code)) {
      console.log('[MappingSection] Detected base64 encoded code, decoding for display');
      return decodeBase64(code);
    }
    return code;
  }, [value.code]);

  // Track if the original code was base64
  const isCodeBase64 = useMemo(() => {
    return isBase64(value.code || '');
  }, [value.code]);

  // Debug: Log available mappers
  console.log('[MappingSection] Available mappers:', availableMappers.length, 'Visual mappers:', visualMappers.length, 'CSX scripts (filtered):', csxScripts.length, 'Interface type:', interfaceType, 'Code is base64:', isCodeBase64);

  const handleModeChange = (mode: MappingMode) => {
    onChange({ ...value, mode });
  };

  const handleMapperChange = (ref: string) => {
    onChange({ ...value, mapperRef: ref });
  };

  const _handleCodeChange = (code: string | undefined) => {
    const newCode = code || '';
    // If original was base64, keep it base64
    const finalCode = isCodeBase64 ? encodeBase64(newCode) : newCode;
    onChange({ ...value, code: finalCode });
  };

  const _handleLocationChange = (location: string) => {
    onChange({ ...value, location });
  };

  const _handleInsertTemplate = (templateCode: string) => {
    onChange({ ...value, code: templateCode });
  };

  const handleOpenMapper = () => {
    if (!stateKey || !lane || taskIndex === null || taskIndex === undefined) {
      console.warn('[MappingSection] Cannot open mapper: missing context', { stateKey, lane, taskIndex });
      return;
    }
    postMessage({
      type: 'mapping:openMapper',
      stateKey,
      lane,
      taskIndex,
      mappingType: type,
      existingMapperRef: value.mapperRef || undefined,
    });
  };

  const handleScriptSelect = (location: string | null, script: ScriptItem | null) => {
    if (script && location) {
      onChange({
        ...value,
        location: location,
        code: script.base64
      });
    } else {
      onChange({ ...value, location: '', code: '' });
    }
  };

  const handleOpenInVSCode = () => {
    if (!value.location) {
      return;
    }
    postMessage({
      type: 'editor:openInVSCode',
      location: value.location
    });
  };

  const handleCreateFromTemplate = (templateCode: string) => {
    setTemplateToSave(templateCode);

    // Check if a file is already bound to this mapping
    if (value.location && value.location.trim().length > 0) {
      // Already bound - show override dialog
      setShowOverrideDialog(true);
    } else {
      // Not bound - proceed with save dialog for creating new file
      setSaveMode('create');
      setShowSaveDialog(true);
    }
  };

  const handleOverrideExisting = () => {
    setShowOverrideDialog(false);
    setSaveMode('override');
    // Set the override location to the currently bound file
    setOverrideLocation(value.location || undefined);
    setShowSaveDialog(true);
  };

  const handleCreateNewFile = () => {
    setShowOverrideDialog(false);
    setSaveMode('create');
    // Clear override location for creating new file
    setOverrideLocation(undefined);
    setShowSaveDialog(true);
  };

  const handleSaveNewScript = (location: string, content: string, mode: 'create' | 'override') => {
    setShowSaveDialog(false);

    // Save previous binding for rollback
    setPreviousBinding({
      location: value.location || '',
      code: value.code || ''
    });

    // Send new message type
    postMessage({
      type: 'editor:createOrBindScript',
      location,
      content,
      scriptType,
      mode
    });

    // Optimistically bind - will rollback if extension returns error
    onChange({ ...value, mode: 'code', location, code: btoa(content) });
  };

  // Listen for script operation result and rollback on error
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;

      if (message.type === 'editor:scriptOperationResult') {
        if (!message.success) {
          // Rollback optimistic binding
          console.log('[MappingSection] Script operation failed, rolling back:', message.error);
          if (previousBinding) {
            onChange({
              ...value,
              location: previousBinding.location,
              code: previousBinding.code,
              mode: previousBinding.location ? 'code' : 'none'
            });
            setPreviousBinding(null);
          }
        } else {
          // Success - clear previous binding
          console.log('[MappingSection] Script operation succeeded:', message.action);
          setPreviousBinding(null);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [previousBinding, value, onChange]);

  return (
    <div className="mapping-section">
      <div className="mapping-section__header">
        <h4 className="mapping-section__title">{title}</h4>
        <p className="mapping-section__subtitle">{subtitle}</p>
      </div>

      {/* Radio Buttons */}
      <div className="mapping-section__mode-selector">
        <label className="mapping-section__radio">
          <input
            type="radio"
            name={`${type}-mode`}
            value="none"
            checked={value.mode === 'none'}
            onChange={() => handleModeChange('none')}
          />
          <span>None</span>
        </label>
        <label className="mapping-section__radio">
          <input
            type="radio"
            name={`${type}-mode`}
            value="mapper"
            checked={value.mode === 'mapper'}
            onChange={() => handleModeChange('mapper')}
          />
          <span>Mapper</span>
        </label>
        <label className="mapping-section__radio">
          <input
            type="radio"
            name={`${type}-mode`}
            value="code"
            checked={value.mode === 'code'}
            onChange={() => handleModeChange('code')}
          />
          <span>Code</span>
        </label>
      </div>

      {/* Mode-Specific Content */}
      <div className="mapping-section__content">
        {value.mode === 'none' && (
          <div className="mapping-section__empty">
            <p>No mapping configured. Data will pass through unchanged.</p>
          </div>
        )}

        {value.mode === 'mapper' && (
          <div className="mapping-section__mapper">
            <label className="mapping-section__label">
              Select Mapper
            </label>
            <div className="mapping-section__mapper-controls">
              <select
                className="mapping-section__select"
                value={value.mapperRef || ''}
                onChange={(e) => handleMapperChange(e.target.value)}
              >
                <option value="">-- Select a mapper --</option>
                {visualMappers.map((mapper) => {
                  const location = mapper.location || mapper.ref || '';
                  // Extract filename from path for display
                  const filename = location.split('/').pop() || location;
                  return (
                    <option key={location} value={location}>
                      {filename}
                    </option>
                  );
                })}
              </select>
              <button
                type="button"
                className="mapping-section__open-mapper-btn"
                onClick={handleOpenMapper}
                title="Open mapper tool in overlay"
              >
                Open Mapper
              </button>
            </div>
            {!value.mapperRef && visualMappers.length === 0 && (
              <p className="mapping-section__hint mapping-section__hint--warning">
                No visual mappers found. Click &quot;Open Mapper&quot; to create one.
              </p>
            )}
            {!value.mapperRef && visualMappers.length > 0 && (
              <p className="mapping-section__hint mapping-section__hint--warning">
                Please select a mapper or click &quot;Open Mapper&quot; to create one
              </p>
            )}
          </div>
        )}

        {value.mode === 'code' && (
          <div className="mapping-section__code">
            {/* Quick Templates Section */}
            <div className="mapping-section__templates-section">
              <label className="mapping-section__label">
                Quick Templates
              </label>
              <div className="mapping-section__templates-grid">
                {TEMPLATES.map((template, index) => {
                  const Icon = template.icon;

                  return (
                    <div key={index} className="mapping-section__template-card-wrapper">
                      <button
                        type="button"
                        className="mapping-section__template-card"
                        onClick={() => handleCreateFromTemplate(template.code)}
                        onMouseEnter={(e) => {
                          setHoveredTemplateIndex(index);
                          // Store button position for tooltip positioning
                          const rect = e.currentTarget.getBoundingClientRect();
                          e.currentTarget.dataset.buttonRect = JSON.stringify({
                            top: rect.top,
                            left: rect.left,
                            right: rect.right,
                            bottom: rect.bottom,
                            width: rect.width
                          });
                        }}
                        onMouseLeave={() => setHoveredTemplateIndex(null)}
                      >
                        <Icon size={16} className="mapping-section__template-card-icon" />
                        <div className="mapping-section__template-card-content">
                          <div className="mapping-section__template-card-name">{template.name}</div>
                          <div className="mapping-section__template-card-desc">
                            {template.description}
                          </div>
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tooltip Portal - rendered at root level */}
            {hoveredTemplateIndex !== null && (() => {
              const template = TEMPLATES[hoveredTemplateIndex];
              const Icon = template.icon;
              const buttonElement = document.querySelector(`[data-button-rect]`);
              const rect = buttonElement?.dataset?.buttonRect ? JSON.parse(buttonElement.dataset.buttonRect) : null;

              if (!rect) return null;

              // Calculate tooltip dimensions
              const tooltipWidth = 500;
              const tooltipMaxWidth = window.innerWidth * 0.9;
              const actualTooltipWidth = Math.min(tooltipWidth, tooltipMaxWidth);

              // Calculate button center
              const buttonCenterX = rect.left + rect.width / 2;
              const buttonCenterY = rect.top + rect.height / 2;

              // Calculate if we should show on left or right based on available space
              const showOnLeft = buttonCenterX > window.innerWidth / 2;

              // Calculate horizontal position (center-to-center alignment)
              let leftPos: number;
              if (showOnLeft) {
                // Position tooltip to the left of button, centered vertically with button
                leftPos = buttonCenterX - actualTooltipWidth - 12;
              } else {
                // Position tooltip to the right of button, centered vertically with button
                leftPos = buttonCenterX + 12;
              }

              return (
                <div
                  className="mapping-section__tooltip"
                  style={{
                    top: `${buttonCenterY}px`,
                    left: `${leftPos}px`,
                    transform: 'translateY(-50%)',
                    width: `${actualTooltipWidth}px`,
                  }}
                >
                  <div className="mapping-section__tooltip-header">
                    <div className="mapping-section__tooltip-title">
                      <Icon size={14} className="mapping-section__tooltip-title-icon" />
                      {template.name}
                    </div>
                    <div className="mapping-section__tooltip-desc">
                      {template.description}
                    </div>
                  </div>
                  <div className="mapping-section__tooltip-body">
                    <div className="mapping-section__tooltip-editor">
                      <Editor
                        height="100%"
                        defaultLanguage="csharp"
                        value={template.code}
                        theme="vs"
                        options={{
                          readOnly: true,
                          minimap: { enabled: false },
                          fontSize: 12,
                          fontFamily: "'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace",
                          lineNumbers: 'on',
                          wordWrap: 'on',
                          scrollBeyondLastLine: false,
                          automaticLayout: true,
                          padding: { top: 8, bottom: 8 },
                          renderLineHighlight: 'none',
                          lineDecorationsWidth: 0,
                          lineNumbersMinChars: 3,
                          folding: false,
                          domReadOnly: true,
                          contextmenu: false,
                          scrollbar: {
                            vertical: 'auto',
                            horizontal: 'auto',
                            verticalScrollbarSize: 8,
                            horizontalScrollbarSize: 8
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Script Selector */}
            <ScriptSelector
              label={scriptType === 'mapping' ? 'Mapping Script' : 'Rule Script'}
              availableScripts={csxScripts}
              value={value.location || null}
              scriptType={scriptType}
              onChange={handleScriptSelect}
              helpText="Select an existing script file or create new from template above"
            />

            {/* Open in VS Code button */}
            {value.location && (
              <div className="mapping-section__vscode-btn-wrapper">
                <button
                  type="button"
                  className="mapping-section__vscode-btn"
                  onClick={handleOpenInVSCode}
                  title="Open script file in VS Code for editing"
                >
                  📝 Open in VS Code
                </button>
              </div>
            )}

            {isCodeBase64 && (
              <p className="mapping-section__hint mapping-section__hint--info">
                ℹ️ Viewing script content (read-only)
              </p>
            )}

            {/* Read-only Monaco Editor */}
            <div className="mapping-section__monaco-wrapper">
              <Editor
                height="300px"
                defaultLanguage="csharp"
                value={displayCode}
                theme="vs"
                options={{
                  readOnly: true, // Make editor read-only
                  minimap: { enabled: false },
                  fontSize: 13,
                  fontFamily: "'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace",
                  lineNumbers: 'on',
                  wordWrap: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  padding: { top: 12, bottom: 12 },
                  renderLineHighlight: 'all',
                  lineDecorationsWidth: 0,
                  lineNumbersMinChars: 3,
                  folding: true,
                  domReadOnly: true,
                  contextmenu: false
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Override Script Dialog */}
      {showOverrideDialog && (
        <OverrideScriptDialog
          scriptType={scriptType}
          currentLocation={value.location || ''}
          templateContent={templateToSave}
          onOverride={handleOverrideExisting}
          onCreateNew={handleCreateNewFile}
          onCancel={() => setShowOverrideDialog(false)}
        />
      )}

      {/* Save Script Dialog */}
      {showSaveDialog && (
        <SaveScriptDialog
          scriptType={scriptType}
          templateContent={templateToSave}
          workflowName={workflowName}
          fromStateKey={stateKey}
          mode={saveMode}
          overrideLocation={overrideLocation}
          onSave={handleSaveNewScript}
          onCancel={() => setShowSaveDialog(false)}
        />
      )}
    </div>
  );
}
