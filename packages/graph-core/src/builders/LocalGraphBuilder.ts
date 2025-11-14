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
import { ComponentResolver } from '@amorphie-flow-studio/core/model';

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

  // Directory names for each component type
  const typeDirectories: Record<ComponentType, string[]> = {
    task: ['Tasks', 'tasks', 'sys-tasks'],
    schema: ['Schemas', 'schemas', 'sys-schemas'],
    view: ['Views', 'views', 'sys-views'],
    function: ['Functions', 'functions', 'sys-functions'],
    extension: ['Extensions', 'extensions', 'sys-extensions'],
    workflow: ['Workflows', 'workflows', 'flows', 'sys-flows']
  };

  // Scan each component type directory
  for (const type of typesToProcess) {
    const dirs = typeDirectories[type];

    for (const dir of dirs) {
      const fullPath = path.join(basePath, dir);

      try {
        // Check if directory exists
        await fs.access(fullPath);

        // Scan directory for JSON files
        await scanDirectory(fullPath, async (filePath: string) => {
          // Skip diagram files
          if (filePath.includes('.diagram.json')) {
            return;
          }

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
              definition = await normalizeWorkflowReferences(definition, basePath);
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

/**
 * Recursively scan directory for files
 */
async function scanDirectory(dir: string, handler: (filePath: string) => Promise<void>): Promise<void> {
  const fs = await import('fs/promises');
  const path = await import('path');

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip node_modules and hidden directories
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
          await scanDirectory(fullPath, handler);
        }
      } else if (entry.isFile() && entry.name.endsWith('.json')) {
        await handler(fullPath);
      }
    }
  } catch {
    // Ignore errors
  }
}

/**
 * Normalize workflow definition by resolving file path references
 * Converts { "ref": "Tasks/task.json" } to { "key": "task", "domain": "...", "flow": "...", "version": "..." }
 */
async function normalizeWorkflowReferences(workflowDef: any, basePath: string): Promise<any> {
  // Deep clone to avoid mutating original
  const normalized = JSON.parse(JSON.stringify(workflowDef));

  // Create component resolver for this workflow
  const resolver = new ComponentResolver({ basePath });

  // Helper to resolve a reference object using ComponentResolver
  const resolveRef = async (refObj: any, type: 'task' | 'schema' | 'view'): Promise<any> => {
    if (!refObj || typeof refObj !== 'object') {
      return refObj;
    }

    // If it has a "ref" field with file path, use ComponentResolver to resolve it
    if (refObj.ref && typeof refObj.ref === 'string') {
      let component: any = null;

      try {
        switch (type) {
          case 'task':
            component = await resolver.resolveTask(refObj);
            break;
          case 'schema':
            component = await resolver.resolveSchema(refObj);
            break;
          case 'view':
            component = await resolver.resolveView(refObj);
            break;
        }
      } catch (error) {
        console.warn(`Failed to resolve ${type} reference: ${refObj.ref}`, error);
        return refObj;
      }

      // If resolved, return structured reference
      if (component) {
        return {
          key: component.key,
          domain: component.domain,
          flow: component.flow || (type === 'task' ? 'sys-tasks' : type === 'schema' ? 'sys-schemas' : 'sys-views'),
          version: component.version
        };
      }
    }

    return refObj;
  };

  // Resolve schema in start transition
  if (normalized.startTransition?.schema) {
    normalized.startTransition.schema = await resolveRef(normalized.startTransition.schema, 'schema');
  }

  // Resolve references in states
  if (Array.isArray(normalized.states)) {
    for (const state of normalized.states) {
      // Resolve schema
      if (state.schema) {
        state.schema = await resolveRef(state.schema, 'schema');
      }

      // Resolve view
      if (state.view) {
        state.view = await resolveRef(state.view, 'view');
      }

      // Resolve task
      if (state.task) {
        state.task = await resolveRef(state.task, 'task');
      }

      // Resolve onEntries tasks
      if (Array.isArray(state.onEntries)) {
        for (const entry of state.onEntries) {
          if (entry.task) {
            entry.task = await resolveRef(entry.task, 'task');
          }
        }
      }

      // Resolve onExits tasks
      if (Array.isArray(state.onExits)) {
        for (const exit of state.onExits) {
          if (exit.task) {
            exit.task = await resolveRef(exit.task, 'task');
          }
        }
      }

      // Resolve transition references
      if (Array.isArray(state.transitions)) {
        for (const transition of state.transitions) {
          // Resolve schema
          if (transition.schema) {
            transition.schema = await resolveRef(transition.schema, 'schema');
          }

          // Resolve view
          if (transition.view) {
            transition.view = await resolveRef(transition.view, 'view');
          }

          // Resolve onExecutionTasks
          if (Array.isArray(transition.onExecutionTasks)) {
            for (const execTask of transition.onExecutionTasks) {
              if (execTask.task) {
                execTask.task = await resolveRef(execTask.task, 'task');
              }
            }
          }
        }
      }
    }
  }

  // Resolve shared transitions
  if (Array.isArray(normalized.sharedTransitions)) {
    for (const transition of normalized.sharedTransitions) {
      if (transition.schema) {
        transition.schema = await resolveRef(transition.schema, 'schema');
      }
      if (transition.view) {
        transition.view = await resolveRef(transition.view, 'view');
      }
    }
  }

  return normalized;
}
