import React, { useState, useMemo } from 'react';
import '../../styles/reference-selector.css';

/**
 * Represents a script file from the model
 */
export interface ScriptItem {
  location: string;
  absolutePath: string;
  content: string;
  base64: string;
  exists: boolean;
  lastModified?: Date;
  size?: number;
}

interface ScriptSelectorProps {
  label: string;
  value: string | null; // Current script location
  availableScripts: ScriptItem[];
  scriptType: 'mapper' | 'rule';
  onChange: (location: string | null, script: ScriptItem | null) => void;
  helpText?: string;
  required?: boolean;
}

export const ScriptSelector: React.FC<ScriptSelectorProps> = ({
  label,
  value,
  availableScripts,
  scriptType,
  onChange,
  helpText,
  required = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Find the selected script
  const selectedScript = useMemo(() => {
    if (!value) return null;

    // Normalize paths for comparison
    const normalizeLocation = (loc: string) => {
      // Remove leading ./ if present
      return loc.startsWith('./') ? loc.substring(2) : loc;
    };

    const normalizedValue = normalizeLocation(value);

    return availableScripts.find(s => {
      const normalizedScriptLocation = normalizeLocation(s.location);
      return normalizedScriptLocation === normalizedValue ||
             s.location === value ||
             s.absolutePath === value;
    }) || null;
  }, [value, availableScripts]);

  // Filter scripts based on search
  const filteredScripts = useMemo(() => {
    if (!searchTerm.trim()) return availableScripts;

    const searchLower = searchTerm.toLowerCase();
    return availableScripts.filter(script => {
      const locationMatch = script.location.toLowerCase().includes(searchLower);
      const pathMatch = script.absolutePath.toLowerCase().includes(searchLower);
      return locationMatch || pathMatch;
    });
  }, [availableScripts, searchTerm]);

  const handleSelect = (script: ScriptItem) => {
    onChange(script.location, script);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = () => {
    onChange(null, null);
    setIsOpen(false);
    setSearchTerm('');
  };

  const getDisplayName = (script: ScriptItem) => {
    // Extract filename from location, preserving original format
    const parts = script.location.split('/');
    const filename = parts[parts.length - 1];
    return filename.replace('.csx', '');
  };

  const getDisplayPath = (script: ScriptItem) => {
    // Return the location path without filename, preserving original format
    const parts = script.location.split('/');
    const path = parts.slice(0, -1).join('/');
    return path || '.';
  };

  return (
    <div className="reference-selector">
      <div className="reference-selector__label-row">
        <label className="reference-selector__label">
          {label}
          {required && <span className="reference-selector__required">*</span>}
        </label>
        {selectedScript && (
          <button
            type="button"
            onClick={handleClear}
            className="reference-selector__clear-button"
            title="Clear selection"
          >
            Clear
          </button>
        )}
      </div>

      <div className="reference-selector__control">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="reference-selector__button"
        >
          <span className="reference-selector__button-text">
            {selectedScript ? (
              <>
                <span className="reference-selector__key">{getDisplayName(selectedScript)}</span>
                <span className="reference-selector__meta">{getDisplayPath(selectedScript)}</span>
              </>
            ) : (
              <span className="reference-selector__placeholder">
                Select {scriptType}...
              </span>
            )}
          </span>
          <span className="reference-selector__arrow">{isOpen ? '▲' : '▼'}</span>
        </button>

        {isOpen && (
          <div className="reference-selector__dropdown">
            <div className="reference-selector__search">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={`Search ${scriptType}s...`}
                className="reference-selector__search-input"
                autoFocus
              />
            </div>

            <div className="reference-selector__list">
              {filteredScripts.length === 0 ? (
                <div className="reference-selector__empty">
                  {searchTerm ? 'No matching scripts found' : `No ${scriptType}s available`}
                </div>
              ) : (
                filteredScripts.map((script, index) => {
                  // Normalize paths for comparison
                  const normalizeLocation = (loc: string) => {
                    return loc.startsWith('./') ? loc.substring(2) : loc;
                  };
                  const normalizedValue = value ? normalizeLocation(value) : '';
                  const normalizedScriptLocation = normalizeLocation(script.location);

                  const isSelected = normalizedScriptLocation === normalizedValue ||
                                   script.location === value ||
                                   script.absolutePath === value;
                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={() => handleSelect(script)}
                      className={`reference-selector__dropdown-item ${
                        isSelected ? 'reference-selector__dropdown-item--selected' : ''
                      }`}
                    >
                      <div className="reference-selector__item-header">
                        <span className="reference-selector__item-key">
                          {getDisplayName(script)}
                        </span>
                        {script.size && (
                          <span className="reference-selector__item-version">
                            {(script.size / 1024).toFixed(1)}KB
                          </span>
                        )}
                      </div>
                      <div className="reference-selector__item-footer">
                        <span className="reference-selector__item-domain">
                          {getDisplayPath(script)}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {helpText && (
        <small className="reference-selector__help">{helpText}</small>
      )}

      {selectedScript && (
        <div className="reference-selector__details">
          <div className="reference-selector__detail-row">
            <span className="reference-selector__detail-label">Location:</span>
            <span className="reference-selector__detail-value">{selectedScript.location}</span>
          </div>
          {selectedScript.size && (
            <div className="reference-selector__detail-row">
              <span className="reference-selector__detail-label">Size:</span>
              <span className="reference-selector__detail-value">
                {(selectedScript.size / 1024).toFixed(2)} KB
              </span>
            </div>
          )}
          {selectedScript.lastModified && (
            <div className="reference-selector__detail-row">
              <span className="reference-selector__detail-label">Modified:</span>
              <span className="reference-selector__detail-value">
                {new Date(selectedScript.lastModified).toLocaleString()}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
