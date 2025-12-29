/**
 * Schema Adapter - Utilities for transforming JSON Schema
 * Converts JSON Schema to tree structures and flattened terminal lists
 */

import type { JSONSchema, TreeNode, Terminal, SchemaOverlay } from './types';

/**
 * Deep merge two schema property sets
 * When the same property appears in both, merge their nested properties if they're both objects
 */
function deepMergeProperties(
  target: Record<string, JSONSchema>,
  source: Record<string, JSONSchema>
): Record<string, JSONSchema> {
  const result = { ...target };

  for (const [key, sourceSchema] of Object.entries(source)) {
    if (key in result) {
      const targetSchema = result[key];

      // If both are object schemas, merge their properties recursively
      if (targetSchema.type === 'object' && sourceSchema.type === 'object') {
        const mergedNestedProps = deepMergeProperties(
          targetSchema.properties || {},
          sourceSchema.properties || {}
        );

        result[key] = {
          ...targetSchema,
          ...sourceSchema,
          properties: mergedNestedProps,
          description: `${targetSchema.description || ''} (union of multiple types)`.trim()
        };
      } else {
        // For non-objects, just use the source (last one wins)
        result[key] = sourceSchema;
      }
    } else {
      // New property, just add it
      result[key] = sourceSchema;
    }
  }

  return result;
}

/**
 * Extract discriminator info from an if/then conditional schema
 * Returns the field name and value being checked
 */
function extractDiscriminator(ifSchema: JSONSchema): { field: string; value: string; label?: string } | null {
  if (!ifSchema.properties) return null;

  // Look for a property with a const value
  for (const [field, fieldSchema] of Object.entries(ifSchema.properties)) {
    if (fieldSchema.const !== undefined) {
      return { field, value: String(fieldSchema.const) };
    }
  }

  return null;
}

/**
 * Get a human-readable label for a task type
 */
function getTaskTypeLabel(typeValue: string): string {
  const labels: Record<string, string> = {
    '1': 'Dapr HTTP Endpoint',
    '2': 'Dapr Binding',
    '3': 'Dapr Service',
    '4': 'Dapr PubSub',
    '5': 'Human Task',
    '6': 'HTTP Task',
    '7': 'Script Task'
  };
  return labels[typeValue] || `Type ${typeValue}`;
}

/**
 * Synthetic notation prefix for zero ambiguity
 * Used to mark path segments that are for display only
 */
export const SYNTH_PREFIX = '__SYNTH__';

/**
 * Check if a path segment contains synthetic conditional notation
 * E.g., "__SYNTH__[type=6] HTTP Task"
 */
export function hasSyntheticNotation(segment: string): boolean {
  return segment.startsWith(SYNTH_PREFIX);
}

/**
 * Strip synthetic conditional notation from a path segment
 * E.g., "__SYNTH__[type=6] HTTP Task" -> ""
 * Returns empty string for synthetic segments
 */
export function stripSyntheticSegment(segment: string): string {
  if (hasSyntheticNotation(segment)) {
    return ''; // This segment is synthetic, should be removed from real path
  }
  return segment;
}

/**
 * Extract a unique discriminator key from an if clause
 * E.g., { "properties": { "type": { "const": "6" } } } -> "type=6"
 */
function getDiscriminatorKey(ifClause: JSONSchema): string | null {
  if (!ifClause.properties) return null;

  for (const [field, fieldSchema] of Object.entries(ifClause.properties)) {
    if (fieldSchema.const !== undefined) {
      return `${field}=${fieldSchema.const}`;
    }
  }

  return null;
}

/**
 * Deep merge two JSON Schema objects
 * Properly merges nested properties, required arrays, etc.
 */
