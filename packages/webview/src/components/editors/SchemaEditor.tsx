import React from 'react';
import type { SchemaRef } from '@amorphie-flow-studio/core';
import { isSchemaRef, isSchemaInlineRef } from './utils';

interface SchemaEditorProps {
  title: string;
  schema?: SchemaRef | null;
  availableSchemas?: Array<{ key: string; domain: string; version: string; flow: string; path: string }>;
  onModeChange: (mode: 'none' | 'ref' | 'full') => void;
  onReferenceChange: (field: string, value: string) => void;
  onRefChange: (ref: string) => void;
}

export const SchemaEditor: React.FC<SchemaEditorProps> = ({
  title,
  schema,
  availableSchemas = [],
  onModeChange,
  onReferenceChange,
  onRefChange
}) => {
  const currentMode = schema === null
    ? 'none'
    : isSchemaInlineRef(schema)
    ? 'ref'
    : 'full';

  return (
    <div className="property-panel__group">
      {title ? (
        <div className="property-panel__group-header">
          <span>{title}</span>
          <select
            value={currentMode}
            onChange={(e) => onModeChange(e.target.value as 'none' | 'ref' | 'full')}
            className="property-panel__select property-panel__select--small"
          >
            <option value="none">None</option>
            <option value="ref">Reference (by path)</option>
            <option value="full">Full Reference</option>
          </select>
        </div>
      ) : (
        <div className="property-panel__field">
          <label>Schema Mode:</label>
          <select
            value={currentMode}
            onChange={(e) => onModeChange(e.target.value as 'none' | 'ref' | 'full')}
            className="property-panel__select"
          >
            <option value="none">None</option>
            <option value="ref">Reference (by path)</option>
            <option value="full">Full Reference</option>
          </select>
        </div>
      )}

      {currentMode === 'ref' && (
        <div className="property-panel__field">
          <label>Schema Reference Path:</label>
          {availableSchemas.length > 0 ? (
            <>
              <select
                value={isSchemaInlineRef(schema) ? schema.ref : ''}
                onChange={(e) => onRefChange(e.target.value)}
                className="property-panel__select"
              >
                <option value="">Select a schema...</option>
                {availableSchemas.map((availableSchema) => (
                  <option key={availableSchema.path} value={availableSchema.path}>
                    {availableSchema.path} ({availableSchema.key} v{availableSchema.version})
                  </option>
                ))}
              </select>
              <small className="property-panel__help">
                Or enter a custom path:
              </small>
            </>
          ) : null}
          <input
            type="text"
            value={isSchemaInlineRef(schema) ? schema.ref : ''}
            onChange={(e) => onRefChange(e.target.value)}
            placeholder="e.g., Schemas/payment.json"
            className="property-panel__input"
          />
          <small className="property-panel__help">
            Path to the schema definition file relative to project root
          </small>
        </div>
      )}

      {currentMode === 'full' && isSchemaRef(schema) && (
        <>
          <div className="property-panel__field">
            <label>Key:</label>
            <input
              type="text"
              value={schema.key}
              onChange={(e) => onReferenceChange('key', e.target.value)}
              placeholder="Schema key"
              className="property-panel__input"
            />
          </div>
          <div className="property-panel__field">
            <label>Domain:</label>
            <input
              type="text"
              value={schema.domain}
              onChange={(e) => onReferenceChange('domain', e.target.value)}
              placeholder="Domain"
              className="property-panel__input"
            />
          </div>
          <div className="property-panel__field">
            <label>Version:</label>
            <input
              type="text"
              value={schema.version}
              onChange={(e) => onReferenceChange('version', e.target.value)}
              placeholder="1.0.0"
              pattern="^\d+\.\d+\.\d+$"
              className="property-panel__input"
            />
          </div>
          <div className="property-panel__field">
            <label>Flow:</label>
            <input
              type="text"
              value={schema.flow}
              onChange={(e) => onReferenceChange('flow', e.target.value)}
              placeholder="sys-schemas"
              className="property-panel__input"
            />
          </div>
        </>
      )}

      {currentMode === 'none' && (
        <p className="property-panel__muted">No schema configured.</p>
      )}
    </div>
  );
};