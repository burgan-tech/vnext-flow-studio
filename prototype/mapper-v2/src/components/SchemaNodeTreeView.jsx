import { useState } from 'react';
import { Position } from '@xyflow/react';
import { SchemaTreeNode } from './SchemaTreeNode';
import './SchemaNodeTreeView.css';

/**
 * SchemaNodeTreeView - Tree-based schema node with hierarchy
 * Uses labeled handles on leaf nodes (actual data fields)
 */
export function SchemaNodeTreeView({ data }) {
  const { side, schema, tree } = data;
  const [search, setSearch] = useState('');

  const isSource = side === 'source';
  const handleType = isSource ? 'source' : 'target';
  const handlePosition = isSource ? Position.Right : Position.Left;

  // Filter tree nodes based on search
  const filterTree = (node, query) => {
    if (!query) return node;

    const matchesSearch = node.name.toLowerCase().includes(query.toLowerCase()) ||
                         node.path.toLowerCase().includes(query.toLowerCase());

    if (matchesSearch) return node;

    // Check if any children match
    if (node.children && node.children.length > 0) {
      const filteredChildren = node.children
        .map(child => filterTree(child, query))
        .filter(Boolean);

      if (filteredChildren.length > 0) {
        return { ...node, children: filteredChildren };
      }
    }

    return null;
  };

  const filteredTree = search ? filterTree(tree, search) : tree;
  const hasResults = filteredTree !== null;

  return (
    <div className={`schema-node-tree-view schema-node-${side}`}>
      {/* Header */}
      <div className="schema-node-tree-header">
        <div className="schema-title">
          {isSource ? '📤 Source Schema' : '📥 Target Schema'}
        </div>
        <input
          type="search"
          placeholder="Search fields..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="schema-search-input"
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {/* Tree structure */}
      <div className="schema-tree-container">
        {!hasResults ? (
          <div className="schema-tree-empty">
            No fields found
          </div>
        ) : (
          <div className="schema-tree-body">
            {filteredTree.children.map((child) => (
              <SchemaTreeNode
                key={child.id}
                node={child}
                depth={0}
                handleType={handleType}
                handlePosition={handlePosition}
                isSource={isSource}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="schema-node-tree-footer">
        <span className="field-count">
          {tree.type} schema
        </span>
        {search && hasResults && (
          <span className="search-indicator">
            (filtered)
          </span>
        )}
      </div>
    </div>
  );
}
