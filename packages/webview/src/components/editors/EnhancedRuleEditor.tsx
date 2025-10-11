import React, { useState, useEffect } from 'react';
import { EnhancedMappingEditor } from './EnhancedMappingEditor';
import { ScriptSelector, type ScriptItem } from './ScriptSelector';
import type {
  Rule,
  State,
  Workflow,
  TaskDefinition
} from '../../types/workflow-types';

interface EnhancedRuleEditorProps {
  title: string;
  rule?: Rule;
  inlineText: string;
  availableRules?: ScriptItem[];
  onLoadFromFile?: () => void;
  onChange: (rule?: Rule) => void;
  onInlineChange: (text: string) => void;
  // Enhanced context
  currentState?: State;
  workflow?: Workflow;
  availableTasks?: TaskDefinition[];
  hideHeader?: boolean;
}

interface RuleTemplate {
  name: string;
  description: string;
  code: string;
  category: 'amount' | 'time' | 'risk' | 'status' | 'condition';
}

const RULE_TEMPLATES: RuleTemplate[] = [
  {
    name: 'Amount Threshold',
    description: 'Check if amount exceeds threshold',
    code: 'return input.Amount > 10000;',
    category: 'amount'
  },
  {
    name: 'Business Hours',
    description: 'Check if current time is within business hours',
    code: `var now = DateTime.Now;
return now.Hour >= 9 && now.Hour <= 17 &&
       now.DayOfWeek != DayOfWeek.Saturday &&
       now.DayOfWeek != DayOfWeek.Sunday;`,
    category: 'time'
  },
  {
    name: 'Risk Score Check',
    description: 'Validate risk score is below threshold',
    code: 'return input.RiskScore < 0.5;',
    category: 'risk'
  },
  {
    name: 'Status Validation',
    description: 'Check if status matches expected value',
    code: 'return input.Status == "ACTIVE";',
    category: 'status'
  },
  {
    name: 'Multiple Conditions',
    description: 'Complex condition with multiple checks',
    code: `return input.Amount > 1000 &&
       input.CustomerType == "PREMIUM" &&
       input.RiskScore < 0.3;`,
    category: 'condition'
  },
  {
    name: 'User Permission Check',
    description: 'Check if user has required permissions',
    code: `// Check user permissions
var userId = Context.UserId;
var requiredRole = "MANAGER";

return input.UserRoles != null &&
       input.UserRoles.Contains(requiredRole);`,
    category: 'condition'
  },
  {
    name: 'Data Completeness',
    description: 'Verify all required fields are present',
    code: `// Check data completeness
return !string.IsNullOrEmpty(input.UserId) &&
       !string.IsNullOrEmpty(input.Email) &&
       input.Amount > 0 &&
       input.Data != null;`,
    category: 'condition'
  },
  {
    name: 'Retry Logic',
    description: 'Check retry count and conditions',
    code: `// Retry logic with backoff
var maxRetries = 3;
var currentRetry = State.RetryCount ?? 0;

return currentRetry < maxRetries &&
       input.Status != "FAILED" &&
       input.ErrorType != "PERMANENT";`,
    category: 'condition'
  }
];

