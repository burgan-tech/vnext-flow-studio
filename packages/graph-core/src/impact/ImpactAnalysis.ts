/**
 * Impact analysis - compute impact cone of changes using reverse BFS
 */

import type { Graph, ComponentId, GraphNode } from '../types/index.js';
import { getIncomingEdges, getNode } from '../graph/Graph.js';
import { parseComponentId } from '../types/index.js';

/**
 * Impact cone result
 */
export interface ImpactCone {
  /** Starting component IDs */
  startIds: ComponentId[];

  /** All affected components (including start nodes) */
  affectedComponents: GraphNode[];

  /** Dependency paths showing how components are affected */
  dependencyPaths: DependencyPath[];

  /** Statistics */
  stats: {
    totalAffected: number;
    byType: Record<string, number>;
    maxDepth: number;
  };
}

/**
 * Dependency path showing how one component depends on another
 */
export interface DependencyPath {
  /** Component that is affected */
  target: ComponentId;

  /** Path from target back to one of the start nodes */
  path: ComponentId[];

  /** Depth (distance from start node) */
  depth: number;

  /** Human-readable path string */
  pathString: string;
}

/**
 * Options for impact analysis
 */
export interface ImpactAnalysisOptions {
  /** Maximum depth to traverse (default: unlimited) */
  maxDepth?: number;

  /** Component types to include (default: all) */
  includeTypes?: string[];

  /** Whether to include dependency paths (default: true) */
  includePaths?: boolean;
}

/**
 * Compute impact cone - find all components affected by changes to startIds
 * Uses reverse BFS traversal (following incoming edges)
 */
export function impactCone(
  graph: Graph,
  startIds: ComponentId[],
  options?: ImpactAnalysisOptions
): ImpactCone {
  const {
    maxDepth,
    includeTypes,
    includePaths = true
  } = options || {};

  // Track visited nodes
  const visited = new Set<ComponentId>();
  const affectedNodes: GraphNode[] = [];
  const dependencyPaths: DependencyPath[] = [];

  // BFS queue: [nodeId, path, depth]
  const queue: Array<[ComponentId, ComponentId[], number]> = [];

  // Initialize queue with start nodes
  for (const startId of startIds) {
    const node = getNode(graph, startId);
    if (node) {
      queue.push([startId, [startId], 0]);
      visited.add(startId);
    }
  }

  let maxReachedDepth = 0;

  // BFS traversal
  while (queue.length > 0) {
    const [currentId, path, depth] = queue.shift()!;

    // Skip if we've reached max depth
    if (maxDepth !== undefined && depth > maxDepth) {
      continue;
    }

    maxReachedDepth = Math.max(maxReachedDepth, depth);

    const currentNode = getNode(graph, currentId);
    if (!currentNode) {
      continue;
    }

    // Check if this node type should be included
    if (includeTypes && !includeTypes.includes(currentNode.type)) {
      continue;
    }

    // Add to affected nodes if not already added
    if (!affectedNodes.some(n => n.id === currentId)) {
      affectedNodes.push(currentNode);
    }

    // Add dependency path if requested and not a start node
    if (includePaths && depth > 0) {
      const ref = parseComponentId(currentId);
      if (ref) {
        const pathString = path
          .map(id => {
            const r = parseComponentId(id);
            return r ? `${r.key}@${r.version}` : id;
          })
          .join(' → ');

        dependencyPaths.push({
          target: currentId,
          path: [...path],
          depth,
          pathString
        });
      }
    }

    // Get all dependents (nodes that depend on current node)
    const incomingEdges = getIncomingEdges(graph, currentId);

    for (const edge of incomingEdges) {
      if (!visited.has(edge.from)) {
        visited.add(edge.from);
        queue.push([edge.from, [...path, edge.from], depth + 1]);
      }
    }
  }

  // Calculate statistics
  const byType: Record<string, number> = {};
  for (const node of affectedNodes) {
    byType[node.type] = (byType[node.type] || 0) + 1;
  }

  return {
    startIds,
    affectedComponents: affectedNodes,
    dependencyPaths,
    stats: {
      totalAffected: affectedNodes.length,
      byType,
      maxDepth: maxReachedDepth
    }
  };
}

/**
 * Get direct dependents of a component (one level only)
 */
export function getDirectDependents(
  graph: Graph,
  componentId: ComponentId
): GraphNode[] {
  const dependents: GraphNode[] = [];
  const incomingEdges = getIncomingEdges(graph, componentId);

  for (const edge of incomingEdges) {
    const node = getNode(graph, edge.from);
    if (node) {
      dependents.push(node);
    }
  }

  return dependents;
}

/**
 * Get all dependents recursively (unlimited depth)
 */
export function getAllDependents(
  graph: Graph,
  componentId: ComponentId
): GraphNode[] {
  const cone = impactCone(graph, [componentId], { includePaths: false });
  // Remove the start node itself
  return cone.affectedComponents.filter(n => n.id !== componentId);
}

/**
 * Find critical components (components with many dependents)
 */
export function findCriticalComponents(
  graph: Graph,
  threshold: number = 5
): Array<{ node: GraphNode; dependentCount: number }> {
  const criticalComponents: Array<{ node: GraphNode; dependentCount: number }> = [];

  for (const node of graph.nodes.values()) {
    const dependents = getDirectDependents(graph, node.id);

    if (dependents.length >= threshold) {
      criticalComponents.push({
        node,
        dependentCount: dependents.length
      });
    }
  }

  // Sort by dependent count (descending)
  criticalComponents.sort((a, b) => b.dependentCount - a.dependentCount);

  return criticalComponents;
}

/**
 * Estimate deployment risk based on impact cone size
 */
export function estimateDeploymentRisk(
  graph: Graph,
  componentIds: ComponentId[]
): {
  risk: 'low' | 'medium' | 'high' | 'critical';
  affectedCount: number;
  reason: string;
} {
  const cone = impactCone(graph, componentIds);
  const affectedCount = cone.affectedComponents.length;

  // Define risk thresholds
  if (affectedCount <= 5) {
    return {
      risk: 'low',
      affectedCount,
      reason: `Only ${affectedCount} component(s) affected`
    };
  } else if (affectedCount <= 15) {
    return {
      risk: 'medium',
      affectedCount,
      reason: `${affectedCount} components affected`
    };
  } else if (affectedCount <= 30) {
    return {
      risk: 'high',
      affectedCount,
      reason: `${affectedCount} components affected - significant impact`
    };
  } else {
    return {
      risk: 'critical',
      affectedCount,
      reason: `${affectedCount} components affected - very high impact`
    };
  }
}

/**
 * Find shortest dependency path between two components
 */
export function findShortestPath(
  graph: Graph,
  fromId: ComponentId,
  toId: ComponentId
): ComponentId[] | null {
  // BFS to find shortest path
  const queue: Array<[ComponentId, ComponentId[]]> = [[fromId, [fromId]]];
  const visited = new Set<ComponentId>();
  visited.add(fromId);

  while (queue.length > 0) {
    const [currentId, path] = queue.shift()!;

    // Check if we reached the target
    if (currentId === toId) {
      return path;
    }

    // Explore outgoing edges (dependencies)
    const edges = getIncomingEdges(graph, currentId);
    for (const edge of edges) {
      if (!visited.has(edge.from)) {
        visited.add(edge.from);
        queue.push([edge.from, [...path, edge.from]]);
      }
    }
  }

  return null; // No path found
}