function deepMergeSchemas(target: JSONSchema, source: JSONSchema): JSONSchema {
  const result: JSONSchema = { ...target };

  // Merge properties recursively
  if (source.properties) {
    result.properties = deepMergeProperties(
      target.properties || {},
      source.properties
    );
  }

  // Merge required arrays
  if (source.required) {
    const targetRequired = target.required || [];
    result.required = Array.from(new Set([...targetRequired, ...source.required]));
  }

  // Merge items for array types
  if (source.items) {
    result.items = source.items;
  }

  // Copy other properties from source if not in target
  for (const key of Object.keys(source) as Array<keyof JSONSchema>) {
    if (key !== 'properties' && key !== 'required' && key !== 'items') {
      if (result[key] === undefined) {
        result[key] = source[key];
      }
    }
  }

  return result;
}

/**
 * Apply schema overlays to a schema, navigating to the correct schema path
 * Groups overlays by schemaPath and applies them at the appropriate level
 *
 * @param schema - Base JSON Schema
 * @param overlays - Array of schema overlays with metadata.schemaPath
 * @returns Schema with overlays applied at their specified paths
 */
export function applyOverlaysToSchema(schema: JSONSchema, overlays?: SchemaOverlay[]): JSONSchema {
  if (!overlays || overlays.length === 0) {
    return schema;
  }

  console.log('[Schema Overlays] Applying', overlays.length, 'overlays to schema');

  // Group overlays by their schemaPath
  const overlaysByPath = new Map<string, SchemaOverlay[]>();
  for (const overlay of overlays) {
    const path = overlay.metadata?.schemaPath || '$';
    if (!overlaysByPath.has(path)) {
      overlaysByPath.set(path, []);
    }
    overlaysByPath.get(path)!.push(overlay);
  }

  console.log('[Schema Overlays] Grouped by path:', Array.from(overlaysByPath.keys()));

  // Apply overlays at each schema path
  let result = { ...schema };
  for (const [path, pathOverlays] of overlaysByPath.entries()) {
    if (path === '$') {
      // Apply at root level
      result = applyOverlays(result, pathOverlays);
    } else {
      // Navigate to the path and apply there
      result = applyOverlaysAtPath(result, path, pathOverlays);
    }
  }

  return result;
}

/**
 * Apply overlays at a specific path within the schema
 */
function applyOverlaysAtPath(schema: JSONSchema, path: string, overlays: SchemaOverlay[]): JSONSchema {
  // Parse path: "$.attributes" -> ["attributes"]
  const segments = path.replace(/^\$\.?/, '').split('.').filter(s => s);

  if (segments.length === 0) {
    return applyOverlays(schema, overlays);
  }

  console.log('[Schema Overlays] Applying at path:', path, 'segments:', segments);

  // Navigate to target and apply overlays
  return updateSchemaAtPath(schema, segments, (target) => applyOverlays(target, overlays));
}

/**
 * Navigate to a path in the schema and update it
 */
function updateSchemaAtPath(
  schema: JSONSchema,
  segments: string[],
  updater: (target: JSONSchema) => JSONSchema
): JSONSchema {
  if (segments.length === 0) {
    return updater(schema);
  }

  const [head, ...rest] = segments;

  // Navigate through properties
  if (!schema.properties || !schema.properties[head]) {
    console.warn('[Schema Overlays] Cannot find property:', head, 'in schema');
    return schema;
  }

  const updatedProperty = updateSchemaAtPath(schema.properties[head], rest, updater);

  return {
    ...schema,
    properties: {
      ...schema.properties,
      [head]: updatedProperty
    }
  };
}

/**
 * Apply schema overlays to a base schema (at current level)
 * Merges overlays with matching conditionals instead of creating duplicates
 *
 * @param schema - Base JSON Schema
 * @param overlays - Array of schema overlays to apply
 * @returns Schema with overlays intelligently merged
 */
