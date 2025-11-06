import { useState, useRef, useEffect } from 'react';
import { Position, useUpdateNodeInternals, useNodeId } from '@xyflow/react';
import type { TreeNode, JSONSchema, PartDefinition } from '../../../../core/src/mapper';
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
    parts?: Record<string, PartDefinition>; // Multi-part document parts
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
  const { side, _schema, tree, parts, onCollapsedHandlesChange, onAddProperty, onEditProperty, onRemoveProperty } = data;
  const [search, setSearch] = useState('');
  const [_collapseState, setCollapseState] = useState<CollapseState>({
    collapsedIds: new Set(),
    parentMap: new Map()
  });
  const [expandedParts, setExpandedParts] = useState<Set<string>>(new Set(Object.keys(parts || {})));

  // Get React Flow instance and node ID for updating node internals
  const nodeId = useNodeId();
  const updateNodeInternals = useUpdateNodeInternals();
  const containerRef = useRef<HTMLDivElement>(null);

  // Set up ResizeObserver to detect size changes and update handle positions
  useEffect(() => {
    if (!containerRef.current || !nodeId) {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      // Use double requestAnimationFrame to ensure React has fully updated the DOM
      // before React Flow measures handle positions
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          updateNodeInternals(nodeId);

          // Also update the opposite schema node to force edge recalculation
          const oppositeNodeId = nodeId === 'source-schema' ? 'target-schema' : 'source-schema';
          updateNodeInternals(oppositeNodeId);
        });
      });
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [nodeId, updateNodeInternals]);

  // Handle collapse/expand events from tree nodes
  const handleCollapsedChange = (parentNodeId: string, isCollapsed: boolean, collapsedChildIds: string[]) => {
    console.log('🌳 Tree node collapse/expand:', {
      parentNodeId,
      isCollapsed,
      childCount: collapsedChildIds.length,
      side
    });
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

  // Check if this is a multi-part document
  const isMultiPart = parts && Object.keys(parts).length > 0;

  // Toggle part expansion
  const togglePart = (partName: string) => {
    console.log('📦 Part toggle:', { partName, side });
    setExpandedParts(prev => {
      const next = new Set(prev);
      if (next.has(partName)) {
        console.log('➖ Collapsing part:', partName);
        next.delete(partName);
      } else {
        console.log('➕ Expanding part:', partName);
        next.add(partName);
      }
      return next;
    });
  };

  // Group tree children by part name (for multi-part documents)
  const partGroups = new Map<string, TreeNode>();
  if (isMultiPart && filteredTree) {
    for (const child of filteredTree.children) {
      // Top-level children are part nodes (e.g., "header", "body")
      partGroups.set(child.name, child);
    }
  }

  return (
    <div ref={containerRef} className={`schema-node-tree-view schema-node-${side}`}>
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
        ) : isMultiPart ? (
          // Multi-part document: render parts as sections
          <div className="schema-tree-body">
            {Array.from(partGroups.entries()).map(([partName, partNode]) => {
              const partDef = parts![partName];
              const isExpanded = expandedParts.has(partName);

              return (
                <div key={partName} className="schema-part-section">
                  {/* Part header */}
                  <div
                    className="schema-part-header"
                    onClick={() => togglePart(partName)}
                  >
                    <button className="schema-part-toggle">
                      {isExpanded ? '▼' : '▶'}
                    </button>
                    <span className="schema-part-name">
                      {partDef?.label || partName}
                    </span>
                    <span className="schema-part-badge">
                      {partName}
                    </span>
                  </div>

                  {/* Part content */}
                  {isExpanded && (
                    <div className="schema-part-body">
                      {partNode.children.map((child) => (
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
              );
            })}
          </div>
        ) : (
          // Single schema: render tree normally
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
          {isMultiPart ? `${Object.keys(parts!).length} parts` : `${tree.type} schema`}
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
