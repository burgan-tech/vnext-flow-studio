/**
 * Core Graph implementation with Map-based directed multigraph
 */

import type {
  Graph,
  GraphNode,
  GraphEdge,
  ComponentId,
  ComponentRef
} from '../types/index.js';
import { toComponentId } from '../types/index.js';

/**
 * Create a new empty graph
 */
export function createGraph(metadata?: Graph['metadata']): Graph {
  return {
    nodes: new Map(),
    outgoingEdges: new Map(),
    incomingEdges: new Map(),
    metadata
  };
}

/**
 * Add a node to the graph
 */
export function addNode(graph: Graph, node: GraphNode): void {
  graph.nodes.set(node.id, node);

  // Initialize edge arrays if not present
  if (!graph.outgoingEdges.has(node.id)) {
    graph.outgoingEdges.set(node.id, []);
  }
  if (!graph.incomingEdges.has(node.id)) {
    graph.incomingEdges.set(node.id, []);
  }
}

/**
 * Add an edge to the graph
 */
export function addEdge(graph: Graph, edge: GraphEdge): void {
  // Ensure nodes exist
  if (!graph.nodes.has(edge.from)) {
    throw new Error(`Cannot add edge: source node ${edge.from} does not exist`);
  }
  if (!graph.nodes.has(edge.to)) {
    throw new Error(`Cannot add edge: target node ${edge.to} does not exist`);
  }

  // Add to outgoing edges
  const outgoing = graph.outgoingEdges.get(edge.from) || [];
  outgoing.push(edge);
  graph.outgoingEdges.set(edge.from, outgoing);

  // Add to incoming edges
  const incoming = graph.incomingEdges.get(edge.to) || [];
  incoming.push(edge);
  graph.incomingEdges.set(edge.to, incoming);
}

/**
 * Get a node by ID
 */
export function getNode(graph: Graph, id: ComponentId): GraphNode | undefined {
  return graph.nodes.get(id);
}

/**
 * Check if a node exists
 */
export function hasNode(graph: Graph, id: ComponentId): boolean {
  return graph.nodes.has(id);
}

/**
 * Get all outgoing edges from a node
 */
export function getOutgoingEdges(graph: Graph, id: ComponentId): GraphEdge[] {
  return graph.outgoingEdges.get(id) || [];
}

/**
 * Get all incoming edges to a node
 */
export function getIncomingEdges(graph: Graph, id: ComponentId): GraphEdge[] {
  return graph.incomingEdges.get(id) || [];
}

/**
 * Get all dependencies of a node (nodes it depends on)
 */
export function getDependencies(graph: Graph, id: ComponentId): GraphNode[] {
  const edges = getOutgoingEdges(graph, id);
  return edges
    .map(edge => getNode(graph, edge.to))
    .filter((node): node is GraphNode => node !== undefined);
}

/**
 * Get all dependents of a node (nodes that depend on it)
 */
export function getDependents(graph: Graph, id: ComponentId): GraphNode[] {
  const edges = getIncomingEdges(graph, id);
  return edges
    .map(edge => getNode(graph, edge.from))
    .filter((node): node is GraphNode => node !== undefined);
}

/**
 * Get all nodes in the graph
 */
export function getAllNodes(graph: Graph): GraphNode[] {
  return Array.from(graph.nodes.values());
}

/**
 * Get all edges in the graph
 */
export function getAllEdges(graph: Graph): GraphEdge[] {
  const edges: GraphEdge[] = [];
  for (const edgeList of graph.outgoingEdges.values()) {
    edges.push(...edgeList);
  }
  return edges;
}

/**
 * Find nodes by component reference (without version)
 */
export function findNodesByRef(
  graph: Graph,
  ref: Omit<ComponentRef, 'version'>
): GraphNode[] {
  const prefix = `${ref.domain}/${ref.flow}/${ref.key}@`;
  return Array.from(graph.nodes.values()).filter(node =>
    node.id.startsWith(prefix)
  );
}

/**
 * Get graph statistics
 */
