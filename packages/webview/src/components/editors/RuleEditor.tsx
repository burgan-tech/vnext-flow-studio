import React, { useState, useEffect } from 'react';
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
  const [displayText, setDisplayText] = useState(inlineText);

  // Decode Base64 content for display
  useEffect(() => {
    if (inlineText) {
      try {
        // Check if it's Base64 by trying to decode it
        const decoded = atob(inlineText);
        // Verify it looks like C# code (contains common keywords)
        if (decoded.includes('using ') || decoded.includes('public ') || decoded.includes('class ') || decoded.includes('namespace ')) {
          setDisplayText(decoded);
        } else {
          setDisplayText(inlineText);
        }
      } catch (error) {
        // Not Base64, use as-is
        setDisplayText(inlineText);
      }
    } else {
      setDisplayText('');
    }
  }, [inlineText]);

  const handleCodeChange = (value: string) => {
    // Try to encode as Base64 if it looks like C# code
    let codeToStore = value;
    if (value && (value.includes('using ') || value.includes('public ') || value.includes('class '))) {
      try {
        codeToStore = btoa(value);
      } catch (error) {
        // If encoding fails, store as-is
        codeToStore = value;
      }
    }
    onInlineChange(codeToStore);
  };

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
              value={displayText}
              onChange={(e) => handleCodeChange(e.target.value)}
              placeholder="Enter C# script code (auto-encodes to Base64)"
              className="property-panel__textarea"
              rows={8}
              style={{
                fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                fontSize: '12px',
                lineHeight: '1.4'
              }}
            />
            <div className="property-panel__hint">
              ✨ C# code is automatically detected and encoded as Base64
            </div>
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