export function applyOverlays(schema: JSONSchema, overlays?: SchemaOverlay[]): JSONSchema {
  if (!overlays || overlays.length === 0) {
    return schema;
  }

  console.log('[Schema Overlays] Applying', overlays.length, 'overlays to schema');

  const existingAllOf = schema.allOf || [];

  // Build a map of discriminator key -> conditional schema
  const conditionalMap = new Map<string, { if: JSONSchema; then: JSONSchema; else?: JSONSchema }>();

  // First, collect existing conditionals from allOf
  const nonConditionals: JSONSchema[] = [];
  for (const item of existingAllOf) {
    if (item.if && item.then) {
      const key = getDiscriminatorKey(item.if);
      if (key) {
        conditionalMap.set(key, {
          if: item.if,
          then: item.then as JSONSchema,
          ...(item.else && { else: item.else as JSONSchema })
        });
        console.log('[Schema Overlays] Found existing conditional:', key);
      } else {
        // Conditional without recognizable discriminator - keep as-is
        nonConditionals.push(item);
      }
    } else {
      // Non-conditional schema
      nonConditionals.push(item);
    }
  }

  // Merge overlays with matching conditionals
  for (const overlay of overlays) {
    // Check if this is a non-conditional overlay (no if/then)
    if (!overlay.if && !overlay.then) {
      // This is a direct schema extension - add to non-conditionals
      const { metadata, $id, ...schemaExtension } = overlay;
      nonConditionals.push(schemaExtension);
      console.log('[Schema Overlays] Adding non-conditional schema extension');
      continue;
    }

    const key = getDiscriminatorKey(overlay.if);
    if (!key) {
      console.warn('[Schema Overlays] Overlay has no recognizable discriminator, skipping');
      continue;
    }

    if (conditionalMap.has(key)) {
      // Merge with existing conditional
      console.log('[Schema Overlays] Merging overlay with existing conditional:', key);
      const existing = conditionalMap.get(key)!;
      const mergedThen = deepMergeSchemas(existing.then, overlay.then);
      conditionalMap.set(key, {
        ...existing,
        then: mergedThen
      });
    } else {
      // New conditional
      console.log('[Schema Overlays] Adding new conditional:', key);
      conditionalMap.set(key, {
        if: overlay.if,
        then: overlay.then,
        ...(overlay.else && { else: overlay.else })
      });
    }
  }

  // Merge non-conditionals directly into the base schema (instead of using allOf)
  // This ensures properties are actually merged, not just constrained
  let result = { ...schema };
  for (const overlay of nonConditionals) {
    result = deepMergeSchemas(result, overlay);
  }

  // Reconstruct allOf with only the merged conditionals
  const mergedConditionals = Array.from(conditionalMap.values());

  console.log('[Schema Overlays] Result:', {
    nonConditionals: nonConditionals.length,
    mergedConditionals: mergedConditionals.length,
    total: nonConditionals.length + mergedConditionals.length
  });

  // If there are conditionals, use allOf; otherwise just return the merged result
  if (mergedConditionals.length > 0) {
    return {
      ...result,
      allOf: mergedConditionals
    };
  }

  return result;
}

/**
 * Extract user-added property paths from overlays
 * Used to mark nodes in the tree as user-added for UI purposes
 *
 * @param overlays - Array of schema overlays
 * @returns Set of JSONPath strings for user-added properties
 */
export function extractUserAddedPaths(overlays?: SchemaOverlay[]): Set<string> {
  const paths = new Set<string>();

  if (!overlays || overlays.length === 0) {
    return paths;
  }

  // Extract paths directly from overlay metadata
  // targetPath now includes the full path to the property (e.g., "$.attributes.config.[type=6] HTTP Task.headers.Authorization")
  for (const overlay of overlays) {
    if (overlay.metadata?.targetPath) {
      paths.add(overlay.metadata.targetPath);
      console.log('[User-Added Path] Extracted:', overlay.metadata.targetPath);
    }
  }

  return paths;
}

/**
 * Resolve JSON Schema composition keywords (allOf, anyOf, oneOf)
 * For conditional schemas, creates separate branches instead of merging
 *
 * @param schema - JSON Schema with potential composition keywords
 * @returns Resolved schema with merged properties or branched conditionals
 */
