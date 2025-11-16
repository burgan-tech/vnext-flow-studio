/**
 * Unified reference normalization for component references
 * Handles all reference formats and provides consistent resolution
 */

import type { ComponentResolver } from './ComponentResolver.js';
import type { ComponentType } from './ComponentResolver.js';
import type { ComponentRef } from './types.js';

/**
 * Context for component reference normalization
 */
export interface ReferenceNormalizationContext {
  /**
   * Base path for file-system resolution (workspace root)
   */
  basePath: string;

  /**
   * Optional component resolver for file-system validation
   * If provided, file path references will be resolved by reading actual files
   * If not provided, heuristic parsing will be used
   */
  resolver?: ComponentResolver;

  /**
   * Whether to use strict validation (requires resolver)
   * @default false
   */
  strict?: boolean;
}

/**
 * Check if reference is already a complete structured reference
 */
function isStructuredRef(ref: any): ref is ComponentRef {
  return (
    ref &&
    typeof ref === 'object' &&
    typeof ref.key === 'string' &&
    typeof ref.domain === 'string' &&
    typeof ref.flow === 'string' &&
    typeof ref.version === 'string'
  );
}

/**
 * Check if string is a ref-style reference (domain/flow/key@version)
 */
function isRefStyleString(str: string): boolean {
  return /^([^/]+)\/([^/]+)\/([^@]+)@(.+)$/.test(str);
}

/**
 * Check if string is likely a file path reference
 */
function isFilePathString(str: string): boolean {
  return str.includes('/') && (str.endsWith('.json') || !str.includes('@'));
}

/**
 * Parse ref-style string to ComponentRef
 */
function parseRefStyleString(refString: string): ComponentRef | null {
  const match = refString.match(/^([^/]+)\/([^/]+)\/([^@]+)@(.+)$/);
  if (!match) {
    return null;
  }

  return {
    domain: match[1].toLowerCase(),
    flow: match[2].toLowerCase(),
    key: match[3].toLowerCase(),
    version: match[4]
  };
}

/**
 * Heuristically parse file path to ComponentRef
 * Used when no resolver is available
 */
function parseFilePathHeuristic(filePath: string): ComponentRef | null {
  // Extract directory and filename
  const parts = filePath.split('/').filter(p => p);
  if (parts.length === 0) {
    return null;
  }

  const filename = parts[parts.length - 1];
  const directory = parts[0].toLowerCase();

  // Remove .json extension
  const key = filename.replace(/\.json$/, '').toLowerCase();

  // Map directory to component type and flow
  let flow: string;
  if (directory.includes('task')) {
    flow = 'sys-tasks';
  } else if (directory.includes('schema')) {
    flow = 'sys-schemas';
  } else if (directory.includes('view')) {
    flow = 'sys-views';
  } else if (directory.includes('function')) {
    flow = 'sys-functions';
  } else if (directory.includes('extension')) {
    flow = 'sys-extensions';
  } else if (directory.includes('workflow') || directory.includes('flow')) {
    flow = 'sys-flows';
  } else {
    // Unknown directory, default to key as flow
    flow = directory;
  }

  return {
    domain: 'core',
    flow,
    key,
    version: '1.0.0'
  };
}

/**
 * Map component type to resolver method name
 */
function getComponentTypeName(type: ComponentType): 'task' | 'schema' | 'view' | 'function' | 'extension' | 'workflow' {
  // ComponentType uses singular form which matches resolver method names
  return type as any;
}

/**
 * Normalize a component reference from any format to structured ComponentRef
 *
 * Supports:
 * - Structured refs: `{ key, domain, flow, version }`
 * - Ref-style strings: `"domain/flow/key@version"`
 * - File path strings: `"Tasks/task.json"`
 * - Wrapped refs: `{ ref: "..." }`
 *
 * @param ref - The reference to normalize
 * @param type - The component type (for resolver validation)
 * @param context - Normalization context
 * @returns Normalized ComponentRef or null if invalid
 */
