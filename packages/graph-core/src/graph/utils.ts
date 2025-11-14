/**
 * Utility functions for component references, normalization, and hashing
 */

import * as crypto from 'crypto';
import type { ComponentRef, ComponentType } from '../types/index.js';

/**
 * Normalize a component reference from various formats
 * Supports both explicit refs and ref-style (file path) references
 */
export function normalizeComponentRef(ref: any): ComponentRef | null {
  // If it's already a ComponentRef-like object
  if (ref && typeof ref === 'object' && ref.key && ref.domain && ref.flow && ref.version) {
    return {
      domain: String(ref.domain).toLowerCase(),
      flow: String(ref.flow).toLowerCase(),
      key: String(ref.key).toLowerCase(),
      version: String(ref.version)
    };
  }

  // Handle file path references: { "ref": "Tasks/invalidate-cache.json" }
  if (ref && typeof ref === 'object' && ref.ref && typeof ref.ref === 'string') {
    const parsed = parseFilePathReference(ref.ref);
    if (parsed) {
      return parsed;
    }
  }

  // If it's a ref-style string (e.g., "domain/flow/key@version")
  if (typeof ref === 'string') {
    const match = ref.match(/^([^/]+)\/([^/]+)\/([^@]+)@(.+)$/);
    if (match) {
      return {
        domain: match[1].toLowerCase(),
        flow: match[2].toLowerCase(),
        key: match[3].toLowerCase(),
        version: match[4]
      };
    }

    // Try parsing as file path
    const parsed = parseFilePathReference(ref);
    if (parsed) {
      return parsed;
    }
  }

  return null;
}

/**
 * Parse file path reference (e.g., "Tasks/cache-task.json", "Schemas/applicant-schema.json")
 */
function parseFilePathReference(filePath: string): ComponentRef | null {
  // Extract directory and filename
  const parts = filePath.split('/');
  if (parts.length < 2) {
    return null;
  }

  const directory = parts[0].toLowerCase();
  const filename = parts[parts.length - 1];

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
    return null;
  }

  // Default values
  return {
    domain: 'core',
    flow,
    key,
    version: '1.0.0'
  };
}

/**
 * Infer component type from context (field name or parent path where ref was found)
 */
function inferComponentType(fieldName: string, parentPath: string): ComponentType {
  const lowerField = fieldName.toLowerCase();
  const lowerPath = parentPath.toLowerCase();

  // Check field name first
  if (lowerField.includes('task')) return 'task';
  if (lowerField.includes('schema')) return 'schema';
  if (lowerField.includes('view')) return 'view';
  if (lowerField.includes('function')) return 'function';
  if (lowerField.includes('extension') || lowerField.includes('feature')) return 'extension';
  if (lowerField.includes('subflow') || lowerField.includes('process')) return 'workflow';

  // Check parent path
  if (lowerPath.includes('task')) return 'task';
  if (lowerPath.includes('schema')) return 'schema';
  if (lowerPath.includes('view')) return 'view';
  if (lowerPath.includes('function')) return 'function';
  if (lowerPath.includes('extension') || lowerPath.includes('feature')) return 'extension';
  if (lowerPath.includes('subflow') || lowerPath.includes('process')) return 'workflow';

  // Default to workflow for unknown contexts
  return 'workflow';
}

/**
 * Recursively extract all component references from a workflow definition
 * This uses automatic traversal to find all refs, regardless of where they appear
 */
