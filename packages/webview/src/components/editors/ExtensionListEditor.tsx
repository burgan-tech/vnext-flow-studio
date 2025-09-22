import React from 'react';
import type { ExtensionRef } from '@amorphie-flow-studio/core';

interface ExtensionListEditorProps {
  title: string;
  extensions?: ExtensionRef[];
  onChange: (extensions?: ExtensionRef[]) => void;
}


function isExtensionInlineRef(ext: ExtensionRef): ext is { ref: string } {
  return Boolean(ext && 'ref' in ext);
}

export const ExtensionListEditor: React.FC<ExtensionListEditorProps> = ({
  title,
  extensions = [],
  onChange
}) => {
  const handleExtensionChange = (index: number, ext: ExtensionRef) => {
    const newExtensions = [...extensions];
    newExtensions[index] = ext;
    onChange(newExtensions);
  };

  const handleAddExtension = () => {
    const newExtension: ExtensionRef = { ref: '' };
    onChange([...extensions, newExtension]);
  };

  const handleRemoveExtension = (index: number) => {
    const newExtensions = extensions.filter((_, i) => i !== index);
    onChange(newExtensions.length > 0 ? newExtensions : undefined);
  };

  const handleModeChange = (index: number, mode: 'ref' | 'full') => {
    const ext = extensions[index];
    if (!ext) return;

    if (mode === 'ref') {
      handleExtensionChange(index, { ref: '' });
    } else {
      handleExtensionChange(index, {
        key: '',
        domain: '',
        flow: 'sys-extensions',
        version: '1.0.0'
      });
    }
  };

  return (
    <div className="property-panel__group">
      <div className="property-panel__group-header">
        <span>{title}</span>
        <button
          type="button"
          onClick={handleAddExtension}
          className="property-panel__add-button"
        >
          +
        </button>
      </div>

      {extensions.length === 0 ? (
        <p className="property-panel__muted">No extensions defined.</p>
      ) : (
        extensions.map((ext, index) => (
          <div key={index} className="property-panel__list-item">
            <div className="property-panel__list-item-header">
              <span>Extension {index + 1}</span>
              <div className="property-panel__list-item-actions">
                <select
                  value={isExtensionInlineRef(ext) ? 'ref' : 'full'}
                  onChange={(e) => handleModeChange(index, e.target.value as 'ref' | 'full')}
                  className="property-panel__select property-panel__select--small"
                >
                  <option value="ref">Path Reference</option>
                  <option value="full">Full Reference</option>
                </select>
                <button
                  type="button"
                  onClick={() => handleRemoveExtension(index)}
                  className="property-panel__remove-button"
                >
                  ×
                </button>
              </div>
            </div>

            {isExtensionInlineRef(ext) ? (
              <div className="property-panel__field">
                <label>Extension Path:</label>
                <input
                  type="text"
                  value={ext.ref}
                  onChange={(e) =>
                    handleExtensionChange(index, { ref: e.target.value })
                  }
                  placeholder="e.g., Extensions/logger.json"
                  className="property-panel__input"
                />
                <small className="property-panel__help">
                  Path to the extension definition file
                </small>
              </div>
            ) : (
              <>
                <div className="property-panel__field">
                  <label>Key:</label>
                  <input
                    type="text"
                    value={ext.key}
                    onChange={(e) =>
                      handleExtensionChange(index, {
                        ...ext,
                        key: e.target.value
                      } as ExtensionRef)
                    }
                    placeholder="Extension key"
                    className="property-panel__input"
                  />
                </div>
                <div className="property-panel__field">
                  <label>Domain:</label>
                  <input
                    type="text"
                    value={ext.domain}
                    onChange={(e) =>
                      handleExtensionChange(index, {
                        ...ext,
                        domain: e.target.value
                      } as ExtensionRef)
                    }
                    placeholder="Domain"
                    className="property-panel__input"
                  />
                </div>
                <div className="property-panel__field">
                  <label>Flow:</label>
                  <input
                    type="text"
                    value={ext.flow}
                    onChange={(e) =>
                      handleExtensionChange(index, {
                        ...ext,
                        flow: e.target.value
                      } as ExtensionRef)
                    }
                    placeholder="sys-extensions"
                    className="property-panel__input"
                  />
                </div>
                <div className="property-panel__field">
                  <label>Version:</label>
                  <input
                    type="text"
                    value={ext.version}
                    onChange={(e) =>
                      handleExtensionChange(index, {
                        ...ext,
                        version: e.target.value
                      } as ExtensionRef)
                    }
                    placeholder="1.0.0"
                    pattern="^\d+\.\d+\.\d+$"
                    className="property-panel__input"
                  />
                </div>
              </>
            )}
          </div>
        ))
      )}
    </div>
  );
};