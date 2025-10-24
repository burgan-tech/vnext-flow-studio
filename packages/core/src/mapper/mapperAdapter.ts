/**
 * Mapper Adapter - Convert between MapSpec and React Flow format
 * Similar to toReactFlow() in workflow adapter
 */

import type { Node, Edge as ReactFlowEdge } from '@xyflow/react';
import type { MapSpec, MapSpecNode, Edge, JSONSchema, NodeKind, GraphLayout, NodeLayout, SchemaOverlays } from './types';
import { buildSchemaTree, applyOverlaysToSchema, extractUserAddedPaths } from './adapter';
import { functoidRegistry } from './registry';


/**
 * React Flow node data for schema nodes
 */
export interface SchemaNodeData {
  side: 'source' | 'target';
  schema: JSONSchema;
  tree: any; // TreeNode
  [key: string]: any; // Index signature for React Flow compatibility
}

/**
 * React Flow node data for functoid nodes
 */
export interface FunctoidNodeData {
  label: string;
  icon: string;
  category: string;
  kind: NodeKind;
  config?: Record<string, any>;
  [key: string]: any; // Index signature for React Flow compatibility
}

/**
 * Convert MapSpec to React Flow format
 */
export function mapSpecToReactFlow(
  mapSpec: MapSpec,
  sourceSchema?: JSONSchema,
  targetSchema?: JSONSchema,
  schemaOverlays?: SchemaOverlays
): { nodes: Node[]; edges: ReactFlowEdge[] } {
  const nodes: Node[] = [];
  const edges: ReactFlowEdge[] = [];

  // Add source schema node if schema is provided
  if (sourceSchema) {
    // Apply overlays to source schema at their specified paths
    const enhancedSourceSchema = applyOverlaysToSchema(sourceSchema, schemaOverlays?.source);
    const sourceUserAddedPaths = extractUserAddedPaths(schemaOverlays?.source);

    const sourceTree = buildSchemaTree(
      enhancedSourceSchema,
      '$',
      'root',
      sourceUserAddedPaths
    );
    nodes.push({
      id: 'source-schema',
      type: 'schema',
      position: { x: 50, y: 50 },
      data: {
        side: 'source',
        schema: sourceSchema,
        tree: sourceTree
      } as SchemaNodeData,
      draggable: true
    });
  }

  // Add target schema node if schema is provided
  if (targetSchema) {
    // Apply overlays to target schema at their specified paths
    const enhancedTargetSchema = applyOverlaysToSchema(targetSchema, schemaOverlays?.target);
    const targetUserAddedPaths = extractUserAddedPaths(schemaOverlays?.target);

    const targetTree = buildSchemaTree(
      enhancedTargetSchema,
      '$',
      'root',
      targetUserAddedPaths
    );
    nodes.push({
      id: 'target-schema',
      type: 'schema',
      position: { x: 950, y: 50 },
      data: {
        side: 'target',
        schema: targetSchema,
        tree: targetTree
      } as SchemaNodeData,
      draggable: true
    });
  }

  // Convert MapSpec nodes (functoids) to React Flow nodes
  if (mapSpec.nodes && Array.isArray(mapSpec.nodes)) {
    for (const mapSpecNode of mapSpec.nodes) {
      // Skip undefined or null nodes
      if (!mapSpecNode || !mapSpecNode.kind) {
        console.warn('[Mapper Adapter] Skipping invalid node:', mapSpecNode);
        continue;
      }

      const functoid = functoidRegistry[mapSpecNode.kind];

      if (functoid) {
        nodes.push({
          id: mapSpecNode.id,
          type: 'functoid',
          position: { x: 500, y: 200 }, // Default position, should come from GraphLayout
          data: {
            label: functoid.label,
            icon: functoid.icon,
            category: functoid.category,
            kind: mapSpecNode.kind,
            config: mapSpecNode.config
          } as FunctoidNodeData
        });
      }
    }
  }

  // Convert MapSpec edges to React Flow edges
  for (const mapSpecEdge of mapSpec.edges) {
    edges.push({
      id: mapSpecEdge.id,
      source: mapSpecEdge.source,
      sourceHandle: mapSpecEdge.sourceHandle,
      target: mapSpecEdge.target,
      targetHandle: mapSpecEdge.targetHandle,
      type: 'smoothstep',
      animated: false,
      style: { stroke: '#3b82f6', strokeWidth: 3 }
    });
  }

  return { nodes, edges };
}

/**
 * Convert React Flow changes back to MapSpec updates
 */