function resolveSchemaComposition(schema: JSONSchema): JSONSchema {
  if (!schema) return schema;

  const resolved: JSONSchema = { ...schema };

  // Handle allOf - check if it contains conditionals
  if (schema.allOf && Array.isArray(schema.allOf)) {
    const conditionals: Array<{ discriminator: { field: string; value: string; label?: string }; thenSchema: JSONSchema }> = [];
    let mergedProperties: Record<string, JSONSchema> = { ...schema.properties };
    const mergedRequired: string[] = [...(schema.required || [])];

    console.log('[Schema Composition] Resolving allOf with', schema.allOf.length, 'items');

    for (const subSchema of schema.allOf) {
      // Check for conditional schemas (if/then/else)
      if (subSchema.if && subSchema.then) {
        const discriminator = extractDiscriminator(subSchema.if);
        if (discriminator && typeof subSchema.then === 'object') {
          conditionals.push({ discriminator, thenSchema: subSchema.then as JSONSchema });
          console.log('[Schema Composition] Found conditional:', discriminator);
        }
        continue;
      }

      // Merge properties from non-conditional schemas
      if (subSchema.properties) {
        mergedProperties = deepMergeProperties(mergedProperties, subSchema.properties);
      }

      // Merge required fields
      if (subSchema.required) {
        mergedRequired.push(...subSchema.required);
      }

      // Merge other schema attributes
      if (subSchema.type && !resolved.type) {
        resolved.type = subSchema.type;
      }
    }

    // If we found conditionals, create branches for varying properties
    if (conditionals.length > 0) {
      console.log('[Schema Composition] Creating branches for', conditionals.length, 'conditionals');

      // Find which properties vary across conditionals
      // For task-definition, this will be 'config'
      const varyingProps = new Set<string>();
      for (const { thenSchema } of conditionals) {
        if (thenSchema.properties) {
          for (const propName of Object.keys(thenSchema.properties)) {
            // Skip the discriminator field itself
            if (propName !== conditionals[0].discriminator.field) {
              varyingProps.add(propName);
            }
          }
        }
      }

      console.log('[Schema Composition] Varying properties:', Array.from(varyingProps));

      // For each varying property, create branches
      for (const propName of varyingProps) {
        const branchSchemas: Record<string, JSONSchema> = {};

        for (const { discriminator, thenSchema } of conditionals) {
          if (thenSchema.properties && thenSchema.properties[propName]) {
            const propSchema = thenSchema.properties[propName];

            // Create branch name based on discriminator
            const label = discriminator.field === 'type'
              ? getTaskTypeLabel(discriminator.value)
              : `${discriminator.field}=${discriminator.value}`;

            const branchName = `${SYNTH_PREFIX}[${discriminator.field}=${discriminator.value}] ${label}`;

            branchSchemas[branchName] = propSchema;
          }
        }

        // If we found branches for this property, create a synthetic object with branches
        if (Object.keys(branchSchemas).length > 0) {
          mergedProperties[propName] = {
            type: 'object',
            description: `Conditional branches (varies by ${conditionals[0].discriminator.field})`,
            properties: branchSchemas
          };
        }
      }
    }

    resolved.properties = mergedProperties;
    if (mergedRequired.length > 0) {
      resolved.required = Array.from(new Set(mergedRequired));
    }
  }

  // Handle anyOf/oneOf - show union of all possible properties
  if ((schema.anyOf && Array.isArray(schema.anyOf)) ||
      (schema.oneOf && Array.isArray(schema.oneOf))) {
    const schemas = (schema.anyOf || schema.oneOf) as JSONSchema[];
    let mergedProperties: Record<string, JSONSchema> = { ...schema.properties };

    for (const subSchema of schemas) {
      if (subSchema.properties) {
        // Deep merge to handle nested objects
        mergedProperties = deepMergeProperties(mergedProperties, subSchema.properties);
      }
    }

    resolved.properties = mergedProperties;
  }

  return resolved;
}

