/**
 * Local graph builder - builds dependency graph from workspace files
 */

import type {
  Graph,
  GraphNode,
  GraphEdge,
  ComponentType,
  ComponentRef
} from '../types/index.js';
import { toComponentId } from '../types/index.js';
import { createGraph, addNode, addEdge, hasNode } from '../graph/Graph.js';
import {
  extractComponentReferences,
  computeHash,
  extractApiSignature,
  extractConfig,
  extractLabel
} from '../graph/utils.js';
import {
  ComponentResolver,
  DEFAULT_COMPONENT_SEARCH_PATHS,
  normalizeWorkflowReferences
} from '@amorphie-flow-studio/core/model';
import { scanJsonFiles } from '@amorphie-flow-studio/core';

/**
 * Options for local graph builder
 */
export interface LocalGraphBuilderOptions {
  /** Base path to scan */
  basePath: string;

  /** Whether to compute hashes for drift detection */
  computeHashes?: boolean;

  /** Component types to include (default: all) */
  includeTypes?: ComponentType[];
}

/**
 * Build a local dependency graph from workspace by scanning files directly
 */
export async function buildLocalGraph(options: LocalGraphBuilderOptions): Promise<Graph> {
  const {
    basePath,
    computeHashes = true,
    includeTypes
  } = options;

  // Create graph
  const graph = createGraph({
    source: 'local',
    timestamp: Date.now(),
    basePath
  });

  // Import fs
  const fs = await import('fs/promises');
  const path = await import('path');

  // Get component types to process
  const typesToProcess: ComponentType[] = includeTypes || [
    'task',
    'schema',
    'view',
    'function',
    'extension',
    'workflow'
  ];

  // Directory names for each component type (using shared constants from core)
  // Note: We filter out '.' from workflow paths as we want explicit directory names
  const typeDirectories: Record<ComponentType, readonly string[]> = {
    ...DEFAULT_COMPONENT_SEARCH_PATHS,
    workflow: DEFAULT_COMPONENT_SEARCH_PATHS.workflow.filter(p => p !== '.')
  };

  // Create a shared ComponentResolver for workflow normalization
  // This allows caching of component lookups across all workflows
  const resolver = new ComponentResolver({
    basePath,
    useCache: true
  });

  // Scan each component type directory
  for (const type of typesToProcess) {
    const dirs = typeDirectories[type];

    for (const dir of dirs) {
      const fullPath = path.join(basePath, dir);

      try {
        // Check if directory exists
        await fs.access(fullPath);

        // Scan directory for JSON files (excluding diagram files)
        await scanJsonFiles(fullPath, async (filePath: string) => {

          try {
            // Read and parse component
            const content = await fs.readFile(filePath, 'utf-8');
            const component = JSON.parse(content);

            // Validate basic structure
            if (!component.key || !component.domain || !component.version) {
              return;
            }

            // Create component ref
            const ref: ComponentRef = {
              domain: component.domain,
              flow: component.flow || 'sys-flows',
              key: component.key,
              version: component.version
            };

            const nodeId = toComponentId(ref);

            // Skip if already processed
            if (hasNode(graph, nodeId)) {
              return;
            }

            // Normalize definition: extract attributes if present (matching runtime format)
            // Some component files have wrapper structure with metadata, but the actual
            // definition is in the 'attributes' field
            let definition = component.attributes || component;

            // For workflows, resolve file path references to structured references
            if (type === 'workflow') {
              definition = await normalizeWorkflowReferences(definition, {
                basePath,
                resolver // Use shared resolver for caching
              });
            }

            // Compute hashes if requested
            let apiHash: string | undefined;
            let configHash: string | undefined;

            if (computeHashes) {
              const apiSignature = extractApiSignature(definition, type);
              if (apiSignature) {
                apiHash = computeHash(apiSignature);
              }

              const config = extractConfig(definition, type);
              if (config) {
                configHash = computeHash(config);
              }
            }

            // Create graph node
            const node: GraphNode = {
              id: nodeId,
              ref,
              type,
              label: extractLabel(definition), // Use normalized definition for label extraction
              definition, // Use normalized definition
              apiHash,
              configHash,
              source: 'local',
              tags: definition.tags || [], // Use normalized definition for tags
              metadata: {
                filePath
              }
            };

            addNode(graph, node);

            // Extract and process dependencies for workflows
            if (type === 'workflow') {
              const references = extractComponentReferences(definition);

              for (const { ref: depRef, type: depType } of references) {
                const targetId = toComponentId(depRef);

                // Create edge
                const edge: GraphEdge = {
                  id: `${node.id}->${targetId}`,
                  from: node.id,
                  to: targetId,
                  type: depType,
                  required: true
                };

                // Try to add edge (will fail if target doesn't exist yet)
                try {
                  if (hasNode(graph, targetId)) {
                    addEdge(graph, edge);
                  }
                } catch {
                  // Target doesn't exist yet - that's okay
                }
              }
            }
          } catch {
            // Skip invalid files
          }
        }, {
          excludePatterns: ['*.diagram.json'],
          maxDepth: undefined // Scan entire directory tree
        });
      } catch {
        // Directory doesn't exist - skip
      }
    }
  }

  // Second pass: add edges for dependencies that now exist
  for (const node of graph.nodes.values()) {
    if (node.type === 'workflow' && node.definition) {
      const references = extractComponentReferences(node.definition);

      for (const { ref: depRef, type: depType } of references) {
        const targetId = toComponentId(depRef);

        // Check if edge already exists
        const existingEdges = graph.outgoingEdges.get(node.id) || [];
        const edgeExists = existingEdges.some(e => e.to === targetId);

        if (!edgeExists && hasNode(graph, targetId)) {
          const edge: GraphEdge = {
            id: `${node.id}->${targetId}`,
            from: node.id,
            to: targetId,
            type: depType,
            required: true
          };

          try {
            addEdge(graph, edge);
          } catch {
            // Edge already exists or target missing
          }
        }
      }
    }
  }

  return graph;
}

