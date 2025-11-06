import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Position } from '@xyflow/react';
import type { TreeNode, JSONSchema } from '../../../../core/src/mapper';
import { LabeledHandle } from './LabeledHandle';
import { AddPropertyModal } from './AddPropertyModal';
import './SchemaTreeNode.css';

/**
 * SchemaTreeNode - Recursive tree node component with labeled handles
 * Shows hierarchy with expand/collapse and handles on leaf nodes
 */
export interface SchemaTreeNodeProps {
  node: TreeNode;
  depth?: number;
  handleType: 'source' | 'target';
  handlePosition: Position;
  isSource: boolean;
  onCollapsedChange?: (nodeId: string, isCollapsed: boolean, collapsedChildIds: string[]) => void;
  onAddProperty?: (path: string, propertyName: string, propertySchema: JSONSchema) => void;
  onEditProperty?: (path: string, propertyName: string, propertySchema: JSONSchema, oldPropertyName?: string) => void;
  onRemoveProperty?: (path: string, propertyName: string) => void;
}

export function SchemaTreeNode({
  node,
  depth = 0,
  handleType,
  handlePosition,
  isSource,
  onCollapsedChange,
  onAddProperty,
  onEditProperty,
  onRemoveProperty
}: SchemaTreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    mode: 'add' | 'edit';
    existingPropertyName?: string;
    existingPropertySchema?: JSONSchema;
  }>({
    isOpen: false,
    mode: 'add'
  });

  // Collect all child IDs recursively
  const collectAllChildIds = (treeNode: TreeNode): string[] => {
    const ids: string[] = [];
    if (treeNode.children && treeNode.children.length > 0) {
      for (const child of treeNode.children) {
        ids.push(child.id);
        ids.push(...collectAllChildIds(child));
      }
    }
    return ids;
  };

  // Handle expand/collapse
  const handleToggle = () => {
    const newExpandedState = !isExpanded;
    setIsExpanded(newExpandedState);

    // Notify parent of collapse state change
    if (onCollapsedChange) {
      const collapsedChildIds = collectAllChildIds(node);
      // Pass parent ID (this node) and all collapsed child IDs
      onCollapsedChange(node.id, !newExpandedState, collapsedChildIds);
    }
  };

  const hasChildren = node.children && node.children.length > 0;

  // Check if this is a free-form object (can be extended)
  // An object is extensible if:
  // 1. It has no children (empty object), OR
  // 2. All its children are user-added (was extended from empty object)
  const hasUserAddedChildren = node.children?.some(child => child.isUserAdded) || false;
  const allChildrenUserAdded = node.children && node.children.length > 0
    ? node.children.every(child => child.isUserAdded)
    : false;
  const isFreeFormObject = node.type === 'object' && (!hasChildren || node.children.length === 0 || allChildrenUserAdded);

  // Always show handles for leaf nodes, parent nodes with children (for redirection), and empty objects
  const showHandle = node.isLeaf || hasChildren || isFreeFormObject;

  // Determine icon based on node type
  const getIcon = () => {
    if (!hasChildren) return null;
    if (node.type === 'array') return isExpanded ? '▼' : '▶';
    if (node.type === 'object') return isExpanded ? '▼' : '▶';
    return null;
  };

  // Type badge for leaf nodes
  const _getTypeBadge = () => {
    if (!node.isLeaf) return null;
    return (
      <span className="tree-type-badge">
        {node.type}
      </span>
    );
  };

  // Check if this node is a synthetic conditional branch
  const isSyntheticBranch = node.name.startsWith('__SYNTH__');

  // Format name (add [] for array items, strip __SYNTH__ prefix, split discriminator)
  const formatName = () => {
    let displayName = node.name;

    // Strip __SYNTH__ prefix for display
    if (displayName.startsWith('__SYNTH__')) {
      displayName = displayName.replace(/^__SYNTH__/, '');
    }

    if (node.isArrayItem) {
      return `[${displayName}]`;
    }
    return displayName;
  };

  // Parse discriminator and label from synthetic branch name
  // E.g., "[type=1] Dapr HTTP Endpoint" -> { discriminator: "[type=1]", label: "Dapr HTTP Endpoint" }
  const parseSyntheticName = () => {
    const name = formatName();
    const match = name.match(/^(\[[^\]]+\])\s+(.+)$/);
    if (match) {
      return { discriminator: match[1], label: match[2] };
    }
    return null;
  };

  // Handle right-click
  const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    // Debug logging
    console.log('🖱️ Context menu check:', {
      nodeName: node.name,
      nodePath: node.path,
      hasChildren,
      childrenCount: node.children?.length || 0,
      hasUserAddedChildren,
      allChildrenUserAdded,
      isFreeFormObject,
      isUserAdded: node.isUserAdded,
      children: node.children?.map(c => ({ name: c.name, isUserAdded: c.isUserAdded }))
    });

    // Only show context menu if:
    // 1. It's a free-form object (can add properties)
    // 2. It's a user-added property (can edit/remove)
    if (!isFreeFormObject && !node.isUserAdded) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    // Use mouse position directly for fixed positioning
    setContextMenu({
      x: e.clientX,
      y: e.clientY
    });
  };

  // Close context menu
  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  // Get existing property names for duplicate validation
  const getExistingPropertyNames = (): string[] => {
    if (!node.children) return [];
    return node.children.map(child => child.name);
  };

  // Handle add property
  const handleAddPropertyClick = () => {
    setContextMenu(null);
    setModalState({
      isOpen: true,
      mode: 'add'
    });
  };

  // Handle edit property
  const handleEditPropertyClick = () => {
    setContextMenu(null);

    // Build schema from current node
    const currentSchema: JSONSchema = {
      type: node.type as any,
      ...(node.description && { description: node.description })
    };

    setModalState({
      isOpen: true,
      mode: 'edit',
      existingPropertyName: node.name,
      existingPropertySchema: currentSchema
    });
  };

  // Handle remove property
  const handleRemovePropertyClick = () => {
    if (onRemoveProperty) {
      // Use full path to preserve synthetic notation for variant-specific properties
      const usePath = node.path;

      // Extract parent path and property name
      const pathParts = usePath.split('.');
      const propertyName = pathParts[pathParts.length - 1];
      const parentPath = pathParts.slice(0, -1).join('.');
      onRemoveProperty(parentPath, propertyName);
    }
    setContextMenu(null);
  };

  // Handle modal submit
  const handleModalSubmit = (propertyName: string, propertySchema: JSONSchema, oldPropertyName?: string) => {
    // Use full path to preserve synthetic notation for variant-specific properties
    const usePath = node.path;

    if (modalState.mode === 'add' && onAddProperty) {
      onAddProperty(usePath, propertyName, propertySchema);
    } else if (modalState.mode === 'edit' && onEditProperty) {
      // For edit mode, we need to extract the parent path (without the property name)
      const pathParts = usePath.split('.');
      const currentPropertyName = pathParts[pathParts.length - 1];
      const parentPath = pathParts.slice(0, -1).join('.');

      // Pass parent path and new property name
      onEditProperty(parentPath, propertyName, propertySchema, oldPropertyName || currentPropertyName);
    }
    setModalState({ isOpen: false, mode: 'add' });
  };

  // Handle modal close
  const handleModalClose = () => {
    setModalState({ isOpen: false, mode: 'add' });
  };

  return (
    <div className="schema-tree-node">
      <div
        className={`tree-node-row ${showHandle ? 'has-handle' : ''} ${hasChildren ? 'has-children' : ''} ${node.isUserAdded ? 'user-added' : ''} ${isFreeFormObject ? 'free-form' : ''} ${isSyntheticBranch ? 'synthetic-branch' : ''} ${node.isArrayItem ? 'array-item' : ''} ${node.type === 'array' ? 'array-type' : ''}`}
        style={{ paddingLeft: `${depth * 20}px` }}
        data-depth={depth}
        onContextMenu={handleContextMenu}
      >
        {/* Expand/collapse icon */}
        {hasChildren && (
          <button
            className="tree-expand-icon"
            onClick={handleToggle}
          >
            {getIcon()}
          </button>
        )}

        {/* Node content */}
        <div className="tree-node-content">
          {showHandle ? (
            // Leaf node or collapsed parent: show labeled handle
            // Use node.id (full path with synthetic notation) for handle ID to match edges
            <>
              {hasChildren && !isExpanded && console.log('🎯 Creating collapsed parent handle:', { nodeId: node.id, nodeName: node.name, type: handleType })}
              <LabeledHandle
                id={node.id}
                type={handleType}
                position={handlePosition}
                title={hasChildren && !isExpanded ? `${formatName()} (collapsed)` : `${formatName()}: ${node.type}`}
                labelClassName="text-left"
                className={hasChildren && !isExpanded ? 'collapsed-parent-handle' : ''}
              />
              {node.isUserAdded && <span className="user-added-badge" title="User-added property"></span>}
            </>
          ) : (
            // Parent node: just show name
            <div className="tree-node-label">
              {isSyntheticBranch && parseSyntheticName() ? (
                // Synthetic branch: show discriminator badge + label
                <>
                  <span className="branch-icon" title="Conditional branch">⑂</span>
                  <span className="discriminator-badge">{parseSyntheticName()!.discriminator}</span>
                  <span className="tree-node-name">{parseSyntheticName()!.label}</span>
                </>
              ) : (
                // Regular node: show name normally
                <span className="tree-node-name">{formatName()}</span>
              )}
              {node.type === 'object' && !isSyntheticBranch && <span className="tree-node-type-hint">{'{}'}</span>}
              {node.type === 'array' && <span className="tree-node-type-hint">{'[]'}</span>}
              {node.isUserAdded && <span className="user-added-badge" title="User-added property"></span>}
            </div>
          )}
        </div>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div className="tree-node-children">
          {node.children.map((child) => (
            <SchemaTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              handleType={handleType}
              handlePosition={handlePosition}
              isSource={isSource}
              onCollapsedChange={onCollapsedChange}
              onAddProperty={onAddProperty}
              onEditProperty={onEditProperty}
              onRemoveProperty={onRemoveProperty}
            />
          ))}
        </div>
      )}

      {/* Context Menu - Rendered via portal to escape transform hierarchy */}
      {contextMenu && createPortal(
        <>
          <div className="context-menu-overlay" onClick={handleCloseContextMenu} />
          <div
            className="context-menu"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            {isFreeFormObject && (
              <button className="context-menu-item" onClick={handleAddPropertyClick}>
                ➕ Add Property
              </button>
            )}
            {node.isUserAdded && (
              <>
                <button className="context-menu-item" onClick={handleEditPropertyClick}>
                  ✏️ Edit Property
                </button>
                <button className="context-menu-item danger" onClick={handleRemovePropertyClick}>
                  🗑️ Remove Property
                </button>
              </>
            )}
          </div>
        </>,
        document.body
      )}

      {/* Add/Edit Property Modal - Rendered via portal to escape transform hierarchy */}
      {modalState.isOpen && createPortal(
        <AddPropertyModal
          mode={modalState.mode}
          isOpen={modalState.isOpen}
          onClose={handleModalClose}
          onSubmit={handleModalSubmit}
          existingPropertyName={modalState.existingPropertyName}
          existingPropertySchema={modalState.existingPropertySchema}
          existingProperties={getExistingPropertyNames()}
        />,
        document.body
      )}
    </div>
  );
}