export function reactFlowToMapSpecNode(node: Node): MapSpecNode | null {
  // Only convert functoid nodes, not schema nodes
  if (node.type !== 'functoid') {
    return null;
  }

  const data = node.data as FunctoidNodeData;

  return {
    id: node.id,
    kind: data.kind as any, // NodeKind
    config: data.config || {}
  };
}

/**
 * Convert React Flow edge to MapSpec edge
 */
export function reactFlowToMapSpecEdge(edge: ReactFlowEdge): Edge {
  return {
    id: edge.id,
    source: edge.source,
    sourceHandle: edge.sourceHandle || '',
    target: edge.target,
    targetHandle: edge.targetHandle || ''
  };
}

/**
 * Get default position for a new functoid node
 * Places it in the center of the canvas
 */
export function getDefaultNodePosition(existingNodes: Node[]): { x: number; y: number } {
  // If there are existing functoid nodes, place near them
  const functoidNodes = existingNodes.filter(n => n.type === 'functoid');

  if (functoidNodes.length > 0) {
    // Find average position and offset slightly
    const avgX = functoidNodes.reduce((sum, n) => sum + n.position.x, 0) / functoidNodes.length;
    const avgY = functoidNodes.reduce((sum, n) => sum + n.position.y, 0) / functoidNodes.length;

    return {
      x: avgX + 50,
      y: avgY + 100
    };
  }

  // Default center position between source and target
  return { x: 500, y: 300 };
}

/**
 * Get the output type from a node and handle
 */
function getOutputType(node: Node, handleId: string | null): string | null {
  if (node.type === 'schema') {
    const schemaData = node.data as SchemaNodeData;
    // Find the tree node by handle ID (which is the JSONPath)
    const treeNode = findTreeNodeById(schemaData.tree, handleId);
    return treeNode?.type || null;
  }

  if (node.type === 'functoid') {
    const functoidData = node.data as FunctoidNodeData;
    const functoid = functoidRegistry[functoidData.kind];
    return functoid?.outputType || null;
  }

  return null;
}

/**
 * Get the input type from a node and handle
 */
function getInputType(node: Node, handleId: string | null): string | null {
  if (node.type === 'schema') {
    const schemaData = node.data as SchemaNodeData;
    // Find the tree node by handle ID
    const treeNode = findTreeNodeById(schemaData.tree, handleId);
    return treeNode?.type || null;
  }

  if (node.type === 'functoid') {
    const functoidData = node.data as FunctoidNodeData;
    const functoid = functoidRegistry[functoidData.kind];

    // Parse handle ID to get input index (format: "input-0", "input-1", etc.)
    if (handleId && handleId.startsWith('input-')) {
      const index = parseInt(handleId.split('-')[1], 10);
      return functoid?.inputTypes?.[index] || null;
    }
  }

  return null;
}

/**
 * Find a tree node by its ID (JSONPath)
 */
function findTreeNodeById(node: any, targetId: string | null): any {
  if (!node || !targetId) return null;

  if (node.id === targetId) {
    return node;
  }

  if (node.children) {
    for (const child of node.children) {
      const found = findTreeNodeById(child, targetId);
      if (found) return found;
    }
  }

  return null;
}

/**
 * Check if two types are compatible for connection
 */
function areTypesCompatible(sourceType: string | null, targetType: string | null): boolean {
  if (!sourceType || !targetType) {
    // If we can't determine types, allow the connection
    return true;
  }

  // 'any' type is compatible with everything
  if (sourceType === 'any' || targetType === 'any') {
    return true;
  }

  // Exact match
  if (sourceType === targetType) {
    return true;
  }

  // Number compatibility: integer can go to number, but not vice versa
  if (sourceType === 'integer' && targetType === 'number') {
    return true;
  }

  // Boolean can be represented as number (0/1)
  if (sourceType === 'boolean' && targetType === 'number') {
    return true;
  }

  // Everything can be converted to string
  if (targetType === 'string') {
    return true;
  }

  // Array compatibility - check if both are arrays
  if (sourceType === 'array' && targetType === 'array') {
    return true;
  }

  // Object compatibility
  if (sourceType === 'object' && targetType === 'object') {
    return true;
  }

  // Function type is compatible with any (for custom functoids)
  if (sourceType === 'function' || targetType === 'function') {
    return true;
  }

  return false;
}

/**
 * Validate an edge connection
 * Check if source and target types are compatible
 */