export function extractComponentReferences(
  workflowDef: any
): Array<{ ref: ComponentRef; type: ComponentType }> {
  const refs: Array<{ ref: ComponentRef; type: ComponentType }> = [];
  const seen = new Set<string>(); // Track unique refs to avoid duplicates

  if (!workflowDef || typeof workflowDef !== 'object') {
    return refs;
  }

  // Handle nested attributes structure
  const def = workflowDef.attributes || workflowDef;

  /**
   * Recursively traverse object looking for component references
   */
  function traverse(obj: any, path: string = ''): void {
    if (!obj || typeof obj !== 'object') {
      return;
    }

    // Check if this object itself is a component reference
    const normalized = normalizeComponentRef(obj);
    if (normalized) {
      const refId = `${normalized.domain}/${normalized.flow}/${normalized.key}@${normalized.version}`;

      // Skip if we've already seen this exact reference
      if (seen.has(refId)) {
        return;
      }
      seen.add(refId);

      // Infer type from path context
      const pathParts = path.split('.');
      const fieldName = pathParts[pathParts.length - 1] || '';
      const parentPath = pathParts.slice(0, -1).join('.');
      const type = inferComponentType(fieldName, parentPath);

      refs.push({ ref: normalized, type });
      return; // Don't traverse into the ref object itself
    }

    // Traverse arrays
    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        traverse(item, `${path}[${index}]`);
      });
      return;
    }

    // Traverse object properties
    for (const [key, value] of Object.entries(obj)) {
      // Skip certain metadata fields to avoid false positives
      if (key === 'labels' || key === 'label' || key === 'location' || key === 'code' ||
          key === 'mapping' || key === 'rule' || key === 'timer' || key === 'versionStrategy') {
        continue;
      }

      const newPath = path ? `${path}.${key}` : key;
      traverse(value, newPath);
    }
  }

  traverse(def);
  return refs;
}

/**
 * Extract API signature from definition (used for drift detection)
 */
export function extractApiSignature(def: any, type: ComponentType): any {
  if (!def) return null;

  switch (type) {
    case 'workflow':
      return {
        states: def.states?.map((s: any) => ({
          key: s.key,
          stateType: s.stateType,
          transitions: s.transitions?.map((t: any) => ({
            key: t.key,
            target: t.target,
            triggerType: t.triggerType
          }))
        })),
        startTransition: def.startTransition ? {
          key: def.startTransition.key,
          target: def.startTransition.target
        } : null
      };

    case 'task':
      return {
        parameters: def.parameters,
        output: def.output
      };

    case 'schema':
      return def.schema || def.properties;

    case 'view':
      return def.view || def.components;

    default:
      return null;
  }
}

/**
 * Extract configuration from definition (used for drift detection)
 */
export function extractConfig(def: any, type: ComponentType): any {
  if (!def) return null;

  // Common config fields across all types
  const commonConfig: any = {};

  if (def.timeout) commonConfig.timeout = def.timeout;
  if (def.features) commonConfig.features = def.features;
  if (def.extensions) commonConfig.extensions = def.extensions;

  switch (type) {
    case 'workflow':
      return {
        ...commonConfig,
        type: def.type,
        functions: def.functions
      };

    case 'task':
      return {
        ...commonConfig,
        taskType: def.taskType,
        config: def.config
      };

    default:
      return commonConfig;
  }
}

/**
 * Extract label from definition
 */
export function extractLabel(def: any): string | undefined {
  if (!def) return undefined;

  // Check for labels array (multi-language)
  if (Array.isArray(def.labels) && def.labels.length > 0) {
    // Prefer English label
    const enLabel = def.labels.find((l: any) => l.language === 'en-US' || l.language === 'en');
    if (enLabel?.label) return enLabel.label;

    // Fallback to first label
    return def.labels[0].label;
  }

  // Check for single label
  if (def.label && typeof def.label === 'string') {
    return def.label;
  }

  // Check for name field
  if (def.name && typeof def.name === 'string') {
    return def.name;
  }

  return undefined;
}

/**
 * Compute hash of an object
 */
export function computeHash(obj: any): string {
  if (!obj) return '';

  // Create stable JSON string (sorted keys)
  const stable = JSON.stringify(obj, Object.keys(obj).sort());

  // Compute SHA-256 hash
  return crypto.createHash('sha256').update(stable).digest('hex');
}
