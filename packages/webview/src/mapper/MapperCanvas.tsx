import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import {
  ReactFlow,
  Background,
  useNodesState,
  useEdgesState,
  addEdge as addReactFlowEdge,
  useReactFlow,
  ReactFlowProvider,
  type Node,
  type Edge,
  type OnConnect,
  type NodeTypes,
  type NodeChange,
  type EdgeChange
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Upload, Download, Save, LayoutGrid, Play, Info } from 'lucide-react';

import {
  mapSpecToReactFlow,
  reactFlowToMapSpecNode,
  reactFlowToMapSpecEdge,
  reactFlowToGraphLayout,
  applyGraphLayoutToNodes,
  getDefaultNodePosition,
  validateEdgeConnection,
  cleanOrphanedEdges,
  buildSchemaTree,
  applyOverlaysToSchema,
  extractUserAddedPaths
} from '../../../core/src/mapper';
import type { JSONSchema, MapSpec, NodeKind, GraphLayout, SchemaOverlays, SchemaOverlay } from '../../../core/src/mapper';
import { SchemaNodeTreeView, FunctoidNode, SchemaInferenceDialog, FunctoidPalette, FunctoidConfigPanel, ExecutionPreviewPanel } from './components';
import { traceUpstreamDependencies } from './utils/highlightTracer';
import { HighlightContext } from './contexts/HighlightContext';
// Sample schemas removed - users must import or reference schemas explicitly
import './MapperCanvas.css';

/**
 * Messages from extension to webview
 */
type MsgFromExtension =
  | { type: 'init'; mapSpec: MapSpec; fileUri: string; sourceSchema: any; targetSchema: any; graphLayout?: GraphLayout }
  | { type: 'reload'; mapSpec: MapSpec; sourceSchema: any; targetSchema: any; graphLayout?: GraphLayout }
  | { type: 'layoutComputed'; graphLayout: GraphLayout };

/**
 * Messages from webview to extension
 */
type MsgToExtension =
  | { type: 'ready' }
  | { type: 'save'; mapSpec: MapSpec }
  | { type: 'saveLayout'; graphLayout: GraphLayout }
  | { type: 'autoLayout'; nodeSizes: Record<string, { width: number; height: number }>; currentPositions: Record<string, { x: number; y: number }>; handlePositions: Record<string, Record<string, number>> }
  | { type: 'error'; message: string }
  | { type: 'info'; message: string };

/**
 * VS Code API for webview
 */
declare const acquireVsCodeApi: () => {
  postMessage: (message: MsgToExtension) => void;
  getState: () => any;
  setState: (state: any) => void;
};

// Get VS Code API if available
const vscodeApi = typeof acquireVsCodeApi !== 'undefined' ? acquireVsCodeApi() : null;

/**
 * MapperCanvas - Main React Flow canvas for visual data mapping
 */

const nodeTypes: NodeTypes = {
  schema: SchemaNodeTreeView,
  functoid: FunctoidNode
};