export const EnhancedRuleEditor: React.FC<EnhancedRuleEditorProps> = ({
  title,
  rule,
  inlineText,
  availableRules = [],
  onLoadFromFile,
  onChange,
  onInlineChange,
  currentState,
  workflow,
  availableTasks = [],
  hideHeader = false
}) => {
  const [showTemplates, setShowTemplates] = useState(false);
  const [editorMode, setEditorMode] = useState<'basic' | 'advanced'>('basic');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const hasRule = Boolean(rule);

  useEffect(() => {
    // Auto-switch to advanced mode if there's complex code
    if (inlineText && (inlineText.includes('\n') || inlineText.length > 50)) {
      setEditorMode('advanced');
    }
  }, [inlineText]);

  useEffect(() => {
    // Validate rule content
    validateRule(inlineText);
  }, [inlineText]);

  const validateRule = (code: string) => {
    const errors: string[] = [];

    if (!code.trim()) {
      errors.push('Rule cannot be empty');
    } else {
      if (!code.includes('return')) {
        errors.push('Rule must contain a return statement');
      }

      // Check for common syntax issues
      const openBraces = (code.match(/\{/g) || []).length;
      const closeBraces = (code.match(/\}/g) || []).length;
      if (openBraces !== closeBraces) {
        errors.push('Mismatched braces');
      }

      const openParens = (code.match(/\(/g) || []).length;
      const closeParens = (code.match(/\)/g) || []).length;
      if (openParens !== closeParens) {
        errors.push('Mismatched parentheses');
      }
    }

    setValidationErrors(errors);
  };

  const applyTemplate = (template: RuleTemplate) => {
    onInlineChange(template.code);
    setShowTemplates(false);
    setEditorMode('advanced');

    // Create rule if it doesn't exist
    if (!hasRule) {
      onChange({
        location: `./src/rules/${template.name.toLowerCase().replace(/\s+/g, '_')}.csx`,
        code: ''
      });
    }
  };

  const createMappingFromRule = () => {
    return {
      location: rule?.location || './src/rules/new.csx',
      code: btoa(inlineText),
      enabled: true,
      type: 'rule'
    };
  };

  return (
    <div className="property-panel__group">
      {!hideHeader && (
        <div className="property-panel__group-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            type="button"
            onClick={() => hasRule ? setIsExpanded(!isExpanded) : null}
            className="property-panel__collapsible-toggle"
            style={{
              background: 'none',
              border: 'none',
              cursor: hasRule ? 'pointer' : 'default',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              color: 'inherit',
              fontSize: 'inherit',
              fontWeight: 'inherit',
              flex: '1',
              textAlign: 'left'
            }}
          >
            {hasRule && (
              <span style={{ marginRight: '8px', fontSize: '12px' }}>
                {isExpanded ? '▼' : '▶'}
              </span>
            )}
            <span>{title || 'Rule'}</span>
          </button>
          <div className="property-panel__header-actions" style={{ display: 'flex', alignItems: 'center' }}>
            {!hasRule && (
              <button
                type="button"
                onClick={() => onChange({ location: './src/rules/new.csx', code: '' })}
                className="property-panel__add-button"
                title="Add rule"
              >
                +
              </button>
            )}
            {hasRule && (
              <>
                <button
                  type="button"
                  onClick={() => setShowTemplates(!showTemplates)}
                  className="property-panel__action-button"
                  title="Rule templates"
                >
                  📚
                </button>
                <button
                  type="button"
                  onClick={() => setEditorMode(editorMode === 'basic' ? 'advanced' : 'basic')}
                  className="property-panel__action-button"
                  title={`Switch to ${editorMode === 'basic' ? 'advanced' : 'basic'} editor`}
                >
                  {editorMode === 'basic' ? '⚡' : '📝'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {hasRule && rule && (hideHeader || isExpanded) && (
        <>
          {availableRules.length > 0 ? (
            <ScriptSelector
              label="Rule Script"
              value={rule.location || null}
              availableScripts={availableRules}
              scriptType="rule"
              onChange={(location, script) => {
                if (location && script) {
                  // Update both location and load the script content
                  onChange({
                    location: script.location,
                    code: script.content // Use plain content, will be encoded on save
                  });
                  // Also update the inline text state
                  onInlineChange(script.content);
                } else {
                  onChange(undefined);
                  onInlineChange('');
                }
              }}
              helpText="Select a rule script from available scripts in the workspace"
            />
          ) : (
            <div className="property-panel__field">
              <label>Location:</label>
              <div className="property-panel__input-group">
                <input
                  type="text"
                  value={rule.location}
                  onChange={(e) => onChange({ ...rule, location: e.target.value })}
                  placeholder="./src/rules/example.csx"
                  className="property-panel__input"
                />
                {onLoadFromFile && (
                  <button
                    type="button"
                    onClick={onLoadFromFile}
                    className="property-panel__action-button"
                    title="Load from file"
                  >
                    📁
                  </button>
                )}
              </div>
            </div>
          )}

          {showTemplates && (
            <div className="property-panel__templates">
              <h4>Rule Templates</h4>
              <div className="property-panel__template-grid">
                {RULE_TEMPLATES.map((template, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => applyTemplate(template)}
                    className="property-panel__template-item"
                    title={template.description}
                  >
                    <span className="property-panel__template-name">{template.name}</span>
                    <span className="property-panel__template-category">{template.category}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {editorMode === 'advanced' ? (
            <EnhancedMappingEditor
              mapping={createMappingFromRule()}
              onMappingChange={(mapping) => {
                try {
                  const decodedContent = atob(mapping.code);
                  onInlineChange(decodedContent);
                } catch {
                  onInlineChange(mapping.code);
                }
              }}
              onError={(error) => console.error('Rule editor error:', error)}
              onMessage={(message) => console.log('Rule editor message:', message)}
              height="200px"
              showTemplateSelector={false}
              allowFullScreen={true}
              currentState={currentState}
              workflow={workflow}
              availableTasks={availableTasks}
            />
          ) : (
            <div className="property-panel__field">
              <label>Rule Code:</label>
              <textarea
                value={inlineText}
                onChange={(e) => onInlineChange(e.target.value)}
                placeholder="Enter rule condition (must return boolean)&#10;Example: return input.Amount > 10000;"
                className={`property-panel__textarea ${validationErrors.length > 0 ? 'property-panel__textarea--error' : ''}`}
                rows={4}
              />
              {validationErrors.length > 0 && (
                <div className="property-panel__validation-errors">
                  {validationErrors.map((error, index) => (
                    <div key={index} className="property-panel__error">
                      ⚠️ {error}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {validationErrors.length === 0 && inlineText && (
            <div className="property-panel__help property-panel__help--success">
              ✅ Rule looks valid! This will be evaluated as a boolean condition.
            </div>
          )}

          <div className="property-panel__help">
            <h4>💡 Rule Tips:</h4>
            <ul>
              <li><strong>Return boolean:</strong> Rules must return true/false</li>
              <li><strong>Use &apos;input&apos;:</strong> Access input data with input.PropertyName</li>
              <li><strong>Context available:</strong> Use Context.UserId, Context.WorkflowId</li>
              {currentState && <li><strong>State info:</strong> Use State.Key for current state: {currentState.key}</li>}
            </ul>
          </div>
        </>
      )}

      {!hasRule && (
        <div className="property-panel__help">
          <p><strong>Rules</strong> determine when a transition should be taken.</p>
          <p>Click + to add a rule that returns true/false.</p>
          <p>Rules are evaluated as C# expressions that must return a boolean value.</p>
        </div>
      )}
    </div>
  );
};
