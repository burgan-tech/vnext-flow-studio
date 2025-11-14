import React, { useState, useMemo } from 'react';
import Editor from '@monaco-editor/react';
import { FileCode, ExternalLink, Trash2, Info, Sparkles } from 'lucide-react';
import { useBridge } from '../../hooks/useBridge';
import { ScriptSelector, type ScriptItem } from './ScriptSelector';
import { SaveScriptDialog } from './SaveScriptDialog';

/**
 * Check if a string is base64 encoded
 */
function isBase64(str: string): boolean {
  if (!str || str.length === 0) return false;
  const base64Regex = /^[A-Za-z0-9+/]+={0,2}$/;
  if (!base64Regex.test(str)) return false;
  try {
    const decoded = atob(str);
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
    return str;
  }
}

const RULE_TEMPLATES = [
  {
    name: 'Simple Property Check',
    description: 'Check a single property value for equality',
    code: `using System.Threading.Tasks;
using BBT.Workflow.Scripting;

public class MyRule : IConditionMapping
{
    public async Task<bool> Handler(ScriptContext context)
    {
        // Check a simple property value
        return context.Instance.Data?.status == "approved";
    }
}`,
  },
  {
    name: 'Boolean Flag Check',
    description: 'Check boolean property with null safety',
    code: `using System.Threading.Tasks;
using BBT.Workflow.Scripting;

public class MyRule : IConditionMapping
{
    public async Task<bool> Handler(ScriptContext context)
    {
        // Check boolean flag with null safety
        return context.Instance.Data?.isVerified == true;
    }
}`,
  },
  {
    name: 'Null Check & Validation',
    description: 'Validate data exists and meets conditions',
    code: `using System.Threading.Tasks;
using BBT.Workflow.Scripting;

public class MyRule : IConditionMapping
{
    public async Task<bool> Handler(ScriptContext context)
    {
        var data = context.Instance.Data?.evaluation;

        // Return true if data is missing
        if (data == null)
            return true;

        // Check specific conditions
        return data.isSuccess == true && data.hasErrors == false;
    }
}`,
  },
  {
    name: 'Multiple Conditions (AND)',
    description: 'All conditions must be true',
    code: `using System.Threading.Tasks;
using BBT.Workflow.Scripting;

public class MyRule : IConditionMapping
{
    public async Task<bool> Handler(ScriptContext context)
    {
        // All conditions must be true
        return context.Instance.Data?.isActive == true &&
               context.Instance.Data?.isVerified == true &&
               context.Instance.Data?.hasErrors == false;
    }
}`,
  },
  {
    name: 'Multiple Conditions (OR)',
    description: 'Any condition can be true',
    code: `using System.Threading.Tasks;
using BBT.Workflow.Scripting;

public class MyRule : IConditionMapping
{
    public async Task<bool> Handler(ScriptContext context)
    {
        var status = context.Instance.Data?.status;

        // Any of these conditions can be true
        return status == "approved" ||
               status == "pending" ||
               status == "review";
    }
}`,
  },
  {
    name: 'Amount/Threshold Check',
    description: 'Compare numeric values with default fallbacks',
    code: `using System.Threading.Tasks;
using BBT.Workflow.Scripting;

public class MyRule : IConditionMapping
{
    public async Task<bool> Handler(ScriptContext context)
    {
        var amount = context.Instance.Data?.amount ?? 0;
        var threshold = context.Instance.Data?.threshold ?? 1000;

        // Check if amount exceeds threshold
        return amount > threshold;
    }
}`,
  },
  {
    name: 'Status Code (Enum)',
    description: 'Check against enumerated status values',
    code: `using System.Threading.Tasks;
using BBT.Workflow.Scripting;

public class MyRule : IConditionMapping
{
    public async Task<bool> Handler(ScriptContext context)
    {
        // Check against enum value
        return context.Instance.Data?.status == (int)Status.Approved;
    }

    private enum Status
    {
        Pending = 1,
        Approved = 2,
        Rejected = 3,
        Failed = 5
    }
}`,
  },
  {
    name: 'Negation (!= or Inverse)',
    description: 'Check for absence or negative condition',
    code: `using System.Threading.Tasks;
using BBT.Workflow.Scripting;

public class MyRule : IConditionMapping
{
    public async Task<bool> Handler(ScriptContext context)
    {
        // Check for absence or false condition
        return context.Instance.Data?.hasErrors != true;
    }
}`,
  },
];

