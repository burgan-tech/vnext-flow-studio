import React, { useState, useMemo } from 'react';
import type { AvailableComponent } from './ReferenceSelector';

interface ViewSearchPanelProps {
  availableViews: AvailableComponent[];
  selectedViewRef: string;
  onSelectView: (viewRef: string) => void;
}

export function ViewSearchPanel({
  availableViews,
  selectedViewRef,
  onSelectView,
}: ViewSearchPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Filter views based on search query
  const filteredViews = useMemo(() => {
    if (!searchQuery) return availableViews.slice(0, 20);

    const query = searchQuery.toLowerCase();
    return availableViews.filter(view => {
      const key = view.key?.toLowerCase() || '';
      const domain = view.domain?.toLowerCase() || '';
      const flow = view.flow?.toLowerCase() || '';
      const title = view.title?.toLowerCase() || '';
      const version = view.version?.toLowerCase() || '';

      return (
        key.includes(query) ||
        domain.includes(query) ||
        flow.includes(query) ||
        title.includes(query) ||
        version.includes(query)
      );
    }).slice(0, 20);
  }, [availableViews, searchQuery]);

  // Format view reference (domain/flow/key@version or just key)
  const formatViewRef = (view: AvailableComponent): string => {
    if (view.domain && view.version) {
      const flow = view.flow || 'sys-views';
      return `${view.domain}/${flow}/${view.key}@${view.version}`;
    }
    return view.key || '';
  };

  // Get display name for selected view
  const selectedViewDisplay = useMemo(() => {
    if (!selectedViewRef) return '';

    // Try to find the view in available views
    const view = availableViews.find(v => {
      const fullRef = formatViewRef(v);
      return fullRef === selectedViewRef || v.key === selectedViewRef;
    });

    if (view) {
      return view.key || selectedViewRef;
    }

    return selectedViewRef;
  }, [selectedViewRef, availableViews]);

  const handleSelectView = (view: AvailableComponent) => {
    const ref = formatViewRef(view);
    onSelectView(ref);
    setIsDropdownOpen(false);
    setSearchQuery('');
  };

  return (
    <div className="task-search-panel">
      <label className="task-search-panel__label">
        View Component
      </label>

      <div className="task-search-panel__input-container">
        <input
          type="text"
          className="task-search-panel__input"
          value={isDropdownOpen ? searchQuery : selectedViewDisplay}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setIsDropdownOpen(true)}
          onBlur={() => {
            // Delay to allow click on dropdown items
            setTimeout(() => setIsDropdownOpen(false), 200);
          }}
          placeholder="Search views..."
        />

        {isDropdownOpen && (
          <div className="task-search-panel__dropdown">
            {filteredViews.length > 0 ? (
              <div className="task-search-panel__results">
                {filteredViews.map((view, index) => (
                  <div
                    key={index}
                    className="task-search-panel__result-item"
                    onClick={() => handleSelectView(view)}
                  >
                    <div className="task-search-panel__result-header">
                      <span className="task-search-panel__result-key">
                        {view.key}
                      </span>
                      {view.version && (
                        <span className="task-search-panel__result-version">
                          @{view.version}
                        </span>
                      )}
                    </div>
                    {view.domain && (
                      <div className="task-search-panel__result-path">
                        {view.domain}/{view.flow || 'sys-views'}
                      </div>
                    )}
                    {view.title && (
                      <div className="task-search-panel__result-description">
                        {view.title}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="task-search-panel__empty">
                <p>No views found matching &quot;{searchQuery}&quot;</p>
              </div>
            )}
          </div>
        )}
      </div>

      <p className="task-search-panel__help">
        Select from available views or enter view key/reference manually
      </p>
    </div>
  );
}