function MapperCanvasInner() {
  // State
  const [mapSpec, setMapSpec] = useState<MapSpec | null>(null);
  const [sourceSchema, setSourceSchema] = useState<JSONSchema | null>(null);
  const [targetSchema, setTargetSchema] = useState<JSONSchema | null>(null);
  const [schemaOverlays, setSchemaOverlays] = useState<SchemaOverlays>({});
  const [fileUri, setFileUri] = useState<string>('');

  // Schema inference dialog state
  const [inferenceDialogOpen, setInferenceDialogOpen] = useState(false);
  const [inferenceDialogSide, setInferenceDialogSide] = useState<'source' | 'target'>('source');

  // Functoid config panel state
  const [selectedFunctoid, setSelectedFunctoid] = useState<{ id: string; kind: string; config: Record<string, any> } | null>(null);

  // Execution preview state
  const [previewPanelOpen, setPreviewPanelOpen] = useState(false);

  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { screenToFlowPosition, getViewport } = useReactFlow();

  // Track collapsed handles and parent mappings for edge redirection (per side)
  const [collapsedSourceHandles, setCollapsedSourceHandles] = useState<Set<string>>(new Set());
  const [collapsedTargetHandles, setCollapsedTargetHandles] = useState<Set<string>>(new Set());
  const [sourceParentMap, setSourceParentMap] = useState<Map<string, string>>(new Map());
  const [targetParentMap, setTargetParentMap] = useState<Map<string, string>>(new Map());

  // Highlighting state for target handle hover
  const [highlightedNodes, setHighlightedNodes] = useState<Set<string>>(new Set());
  const [highlightedEdges, setHighlightedEdges] = useState<Set<string>>(new Set());
  const [highlightedSourceHandles, setHighlightedSourceHandles] = useState<Set<string>>(new Set());

  // Track if we're loading to prevent save during init
  const isLoadingRef = useRef(false);
  const hasInitializedRef = useRef(false);
  const isReloadingRef = useRef(false);
  const hasRequestedInitRef = useRef(false);

  /**
   * Handle collapsed handles change from schema nodes
   */
  const handleSourceCollapsedHandlesChange = useCallback((handleIds: string[], parentMap: Map<string, string>) => {
    setCollapsedSourceHandles(new Set(handleIds));
    setSourceParentMap(parentMap);
  }, []);

  const handleTargetCollapsedHandlesChange = useCallback((handleIds: string[], parentMap: Map<string, string>) => {
    setCollapsedTargetHandles(new Set(handleIds));
    setTargetParentMap(parentMap);
  }, []);

  /**
   * Handle hover on target handles to highlight contributing elements
   */
  const handleTargetHandleHover = useCallback((nodeId: string, handleId: string) => {
    const { nodeIds, edgeIds, sourceHandles } = traceUpstreamDependencies(
      nodeId,
      handleId,
      nodes,
      edges
    );

    setHighlightedNodes(nodeIds);
    setHighlightedEdges(edgeIds);
    setHighlightedSourceHandles(sourceHandles);
  }, [nodes, edges]);

  /**
   * Clear highlighting when hover ends
   */
  const handleTargetHandleHoverEnd = useCallback(() => {
    setHighlightedNodes(new Set());
    setHighlightedEdges(new Set());
    setHighlightedSourceHandles(new Set());
  }, []);

  /**
   * Find the topmost visible parent for a handle (cascading up through collapsed nodes)
   */
  const findVisibleParent = useCallback((handleId: string, isSource: boolean): string => {
    const collapsedHandles = isSource ? collapsedSourceHandles : collapsedTargetHandles;
    const parentMap = isSource ? sourceParentMap : targetParentMap;

    let currentId = handleId;
    let parentId = parentMap.get(currentId);

    // Keep going up until we find a visible parent or reach the top
    while (parentId && collapsedHandles.has(parentId)) {
      currentId = parentId;
      parentId = parentMap.get(currentId);
    }

    return parentId || currentId;
  }, [collapsedSourceHandles, collapsedTargetHandles, sourceParentMap, targetParentMap]);

  /**
   * Redirect edges to visible parent handles when children are collapsed
   * Also apply highlighting styles to contributing edges
   */
  const redirectedEdges = useMemo(() => {
    console.log('🔄 Recalculating redirected edges...');
    console.log('  - Total edges:', edges.length);
    console.log('  - Collapsed source handles:', Array.from(collapsedSourceHandles));
    console.log('  - Collapsed target handles:', Array.from(collapsedTargetHandles));
    console.log('  - Source parent map:', Array.from(sourceParentMap.entries()));
    console.log('  - Target parent map:', Array.from(targetParentMap.entries()));

    return edges.map(edge => {
      const sourceHandle = edge.sourceHandle || '';
      const targetHandle = edge.targetHandle || '';

      // Check if handles are collapsed and need redirection (using side-specific sets)
      const sourceIsCollapsed = collapsedSourceHandles.has(sourceHandle);
      const targetIsCollapsed = collapsedTargetHandles.has(targetHandle);

      // Check if this edge should be highlighted
      const isHighlighted = highlightedEdges.has(edge.id);

      if (!sourceIsCollapsed && !targetIsCollapsed && !isHighlighted) {
        // No redirection or highlighting needed
        return edge;
      }

      // Find visible parents for collapsed handles (pass side information)
      const newSourceHandle = sourceIsCollapsed ? findVisibleParent(sourceHandle, true) : sourceHandle;
      const newTargetHandle = targetIsCollapsed ? findVisibleParent(targetHandle, false) : targetHandle;

      if (sourceIsCollapsed || targetIsCollapsed) {
        console.log('  📌 Redirecting edge:', {
          id: edge.id,
          from: { original: sourceHandle, redirected: newSourceHandle, wasCollapsed: sourceIsCollapsed },
          to: { original: targetHandle, redirected: newTargetHandle, wasCollapsed: targetIsCollapsed }
        });
      }

      // Create redirected edge with visual indicators
      // Force React Flow to re-validate by adding a unique key suffix when redirected
      const redirectedId = (sourceIsCollapsed || targetIsCollapsed)
        ? `${edge.id}-redirected-${newSourceHandle}-${newTargetHandle}`
        : edge.id;

      // Build style with redirection and highlighting
      const baseStyle = edge.style || {};
      let edgeStyle = { ...baseStyle };

      // Apply redirection styling
      if (sourceIsCollapsed || targetIsCollapsed) {
        edgeStyle.strokeDasharray = '5,5';
        edgeStyle.opacity = 0.6;
      }

      // Apply highlighting styling (overrides redirection if both apply)
      if (isHighlighted) {
        edgeStyle.stroke = '#10b981';
        edgeStyle.strokeWidth = 4;
        edgeStyle.opacity = 1;
      }

      return {
        ...edge,
        id: redirectedId,
        sourceHandle: newSourceHandle,
        targetHandle: newTargetHandle,
        style: edgeStyle,
        // Add class for additional CSS styling
        className: isHighlighted ? 'react-flow__edge-highlighted' : edge.className,
        // Add data to track original handles (for saving)
        data: {
          ...edge.data,
          originalSourceHandle: sourceIsCollapsed ? sourceHandle : undefined,
          originalTargetHandle: targetIsCollapsed ? targetHandle : undefined,
          isRedirected: sourceIsCollapsed || targetIsCollapsed
        }
      };
    });
  }, [edges, collapsedSourceHandles, collapsedTargetHandles, sourceParentMap, targetParentMap, findVisibleParent, highlightedEdges]);

  /**
   * Initialize from MapSpec
   */
  const initializeFromMapSpec = useCallback((newMapSpec: MapSpec, srcSchema?: JSONSchema | null, tgtSchema?: JSONSchema | null, layout?: GraphLayout | null) => {
    console.log('initializeFromMapSpec called with:', {
      srcSchema: srcSchema ? 'present' : 'null/undefined',
      tgtSchema: tgtSchema ? 'present' : 'null/undefined',
      layout: layout ? 'present' : 'null/undefined'
    });

    isLoadingRef.current = true;

    // Use provided schemas or fall back to empty schemas
    // Note: null means no schema, so use empty placeholder
    const finalSourceSchema = (srcSchema !== undefined && srcSchema !== null)
      ? srcSchema
      : (sourceSchema || { type: 'object', properties: {} });
    const finalTargetSchema = (tgtSchema !== undefined && tgtSchema !== null)
      ? tgtSchema
      : (targetSchema || { type: 'object', properties: {} });

    // Clean orphaned edges before loading (with schema validation)
    const cleanedMapSpec = cleanOrphanedEdges(newMapSpec, finalSourceSchema, finalTargetSchema);
    setMapSpec(cleanedMapSpec);

    console.log('Using schemas:', {
      finalSource: finalSourceSchema ? Object.keys(finalSourceSchema.properties || {}).length + ' properties' : 'empty',
      finalTarget: finalTargetSchema ? Object.keys(finalTargetSchema.properties || {}).length + ' properties' : 'empty'
    });

    // Update schema state
    setSourceSchema(srcSchema !== undefined ? srcSchema : sourceSchema);
    setTargetSchema(tgtSchema !== undefined ? tgtSchema : targetSchema);

    // Load schema extensions from MapSpec
    setSchemaOverlays(cleanedMapSpec.schemaOverlays || {});

    // Convert MapSpec to React Flow format (already cleaned above)
    const { nodes: rfNodes, edges: rfEdges } = mapSpecToReactFlow(
      cleanedMapSpec,
      finalSourceSchema,
      finalTargetSchema,
      cleanedMapSpec.schemaOverlays
    );

    console.log('Generated nodes:', rfNodes.length, 'edges:', rfEdges.length);

    // Apply GraphLayout if provided
    const nodesWithLayout = layout ? applyGraphLayoutToNodes(rfNodes, layout) : rfNodes;

    // Add callbacks to schema nodes (side-specific)
    const nodesWithCallbacks = nodesWithLayout.map(node => {
      if (node.type === 'schema') {
        const isSourceNode = node.data.side === 'source';
        const side: 'source' | 'target' = node.data.side;
        return {
          ...node,
          data: {
            ...node.data,
            onCollapsedHandlesChange: isSourceNode ? handleSourceCollapsedHandlesChange : handleTargetCollapsedHandlesChange,
            onAddProperty: (path: string, propertyName: string, propertySchema: JSONSchema) => handleAddProperty(side, path, propertyName, propertySchema),
            onEditProperty: (path: string, propertyName: string, propertySchema: JSONSchema) => handleEditProperty(side, path, propertyName, propertySchema),
            onRemoveProperty: (path: string, propertyName: string) => handleRemoveProperty(side, path, propertyName)
          }
        };
      }
      return node;
    });

    setNodes(nodesWithCallbacks);
    setEdges(rfEdges);

    // Small delay to let React finish processing before allowing saves
    setTimeout(() => {
      isLoadingRef.current = false;
      hasInitializedRef.current = true;
    }, 100);
  }, [sourceSchema, targetSchema, setNodes, setEdges, handleSourceCollapsedHandlesChange, handleTargetCollapsedHandlesChange]);

  /**
   * Rebuild schema nodes when schemaOverlays changes
   * This updates the tree to show newly added/removed properties
   */
  useEffect(() => {
    // Skip if not initialized yet or currently loading
    if (!hasInitializedRef.current || isLoadingRef.current) {
      return;
    }

    // Skip if no schemas loaded
    if (!sourceSchema && !targetSchema) {
      return;
    }

    console.log('🔄 Rebuilding schema trees with overlays:', schemaOverlays);

    // Rebuild schema nodes with updated overlays
    setNodes((currentNodes) => {
      return currentNodes.map((node) => {
        if (node.type === 'schema') {
          const side: 'source' | 'target' = node.data.side;
          const schema = side === 'source' ? sourceSchema : targetSchema;

          if (!schema) return node;

          // Apply overlays at their specified paths and rebuild tree
          const enhancedSchema = applyOverlaysToSchema(schema, schemaOverlays[side]);
          const userAddedPaths = extractUserAddedPaths(schemaOverlays[side]);

          const newTree = buildSchemaTree(
            enhancedSchema,
            '$',
            'root',
            userAddedPaths
          );

          console.log(`📊 Rebuilt ${side} tree:`, newTree);

          // Return updated node with new tree AND preserve callbacks
          return {
            ...node,
            data: {
              ...node.data,
              tree: newTree,
              // Ensure callbacks are preserved
              onCollapsedHandlesChange: node.data.onCollapsedHandlesChange,
              onAddProperty: node.data.onAddProperty,
              onEditProperty: node.data.onEditProperty,
              onRemoveProperty: node.data.onRemoveProperty
            }
          };
        }
        return node;
      });
    });
  }, [schemaOverlays, sourceSchema, targetSchema, setNodes]);

  /**
   * Initialize with empty MapSpec only when NOT in VS Code (standalone mode)
   * When in VS Code, wait for the 'init' message instead
   */
  useEffect(() => {
    // Only initialize if:
    // 1. Not yet initialized
    // 2. NOT in VS Code (vscodeApi is null for standalone)
    if (!hasInitializedRef.current && !vscodeApi) {
      const emptyMapSpec: MapSpec = {
        version: '1.0',
        metadata: {
          name: 'New Mapper',
          description: '',
          version: '1.0.0',
          source: 'Source Schema',
          target: 'Target Schema',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        schemas: {
          source: 'none',
          target: 'none'
        },
        nodes: [],
        edges: []
      };

      // Initialize with empty placeholder schemas - user must import schemas
      const emptySchema: JSONSchema = {
        type: 'object',
        properties: {},
        description: 'No schema imported yet. Click "Import Schema" to add a schema.'
      };
      initializeFromMapSpec(emptyMapSpec, emptySchema, emptySchema);
      // hasInitializedRef is set to true inside initializeFromMapSpec
    }
  }, [initializeFromMapSpec]);

  /**
   * Handle messages from VS Code extension
   */
  useEffect(() => {
    const handleMessage = (event: MessageEvent<MsgFromExtension>) => {
      const message = event.data;

      switch (message.type) {
        case 'init': {
          console.log('Received init message');
          console.log('Schema refs:', message.mapSpec.schemas?.source, message.mapSpec.schemas?.target);
          console.log('Has sourceSchema:', !!message.sourceSchema);
          console.log('Has targetSchema:', !!message.targetSchema);
          console.log('Has graphLayout:', !!message.graphLayout);

          setFileUri(message.fileUri);
          // Use schemas passed separately (not from mapSpec)
          const srcSchema = message.sourceSchema || null;
          const tgtSchema = message.targetSchema || null;
          const graphLayout = message.graphLayout || null;

          console.log('Calling initializeFromMapSpec with schemas:', {
            hasSource: !!srcSchema,
            hasTarget: !!tgtSchema,
            hasLayout: !!graphLayout
          });

          initializeFromMapSpec(message.mapSpec, srcSchema, tgtSchema, graphLayout);
          break;
        }

        case 'reload': {
          // Set reloading flag to prevent auto-save during external file changes
          isReloadingRef.current = true;

          // Use schemas passed separately (not from mapSpec)
          const reloadSrcSchema = message.sourceSchema || null;
          const reloadTgtSchema = message.targetSchema || null;
          const reloadGraphLayout = message.graphLayout || null;
          initializeFromMapSpec(message.mapSpec, reloadSrcSchema, reloadTgtSchema, reloadGraphLayout);

          // Clear reloading flag after React finishes processing
          setTimeout(() => {
            isReloadingRef.current = false;
          }, 1000);
          break;
        }

        case 'layoutComputed':
          // Apply computed layout to nodes
          if (message.graphLayout) {
            const nodesWithLayout = applyGraphLayoutToNodes(nodes, message.graphLayout);

            // Preserve collapsed handles callbacks
            const nodesWithCallbacks = nodesWithLayout.map(node => {
              if (node.type === 'schema') {
                const isSourceNode = node.data.side === 'source';
                return {
                  ...node,
                  data: {
                    ...node.data,
                    onCollapsedHandlesChange: isSourceNode ? handleSourceCollapsedHandlesChange : handleTargetCollapsedHandlesChange
                  }
                };
              }
              return node;
            });

            setNodes(nodesWithCallbacks);
            console.log('Auto-layout applied');
          }
          break;

        case 'schemaLoaded':
          // Handle schema loaded from file reference
          if ((message as any).schema && (message as any).side && (message as any).path) {
            const loadedSchema = (message as any).schema;
            const side = (message as any).side as 'source' | 'target';
            const filePath = (message as any).path;

            // Update schema state for display (but won't be saved to file)
            const newSourceSchema = side === 'source' ? loadedSchema : sourceSchema;
            const newTargetSchema = side === 'target' ? loadedSchema : targetSchema;

            setSourceSchema(newSourceSchema);
            setTargetSchema(newTargetSchema);

            // Update MapSpec with file reference path ONLY (no embedded schema)
            const updatedMapSpec: MapSpec = mapSpec ? {
              ...mapSpec,
              schemas: {
                source: side === 'source' ? filePath : mapSpec.schemas.source,
                target: side === 'target' ? filePath : mapSpec.schemas.target,
                // Don't embed schemas for file references
                sourceSchema: undefined,
                targetSchema: undefined
              },
              nodes: nodes.filter(n => n.type === 'functoid').map(n => reactFlowToMapSpecNode(n)!),
              edges: edges.map(e => reactFlowToMapSpecEdge(e))
            } : {
              version: '1.0',
              metadata: {
                name: 'New Mapper',
                description: '',
                version: '1.0.0',
                source: 'Source Schema',
                target: 'Target Schema',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              },
              schemas: {
                source: side === 'source' ? filePath : 'none',
                target: side === 'target' ? filePath : 'none',
                // Don't embed schemas for file references
                sourceSchema: undefined,
                targetSchema: undefined
              },
              nodes: [],
              edges: []
            };

            // Rebuild schema nodes with new schema
            const { nodes: rfNodes, edges: rfEdges } = mapSpecToReactFlow(
              updatedMapSpec,
              newSourceSchema || { type: 'object', properties: {} },
              newTargetSchema || { type: 'object', properties: {} },
              schemaOverlays
            );

            setMapSpec(updatedMapSpec);
            setNodes(rfNodes);
            setEdges(rfEdges);
            // Auto-save will trigger from useEffect watching nodes/edges
          }
          break;
      }
    };

    window.addEventListener('message', handleMessage);

    // Send ready message to extension to request init data (only once)
    if (vscodeApi && !hasRequestedInitRef.current) {
      vscodeApi.postMessage({ type: 'ready' });
      hasRequestedInitRef.current = true;
    }

    return () => window.removeEventListener('message', handleMessage);
  }, [initializeFromMapSpec]);

  /**
   * Save MapSpec back to VS Code
   */
  const saveMapSpec = useCallback(() => {
    if (!mapSpec || isLoadingRef.current || isReloadingRef.current || !vscodeApi) {
      return;
    }

    // Only embed schemas when they're custom (not file references)
    // File references should only store the path, not the full schema
    const shouldEmbedSource = mapSpec.schemas.source === 'custom';
    const shouldEmbedTarget = mapSpec.schemas.target === 'custom';

    // Update MapSpec with current nodes, edges, schemas, and extensions
    // Don't update timestamp - let user decide when to update metadata
    const updatedMapSpec: MapSpec = {
      ...mapSpec,
      schemas: {
        ...mapSpec.schemas,
        sourceSchema: shouldEmbedSource ? (sourceSchema || undefined) : undefined,
        targetSchema: shouldEmbedTarget ? (targetSchema || undefined) : undefined
      },
      schemaOverlays: Object.keys(schemaOverlays).length > 0 ? schemaOverlays : undefined,
      nodes: nodes
        .filter(n => n.type === 'functoid')
        .map(n => {
          const msNode = reactFlowToMapSpecNode(n);
          return msNode!;
        })
        .filter(Boolean),
      edges: edges.map(e => reactFlowToMapSpecEdge(e))
    };

    vscodeApi.postMessage({
      type: 'save',
      mapSpec: updatedMapSpec
    });

    setMapSpec(updatedMapSpec);
  }, [mapSpec, nodes, edges, sourceSchema, targetSchema, schemaOverlays]);

  /**
   * Save GraphLayout (positions, viewport) back to VS Code
   */
  const saveGraphLayout = useCallback(() => {
    if (!fileUri || isLoadingRef.current || isReloadingRef.current || !vscodeApi) {
      return;
    }

    // Get current viewport from React Flow
    const viewport = getViewport();

    // Create GraphLayout from current state
    const graphLayout = reactFlowToGraphLayout(
      nodes,
      viewport,
      fileUri.replace(/\.mapper\.json$/, '.mapper.json') // Reference to MapSpec file
    );

    vscodeApi.postMessage({
      type: 'saveLayout',
      graphLayout
    });
  }, [nodes, fileUri, getViewport]);

  /**
   * Extract conditional context from a synthetic path
   * E.g., "$.attributes.config.__SYNTH__[type=6] HTTP Task.headers" -> { field: 'type', value: '6', cleanPath: '$.attributes.config.headers' }
   */
  const extractConditionFromPath = (path: string): { field: string; value: string; cleanPath: string } | null => {
    const match = path.match(/__SYNTH__\[([^=]+)=([^\]]+)\]/);
    if (!match) return null;

    const field = match[1];
    const value = match[2];
    // Remove synthetic notation to get clean path (format: .__SYNTH__[...] Display Name)
    const cleanPath = path.replace(/\.__SYNTH__\[[^\]]+\]\s+[^.]+/g, '');

    return { field, value, cleanPath };
  };

  /**
   * Build path from segments to a specific property
   * E.g., buildPathToProperty(['attributes', 'config', 'headers'], 'Authorization')
   * -> { attributes: { properties: { config: { properties: { headers: { properties: { Authorization: {...} } } } } } } }
   */
  const buildNestedSchema = (pathSegments: string[], propertyName: string, propertySchema: JSONSchema): JSONSchema => {
    if (pathSegments.length === 0) {
      // Base case: return the property
      return {
        type: 'object',
        properties: {
          [propertyName]: propertySchema
        }
      };
    }

    // Recursive case: wrap in parent object
    const [head, ...tail] = pathSegments;
    return {
      type: 'object',
      properties: {
        [head]: buildNestedSchema(tail, propertyName, propertySchema)
      }
    };
  };

  /**
   * Add a user-defined property to a free-form object
   * Generates overlay schemas for conditional properties
   */
  const handleAddProperty = useCallback((side: 'source' | 'target', path: string, propertyName: string, propertySchema: JSONSchema) => {
    console.log('➕ Adding property:', { side, path, propertyName, propertySchema });

    const condition = extractConditionFromPath(path);

    if (!condition) {
      // No conditional context - this shouldn't happen with current implementation
      console.warn('No condition found in path:', path);
      return;
    }

    // Find the synthetic segment in the original path to determine the discriminator parent
    // E.g., "$.attributes.config.__SYNTH__[type=6] HTTP Task.headers"
    // Synthetic at: "__SYNTH__[type=6] HTTP Task", grandparent is "attributes" (discriminator parent)
    const pathSegments = path.split('.');
    const syntheticIndex = pathSegments.findIndex(seg => seg.startsWith('__SYNTH__'));

    if (syntheticIndex === -1) {
      console.warn('No synthetic notation found in path:', path);
      return;
    }

    // The discriminator's parent is the grandparent of the synthetic segment
    // E.g., if synthetic is at index 3, grandparent is at index 1
    const discriminatorParentIndex = syntheticIndex - 2;

    if (discriminatorParentIndex < 0) {
      console.warn('Cannot determine discriminator parent from path:', path);
      return;
    }

    // Get the schema path (discriminator parent) - where the overlay should be applied
    const schemaPath = pathSegments.slice(0, discriminatorParentIndex + 1).join('.');

    // Get the relative path (everything after the discriminator parent)
    // E.g., "$.attributes.config.[type=6] HTTP Task.headers" -> "config.[type=6] HTTP Task.headers"
    const relativePathSegments = pathSegments.slice(discriminatorParentIndex + 1);
    const relativePath = relativePathSegments.join('.');

    // Strip synthetic notation from the relative path
    const cleanRelativePath = relativePath.replace(/\.__SYNTH__\[[^\]]+\]\s+[^.]+/g, '');

    console.log('Path analysis:', {
      originalPath: path,
      syntheticIndex,
      discriminatorParentIndex,
      schemaPath,
      relativePath,
      cleanRelativePath
    });

    // Build nested schema using the relative path segments
    const cleanSegments = cleanRelativePath.split('.');

    // Build nested schema for the property
    const nestedSchema = buildNestedSchema(cleanSegments, propertyName, propertySchema);

    // Generate overlay ID
    const overlayId = `mapper://overlay/${side}/${condition.field}-${condition.value}/${propertyName}`;

    // Create overlay schema
    const overlay: SchemaOverlay = {
      $id: overlayId,
      if: {
        properties: {
          [condition.field]: { const: condition.value }
        }
      },
      then: nestedSchema,
      metadata: {
        targetPath: `${path}.${propertyName}`,  // Full path including property name
        schemaPath: schemaPath,  // Store where this overlay should be applied
        description: `User-added property: ${propertyName}`,
        createdAt: new Date().toISOString()
      }
    };

    // Add overlay to state
    setSchemaOverlays(prev => {
      const sideOverlays = prev[side] || [];
      return {
        ...prev,
        [side]: [...sideOverlays, overlay]
      };
    });
  }, []);

  /**
   * Edit a user-defined property
   * Updates the overlay schema for the property
   */
  const handleEditProperty = useCallback((side: 'source' | 'target', path: string, propertyName: string, propertySchema: JSONSchema) => {
    console.log('✏️ Editing property:', { side, path, propertyName, propertySchema });

    // Find and update the overlay that targets this path and property
    setSchemaOverlays(prev => {
      const sideOverlays = prev[side] || [];

      const updatedOverlays = sideOverlays.map(overlay => {
        // Match overlay by target path in metadata (now includes property name)
        const fullPath = `${path}.${propertyName}`;
        if (overlay.metadata?.targetPath === fullPath) {
          // Calculate relative path from discriminator parent
          const pathSegments = path.split('.');
          const syntheticIndex = pathSegments.findIndex(seg => seg.startsWith('__SYNTH__'));

          if (syntheticIndex === -1) {
            console.warn('No synthetic notation in path for edit:', path);
            return overlay;
          }

          const discriminatorParentIndex = syntheticIndex - 2;
          if (discriminatorParentIndex < 0) {
            console.warn('Cannot determine discriminator parent for edit:', path);
            return overlay;
          }

          // Get schema path (discriminator parent)
          const schemaPath = pathSegments.slice(0, discriminatorParentIndex + 1).join('.');

          // Get relative path and strip synthetic notation
          const relativePathSegments = pathSegments.slice(discriminatorParentIndex + 1);
          const relativePath = relativePathSegments.join('.');
          const cleanRelativePath = relativePath.replace(/\.__SYNTH__\[[^\]]+\]\s+[^.]+/g, '');
          const cleanSegments = cleanRelativePath.split('.');

          const nestedSchema = buildNestedSchema(cleanSegments, propertyName, propertySchema);

          return {
            ...overlay,
            then: nestedSchema,
            metadata: {
              ...overlay.metadata,
              targetPath: fullPath,  // Update full path
              schemaPath: schemaPath,  // Update schema path
              description: `User-added property: ${propertyName} (edited)`
            }
          };
        }
        return overlay;
      });

      return {
        ...prev,
        [side]: updatedOverlays
      };
    });
  }, []);

  /**
   * Remove a user-defined property
   * Removes the overlay schema for the property
   */
  const handleRemoveProperty = useCallback((side: 'source' | 'target', path: string, propertyName: string) => {
    console.log('🗑️ Removing property:', { side, path, propertyName });

    // Build full path including property name
    const fullPath = `${path}.${propertyName}`;

    // Remove the overlay that targets this full path
    setSchemaOverlays(prev => {
      const sideOverlays = prev[side] || [];

      // Filter out overlays that match this full path
      const remainingOverlays = sideOverlays.filter(overlay => {
        return overlay.metadata?.targetPath !== fullPath;
      });

      console.log('🗑️ Filtered overlays:', {
        before: sideOverlays.length,
        after: remainingOverlays.length,
        removed: sideOverlays.length - remainingOverlays.length
      });

      return {
        ...prev,
        [side]: remainingOverlays
      };
    });
  }, []);

  /**
   * Auto-save when nodes or edges change (debounced)
   */
  useEffect(() => {
    // Don't save during loading or reloading
    if (isLoadingRef.current || isReloadingRef.current || !hasInitializedRef.current || !vscodeApi || !mapSpec) {
      return;
    }

    // Debounce saves
    const timer = setTimeout(() => {
      // Access current nodes/edges directly here instead of through saveMapSpec closure
      const shouldEmbedSource = mapSpec.schemas.source === 'custom';
      const shouldEmbedTarget = mapSpec.schemas.target === 'custom';

      const updatedMapSpec: MapSpec = {
        ...mapSpec,
        schemas: {
          ...mapSpec.schemas,
          sourceSchema: shouldEmbedSource ? (sourceSchema || undefined) : undefined,
          targetSchema: shouldEmbedTarget ? (targetSchema || undefined) : undefined
        },
        schemaOverlays: Object.keys(schemaOverlays).length > 0 ? schemaOverlays : undefined,
        nodes: nodes
          .filter(n => n.type === 'functoid')
          .map(n => {
            const msNode = reactFlowToMapSpecNode(n);
            return msNode!;
          })
          .filter(Boolean),
        edges: edges.map(e => reactFlowToMapSpecEdge(e))
      };

      console.log('💾 Auto-saving MapSpec with overlays:', updatedMapSpec.schemaOverlays);

      vscodeApi.postMessage({
        type: 'save',
        mapSpec: updatedMapSpec
      });

      setMapSpec(updatedMapSpec);
    }, 500);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, schemaOverlays, vscodeApi]); // Trigger on nodes/edges/overlays changes

  /**
   * Auto-save GraphLayout when nodes move (debounced)
   */
  useEffect(() => {
    // Don't save during loading or reloading
    if (isLoadingRef.current || isReloadingRef.current || !hasInitializedRef.current || !vscodeApi || !fileUri) {
      return;
    }

    // Debounce layout saves
    const timer = setTimeout(() => {
      saveGraphLayout();
    }, 500);

    return () => clearTimeout(timer);
  }, [nodes, saveGraphLayout, fileUri, vscodeApi]);

  /**
   * Handle node changes
   */
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    onNodesChange(changes);

    // Clean up orphaned edges when nodes are removed
    const removedNodeIds = changes
      .filter(change => change.type === 'remove')
      .map(change => change.id);

    if (removedNodeIds.length > 0) {
      setEdges(currentEdges =>
        currentEdges.filter(edge =>
          !removedNodeIds.includes(edge.source) &&
          !removedNodeIds.includes(edge.target)
        )
      );
    }
  }, [onNodesChange, setEdges]);

  /**
   * Handle edge changes
   */
  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    onEdgesChange(changes);
  }, [onEdgesChange]);

  /**
   * Handle new connections
   */
  const onConnect: OnConnect = useCallback((params) => {
    setEdges((eds) => addReactFlowEdge({
      ...params,
      type: 'smoothstep',
      animated: false,
      style: { stroke: '#3b82f6', strokeWidth: 3 }
    }, eds));
    // Auto-save will trigger from useEffect watching edges
  }, [setEdges]);

  /**
   * Add functoid node at specific position
   */
  const addFunctoidNode = useCallback((kind: string, label: string, icon: string, category: string, position?: { x: number; y: number }) => {
    const newNode: Node = {
      id: `functoid-${Date.now()}`,
      type: 'functoid',
      position: position || getDefaultNodePosition(nodes),
      data: {
        label,
        icon,
        category,
        kind
      }
    };
    setNodes((nds) => [...nds, newNode]);
    // Auto-save will trigger from useEffect watching nodes
  }, [nodes, setNodes]);

  /**
   * Handle drop from functoid palette
   */
  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();

    const type = event.dataTransfer.getData('application/reactflow');

    // Only handle functoid drops
    if (type !== 'functoid') {
      return;
    }

    // Get functoid data from drag event
    const kind = event.dataTransfer.getData('functoid/kind');
    const label = event.dataTransfer.getData('functoid/label');
    const icon = event.dataTransfer.getData('functoid/icon');
    const category = event.dataTransfer.getData('functoid/category');

    // Convert screen position to flow position (accounts for zoom and pan)
    const position = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY
    });

    // Add the functoid at the drop position
    addFunctoidNode(kind, label, icon, category, position);
  }, [addFunctoidNode, screenToFlowPosition]);

  /**
   * Handle drag over to enable drop
   */
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  /**
   * Validate connection before creating edge
   */
  const isValidConnection = useCallback((connection: any) => {
    // Find source and target nodes
    const sourceNode = nodes.find(n => n.id === connection.source);
    const targetNode = nodes.find(n => n.id === connection.target);

    if (!sourceNode || !targetNode) {
      return false;
    }

    const result = validateEdgeConnection(
      sourceNode,
      connection.sourceHandle,
      targetNode,
      connection.targetHandle,
      edges
    );

    // Log validation result for debugging
    if (!result.valid) {
      console.log('Connection invalid:', result.reason);
    }

    return result.valid;
  }, [nodes, edges]);

  /**
   * Handle node selection
   */
  const handleNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    // Only open config panel for functoid nodes
    if (node.type === 'functoid') {
      setSelectedFunctoid({
        id: node.id,
        kind: node.data.kind as string,
        config: node.data.config || {}
      });
    } else {
      // Close config panel when selecting non-functoid nodes
      setSelectedFunctoid(null);
    }
  }, []);

  /**
   * Handle functoid config changes
   */
  const handleConfigChange = useCallback((nodeId: string, newConfig: Record<string, any>) => {
    // Update node data with new config
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              config: newConfig
            }
          };
        }
        return node;
      })
    );

    // Update selected functoid state
    setSelectedFunctoid((prev) =>
      prev && prev.id === nodeId
        ? { ...prev, config: newConfig }
        : prev
    );
    // Auto-save will trigger from useEffect watching nodes
  }, [setNodes]);

  /**
   * Handle schema inference
   */
  const handleOpenInference = useCallback((side: 'source' | 'target') => {
    setInferenceDialogSide(side);
    setInferenceDialogOpen(true);
  }, []);

  /**
   * Request auto-layout from extension
   */
  const handleAutoLayout = useCallback(() => {
    if (!vscodeApi) {
      return;
    }

    // Get current viewport transform
    const _viewport = getViewport();

    // Collect measured node sizes from React Flow
    const sizeMap: Record<string, { width: number; height: number }> = {};
    const positionMap: Record<string, { x: number; y: number }> = {};
    const handlePositionsMap: Record<string, Record<string, number>> = {};

    for (const node of nodes) {
      if (node.measured?.width && node.measured?.height) {
        sizeMap[node.id] = {
          width: node.measured.width,
          height: node.measured.height
        };
      } else if (node.width && node.height) {
        sizeMap[node.id] = {
          width: node.width,
          height: node.height
        };
      }

      // Collect current positions
      positionMap[node.id] = {
        x: node.position.x,
        y: node.position.y
      };

      // Collect handle positions for schema nodes
      if (node.type === 'schema') {
        const handlePositions: Record<string, number> = {};

        // Query all handles in this node
        const nodeElement = document.querySelector(`[data-id="${node.id}"]`);
        if (nodeElement) {
          const handles = nodeElement.querySelectorAll('.react-flow__handle');
          handles.forEach((handleEl) => {
            const handleId = handleEl.getAttribute('data-handleid');
            if (handleId) {
              const rect = handleEl.getBoundingClientRect();

              // Convert screen coordinates to flow coordinates
              const handleCenterScreenY = rect.top + rect.height / 2;

              // Use screenToFlowPosition to get flow coordinates
              const flowPosition = screenToFlowPosition({
                x: rect.left + rect.width / 2,
                y: handleCenterScreenY
              });

              handlePositions[handleId] = flowPosition.y;
            }
          });
        }

        handlePositionsMap[node.id] = handlePositions;
      }
    }

    vscodeApi.postMessage({
      type: 'autoLayout',
      nodeSizes: sizeMap,
      currentPositions: positionMap,
      handlePositions: handlePositionsMap
    });
  }, [nodes, vscodeApi, getViewport, screenToFlowPosition]);

  const handleSchemaInferred = useCallback((schema: JSONSchema | any, side: 'source' | 'target') => {
    // Check if this is a file reference
    if (schema && typeof schema === 'object' && '__fileReference' in schema) {
      // Request the extension to load the schema file
      if (vscodeApi) {
        vscodeApi.postMessage({
          type: 'loadSchema',
          path: schema.path,
          side
        });
      }
      return;
    }

    // Get current schemas from mapSpec (not stale state)
    const currentSourceSchema = mapSpec?.schemas.sourceSchema || sourceSchema;
    const currentTargetSchema = mapSpec?.schemas.targetSchema || targetSchema;

    // Update schema state
    const newSourceSchema = side === 'source' ? schema : currentSourceSchema;
    const newTargetSchema = side === 'target' ? schema : currentTargetSchema;

    setSourceSchema(newSourceSchema);
    setTargetSchema(newTargetSchema);

    // Update MapSpec with new schema reference AND embedded schema
    const updatedMapSpec: MapSpec = mapSpec ? {
      ...mapSpec,
      schemas: {
        source: side === 'source' ? 'custom' : mapSpec.schemas.source,
        target: side === 'target' ? 'custom' : mapSpec.schemas.target,
        sourceSchema: newSourceSchema || undefined,
        targetSchema: newTargetSchema || undefined
      },
      nodes: nodes.filter(n => n.type === 'functoid').map(n => reactFlowToMapSpecNode(n)!),
      edges: edges.map(e => reactFlowToMapSpecEdge(e))
    } : {
      version: '1.0',
      metadata: {
        name: 'New Mapper',
        description: '',
        version: '1.0.0',
        source: 'Source Schema',
        target: 'Target Schema',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      schemas: {
        source: side === 'source' ? 'custom' : 'none',
        target: side === 'target' ? 'custom' : 'none',
        sourceSchema: newSourceSchema || undefined,
        targetSchema: newTargetSchema || undefined
      },
      nodes: [],
      edges: []
    };

    // Rebuild schema nodes with new schema
    const { nodes: rfNodes, edges: rfEdges } = mapSpecToReactFlow(
      updatedMapSpec,
      newSourceSchema || { type: 'object', properties: {} },
      newTargetSchema || { type: 'object', properties: {} },
      schemaOverlays
    );

    setMapSpec(updatedMapSpec);
    setNodes(rfNodes);
    setEdges(rfEdges);
    // Auto-save will trigger from useEffect watching nodes/edges
  }, [mapSpec, nodes, edges, sourceSchema, targetSchema, schemaOverlays, setNodes, setEdges, vscodeApi]);

  return (
    <div className="mapper-canvas-container">
      {/* Functoid Palette Sidebar */}
      <FunctoidPalette />

      {/* Main Canvas Area */}
      <div className="mapper-main-area">
        {/* Toolbar */}
        <div className="mapper-toolbar">
          <button
            onClick={() => handleOpenInference('source')}
            className="toolbar-button toolbar-button-secondary"
            title="Import source schema from JSON"
          >
            <Upload size={16} />
            <span>Import Source</span>
          </button>
          <button
            onClick={() => handleOpenInference('target')}
            className="toolbar-button toolbar-button-secondary"
            title="Import target schema from JSON"
          >
            <Download size={16} />
            <span>Import Target</span>
          </button>

          <span className="toolbar-divider" />

          <button
            onClick={saveMapSpec}
            className="toolbar-button toolbar-button-neutral"
            title="Save mapper"
          >
            <Save size={16} />
            <span>Save</span>
          </button>

          <span className="toolbar-divider" />

          <button
            onClick={handleAutoLayout}
            className="toolbar-button toolbar-button-neutral"
            title="Automatically arrange nodes in a clean layout"
            disabled={!mapSpec || nodes.length === 0}
          >
            <LayoutGrid size={16} />
            <span>Auto Layout</span>
          </button>

          <span className="toolbar-divider" />

          <button
            onClick={() => setPreviewPanelOpen(true)}
            className="toolbar-button toolbar-button-primary"
            title="Test mapper execution with sample data"
            disabled={!mapSpec || edges.length === 0}
          >
            <Play size={16} />
            <span>Test & Execute</span>
          </button>

          <span className="toolbar-divider" />

          <span className="toolbar-info">
            <Info size={14} />
            <span>Nodes: {nodes.length} | Edges: {edges.length}</span>
          </span>
        </div>

        {/* React Flow Canvas */}
        <div className="mapper-flow">
          <HighlightContext.Provider
            value={{
              highlightedNodes,
              highlightedEdges,
              highlightedSourceHandles,
              onTargetHandleHover: handleTargetHandleHover,
              onTargetHandleHoverEnd: handleTargetHandleHoverEnd
            }}
          >
            <ReactFlow
              nodes={nodes}
              edges={redirectedEdges}
              onNodesChange={handleNodesChange}
              onEdgesChange={handleEdgesChange}
              onConnect={onConnect}
              onNodeClick={handleNodeClick}
              onDrop={onDrop}
              onDragOver={onDragOver}
              isValidConnection={isValidConnection}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              minZoom={0.1}
              maxZoom={2}
              panOnDrag
              zoomOnScroll
            >
              <Background variant="dots" gap={16} size={1} color="#cbd5e1" />
            </ReactFlow>
          </HighlightContext.Provider>
        </div>
      </div>

      {/* Functoid Config Panel */}
      {selectedFunctoid && (
        <FunctoidConfigPanel
          nodeId={selectedFunctoid.id}
          nodeKind={selectedFunctoid.kind as NodeKind}
          config={selectedFunctoid.config}
          onConfigChange={handleConfigChange}
          onClose={() => setSelectedFunctoid(null)}
        />
      )}

      {/* Schema Inference Dialog */}
      <SchemaInferenceDialog
        isOpen={inferenceDialogOpen}
        onClose={() => setInferenceDialogOpen(false)}
        onSchemaInferred={handleSchemaInferred}
        side={inferenceDialogSide}
        vscodeApi={vscodeApi}
      />

      {/* Execution Preview Panel */}
      {previewPanelOpen && mapSpec && (
        <ExecutionPreviewPanel
          isOpen={previewPanelOpen}
          onClose={() => setPreviewPanelOpen(false)}
          mapSpec={mapSpec}
        />
      )}
    </div>
  );
}

export function MapperCanvas() {
  return (
    <ReactFlowProvider>
      <MapperCanvasInner />
    </ReactFlowProvider>
  );
}