/**
 * Build hierarchical tree structure from JSON Schema
 * Preserves schema hierarchy with expand/collapse support
 *
 * @param schema - JSON Schema object (with overlays already applied)
 * @param path - Current JSONPath (default: '$')
 * @param name - Current field name (default: 'root')
 * @param userAddedPaths - Set of paths that are user-added (for UI marking)
 * @param parentRealPath - Real path from parent (without synthetic notation)
 * @returns Tree node with children
 */
export function buildSchemaTree(
  schema: JSONSchema,
  path: string = '$',
  name: string = 'root',
  userAddedPaths?: Set<string>,
  parentRealPath?: string,
  isCompositeRoot: boolean = false  // NEW: indicates if this is a composite schema where children are parts
): TreeNode | null {
  if (!schema) return null;

  // Resolve composition keywords first
  const resolvedSchema = resolveSchemaComposition(schema);

  // Compute real path (strip synthetic notation)
  let realPath: string | undefined = undefined;
  if (hasSyntheticNotation(name)) {
    // This is a synthetic branch - compute real path by not adding this segment
    realPath = parentRealPath || path.substring(0, path.lastIndexOf('.'));
  } else if (parentRealPath !== undefined) {
    // Parent has real path, so propagate it
    realPath = parentRealPath === '$' ? `$.${name}` : `${parentRealPath}.${name}`;
  }

  const isUserAdded = userAddedPaths?.has(path) || false;

  // Debug: Log when checking user-added status
  if (userAddedPaths && userAddedPaths.size > 0) {
    console.log('[buildSchemaTree] Checking path:', path, '| isUserAdded:', isUserAdded, '| Available paths:', Array.from(userAddedPaths));
  }

  const node: TreeNode = {
    id: path,
    name,
    path,
    realPath, // Set realPath if we computed one
    type: resolvedSchema.type,
    children: [],
    isLeaf: false,
    isUserAdded, // Mark as user-added if in the set
    description: resolvedSchema.description,
    format: resolvedSchema.format
  };

  if (resolvedSchema.type === 'object' && resolvedSchema.properties) {
    // DEBUG: Log properties at root level
    if (path === '$.context' || name === 'context') {
      console.log('[buildSchemaTree] Building context node - properties:',
        Object.keys(resolvedSchema.properties));
    }

    // Object type: add children for each property
    for (const [key, prop] of Object.entries(resolvedSchema.properties)) {
      const childPath = path === '$' ? `$.${key}` : `${path}.${key}`;
      // Pass false for isCompositeRoot - children are not composite roots
      const child = buildSchemaTree(prop, childPath, key, userAddedPaths, path, false);
      if (child) {
        // Mark as part if this is first level of composite schema
        if (isCompositeRoot) {
          child.isPart = true;
        }
        node.children.push(child);
      }
    }
  } else if (resolvedSchema.type === 'object' && !resolvedSchema.properties) {
    // Free-form object (no properties defined) - can be extended by user via overlays
  } else if (resolvedSchema.type === 'array' && resolvedSchema.items) {
    // Array type: add array indicator and recurse into items
    const childPath = `${path}[]`;
    const childRealPath = realPath ? `${realPath}[]` : undefined;
    const child = buildSchemaTree(resolvedSchema.items as JSONSchema, childPath, 'items', userAddedPaths, childRealPath, false);
    if (child) {
      child.isArrayItem = true;
      node.children.push(child);
    }
  }

  // Mark leaf nodes (actual data fields)
  node.isLeaf =
    node.children.length === 0 &&
    node.type !== 'object' &&
    node.type !== 'array';

  return node;
}

/**
 * Flatten JSON Schema to list of terminals (connection points)
 * Loses hierarchy but provides direct field access
 *
 * @param schema - JSON Schema object
 * @param path - Current JSONPath (default: '$')
 * @param name - Current field name (default: 'root')
 * @param required - Set of required field names from parent
 * @returns Array of terminals
 */
