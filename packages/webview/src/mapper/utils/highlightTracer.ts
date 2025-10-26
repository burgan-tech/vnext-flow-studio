import type { Node, Edge } from '@xyflow/react';

/**
 * Trace all upstream nodes and edges that contribute to a target handle
 *
 * @param targetNodeId - The node ID containing the target handle
 * @param targetHandleId - The handle ID on the target node
 * @param nodes - All nodes in the graph
 * @param edges - All edges in the graph
 * @returns Object containing sets of highlighted node IDs, edge IDs, and source handles
 */
export function traceUpstreamDependencies(
  targetNodeId: string,
  targetHandleId: string,
  nodes: Node[],
  edges: Edge[]
): {
  nodeIds: Set<string>;
  edgeIds: Set<string>;
  sourceHandles: Set<string>; // Format: "nodeId:handleId"
} {
  const highlightedNodeIds = new Set<string>();
  const highlightedEdgeIds = new Set<string>();
  const highlightedSourceHandles = new Set<string>();

  // Queue for BFS traversal: [nodeId, handleId]
  const queue: Array<[string, string]> = [[targetNodeId, targetHandleId]];
  const visited = new Set<string>(); // Track visited handles to avoid cycles

  while (queue.length > 0) {
    const [currentNodeId, currentHandleId] = queue.shift()!;
    const visitKey = `${currentNodeId}:${currentHandleId}`;

    if (visited.has(visitKey)) {
      continue;
    }
    visited.add(visitKey);

    // Find all edges that connect TO this handle (target side)
    const incomingEdges = edges.filter(
      edge => edge.target === currentNodeId && edge.targetHandle === currentHandleId
    );

    for (const edge of incomingEdges) {
      // Highlight this edge
      highlightedEdgeIds.add(edge.id);

      // Highlight the source node
      highlightedNodeIds.add(edge.source);

      // Highlight the source handle
      const sourceHandleKey = `${edge.source}:${edge.sourceHandle || 'default'}`;
      highlightedSourceHandles.add(sourceHandleKey);

      // Get the source node
      const sourceNode = nodes.find(n => n.id === edge.source);
      if (!sourceNode) continue;

      // If the source node is a functoid, trace back to its inputs
      if (sourceNode.type === 'functoid') {
        // Functoid nodes have multiple input handles
        // We need to find all input handles and trace back through them
        const functoidInputHandles = getFunctoidInputHandles(sourceNode, edges);

        for (const inputHandleId of functoidInputHandles) {
          queue.push([sourceNode.id, inputHandleId]);
        }
      }
      // If the source is a schema node, we've reached a leaf (source schema property)
      // No need to traverse further
    }
  }

  return {
    nodeIds: highlightedNodeIds,
    edgeIds: highlightedEdgeIds,
    sourceHandles: highlightedSourceHandles
  };
}

/**
 * Get all input handle IDs for a functoid node
 */
function getFunctoidInputHandles(functoidNode: Node, edges: Edge[]): string[] {
  // Find all edges that target this functoid node
  const targetingEdges = edges.filter(edge => edge.target === functoidNode.id);

  // Extract unique target handle IDs
  const handleIds = new Set<string>();
  for (const edge of targetingEdges) {
    if (edge.targetHandle) {
      handleIds.add(edge.targetHandle);
    }
  }

  return Array.from(handleIds);
}
