import React from 'react';
import type { ViewRef } from '@amorphie-flow-studio/core';

type ViewMode = 'none' | 'ref' | 'full';

interface ViewEditorProps {
  title: string;
  view?: ViewRef | null;
  availableViews?: Array<{ key: string; domain: string; version: string; flow: string; path: string }>;
  onModeChange: (mode: ViewMode) => void;
  onReferenceChange: (field: string, value: string) => void;
  onRefChange: (ref: string) => void;
}

function isViewRef(
  value?: ViewRef | null
): value is { key: string; domain: string; version: string; flow: string } {
  return Boolean(value && 'key' in value && 'domain' in value && 'version' in value);
}

function isViewInlineRef(value?: ViewRef | null): value is { ref: string } {
  return Boolean(value && 'ref' in value);
}

export const ViewEditor: React.FC<ViewEditorProps> = ({
  title,
  view,
  availableViews = [],
  onModeChange,
  onReferenceChange,
  onRefChange
}) => {
  const currentMode: ViewMode = view === null || view === undefined
    ? 'none'
    : isViewInlineRef(view)
    ? 'ref'
    : 'full';

  return (
    <div className="property-panel__group">
      <div className="property-panel__group-header">
        <span>{title}</span>
        <select
          value={currentMode}
          onChange={(e) => onModeChange(e.target.value as ViewMode)}
          className="property-panel__select property-panel__select--small"
        >
          <option value="none">None</option>
          <option value="ref">Reference (by path)</option>
          <option value="full">Full Reference</option>
        </select>
      </div>

      {currentMode === 'ref' && (
        <div className="property-panel__field">
          <label>View Reference Path:</label>
          {availableViews.length > 0 ? (
            <>
              <select
                value={isViewInlineRef(view) ? view.ref : ''}
                onChange={(e) => onRefChange(e.target.value)}
                className="property-panel__select"
              >
                <option value="">Select a view...</option>
                {availableViews.map((availableView) => (
                  <option key={availableView.path} value={availableView.path}>
                    {availableView.path} ({availableView.key} v{availableView.version})
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
            value={isViewInlineRef(view) ? view.ref : ''}
            onChange={(e) => onRefChange(e.target.value)}
            placeholder="e.g., Views/state-view.json"
            className="property-panel__input"
          />
          <small className="property-panel__help">
            Path to the view definition file relative to project root
          </small>
        </div>
      )}

      {currentMode === 'full' && isViewRef(view) && (
        <>
          <div className="property-panel__field">
            <label>Key:</label>
            <input
              type="text"
              value={view.key}
              onChange={(e) => onReferenceChange('key', e.target.value)}
              placeholder="View key"
              className="property-panel__input"
            />
          </div>
          <div className="property-panel__field">
            <label>Domain:</label>
            <input
              type="text"
              value={view.domain}
              onChange={(e) => onReferenceChange('domain', e.target.value)}
              placeholder="Domain"
              className="property-panel__input"
            />
          </div>
          <div className="property-panel__field">
            <label>Flow:</label>
            <input
              type="text"
              value={view.flow}
              onChange={(e) => onReferenceChange('flow', e.target.value)}
              placeholder="sys-views"
              className="property-panel__input"
            />
          </div>
          <div className="property-panel__field">
            <label>Version:</label>
            <input
              type="text"
              value={view.version}
              onChange={(e) => onReferenceChange('version', e.target.value)}
              placeholder="1.0.0"
              pattern="^\d+\.\d+\.\d+$"
              className="property-panel__input"
            />
          </div>
        </>
      )}

      {currentMode === 'none' && (
        <p className="property-panel__muted">No view configured.</p>
      )}
    </div>
  );
};