export function flattenSchema(
  schema: JSONSchema,
  path: string = '$',
  name: string = 'root',
  required: Set<string> = new Set()
): Terminal[] {
  if (!schema) return [];

  // Resolve composition keywords first
  const resolvedSchema = resolveSchemaComposition(schema);

  const terminals: Terminal[] = [];

  // Check if this field is required
  const isRequired = required.has(name);

  if (resolvedSchema.type === 'object' && resolvedSchema.properties) {
    // Object type: recurse into properties
    const requiredFields = new Set(resolvedSchema.required || []);

    for (const [key, prop] of Object.entries(resolvedSchema.properties)) {
      const childPath = path === '$' ? `$.${key}` : `${path}.${key}`;
      const childTerminals = flattenSchema(prop, childPath, key, requiredFields);
      terminals.push(...childTerminals);
    }
  } else if (resolvedSchema.type === 'array' && resolvedSchema.items) {
    // Array type: recurse into items with [] notation
    const childPath = `${path}[]`;
    const childTerminals = flattenSchema(
      resolvedSchema.items as JSONSchema,
      childPath,
      name,
      new Set()
    );
    terminals.push(...childTerminals);
  } else {
    // Primitive type: this is a terminal
    terminals.push({
      id: path,
      name,
      type: resolvedSchema.type || 'string',
      path,
      optional: !isRequired,
      description: resolvedSchema.description,
      format: resolvedSchema.format
    });
  }

  return terminals;
}

/**
 * Get all leaf nodes from tree (terminals)
 *
 * @param tree - Tree node
 * @returns Array of leaf nodes
 */
export function getLeafNodes(tree: TreeNode): TreeNode[] {
  const leaves: TreeNode[] = [];

  function traverse(node: TreeNode) {
    if (node.isLeaf) {
      leaves.push(node);
    } else {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }

  traverse(tree);
  return leaves;
}

/**
 * Find node by path in tree
 *
 * @param tree - Tree node
 * @param path - JSONPath to find
 * @returns Tree node or null if not found
 */
export function findNodeByPath(
  tree: TreeNode,
  path: string
): TreeNode | null {
  if (tree.path === path) {
    return tree;
  }

  for (const child of tree.children) {
    const found = findNodeByPath(child, path);
    if (found) {
      return found;
    }
  }

  return null;
}

/**
 * Get all paths from tree (for search/filter)
 *
 * @param tree - Tree node
 * @returns Array of paths
 */
export function getAllPaths(tree: TreeNode): string[] {
  const paths: string[] = [tree.path];

  for (const child of tree.children) {
    paths.push(...getAllPaths(child));
  }

  return paths;
}

/**
 * Convert JSONPath to field name
 * Example: $.customer.addresses[].city → city
 *
 * @param path - JSONPath
 * @returns Field name
 */
export function pathToFieldName(path: string): string {
  const parts = path.split('.');
  return parts[parts.length - 1].replace('[]', '');
}

/**
 * Check if path represents an array
 * Example: $.items[] → true
 *
 * @param path - JSONPath
 * @returns True if array path
 */
export function isArrayPath(path: string): boolean {
  return path.includes('[]');
}

/**
 * Get parent path from JSONPath
 * Example: $.customer.addresses[].city → $.customer.addresses[]
 *
 * @param path - JSONPath
 * @returns Parent path or null if root
 */
export function getParentPath(path: string): string | null {
  if (path === '$') return null;

  const parts = path.split('.');
  if (parts.length === 1) return '$';

  return parts.slice(0, -1).join('.');
}

/**
 * Convert tree to terminal list (alternative to flattenSchema)
 *
 * @param tree - Tree node
 * @returns Array of terminals
 */
export function treeToTerminals(tree: TreeNode): Terminal[] {
  const leaves = getLeafNodes(tree);

  return leaves.map((leaf) => ({
    id: leaf.path,
    name: leaf.name,
    type: leaf.type || 'string',
    path: leaf.path,
    optional: true, // Tree doesn't track required status
    description: leaf.description,
    format: leaf.format
  }));
}
