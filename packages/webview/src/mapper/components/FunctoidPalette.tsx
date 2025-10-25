import { useState, useMemo } from 'react';
import {
  functoidRegistry,
  getCategories,
  getFunctoidsByCategory,
  searchFunctoids
} from '../../../../core/src/mapper/registry';
import type { FunctoidDefinition, FunctoidCategory } from '../../../../core/src/mapper/types';
import { Tooltip } from './Tooltip';
import {
  Calculator,
  Type,
  GitBranch,
  GitMerge,
  Layers,
  Sigma,
  RefreshCw,
  Calendar,
  Settings
} from 'lucide-react';
import './FunctoidPalette.css';

/**
 * Category display metadata with Lucide icons
 */
const CATEGORY_META: Record<FunctoidCategory, { label: string; color: string; icon: typeof Calculator }> = {
  math: { label: 'Math', color: '#f59e0b', icon: Calculator },
  string: { label: 'String', color: '#3b82f6', icon: Type },
  logical: { label: 'Logical', color: '#8b5cf6', icon: GitBranch },
  conditional: { label: 'Conditional', color: '#6366f1', icon: GitMerge },
  collection: { label: 'Collection', color: '#10b981', icon: Layers },
  aggregate: { label: 'Aggregate', color: '#14b8a6', icon: Sigma },
  conversion: { label: 'Conversion', color: '#f97316', icon: RefreshCw },
  datetime: { label: 'Date/Time', color: '#ec4899', icon: Calendar },
  custom: { label: 'Custom', color: '#6b7280', icon: Settings }
};

/**
 * FunctoidPalette - Sidebar palette for dragging functoids to canvas
 */
export function FunctoidPalette() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(true); // Start collapsed for compact view
  const [expandedCategories, setExpandedCategories] = useState<Set<FunctoidCategory>>(
    new Set(['math', 'string']) // Default expanded categories
  );

  /**
   * Toggle category expansion
   */
  const toggleCategory = (category: FunctoidCategory) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  /**
   * Get filtered functoids
   */
  const filteredFunctoids = useMemo(() => {
    if (!searchQuery.trim()) {
      // No search - return all by category
      const categories = getCategories();
      return categories.map(category => ({
        category,
        functoids: getFunctoidsByCategory(category)
      }));
    }

    // Search mode - return search results grouped by category
    const results = searchFunctoids(searchQuery);
    const byCategory = new Map<FunctoidCategory, FunctoidDefinition[]>();

    for (const functoid of results) {
      if (!byCategory.has(functoid.category)) {
        byCategory.set(functoid.category, []);
      }
      byCategory.get(functoid.category)!.push(functoid);
    }

    return Array.from(byCategory.entries()).map(([category, functoids]) => ({
      category,
      functoids
    }));
  }, [searchQuery]);

  /**
   * Handle drag start - set functoid data for drop
   */
  const onDragStart = (event: React.DragEvent, functoid: FunctoidDefinition) => {
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('application/reactflow', 'functoid');
    event.dataTransfer.setData('functoid/kind', functoid.kind);
    event.dataTransfer.setData('functoid/label', functoid.label);
    event.dataTransfer.setData('functoid/icon', functoid.icon);
    event.dataTransfer.setData('functoid/category', functoid.category);
  };

  return (
    <div className={`functoid-palette ${isCollapsed ? 'collapsed' : ''}`}>
      {/* Header */}
      <div className="palette-header">
        {!isCollapsed && (
          <>
            <h3 className="palette-title">Functoids</h3>
            <span className="palette-count">{Object.keys(functoidRegistry).length}</span>
          </>
        )}
        <button
          className="palette-collapse-btn"
          onClick={() => setIsCollapsed(!isCollapsed)}
          title={isCollapsed ? 'Expand functoid palette' : 'Collapse functoid palette'}
        >
          {isCollapsed ? '▶' : '◀'}
        </button>
      </div>

      {/* Search */}
      {!isCollapsed && (
        <div className="palette-search">
          <input
            type="text"
            placeholder="Search functoids..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="palette-search-input"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="palette-search-clear"
              title="Clear search"
            >
              ×
            </button>
          )}
        </div>
      )}

      {/* Categories */}
      {!isCollapsed && (
        <div className="palette-categories">
        {filteredFunctoids.length === 0 && (
          <div className="palette-empty">
            No functoids found for &quot;{searchQuery}&quot;
          </div>
        )}

        {filteredFunctoids.map(({ category, functoids }) => {
          const meta = CATEGORY_META[category];
          const isExpanded = searchQuery.trim() !== '' || expandedCategories.has(category);
          const CategoryIcon = meta.icon;

          return (
            <div key={category} className="palette-category">
              {/* Category Header */}
              <button
                className="palette-category-header"
                onClick={() => toggleCategory(category)}
                style={{ borderLeftColor: meta.color }}
              >
                <span className="category-icon">{isExpanded ? '▼' : '▶'}</span>
                <CategoryIcon className="category-icon-svg" size={12} style={{ color: meta.color }} />
                <span className="category-label">{meta.label}</span>
                <span className="category-count">{functoids.length}</span>
              </button>

              {/* Functoid Items */}
              {isExpanded && (
                <div className="palette-category-items">
                  {functoids.map((functoid) => (
                    <Tooltip
                      key={functoid.kind}
                      content={{
                        label: functoid.label,
                        description: functoid.description
                      }}
                    >
                      <div
                        className="palette-functoid-item"
                        draggable
                        onDragStart={(e) => onDragStart(e, functoid)}
                        style={{ borderLeftColor: meta.color }}
                      >
                        <div
                          className="functoid-icon"
                          style={{ backgroundColor: meta.color }}
                        >
                          {functoid.icon}
                        </div>
                      </div>
                    </Tooltip>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        </div>
      )}

      {/* Footer hint */}
      {!isCollapsed && (
        <div className="palette-footer">
          Drag functoids to the canvas to add them
        </div>
      )}
    </div>
  );
}
