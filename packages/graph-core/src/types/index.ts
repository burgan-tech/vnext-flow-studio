/**
 * Core type definitions for the graph system
 */

/**
 * Component types supported by the system
 */
export type ComponentType = 'task' | 'schema' | 'view' | 'function' | 'extension' | 'workflow';

/**
 * Component reference with domain, flow, key, and version
 */
export interface ComponentRef {
  domain: string;
  flow: string;
  key: string;
  version: string;
}

/**
 * Normalized component identifier
 */
export type ComponentId = string; // Format: ${domain}/${flow}/${key}@${version}

/**
 * Graph node representing a component
 */
export interface GraphNode {
  /** Unique identifier: ${domain}/${flow}/${key}@${version} */
  id: ComponentId;

  /** Component reference */
  ref: ComponentRef;

  /** Component type */
  type: ComponentType;

  /** Display label */
  label?: string;

  /** Component definition (full workflow/schema/task definition) */
  definition?: any;

  /** API hash for detecting breaking changes */
  apiHash?: string;

  /** Config hash for detecting configuration changes */
  configHash?: string;

  /** Source: local (workspace) or runtime (deployed) */
  source: 'local' | 'runtime';

  /** Tags associated with this component */
  tags?: string[];

  /** Metadata */
  metadata?: Record<string, any>;
}

/**
 * Graph edge representing a dependency
 */
export interface GraphEdge {
  /** Edge identifier */
  id: string;

  /** Source node ID */
  from: ComponentId;

  /** Target node ID */
  to: ComponentId;

  /** Dependency type */
  type: 'function' | 'extension' | 'schema' | 'workflow' | 'subflow' | 'task' | 'view';

  /** Version range constraint (e.g., "^1.0.0", ">=2.0.0") */
  versionRange?: string;

  /** Whether this is a required dependency */
  required?: boolean;

  /** Metadata */
  metadata?: Record<string, any>;
}

/**
 * Directed multigraph for component dependencies
 */
export interface Graph {
  /** All nodes indexed by ComponentId */
  nodes: Map<ComponentId, GraphNode>;

  /** Outgoing edges: from → [edges] */
  outgoingEdges: Map<ComponentId, GraphEdge[]>;

  /** Incoming edges: to → [edges] */
  incomingEdges: Map<ComponentId, GraphEdge[]>;

  /** Metadata about the graph */
  metadata?: {
    source?: 'local' | 'runtime';
    timestamp?: number;
    environmentId?: string;
    [key: string]: any;
  };
}

/**
 * Component type to deployment workflow name mapping
 * Each component type is deployed through a specific system workflow
 */
export const COMPONENT_WORKFLOWS: Record<ComponentType, string> = {
  task: 'sys-tasks',
  schema: 'sys-schemas',
  view: 'sys-views',
  function: 'sys-functions',
  extension: 'sys-extensions',
  workflow: 'sys-flows'
};

/**
 * Reverse mapping: deployment workflow name to component type
 */
export const WORKFLOW_COMPONENTS: Record<string, ComponentType> = {
  'sys-tasks': 'task',
  'sys-schemas': 'schema',
  'sys-views': 'view',
  'sys-functions': 'function',
  'sys-extensions': 'extension',
  'sys-flows': 'workflow'
};

/**
 * Helper function to create a ComponentId from a ComponentRef
 */
export function toComponentId(ref: ComponentRef): ComponentId {
  return `${ref.domain}/${ref.flow}/${ref.key}@${ref.version}`;
}

/**
 * Helper function to parse a ComponentId back to ComponentRef
 */
export function parseComponentId(id: ComponentId): ComponentRef | null {
  const match = id.match(/^([^/]+)\/([^/]+)\/([^@]+)@(.+)$/);
  if (!match) {
    return null;
  }
  return {
    domain: match[1],
    flow: match[2],
    key: match[3],
    version: match[4]
  };
}

/**
 * Helper function to create a ComponentId without version (for partial matching)
 */
export function toComponentIdWithoutVersion(ref: Omit<ComponentRef, 'version'>): string {
  return `${ref.domain}/${ref.flow}/${ref.key}`;
}