export function validateEdgeConnection(
  sourceNode: Node,
  sourceHandle: string | null,
  targetNode: Node,
  targetHandle: string | null,
  existingEdges?: ReactFlowEdge[]
): { valid: boolean; reason?: string } {
  // Don't allow self-connections
  if (sourceNode.id === targetNode.id) {
    return { valid: false, reason: 'Cannot connect node to itself' };
  }

  // Validate flow direction: must flow left to right (source schema → functoid → target schema)
  // Don't allow target schema → source schema or functoid → source schema
  if (targetNode.type === 'schema') {
    const targetData = targetNode.data as SchemaNodeData;

    if (targetData.side === 'source') {
      // Cannot connect TO source schema (it's input only)
      return { valid: false, reason: 'Cannot connect to source schema - data flows from source to target' };
    }
  }

  if (sourceNode.type === 'schema') {
    const sourceData = sourceNode.data as SchemaNodeData;

    if (sourceData.side === 'target') {
      // Cannot connect FROM target schema (it's output only)
      return { valid: false, reason: 'Cannot connect from target schema - data flows from source to target' };
    }
  }

  // Don't allow source → source or target → target connections
  if (sourceNode.type === 'schema' && targetNode.type === 'schema') {
    const sourceData = sourceNode.data as SchemaNodeData;
    const targetData = targetNode.data as SchemaNodeData;

    if (sourceData.side === targetData.side) {
      return { valid: false, reason: 'Cannot connect schema nodes of the same type' };
    }
  }

  // Type checking with dynamic array context
  const sourceType = getOutputType(sourceNode, sourceHandle);
  const targetType = getInputType(targetNode, targetHandle);

  // Check if source is an array field (contains [])
  const isDirectArraySource = sourceHandle?.includes('[]') || false;

  // Check if source functoid has array inputs (dynamic typing)
  let isFunctoidWithArrayInputs = false;
  if (sourceNode.type === 'functoid' && existingEdges) {
    const incomingEdges = existingEdges.filter((e) => e.target === sourceNode.id);
    isFunctoidWithArrayInputs = incomingEdges.some((e) => e.sourceHandle?.includes('[]'));
  }

  // Dynamic typing rules:
  // 1. Array field (items[].price) → scalar input (Multiply): Allow (element-wise operation)
  // 2. Functoid with array inputs → array input (Sum): Treat output as array
  // 3. Array field → array input: Allow

  let effectiveSourceType = sourceType;

  // If source is functoid with array inputs, and target expects array, treat as array
  if (isFunctoidWithArrayInputs && targetType === 'array' && sourceType !== 'array') {
    effectiveSourceType = 'array';
  }

  // If direct array source connecting to array input, that's fine
  if (isDirectArraySource && targetType === 'array') {
    effectiveSourceType = 'array';
  }

  // If direct array source connecting to non-array input, keep element type (allow element-wise ops)
  // No change needed - sourceType is already the element type

  if (!areTypesCompatible(effectiveSourceType, targetType)) {
    return {
      valid: false,
      reason: `Type mismatch: cannot connect ${effectiveSourceType || 'unknown'} to ${targetType || 'unknown'}`
    };
  }

  return { valid: true };
}

/**
 * Convert React Flow state to GraphLayout
 */
export function reactFlowToGraphLayout(
  nodes: Node[],
  viewport: { x: number; y: number; zoom: number },
  mapperFile: string
): GraphLayout {
  const nodeLayouts: NodeLayout[] = nodes.map(node => ({
    id: node.id,
    position: { x: node.position.x, y: node.position.y },
    dimensions: node.width && node.height
      ? { width: node.width, height: node.height }
      : undefined,
    ui: {
      // Store any UI-specific state here
      selected: node.selected,
      hidden: node.hidden
    }
  }));

  return {
    version: '1.0',
    mapperFile,
    viewport: {
      x: viewport.x,
      y: viewport.y,
      zoom: viewport.zoom
    },
    nodes: nodeLayouts,
    metadata: {
      layoutAlgorithm: 'manual',
      theme: 'light'
    }
  };
}

/**
 * Apply GraphLayout to React Flow nodes
 * Updates node positions and dimensions from layout
 */
export function applyGraphLayoutToNodes(nodes: Node[], layout: GraphLayout | null): Node[] {
  if (!layout) return nodes;

  return nodes.map(node => {
    const nodeLayout = layout.nodes.find(nl => nl.id === node.id);
    if (!nodeLayout) return node;

    return {
      ...node,
      position: nodeLayout.position,
      width: nodeLayout.dimensions?.width,
      height: nodeLayout.dimensions?.height,
      selected: nodeLayout.ui?.selected,
      hidden: nodeLayout.ui?.hidden
    };
  });
}
