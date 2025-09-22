import React from 'react';
import type { Rule } from '@amorphie-flow-studio/core';

interface RuleEditorProps {
  title: string;
  rule?: Rule;
  inlineText: string;
  onLoadFromFile?: () => void;
  onChange: (rule?: Rule) => void;
  onInlineChange: (text: string) => void;
}

export const RuleEditor: React.FC<RuleEditorProps> = ({
  title,
  rule,
  inlineText,
  onLoadFromFile,
  onChange,
  onInlineChange
}) => {
  const hasRule = Boolean(rule);

  return (
    <div className="property-panel__group">
      <div className="property-panel__group-header">
        <span>{title}</span>
        {!hasRule && (
          <button
            type="button"
            onClick={() => onChange({ location: './src/rules/new.csx', code: '' })}
            className="property-panel__add-button"
          >
            +
          </button>
        )}
      </div>

      {hasRule && rule && (
        <div className="property-panel__rule-editor">
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

          <div className="property-panel__field">
            <label>Code (Base64 or inline):</label>
            <textarea
              value={inlineText}
              onChange={(e) => onInlineChange(e.target.value)}
              placeholder="Enter C# script code or Base64 encoded content"
              className="property-panel__textarea"
              rows={4}
            />
          </div>

          <button
            type="button"
            onClick={() => {
              onChange(undefined);
              onInlineChange('');
            }}
            className="property-panel__remove-button"
          >
            Remove rule
          </button>
        </div>
      )}

      {!hasRule && (
        <p className="property-panel__muted">No rule configured.</p>
      )}
    </div>
  );
};