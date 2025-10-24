import { useState } from 'react';
import { Position } from '@xyflow/react';
import { LabeledHandle } from './LabeledHandle';
import './SchemaTreeNode.css';

/**
 * SchemaTreeNode - Recursive tree node component with labeled handles
 * Shows hierarchy with expand/collapse and handles on leaf nodes
 */
export function SchemaTreeNode({
  node,
  depth = 0,
  handleType,
  handlePosition,
  isSource
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  const hasChildren = node.children && node.children.length > 0;
  const showHandle = node.isLeaf; // Only show handles on leaf nodes (actual data fields)

  // Determine icon based on node type
  const getIcon = () => {
    if (!hasChildren) return null;
    if (node.type === 'array') return isExpanded ? '▼' : '▶';
    if (node.type === 'object') return isExpanded ? '▼' : '▶';
    return null;
  };

  // Type badge for leaf nodes
  const getTypeBadge = () => {
    if (!node.isLeaf) return null;
    return (
      <span className="tree-type-badge">
        {node.type}
      </span>
    );
  };

  // Format name (add [] for array items)
  const formatName = () => {
    if (node.isArrayItem) {
      return `[${node.name}]`;
    }
    return node.name;
  };

  return (
    <div className="schema-tree-node">
      <div
        className={`tree-node-row ${showHandle ? 'has-handle' : ''} ${hasChildren ? 'has-children' : ''}`}
        style={{ paddingLeft: `${depth * 16}px` }}
      >
        {/* Expand/collapse icon */}
        {hasChildren && (
          <button
            className="tree-expand-icon"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {getIcon()}
          </button>
        )}

        {/* Node content */}
        <div className="tree-node-content">
          {showHandle ? (
            // Leaf node: show labeled handle
            <LabeledHandle
              id={node.id}
              type={handleType}
              position={handlePosition}
              title={`${formatName()}: ${node.type}`}
              labelClassName={isSource ? 'text-right' : 'text-left'}
            />
          ) : (
            // Parent node: just show name
            <div className="tree-node-label">
              <span className="tree-node-name">{formatName()}</span>
              {node.type === 'object' && <span className="tree-node-type-hint">{'{}'}</span>}
              {node.type === 'array' && <span className="tree-node-type-hint">{'[]'}</span>}
            </div>
          )}
        </div>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div className="tree-node-children">
          {node.children.map((child, index) => (
            <SchemaTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              handleType={handleType}
              handlePosition={handlePosition}
              isSource={isSource}
            />
          ))}
        </div>
      )}
    </div>
  );
}
