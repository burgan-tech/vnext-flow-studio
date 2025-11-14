import React, { useState, useMemo } from 'react';
import type { AvailableComponent } from './ReferenceSelector';

interface SchemaSearchPanelProps {
  availableSchemas: AvailableComponent[];
  selectedSchemaRef: string;
  onSelectSchema: (schemaRef: string) => void;
}

export function SchemaSearchPanel({
  availableSchemas,
  selectedSchemaRef,
  onSelectSchema,
}: SchemaSearchPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Filter schemas based on search query
  const filteredSchemas = useMemo(() => {
    if (!searchQuery) return availableSchemas.slice(0, 20);

    const query = searchQuery.toLowerCase();
    return availableSchemas.filter(schema => {
      const key = schema.key?.toLowerCase() || '';
      const domain = schema.domain?.toLowerCase() || '';
      const flow = schema.flow?.toLowerCase() || '';
      const title = schema.title?.toLowerCase() || '';
      const version = schema.version?.toLowerCase() || '';

      return (
        key.includes(query) ||
        domain.includes(query) ||
        flow.includes(query) ||
        title.includes(query) ||
        version.includes(query)
      );
    }).slice(0, 20);
  }, [availableSchemas, searchQuery]);

  // Format schema reference (domain/flow/key@version or just key)
  const formatSchemaRef = (schema: AvailableComponent): string => {
    if (schema.domain && schema.version) {
      const flow = schema.flow || 'sys-schemas';
      return `${schema.domain}/${flow}/${schema.key}@${schema.version}`;
    }
    return schema.key || '';
  };

  // Get display name for selected schema
  const selectedSchemaDisplay = useMemo(() => {
    if (!selectedSchemaRef) return '';

    // Try to find the schema in available schemas
    const schema = availableSchemas.find(s => {
      const fullRef = formatSchemaRef(s);
      return fullRef === selectedSchemaRef || s.key === selectedSchemaRef;
    });

    if (schema) {
      return schema.key || selectedSchemaRef;
    }

    return selectedSchemaRef;
  }, [selectedSchemaRef, availableSchemas]);

  const handleSelectSchema = (schema: AvailableComponent) => {
    const ref = formatSchemaRef(schema);
    onSelectSchema(ref);
    setIsDropdownOpen(false);
    setSearchQuery('');
  };

  return (
    <div className="task-search-panel">
      <label className="task-search-panel__label">
        Schema
      </label>

      <div className="task-search-panel__input-container">
        <input
          type="text"
          className="task-search-panel__input"
          value={isDropdownOpen ? searchQuery : selectedSchemaDisplay}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setIsDropdownOpen(true)}
          onBlur={() => {
            // Delay to allow click on dropdown items
            setTimeout(() => setIsDropdownOpen(false), 200);
          }}
          placeholder="Search schemas..."
        />

        {isDropdownOpen && (
          <div className="task-search-panel__dropdown">
            {filteredSchemas.length > 0 ? (
              <div className="task-search-panel__results">
                {filteredSchemas.map((schema, index) => (
                  <div
                    key={index}
                    className="task-search-panel__result-item"
                    onClick={() => handleSelectSchema(schema)}
                  >
                    <div className="task-search-panel__result-header">
                      <span className="task-search-panel__result-key">
                        {schema.key}
                      </span>
                      {schema.version && (
                        <span className="task-search-panel__result-version">
                          @{schema.version}
                        </span>
                      )}
                    </div>
                    {schema.domain && (
                      <div className="task-search-panel__result-path">
                        {schema.domain}/{schema.flow || 'sys-schemas'}
                      </div>
                    )}
                    {schema.title && (
                      <div className="task-search-panel__result-description">
                        {schema.title}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="task-search-panel__empty">
                <p>No schemas found matching "{searchQuery}"</p>
              </div>
            )}
          </div>
        )}
      </div>

      <p className="task-search-panel__help">
        Select a schema to validate data sent with this transition
      </p>
    </div>
  );
}
