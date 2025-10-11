import { useState, useMemo, useCallback } from 'react';

/**
 * Component reference type (only full references - no path refs)
 */
export interface ComponentReference {
  key: string;
  domain: string;
  flow: string;
  version: string;
}

/**
 * Available component from model layer catalog
 */
export interface AvailableComponent {
  key: string;
  domain: string;
  version: string;
  flow: string;
  title?: string;
  tags?: string[];
  [key: string]: any;
}

/**
 * Props for the ReferenceSelector component
 */
export interface ReferenceSelectorProps {
  /** Label for the selector */
  label: string;
  /** Current reference value (null/undefined means none selected) */
  value?: ComponentReference | null;
  /** Available components from the model layer catalog */
  availableComponents?: AvailableComponent[];
  /** Component type name for display (e.g., 'Task', 'Schema', 'View') */
  componentType: string;
  /** Default flow value (e.g., 'sys-tasks', 'sys-schemas', 'sys-views') */
  defaultFlow: string;
  /** Callback when selection changes (null = clear) */
  onChange: (reference: ComponentReference | null) => void;
  /** Whether selector is required */
  required?: boolean;
  /** Placeholder text for search */
  placeholder?: string;
  /** Additional help text */
  helpText?: string;
  /** Whether the selector is disabled */
  disabled?: boolean;
}

/**
 * Format component for display
 */
function formatComponent(comp: AvailableComponent): string {
  return `${comp.domain}/${comp.key}@${comp.version}`;
}

/**
 * Check if two references are equal
 */
function referencesEqual(a: ComponentReference | null | undefined, b: ComponentReference | null | undefined): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.key === b.key && a.domain === b.domain && a.version === b.version && a.flow === b.flow;
}

/**
 * Simplified reference selector that works with model-indexed components
 */
export function ReferenceSelector({
  label,
  value,
  availableComponents = [],
  componentType,
  defaultFlow,
  onChange,
  required = false,
  placeholder,
  helpText,
  disabled = false
}: ReferenceSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  // Filter and sort available components based on search term
  const filteredComponents = useMemo(() => {
    if (!searchTerm.trim()) {
      return availableComponents;
    }

    const term = searchTerm.toLowerCase();
    return availableComponents
      .filter(comp => {
        const keyMatch = comp.key?.toLowerCase().includes(term);
        const domainMatch = comp.domain?.toLowerCase().includes(term);
        const titleMatch = comp.title?.toLowerCase().includes(term);
        const tagsMatch = comp.tags?.some(tag => tag.toLowerCase().includes(term));
        const formattedMatch = formatComponent(comp).toLowerCase().includes(term);

        return keyMatch || domainMatch || titleMatch || tagsMatch || formattedMatch;
      })
      .sort((a, b) => {
        // Prioritize exact matches
        const aExact = a.key?.toLowerCase() === term || a.domain?.toLowerCase() === term;
        const bExact = b.key?.toLowerCase() === term || b.domain?.toLowerCase() === term;

        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;

        // Then sort by domain, then key
        const domainCompare = (a.domain || '').localeCompare(b.domain || '');
        if (domainCompare !== 0) return domainCompare;

        return (a.key || '').localeCompare(b.key || '');
      });
  }, [availableComponents, searchTerm]);

  // Handle component selection from dropdown
  const handleSelectComponent = useCallback((comp: AvailableComponent) => {
    const reference: ComponentReference = {
      key: comp.key,
      domain: comp.domain,
      version: comp.version,
      flow: comp.flow || defaultFlow
    };

    onChange(reference);
    setSearchTerm('');
    setShowDropdown(false);
  }, [onChange, defaultFlow]);

  // Handle clear selection
  const handleClear = useCallback(() => {
    onChange(null);
    setSearchTerm('');
    setShowDropdown(false);
  }, [onChange]);

  // Get current value display
  const currentDisplay = useMemo(() => {
    if (!value) return null;
    return formatComponent(value);
  }, [value]);

  return (
    <div className="property-panel__group reference-selector">
      <div className="property-panel__field">
        <label>
          {label}:
          {required && <span style={{ color: 'red', marginLeft: '4px' }}>*</span>}
        </label>

        {value ? (
          <div className="reference-selector__current">
            <div className="reference-selector__current-display">
              <span className="reference-selector__current-label">{currentDisplay}</span>
            </div>
            {!disabled && (
              <button
                type="button"
                onClick={handleClear}
                className="reference-selector__clear-button"
                title="Clear selection"
              >
                ×
              </button>
            )}
          </div>
        ) : (
          <p className="property-panel__muted">
            No {componentType.toLowerCase()} selected
          </p>
        )}
      </div>

      {!disabled && (
        <div className="property-panel__field">
          <label>
            {value ? `Change ${componentType.toLowerCase()}:` : `Select ${componentType.toLowerCase()}:`}
          </label>

          {availableComponents.length > 0 ? (
            <div className="reference-selector__search">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                onBlur={() => {
                  // Delay to allow click on dropdown item
                  setTimeout(() => setShowDropdown(false), 200);
                }}
                placeholder={placeholder || `Search ${componentType.toLowerCase()}s...`}
                className="property-panel__input"
              />

              {showDropdown && filteredComponents.length > 0 && (
                <div className="reference-selector__dropdown">
                  {filteredComponents.slice(0, 20).map((comp, idx) => {
                    const isSelected = value && referencesEqual(value, comp);
                    return (
                      <button
                        key={`${comp.key}-${comp.domain}-${comp.version}-${idx}`}
                        type="button"
                        className={`reference-selector__dropdown-item ${isSelected ? 'reference-selector__dropdown-item--selected' : ''}`}
                        onClick={() => handleSelectComponent(comp)}
                        onMouseDown={(e) => e.preventDefault()} // Prevent blur
                      >
                        <div className="reference-selector__dropdown-item-main">
                          {formatComponent(comp)}
                          {isSelected && <span className="reference-selector__dropdown-item-badge">✓ Selected</span>}
                        </div>
                        {comp.title && (
                          <div className="reference-selector__dropdown-item-subtitle">
                            {comp.title}
                          </div>
                        )}
                        {comp.tags && comp.tags.length > 0 && (
                          <div className="reference-selector__dropdown-item-tags">
                            {comp.tags.slice(0, 3).map(tag => (
                              <span key={tag} className="reference-selector__tag">{tag}</span>
                            ))}
                          </div>
                        )}
                      </button>
                    );
                  })}
                  {filteredComponents.length > 20 && (
                    <div className="reference-selector__dropdown-info">
                      ... and {filteredComponents.length - 20} more. Keep typing to refine.
                    </div>
                  )}
                </div>
              )}

              {showDropdown && filteredComponents.length === 0 && searchTerm && (
                <div className="reference-selector__dropdown">
                  <div className="reference-selector__dropdown-empty">
                    No {componentType.toLowerCase()}s found matching "{searchTerm}"
                  </div>
                </div>
              )}

              {helpText && (
                <small className="property-panel__help">{helpText}</small>
              )}
            </div>
          ) : (
            <p className="property-panel__muted">
              No {componentType.toLowerCase()}s available in catalog
            </p>
          )}
        </div>
      )}

      {/* Show detailed reference info when selected */}
      {value && (
        <div className="reference-selector__details">
          <small className="property-panel__help">
            <strong>Key:</strong> {value.key} •
            <strong> Domain:</strong> {value.domain} •
            <strong> Version:</strong> {value.version} •
            <strong> Flow:</strong> {value.flow}
          </small>
        </div>
      )}
    </div>
  );
}