export async function normalizeComponentReference(
  ref: any,
  type: ComponentType,
  context: ReferenceNormalizationContext
): Promise<ComponentRef | null> {
  if (!ref) {
    return null;
  }

  // 1. Already a structured ref - just normalize casing
  if (isStructuredRef(ref)) {
    return {
      domain: ref.domain.toLowerCase(),
      flow: ref.flow.toLowerCase(),
      key: ref.key.toLowerCase(),
      version: ref.version
    };
  }

  // 2. Handle wrapped ref: { ref: "..." }
  if (typeof ref === 'object' && ref.ref && typeof ref.ref === 'string') {
    return await normalizeComponentReference(ref.ref, type, context);
  }

  // 3. Handle string references
  if (typeof ref === 'string') {
    // 3a. Try ref-style string (domain/flow/key@version)
    if (isRefStyleString(ref)) {
      return parseRefStyleString(ref);
    }

    // 3b. Try file path reference
    if (isFilePathString(ref)) {
      // If resolver available, use it for validation
      if (context.resolver) {
        try {
          const refObj = { ref };
          let component: any = null;

          // Call appropriate resolver method based on type
          switch (type) {
            case 'task':
              component = await context.resolver.resolveTask(refObj);
              break;
            case 'schema':
              component = await context.resolver.resolveSchema(refObj);
              break;
            case 'view':
              component = await context.resolver.resolveView(refObj);
              break;
            case 'function':
              component = await context.resolver.resolveFunction(refObj);
              break;
            case 'extension':
              component = await context.resolver.resolveExtension(refObj);
              break;
            case 'workflow':
              // Workflows don't typically reference other workflows via file paths
              // Fall through to heuristic parsing
              break;
          }

          if (component) {
            return {
              key: component.key.toLowerCase(),
              domain: component.domain.toLowerCase(),
              flow: (component.flow || getDefaultFlow(type)).toLowerCase(),
              version: component.version || '1.0.0'
            };
          }
        } catch (error) {
          if (context.strict) {
            throw error;
          }
          // Fall through to heuristic parsing
        }
      }

      // Fallback to heuristic parsing
      if (!context.strict) {
        return parseFilePathHeuristic(ref);
      }
    }
  }

  // 4. Invalid reference
  if (context.strict) {
    throw new Error(`Cannot normalize reference: ${JSON.stringify(ref)}`);
  }

  return null;
}

/**
 * Get default flow name for a component type
 */
function getDefaultFlow(type: ComponentType): string {
  const flowMap: Record<ComponentType, string> = {
    task: 'sys-tasks',
    schema: 'sys-schemas',
    view: 'sys-views',
    function: 'sys-functions',
    extension: 'sys-extensions',
    workflow: 'sys-flows'
  };
  return flowMap[type] || 'sys-flows';
}

/**
 * Normalize all component references in a workflow definition
 *
 * Performs deep traversal of workflow structure and normalizes:
 * - Start transition schema
 * - State schemas, views, tasks
 * - OnEntry/onExit tasks
 * - Transition schemas, views, onExecutionTasks
 * - Shared transitions
 *
 * @param workflowDef - The workflow definition to normalize
 * @param context - Normalization context
 * @returns Normalized workflow definition
 */
export async function normalizeWorkflowReferences(
  workflowDef: any,
  context: ReferenceNormalizationContext
): Promise<any> {
  // Deep clone to avoid mutating original
  const normalized = JSON.parse(JSON.stringify(workflowDef));

  // Helper to normalize a reference
  const resolveRef = async (refObj: any, type: ComponentType): Promise<any> => {
    if (!refObj) {
      return refObj;
    }

    const normalized = await normalizeComponentReference(refObj, type, context);
    return normalized || refObj; // Keep original if normalization fails
  };

  // Normalize start transition schema
  if (normalized.startTransition?.schema) {
    normalized.startTransition.schema = await resolveRef(
      normalized.startTransition.schema,
      'schema'
    );
  }

  // Normalize references in states
  if (Array.isArray(normalized.states)) {
    for (const state of normalized.states) {
      // Schema
      if (state.schema) {
        state.schema = await resolveRef(state.schema, 'schema');
      }

      // View
      if (state.view) {
        state.view = await resolveRef(state.view, 'view');
      }

      // Task
      if (state.task) {
        state.task = await resolveRef(state.task, 'task');
      }

      // OnEntry tasks
      if (Array.isArray(state.onEntries)) {
        for (const entry of state.onEntries) {
          if (entry.task) {
            entry.task = await resolveRef(entry.task, 'task');
          }
        }
      }

      // OnExit tasks
      if (Array.isArray(state.onExits)) {
        for (const exit of state.onExits) {
          if (exit.task) {
            exit.task = await resolveRef(exit.task, 'task');
          }
        }
      }

      // Transitions
      if (Array.isArray(state.transitions)) {
        for (const transition of state.transitions) {
          // Schema
          if (transition.schema) {
            transition.schema = await resolveRef(transition.schema, 'schema');
          }

          // View
          if (transition.view) {
            transition.view = await resolveRef(transition.view, 'view');
          }

          // View overrides
          if (transition.viewOverrides) {
            for (const [key, viewRef] of Object.entries(transition.viewOverrides)) {
              if (viewRef) {
                transition.viewOverrides[key] = await resolveRef(viewRef, 'view');
              }
            }
          }

          // onExecutionTasks
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

  // Normalize shared transitions
  if (Array.isArray(normalized.sharedTransitions)) {
    for (const transition of normalized.sharedTransitions) {
      if (transition.schema) {
        transition.schema = await resolveRef(transition.schema, 'schema');
      }

      if (transition.view) {
        transition.view = await resolveRef(transition.view, 'view');
      }

      if (transition.viewOverrides) {
        for (const [key, viewRef] of Object.entries(transition.viewOverrides)) {
          if (viewRef) {
            transition.viewOverrides[key] = await resolveRef(viewRef, 'view');
          }
        }
      }
    }
  }

  return normalized;
}
