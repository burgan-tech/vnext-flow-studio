/**
 * Mapper Auto-Layout using ELK
 *
 * Arranges mapper nodes in a clean left-to-right flow:
 * - Source schema on the left
 * - Functoids in the middle (layered by data flow depth)
 * - Target schema on the right
 */

import ELK from 'elkjs/lib/elk.bundled.js';
import type { MapSpec, GraphLayout } from './types';

export interface MapperAutoLayoutOptions {
  startX?: number;
  startY?: number;
  columnSpacing?: number;
  rowSpacing?: number;
  // Optional measured sizes from the webview (React Flow v12)
  nodeSizes?: Record<string, { width: number; height: number }>;
  // Current node positions (to keep schema nodes fixed)
  currentPositions?: Record<string, { x: number; y: number }>;
  // Handle positions (absolute Y coordinates for each handle)
  handlePositions?: Record<string, Record<string, number>>; // nodeId -> handleId -> absoluteY
}

const _DEFAULT_START_X = 50;
const _DEFAULT_START_Y = 50;
const DEFAULT_COLUMN_SPACING = 80;
const _DEFAULT_ROW_SPACING = 40;

// Default node sizes
const SCHEMA_NODE_SIZE = { width: 300, height: 400 };
const FUNCTOID_NODE_SIZE = { width: 120, height: 80 };

const _elk = new ELK();

const _BASE_LAYOUT_OPTIONS: Record<string, string> = {
  'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT',
  'elk.edgeRouting': 'ORTHOGONAL',
  'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
  'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
  'elk.layered.spacing.baseValue': '30',
  'elk.layered.spacing.edgeNodeBetweenLayers': '20',
  'elk.layered.compaction.connectedComponents': 'true',
  'elk.layered.mergeEdges': 'false',
  'elk.spacing.edgeNode': '20',
  'elk.spacing.edgeEdge': '15',
  'elk.spacing.portPort': '10',
  'elk.layered.thoroughness': '100',
  'elk.layered.spacing.edgeSpacingFactor': '1.5'
};

interface _ElkChild {
  id: string;
  width: number;
  height: number;
  properties?: Record<string, string>;
}

interface _ElkEdge {
  id: string;
  sources: string[];
  targets: string[];
}

/**
 * Auto-layout a mapper
 * Keeps schema nodes fixed and positions functoids based on connected handles
 */