export interface TransitionRuleData {
  location?: string;
  code?: string;
}

interface TransitionRuleEditPopupProps {
  transitionKey: string;
  fromState: string;
  rule?: TransitionRuleData;
  availableScripts?: any[];
  workflowName?: string;
  onApply: (rule?: TransitionRuleData) => void;
  onCancel: () => void;
}

/**
 * Popup editor for transition rules (only for auto transitions)
 */
export function TransitionRuleEditPopup({
  transitionKey,
  fromState,
  rule,
  availableScripts = [],
  workflowName,
  onApply,
  onCancel
}: TransitionRuleEditPopupProps) {
  const { postMessage } = useBridge();
  const [currentRule, setCurrentRule] = useState<TransitionRuleData | undefined>(rule);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [templateToSave, setTemplateToSave] = useState<string>('');
  const [focusedTemplateIndex, setFocusedTemplateIndex] = useState<number>(-1);
  const [hoveredTemplateIndex, setHoveredTemplateIndex] = useState<number>(-1);

  const hasRule = Boolean(currentRule);

  // Filter to only show .csx files (rule scripts)
  const csxScripts = availableScripts.filter(m => {
    const location = m.location || '';
    return location.endsWith('.csx');
  });

  // Decode code if it's base64 encoded
  const displayCode = useMemo(() => {
    const code = currentRule?.code || '';
    if (isBase64(code)) {
      return decodeBase64(code);
    }
    return code;
  }, [currentRule?.code]);

  const handleScriptSelect = (location: string | null, script: ScriptItem | null) => {
    if (script && location) {
      setCurrentRule({
        location: location,
        code: script.base64
      });
    } else {
      setCurrentRule(undefined);
    }
  };

  const handleOpenInVSCode = () => {
    if (!currentRule?.location) {
      return;
    }
    postMessage({
      type: 'editor:openInVSCode',
      location: currentRule.location
    });
  };

  const handleCreateFromTemplate = (templateCode: string) => {
    setTemplateToSave(templateCode);
    setShowSaveDialog(true);
  };

  const handleSaveNewScript = (location: string, content: string) => {
    setShowSaveDialog(false);
    postMessage({
      type: 'editor:createScript',
      location,
      content,
      scriptType: 'rule'
    });
    // Set optimistically
    setCurrentRule({ location, code: btoa(content) });
  };

  const handleApply = () => {
    onApply(currentRule);
  };

  const handleRemove = () => {
    setCurrentRule(undefined);
  };

  const handleTemplateKeyDown = (e: React.KeyboardEvent, index: number, templateCode: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleCreateFromTemplate(templateCode);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = Math.min(index + 1, RULE_TEMPLATES.length - 1);
      setFocusedTemplateIndex(nextIndex);
      // Focus the next template button
      const buttons = document.querySelectorAll('[data-template-button]');
      if (buttons[nextIndex]) {
        (buttons[nextIndex] as HTMLElement).focus();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = Math.max(index - 1, 0);
      setFocusedTemplateIndex(prevIndex);
      // Focus the previous template button
      const buttons = document.querySelectorAll('[data-template-button]');
      if (buttons[prevIndex]) {
        (buttons[prevIndex] as HTMLElement).focus();
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div
      className="comment-modal-overlay"
      onClick={onCancel}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="rule-edit-title"
      style={{
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)'
      }}
    >
      <div
        className="comment-modal"
        style={{
          width: '800px',
          maxWidth: '95vw',
          maxHeight: '90vh',
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #e2e8f0',
          backgroundColor: '#f8fafc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <h2
              id="rule-edit-title"
              style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: 600,
                color: '#0f172a',
                marginBottom: '4px'
              }}
            >
              Edit Transition Rule
            </h2>
            <div style={{
              fontSize: '13px',
              color: '#64748b',
              fontFamily: "'Monaco', 'Menlo', monospace"
            }}>
              <span style={{ color: '#475569' }}>{fromState}</span>
              <span style={{ margin: '0 8px', color: '#94a3b8' }}>→</span>
              <span style={{ color: '#475569', fontWeight: 500 }}>{transitionKey}</span>
            </div>
          </div>
          <button
            onClick={onCancel}
            aria-label="Close"
            type="button"
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              color: '#64748b',
              cursor: 'pointer',
              padding: '4px 8px',
              lineHeight: 1,
              borderRadius: '4px',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#f1f5f9';
              e.currentTarget.style.color = '#0f172a';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#64748b';
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '28px'
        }}>
          {/* Info Banner */}
          <div style={{
            padding: '14px 16px',
            backgroundColor: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: '8px',
            marginBottom: '24px',
            fontSize: '13px',
            color: '#1e3a8a',
            lineHeight: '1.6',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px'
          }}>
            <Info size={18} style={{ flexShrink: 0, marginTop: '1px', color: '#3b82f6' }} />
            <div>
              Rules determine when this auto transition should execute. They must return a boolean value.
            </div>
          </div>

          {/* Quick Templates Section */}
          <div style={{ marginBottom: '28px' }}>
            <div style={{
              fontSize: '14px',
              fontWeight: 600,
              color: '#0f172a',
              marginBottom: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Sparkles size={18} style={{ color: '#3b82f6' }} />
              <span>Quick Templates</span>
            </div>
            <div
              role="group"
              aria-label="Rule templates"
              style={{
                display: 'grid',
                gap: '10px',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))'
              }}
            >
              {RULE_TEMPLATES.map((template, index) => (
                <div
                  key={index}
                  style={{
                    position: 'relative'
                  }}
                  onMouseEnter={() => setHoveredTemplateIndex(index)}
                  onMouseLeave={() => setHoveredTemplateIndex(-1)}
                >
                  <button
                    type="button"
                    data-template-button
                    onClick={() => {
                      handleCreateFromTemplate(template.code);
                    }}
                    onKeyDown={(e) => handleTemplateKeyDown(e, index, template.code)}
                    tabIndex={0}
                    aria-label={`Create rule from template: ${template.name}`}
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      fontSize: '13px',
                      backgroundColor: '#ffffff',
                      color: '#334155',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                      outline: focusedTemplateIndex === index ? '2px solid #3b82f6' : 'none',
                      outlineOffset: '2px'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = '#f8fafc';
                      e.currentTarget.style.borderColor = '#3b82f6';
                      e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = '#ffffff';
                      e.currentTarget.style.borderColor = '#e2e8f0';
                      e.currentTarget.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.05)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                    onFocus={() => setFocusedTemplateIndex(index)}
                    onBlur={() => setFocusedTemplateIndex(-1)}
                  >
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '6px',
                      backgroundColor: '#eff6ff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <FileCode size={18} style={{ color: '#3b82f6' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontWeight: 600,
                        color: '#0f172a',
                        marginBottom: '2px',
                        fontSize: '14px'
                      }}>
                        {template.name}
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: '#64748b',
                        lineHeight: '1.4'
                      }}>
                        {(template as any).description || template.code.split('\n')[0].replace('//', '').trim()}
                      </div>
                    </div>
                  </button>

                  {/* Code Preview Tooltip */}
                  {hoveredTemplateIndex === index && (
                    <div
                      style={{
                        position: 'absolute',
                        // Show on left for odd indices (right column in 2-col layout), right for even indices (left column)
                        ...(index % 2 === 1
                          ? { right: 'calc(100% + 12px)' }
                          : { left: 'calc(100% + 12px)' }
                        ),
                        top: 0,
                        width: '450px',
                        maxHeight: '400px',
                        backgroundColor: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                        zIndex: 1000,
                        overflow: 'hidden',
                        pointerEvents: 'none'
                      }}
                    >
                      <div style={{
                        padding: '10px 12px',
                        backgroundColor: '#f8fafc',
                        borderBottom: '1px solid #e2e8f0',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#475569',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <FileCode size={14} style={{ color: '#3b82f6' }} />
                        <span>Template Preview</span>
                      </div>
                      <div style={{
                        padding: '12px',
                        maxHeight: '360px',
                        overflow: 'auto',
                        backgroundColor: '#fafafa'
                      }}>
                        <pre style={{
                          margin: 0,
                          fontSize: '11px',
                          fontFamily: "'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace",
                          lineHeight: '1.5',
                          color: '#1e293b',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word'
                        }}>
                          {template.code}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Script Selector Section */}
          <div style={{ marginBottom: '28px' }}>
            <div style={{
              fontSize: '14px',
              fontWeight: 600,
              color: '#0f172a',
              marginBottom: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <FileCode size={18} style={{ color: '#3b82f6' }} />
              <span>Select Existing Rule Script</span>
            </div>
            <div
              role="region"
              aria-label="Rule script selector"
              className="rule-script-selector-wrapper"
            >
              <ScriptSelector
                label="Rule Script"
                availableScripts={csxScripts}
                scriptType="rule"
                value={currentRule?.location || null}
                onChange={handleScriptSelect}
                helpText="Choose an existing rule script file (*.csx)"
              />
            </div>
          </div>

          {/* Preview Section */}
          {hasRule && currentRule && (
            <div>
              <div style={{
                fontSize: '14px',
                fontWeight: 600,
                color: '#0f172a',
                marginBottom: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileCode size={18} style={{ color: '#3b82f6' }} />
                  <span>Code Preview</span>
                  <span style={{
                    fontSize: '11px',
                    color: '#64748b',
                    padding: '3px 10px',
                    backgroundColor: '#e0e7ff',
                    borderRadius: '6px',
                    fontWeight: 500
                  }}>
                    Read-only
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={handleOpenInVSCode}
                    title="Open script file in VS Code for editing"
                    aria-label="Edit in VS Code"
                    style={{
                      padding: '7px 14px',
                      fontSize: '13px',
                      fontWeight: 500,
                      backgroundColor: '#3b82f6',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = '#2563eb';
                      e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = '#3b82f6';
                      e.currentTarget.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.05)';
                    }}
                  >
                    <ExternalLink size={14} />
                    <span>Edit in VS Code</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleRemove}
                    title="Remove this rule"
                    aria-label="Remove rule"
                    style={{
                      padding: '7px 14px',
                      fontSize: '13px',
                      fontWeight: 500,
                      backgroundColor: '#ffffff',
                      color: '#dc2626',
                      border: '1px solid #fecaca',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = '#fef2f2';
                      e.currentTarget.style.borderColor = '#dc2626';
                      e.currentTarget.style.boxShadow = '0 2px 4px 0 rgba(220, 38, 38, 0.1)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = '#ffffff';
                      e.currentTarget.style.borderColor = '#fecaca';
                      e.currentTarget.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.05)';
                    }}
                  >
                    <Trash2 size={14} />
                    <span>Remove</span>
                  </button>
                </div>
              </div>

              {/* Monaco Editor */}
              <div style={{
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                overflow: 'hidden',
                backgroundColor: '#ffffff'
              }}>
                <Editor
                  height="320px"
                  defaultLanguage="csharp"
                  value={displayCode}
                  theme="vs"
                  options={{
                    readOnly: true,
                    minimap: { enabled: false },
                    fontSize: 13,
                    fontFamily: "'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace",
                    lineNumbers: 'on',
                    wordWrap: 'on',
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    padding: { top: 16, bottom: 16 },
                    renderLineHighlight: 'all',
                    lineDecorationsWidth: 0,
                    lineNumbersMinChars: 3,
                    folding: true,
                    domReadOnly: true,
                    contextmenu: false
                  }}
                />
              </div>

              {/* File Path */}
              <div style={{
                marginTop: '8px',
                padding: '8px 12px',
                backgroundColor: '#f8fafc',
                borderRadius: '6px',
                fontSize: '11px',
                color: '#64748b',
                fontFamily: "'Monaco', 'Menlo', monospace",
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <FileCode size={12} style={{ flexShrink: 0 }} />
                <span style={{ color: '#475569' }}>{currentRule.location}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          role="group"
          aria-label="Dialog actions"
          style={{
            padding: '18px 28px',
            borderTop: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px'
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancel and close dialog"
            style={{
              padding: '9px 18px',
              fontSize: '14px',
              fontWeight: 500,
              backgroundColor: '#ffffff',
              color: '#475569',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#f1f5f9';
              e.currentTarget.style.borderColor = '#94a3b8';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#ffffff';
              e.currentTarget.style.borderColor = '#cbd5e1';
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            aria-label="Link selected rule file to this transition"
            style={{
              padding: '9px 22px',
              fontSize: '14px',
              fontWeight: 500,
              backgroundColor: '#3b82f6',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#2563eb';
              e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#3b82f6';
              e.currentTarget.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.05)';
            }}
          >
            {hasRule ? 'Link Rule File' : 'Save'}
          </button>
        </div>

        {/* Save Script Dialog */}
        {showSaveDialog && (
          <SaveScriptDialog
            scriptType="rule"
            templateContent={templateToSave}
            workflowName={workflowName}
            fromStateKey={fromState}
            onSave={handleSaveNewScript}
            onCancel={() => setShowSaveDialog(false)}
          />
        )}
      </div>
    </div>
  );
}
