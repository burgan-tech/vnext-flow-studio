import React, { useState, useMemo } from 'react';
import type { AvailableComponent, ComponentReference } from './ReferenceSelector';

interface ComponentSearchPanelProps {
  availableComponents: AvailableComponent[];
  onSelectComponent: (component: ComponentReference) => void;
  componentType: 'Function' | 'Extension';
  defaultFlow: string;
  placeholder?: string;
  label?: string;
}

export function ComponentSearchPanel({
  availableComponents,
  onSelectComponent,
  componentType,
  defaultFlow,
  placeholder,
  label
}: ComponentSearchPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Filter components based on search query
  const filteredComponents = useMemo(() => {
    if (!searchQuery) return availableComponents;

    const query = searchQuery.toLowerCase();
    return availableComponents.filter(comp => {
      const key = comp.key?.toLowerCase() || '';
      const domain = comp.domain?.toLowerCase() || '';
      const flow = comp.flow?.toLowerCase() || '';
      const title = comp.title?.toLowerCase() || '';
      const version = comp.version?.toLowerCase() || '';

      return (
        key.includes(query) ||
        domain.includes(query) ||
        flow.includes(query) ||
        title.includes(query) ||
        version.includes(query)
      );
    });
  }, [availableComponents, searchQuery]);

  const handleSelectComponent = (comp: AvailableComponent) => {
    const reference: ComponentReference = {
      key: comp.key,
      domain: comp.domain,
      version: comp.version,
      flow: comp.flow || defaultFlow
    };
    onSelectComponent(reference);
    setIsDropdownOpen(false);
    setSearchQuery('');
  };

  return (
    <div className="task-search-panel">
      {label && (
        <label className="task-search-panel__label">
          {label}
        </label>
      )}
      <div className="task-search-panel__input-container">
        <input
          type="text"
          className="task-search-panel__input"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setIsDropdownOpen(true)}
          onBlur={() => {
            // Delay to allow click on dropdown items
            setTimeout(() => setIsDropdownOpen(false), 200);
          }}
          placeholder={placeholder || `Search ${componentType.toLowerCase()}s...`}
        />

        {isDropdownOpen && (
          <div className="task-search-panel__dropdown">
            {filteredComponents.length > 0 ? (
              <div className="task-search-panel__results">
                {filteredComponents.map((comp, index) => (
                  <div
                    key={index}
                    className="task-search-panel__result-item"
                    onClick={() => handleSelectComponent(comp)}
                  >
                    <div className="task-search-panel__result-header">
                      <span className="task-search-panel__result-key">
                        {comp.key}
                      </span>
                      {comp.version && (
                        <span className="task-search-panel__result-version">
                          @{comp.version}
                        </span>
                      )}
                    </div>
                    {comp.domain && (
                      <div className="task-search-panel__result-path">
                        {comp.domain}/{comp.flow || defaultFlow}
                      </div>
                    )}
                    {comp.title && (
                      <div className="task-search-panel__result-description">
                        {comp.title}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="task-search-panel__empty">
                <p>No {componentType.toLowerCase()}s found matching &quot;{searchQuery}&quot;</p>
              </div>
            )}
          </div>
        )}
      </div>

      <p className="task-search-panel__help">
        Select from available {componentType.toLowerCase()}s to add to workflow
      </p>
    </div>
  );
}
