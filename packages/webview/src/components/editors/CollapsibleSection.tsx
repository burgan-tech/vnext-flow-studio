import React, { useState, ReactNode } from 'react';

interface CollapsibleSectionProps {
  title: string;
  children: ReactNode;
  defaultExpanded?: boolean;
  onToggle?: (expanded: boolean) => void;
  headerActions?: ReactNode;
  className?: string;
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  children,
  defaultExpanded = false,
  onToggle,
  headerActions,
  className = ''
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const handleToggle = () => {
    const newState = !isExpanded;
    setIsExpanded(newState);
    onToggle?.(newState);
  };

  return (
    <div className={`property-panel__collapsible ${className}`}>
      <div className="property-panel__collapsible-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button
          type="button"
          onClick={handleToggle}
          className="property-panel__collapsible-toggle"
          aria-expanded={isExpanded}
          aria-controls={`section-${title.replace(/\s+/g, '-').toLowerCase()}`}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            color: 'inherit',
            fontSize: 'inherit',
            fontWeight: 'inherit',
            flex: '1',
            textAlign: 'left'
          }}
        >
          <span style={{ marginRight: '8px', fontSize: '12px' }}>
            {isExpanded ? '▼' : '▶'}
          </span>
          <span>{title}</span>
        </button>
        {headerActions && (
          <div className="property-panel__collapsible-actions" style={{ display: 'flex', alignItems: 'center' }}>
            {headerActions}
          </div>
        )}
      </div>
      {isExpanded && (
        <div
          id={`section-${title.replace(/\s+/g, '-').toLowerCase()}`}
          className="property-panel__collapsible-content"
        >
          {children}
        </div>
      )}
    </div>
  );
};