export async function autoLayoutMapper(
  mapSpec: MapSpec,
  options: MapperAutoLayoutOptions = {}
): Promise<GraphLayout> {
  const currentPositions = options.currentPositions ?? {};
  const nodeSizes = options.nodeSizes ?? {};
  const _columnSpacing = options.columnSpacing ?? DEFAULT_COLUMN_SPACING;

  // Get schema positions (keep them fixed)
  const sourceSchemaPos = currentPositions['source-schema'] ?? { x: 50, y: 50 };
  const targetSchemaPos = currentPositions['target-schema'] ?? { x: 800, y: 50 };

  const sourceSchemaSize = nodeSizes['source-schema'] ?? SCHEMA_NODE_SIZE;
  const targetSchemaSize = nodeSizes['target-schema'] ?? SCHEMA_NODE_SIZE;

  // Calculate functoid positions based on connected handles
  const nodeLayouts: Array<{
    id: string;
    position: { x: number; y: number };
    dimensions: { width: number; height: number };
  }> = [];

  // Add schema nodes (keep positions fixed)
  nodeLayouts.push({
    id: 'source-schema',
    position: sourceSchemaPos,
    dimensions: sourceSchemaSize
  });

  nodeLayouts.push({
    id: 'target-schema',
    position: targetSchemaPos,
    dimensions: targetSchemaSize
  });

  // Calculate depth for each functoid (distance from source schema)
  const depths = new Map<string, number>();
  const calculateDepth = (nodeId: string, visited = new Set<string>()): number => {
    if (nodeId === 'source-schema') return 0;
    if (nodeId === 'target-schema') return Infinity;
    if (depths.has(nodeId)) return depths.get(nodeId)!;
    if (visited.has(nodeId)) return 0; // Circular reference

    visited.add(nodeId);

    // Find input edges
    const inputEdges = mapSpec.edges.filter(e => e.target === nodeId);
    if (inputEdges.length === 0) return 1; // No inputs, assume depth 1

    const inputDepths = inputEdges.map(e => calculateDepth(e.source, visited));
    const maxDepth = Math.max(...inputDepths);
    const depth = maxDepth === Infinity ? 1 : maxDepth + 1;

    depths.set(nodeId, depth);
    return depth;
  };

  // Calculate depths for all functoids
  for (const node of mapSpec.nodes) {
    calculateDepth(node.id);
  }

  // Find max depth
  const maxDepth = Math.max(...Array.from(depths.values()), 1);

  // Group functoids by depth
  const nodesByDepth = new Map<number, typeof mapSpec.nodes>();
  for (const node of mapSpec.nodes) {
    const depth = depths.get(node.id) ?? 1;
    if (!nodesByDepth.has(depth)) {
      nodesByDepth.set(depth, []);
    }
    nodesByDepth.get(depth)!.push(node);
  }

  // Position functoids layer by layer
  for (const [depth, nodesInLayer] of nodesByDepth.entries()) {
    // Calculate X position for this layer
    const totalWidth = targetSchemaPos.x - (sourceSchemaPos.x + sourceSchemaSize.width);
    const layerWidth = totalWidth / (maxDepth + 1);
    const x = sourceSchemaPos.x + sourceSchemaSize.width + (depth * layerWidth);

    // Calculate ideal Y positions based on connections
    const nodePositions: Array<{ node: typeof mapSpec.nodes[0]; idealY: number; size: { width: number; height: number } }> = [];

    for (const node of nodesInLayer) {
      const nodeSize = nodeSizes[node.id] ?? FUNCTOID_NODE_SIZE;
      let idealY = sourceSchemaPos.y; // Default

      // Find connected edges
      const inputEdges = mapSpec.edges.filter(e => e.target === node.id);
      const outputEdges = mapSpec.edges.filter(e => e.source === node.id);
      const allEdges = [...inputEdges, ...outputEdges];

      if (allEdges.length > 0) {
        // Calculate Y position based on actual handle positions
        const handlePositions = options.handlePositions ?? {};
        let totalY = 0;
        let count = 0;

        for (const edge of allEdges) {
          if (edge.source === 'source-schema' && edge.sourceHandle) {
            const handleY = handlePositions['source-schema']?.[edge.sourceHandle];
            if (handleY !== undefined) {
              totalY += handleY;
              count++;
            }
          } else if (edge.target === 'target-schema' && edge.targetHandle) {
            const handleY = handlePositions['target-schema']?.[edge.targetHandle];
            if (handleY !== undefined) {
              totalY += handleY;
              count++;
            }
          } else if (edge.source !== 'source-schema' && edge.source !== 'target-schema') {
            // Connected to another functoid in previous layer
            const sourceLayout = nodeLayouts.find(n => n.id === edge.source);
            if (sourceLayout) {
              totalY += sourceLayout.position.y + (sourceLayout.dimensions.height / 2);
              count++;
            }
          }
        }

        if (count > 0) {
          idealY = totalY / count - (nodeSize.height / 2); // Center on average
        }
      }

      nodePositions.push({ node, idealY, size: nodeSize });
    }

    // Sort by ideal Y position
    nodePositions.sort((a, b) => a.idealY - b.idealY);

    // Adjust positions to prevent overlaps
    const minSpacing = 20; // Minimum vertical spacing between nodes
    const adjustedPositions = nodePositions.map(np => ({ ...np, finalY: np.idealY }));

    // Resolve overlaps by pushing nodes down
    for (let i = 1; i < adjustedPositions.length; i++) {
      const prev = adjustedPositions[i - 1];
      const current = adjustedPositions[i];

      const prevBottom = prev.finalY + prev.size.height;
      const minY = prevBottom + minSpacing;

      if (current.finalY < minY) {
        current.finalY = minY;
      }
    }

    // Add positioned nodes to layout
    for (const { node, finalY, size } of adjustedPositions) {
      nodeLayouts.push({
        id: node.id,
        position: { x, y: finalY },
        dimensions: size
      });
    }
  }

  return {
    version: '1.0',
    mapperFile: mapSpec.metadata.name + '.mapper.json',
    viewport: {
      x: 0,
      y: 0,
      zoom: 1
    },
    nodes: nodeLayouts,
    metadata: {
      layoutAlgorithm: 'auto',
      theme: 'light'
    }
  };
}
