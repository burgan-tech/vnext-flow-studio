import { useState, useEffect } from 'react';
import { functoidRegistry } from '../../../../core/src/mapper/registry';
import type { NodeKind, FunctoidCategory } from '../../../../core/src/mapper/types';
import { getFunctoidIcon } from './functoidIcons';
import { extractTemplateParams, validateTemplate } from '../../../../core/src/mapper/templateUtils';
import './FunctoidConfigPanel.css';

const CATEGORY_COLORS: Record<FunctoidCategory, string> = {
  math: '#f59e0b',
  string: '#3b82f6',
  logical: '#8b5cf6',
  conditional: '#6366f1',
  collection: '#10b981',
  aggregate: '#14b8a6',
  conversion: '#f97316',
  datetime: '#ec4899',
  custom: '#6b7280'
};

/**
 * FunctoidConfigPanel - Configuration panel for functoid nodes
 * Displays on right sidebar when a functoid is selected
 */
export interface FunctoidConfigPanelProps {
  nodeId: string;
  nodeKind: NodeKind;
  config: Record<string, any>;
  onConfigChange: (nodeId: string, config: Record<string, any>) => void;
  onClose: () => void;
}

export function FunctoidConfigPanel({
  nodeId,
  nodeKind,
  config,
  onConfigChange,
  onClose
}: FunctoidConfigPanelProps) {
  const functoid = functoidRegistry[nodeKind];
  const [localConfig, setLocalConfig] = useState<Record<string, any>>(config || {});

  // Update local config when props change
  useEffect(() => {
    setLocalConfig(config || {});
  }, [config, nodeId]);

  const handleChange = (key: string, value: any) => {
    const newConfig = { ...localConfig, [key]: value };
    setLocalConfig(newConfig);
    onConfigChange(nodeId, newConfig);
  };

  if (!functoid) {
    return null;
  }

  /**
   * Render config fields based on functoid type
   */
  const renderConfigFields = () => {
    // Constant functoid - needs a value and type
    if (nodeKind === 'Const.Value') {
      return (
        <>
          <div className="config-field">
            <label className="config-label">Data Type:</label>
            <select
              className="config-input"
              value={localConfig.type || 'string'}
              onChange={(e) => handleChange('type', e.target.value)}
            >
              <option value="string">String</option>
              <option value="number">Number</option>
              <option value="integer">Integer</option>
              <option value="boolean">Boolean</option>
              <option value="object">Object (JSON)</option>
              <option value="array">Array (JSON)</option>
              <option value="any">Any</option>
            </select>
            <div className="config-hint">
              Type of the constant value
            </div>
          </div>
          <div className="config-field">
            <label className="config-label">Constant Value:</label>
            {localConfig.type === 'boolean' ? (
              <select
                className="config-input"
                value={localConfig.value || 'true'}
                onChange={(e) => handleChange('value', e.target.value)}
              >
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            ) : (
              <input
                type="text"
                className="config-input"
                value={localConfig.value || ''}
                onChange={(e) => handleChange('value', e.target.value)}
                placeholder={
                  localConfig.type === 'object' ? '{"key": "value"}' :
                  localConfig.type === 'array' ? '[1, 2, 3]' :
                  localConfig.type === 'number' || localConfig.type === 'integer' ? '42' :
                  'Enter value'
                }
              />
            )}
            <div className="config-hint">
              {localConfig.type === 'object' ? 'Enter valid JSON object' :
               localConfig.type === 'array' ? 'Enter valid JSON array' :
               localConfig.type === 'number' || localConfig.type === 'integer' ? 'Enter numeric value' :
               'Enter the constant value'}
            </div>
          </div>
        </>
      );
    }

    // Custom function - needs code
    if (nodeKind === 'Custom.Function') {
      return (
        <div className="config-field">
          <label className="config-label">Function Code:</label>
          <textarea
            className="config-textarea"
            value={localConfig.code || ''}
            onChange={(e) => handleChange('code', e.target.value)}
            placeholder="return input * 2;"
            rows={8}
          />
          <div className="config-hint">
            JavaScript expression. Available: input, args
          </div>
        </div>
      );
    }

    // DateTime Format - needs format string
    if (nodeKind === 'DateTime.Format') {
      return (
        <div className="config-field">
          <label className="config-label">Date Format:</label>
          <input
            type="text"
            className="config-input"
            value={localConfig.format || 'YYYY-MM-DD'}
            onChange={(e) => handleChange('format', e.target.value)}
            placeholder="YYYY-MM-DD"
          />
          <div className="config-hint">
            Examples: YYYY-MM-DD, MM/DD/YYYY, DD.MM.YYYY HH:mm:ss
          </div>
        </div>
      );
    }

    // String Replace - needs search and replace patterns
    if (nodeKind === 'String.Replace') {
      return (
        <>
          <div className="config-field">
            <label className="config-label">Search Pattern:</label>
            <input
              type="text"
              className="config-input"
              value={localConfig.search || ''}
              onChange={(e) => handleChange('search', e.target.value)}
              placeholder="Text to find"
            />
          </div>
          <div className="config-field">
            <label className="config-label">Replace With:</label>
            <input
              type="text"
              className="config-input"
              value={localConfig.replace || ''}
              onChange={(e) => handleChange('replace', e.target.value)}
              placeholder="Replacement text"
            />
          </div>
          <div className="config-field">
            <label className="config-checkbox">
              <input
                type="checkbox"
                checked={localConfig.regex || false}
                onChange={(e) => handleChange('regex', e.target.checked)}
              />
              <span>Use Regular Expression</span>
            </label>
          </div>
        </>
      );
    }

    // String Split - needs delimiter
    if (nodeKind === 'String.Split') {
      return (
        <div className="config-field">
          <label className="config-label">Delimiter:</label>
          <input
            type="text"
            className="config-input"
            value={localConfig.delimiter || ','}
            onChange={(e) => handleChange('delimiter', e.target.value)}
            placeholder="Delimiter (e.g., comma, space)"
          />
          <div className="config-hint">
            Character(s) to split on
          </div>
        </div>
      );
    }

    // String Join - needs delimiter
    if (nodeKind === 'String.Join') {
      return (
        <div className="config-field">
          <label className="config-label">Delimiter:</label>
          <input
            type="text"
            className="config-input"
            value={localConfig.delimiter || ','}
            onChange={(e) => handleChange('delimiter', e.target.value)}
            placeholder="Delimiter (e.g., comma, space)"
          />
          <div className="config-hint">
            Character(s) to join with
          </div>
        </div>
      );
    }

    // String Template - needs template string
    if (nodeKind === 'String.Template') {
      const template = localConfig.template || '';
      const validation = validateTemplate(template);
      const params = template ? extractTemplateParams(template) : [];

      return (
        <>
          <div className="config-field">
            <label className="config-label">Template String:</label>
            <textarea
              className="config-textarea"
              value={template}
              onChange={(e) => handleChange('template', e.target.value)}
              placeholder="Hello {firstName} {lastName}!"
              rows={4}
              style={{
                fontFamily: 'monospace',
                fontSize: '13px',
                borderColor: template && !validation.isValid ? '#ef4444' : undefined
              }}
            />
            <div className="config-hint">
              Use {'{paramName}'} for parameters. Works with any string: URLs, paths, messages, etc.
            </div>
            {template && !validation.isValid && (
              <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>
                ⚠️ {validation.error}
              </div>
            )}
          </div>

          {params.length > 0 && (
            <div className="config-field">
              <label className="config-label">Detected Parameters:</label>
              <div style={{
                padding: '8px',
                backgroundColor: '#f3f4f6',
                borderRadius: '4px',
                fontSize: '13px',
                fontFamily: 'monospace'
              }}>
                {params.map((param, index) => (
                  <div key={param} style={{ marginBottom: index < params.length - 1 ? '4px' : 0 }}>
                    {index + 1}. <strong>{param}</strong>
                  </div>
                ))}
              </div>
              <div className="config-hint">
                These will appear as input terminals on the functoid node
              </div>
            </div>
          )}

          <div className="config-field">
            <div style={{
              padding: '12px',
              backgroundColor: '#dbeafe',
              borderRadius: '4px',
              fontSize: '12px',
              lineHeight: '1.5'
            }}>
              <strong>💡 Examples:</strong><br/>
              • URL: http://{'{hostname}'}/api/users/{'{userId}'}<br/>
              • Path: /data/{'{year}'}/{'{month}'}/{'{filename}'}<br/>
              • Message: Hello {'{firstName}'} {'{lastName}'}!<br/>
              • Query: SELECT * FROM {'{table}'} WHERE id={'{id}'}
            </div>
          </div>
        </>
      );
    }

    // Conditional Switch - needs cases
    if (nodeKind === 'Conditional.Switch') {
      const cases = localConfig.cases || [{ when: '', then: '' }];

      return (
        <>
          <div className="config-section-header">
            <label className="config-label">Cases:</label>
            <button
              className="config-add-button"
              onClick={() => {
                const newCases = [...cases, { when: '', then: '' }];
                handleChange('cases', newCases);
              }}
            >
              + Add Case
            </button>
          </div>
          {cases.map((caseItem: any, index: number) => (
            <div key={index} className="config-case">
              <div className="config-case-header">
                <span className="config-case-label">Case {index + 1}</span>
                {cases.length > 1 && (
                  <button
                    className="config-remove-button"
                    onClick={() => {
                      const newCases = cases.filter((_: any, i: number) => i !== index);
                      handleChange('cases', newCases);
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
              <input
                type="text"
                className="config-input config-input-sm"
                value={caseItem.when || ''}
                onChange={(e) => {
                  const newCases = [...cases];
                  newCases[index] = { ...newCases[index], when: e.target.value };
                  handleChange('cases', newCases);
                }}
                placeholder="When value equals..."
              />
              <input
                type="text"
                className="config-input config-input-sm"
                value={caseItem.then || ''}
                onChange={(e) => {
                  const newCases = [...cases];
                  newCases[index] = { ...newCases[index], then: e.target.value };
                  handleChange('cases', newCases);
                }}
                placeholder="Then return..."
              />
            </div>
          ))}
          <div className="config-field">
            <label className="config-label">Default Value:</label>
            <input
              type="text"
              className="config-input"
              value={localConfig.default || ''}
              onChange={(e) => handleChange('default', e.target.value)}
              placeholder="Value if no cases match"
            />
          </div>
        </>
      );
    }

    // Default: Show generic config editor for any custom config
    const configKeys = Object.keys(localConfig);
    if (configKeys.length === 0) {
      return (
        <div className="config-empty">
          <p>This functoid has no configuration options.</p>
          <p className="config-hint">
            Most functoids work automatically by connecting their inputs.
          </p>
        </div>
      );
    }

    // Generic config editor
    return (
      <>
        {configKeys.map((key) => (
          <div key={key} className="config-field">
            <label className="config-label">{key}:</label>
            <input
              type="text"
              className="config-input"
              value={String(localConfig[key] || '')}
              onChange={(e) => handleChange(key, e.target.value)}
            />
          </div>
        ))}
      </>
    );
  };

  const IconComponent = getFunctoidIcon(nodeKind);
  const iconColor = CATEGORY_COLORS[functoid.category];

  return (
    <div className="functoid-config-panel">
      {/* Header */}
      <div className="config-header">
        <div className="config-title">
          <div className="config-icon" style={{ borderColor: iconColor }}>
            <IconComponent size={24} strokeWidth={2.5} color={iconColor} />
          </div>
          <div>
            <h3>{functoid.label}</h3>
            <p className="config-description">{functoid.description}</p>
          </div>
        </div>
        <button className="config-close" onClick={onClose}>×</button>
      </div>

      {/* Config Fields */}
      <div className="config-body">
        {renderConfigFields()}
      </div>

      {/* Footer */}
      <div className="config-footer">
        <div className="config-footer-hint">
          💡 Changes are saved automatically
        </div>
      </div>
    </div>
  );
}
