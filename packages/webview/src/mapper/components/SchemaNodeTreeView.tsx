import { useState } from 'react';
import { Position } from '@xyflow/react';
import type { TreeNode, JSONSchema } from '../../../../core/src/mapper';
import { SchemaTreeNode } from './SchemaTreeNode';
import './SchemaNodeTreeView.css';

/**
 * SchemaNodeTreeView - Tree-based schema node with hierarchy
 * Uses labeled handles on leaf nodes (actual data fields)
 */
export interface SchemaNodeTreeViewProps {
  data: {
    side: 'source' | 'target';
    schema: JSONSchema;
    tree: TreeNode;
    onCollapsedHandlesChange?: (handleIds: string[], parentMap: Map<string, string>) => void;
    onAddProperty?: (path: string, propertyName: string, propertySchema: JSONSchema) => void;
    onEditProperty?: (path: string, propertyName: string, propertySchema: JSONSchema, oldPropertyName?: string) => void;
    onRemoveProperty?: (path: string, propertyName: string) => void;
  };
}

// Combined state for collapsed handles and parent mappings
interface CollapseState {
  collapsedIds: Set<string>;
  parentMap: Map<string, string>;
}

export function SchemaNodeTreeView({ data }: SchemaNodeTreeViewProps) {
  const { side, _schema, tree, onCollapsedHandlesChange, onAddProperty, onEditProperty, onRemoveProperty } = data;
  const [search, setSearch] = useState('');
  const [_collapseState, setCollapseState] = useState<CollapseState>({
    collapsedIds: new Set(),
    parentMap: new Map()
  });

  // Handle collapse/expand events from tree nodes
  const handleCollapsedChange = (parentNodeId: string, isCollapsed: boolean, collapsedChildIds: string[]) => {
    setCollapseState(prev => {
      // Create new collapsed IDs set
      const newCollapsedIds = new Set(prev.collapsedIds);

      // Create new parent map
      const newParentMap = new Map(prev.parentMap);

      if (isCollapsed) {
        // Add all child IDs to the collapsed set
        collapsedChildIds.forEach(id => newCollapsedIds.add(id));

        // Map all children to this parent
        collapsedChildIds.forEach(childId => {
          newParentMap.set(childId, parentNodeId);
        });
      } else {
        // Remove all child IDs from the collapsed set
        collapsedChildIds.forEach(id => newCollapsedIds.delete(id));

        // Remove mappings for expanded children
        collapsedChildIds.forEach(childId => {
          newParentMap.delete(childId);
        });
      }

      // Create new combined state
      const newState = {
        collapsedIds: newCollapsedIds,
        parentMap: newParentMap
      };

      // Notify parent with both collapsed IDs and parent mapping
      if (onCollapsedHandlesChange) {
        onCollapsedHandlesChange(Array.from(newCollapsedIds), newParentMap);
      }

      return newState;
    });
  };

  const isSource = side === 'source';
  const handleType: 'source' | 'target' = isSource ? 'source' : 'target';
  const handlePosition = isSource ? Position.Right : Position.Left;

  // Filter tree nodes based on search
  const filterTree = (node: TreeNode, query: string): TreeNode | null => {
    if (!query) return node;

    const matchesSearch = node.name.toLowerCase().includes(query.toLowerCase()) ||
                         node.path.toLowerCase().includes(query.toLowerCase());

    if (matchesSearch) return node;

    // Check if any children match
    if (node.children && node.children.length > 0) {
      const filteredChildren = node.children
        .map(child => filterTree(child, query))
        .filter((child): child is TreeNode => child !== null);

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
                onCollapsedChange={handleCollapsedChange}
                onAddProperty={onAddProperty}
                onEditProperty={onEditProperty}
                onRemoveProperty={onRemoveProperty}
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