export function getGraphStats(graph: Graph): {
  nodeCount: number;
  edgeCount: number;
  nodesByType: Record<string, number>;
  nodesBySource: Record<string, number>;
} {
  const nodes = getAllNodes(graph);
  const edges = getAllEdges(graph);

  const nodesByType: Record<string, number> = {};
  const nodesBySource: Record<string, number> = {};

  for (const node of nodes) {
    nodesByType[node.type] = (nodesByType[node.type] || 0) + 1;
    nodesBySource[node.source] = (nodesBySource[node.source] || 0) + 1;
  }

  return {
    nodeCount: nodes.length,
    edgeCount: edges.length,
    nodesByType,
    nodesBySource
  };
}

/**
 * Merge two graphs (useful for combining local and runtime graphs)
 */
export function mergeGraphs(target: Graph, source: Graph): void {
  // Add all nodes from source
  for (const node of source.nodes.values()) {
    if (!target.nodes.has(node.id)) {
      addNode(target, node);
    }
  }

  // Add all edges from source
  for (const edges of source.outgoingEdges.values()) {
    for (const edge of edges) {
      // Check if edge already exists
      const existingEdges = target.outgoingEdges.get(edge.from) || [];
      const isDuplicate = existingEdges.some(
        e => e.from === edge.from && e.to === edge.to && e.type === edge.type
      );
      if (!isDuplicate) {
        addEdge(target, edge);
      }
    }
  }
}

/**
 * Clone a graph
 */
export function cloneGraph(graph: Graph): Graph {
  const cloned = createGraph({ ...graph.metadata });

  // Clone nodes
  for (const node of graph.nodes.values()) {
    addNode(cloned, { ...node });
  }

  // Clone edges
  for (const edges of graph.outgoingEdges.values()) {
    for (const edge of edges) {
      addEdge(cloned, { ...edge });
    }
  }

  return cloned;
}

/**
 * Serialize graph to JSON
 */
export function serializeGraph(graph: Graph): string {
  return JSON.stringify(
    {
      nodes: Array.from(graph.nodes.entries()),
      outgoingEdges: Array.from(graph.outgoingEdges.entries()),
      incomingEdges: Array.from(graph.incomingEdges.entries()),
      metadata: graph.metadata
    },
    null,
    2
  );
}

/**
 * Deserialize graph from JSON
 */
export function deserializeGraph(json: string): Graph {
  const data = JSON.parse(json);

  const graph: Graph = {
    nodes: new Map(data.nodes),
    outgoingEdges: new Map(data.outgoingEdges),
    incomingEdges: new Map(data.incomingEdges),
    metadata: data.metadata
  };

  return graph;
}

/**
 * Get all transitive dependencies of a node (recursive)
 * Returns nodes in dependency order (dependencies first)
 */
export function getTransitiveDependencies(
  graph: Graph,
  id: ComponentId,
  visited: Set<ComponentId> = new Set()
): GraphNode[] {
  // Avoid cycles
  if (visited.has(id)) {
    return [];
  }
  visited.add(id);

  const node = getNode(graph, id);
  if (!node) {
    return [];
  }

  const result: GraphNode[] = [];
  const directDeps = getDependencies(graph, id);

  // Recursively get dependencies
  for (const dep of directDeps) {
    const transitiveDeps = getTransitiveDependencies(graph, dep.id, visited);
    for (const transDep of transitiveDeps) {
      if (!result.some(n => n.id === transDep.id)) {
        result.push(transDep);
      }
    }
    // Add the direct dependency after its dependencies
    if (!result.some(n => n.id === dep.id)) {
      result.push(dep);
    }
  }

  return result;
}

/**
 * Get deployment order for a set of nodes (topological sort)
 * Returns nodes in order where dependencies come before dependents
 */
export function getDeploymentOrder(
  graph: Graph,
  nodeIds: ComponentId[]
): GraphNode[] {
  const result: GraphNode[] = [];
  const visited = new Set<ComponentId>();
  const visiting = new Set<ComponentId>();

  function visit(id: ComponentId): void {
    if (visited.has(id)) {
      return;
    }
    if (visiting.has(id)) {
      // Cycle detected - skip for now
      return;
    }

    visiting.add(id);

    // Visit dependencies first (only within the set of nodes to deploy)
    const deps = getDependencies(graph, id);
    for (const dep of deps) {
      if (nodeIds.includes(dep.id)) {
        visit(dep.id);
      }
    }

    visiting.delete(id);
    visited.add(id);

    const node = getNode(graph, id);
    if (node) {
      result.push(node);
    }
  }

  for (const id of nodeIds) {
    visit(id);
  }

  return result;
}
