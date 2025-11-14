/**
 * Design-time attribute filtering for deployment
 * Removes editor/UI-specific attributes that should not be sent to runtime API
 */

/**
 * Design-time attributes that should be filtered out before deployment
 * These are used only in the editor/design environment
 */
const DESIGN_TIME_ATTRIBUTES = new Set([
  // UI/Visual attributes
  'xprofile',
  'xProfile',  // Case variants
  'position',
  'layout',
  'uiMetadata',
  'editorMetadata',
  'canvas',
  'zoom',
  'viewport',

  // Editor-specific metadata
  'comments',
  'notes',
  'annotations',
  'editorVersion',
  'lastModifiedBy',
  'designNotes',

  // Development/debugging attributes
  'debugInfo',
  'devMode',
  'testData',

  // Diagram-specific attributes (stored in .diagram.json separately)
  'diagram',
  'nodePositions',
  'edgeRouting'
]);

/**
 * Recursively remove design-time attributes from an object
 * @param obj Object to filter
 * @param depth Current recursion depth (prevents infinite loops)
 */
function filterObjectRecursive(obj: any, depth: number = 0): any {
  // Prevent infinite recursion
  if (depth > 100) {
    return obj;
  }

  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => filterObjectRecursive(item, depth + 1));
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  const filtered: any = {};

  for (const [key, value] of Object.entries(obj)) {
    // Skip design-time attributes
    if (DESIGN_TIME_ATTRIBUTES.has(key)) {
      continue;
    }

    // Recursively filter nested objects
    filtered[key] = filterObjectRecursive(value, depth + 1);
  }

  return filtered;
}

/**
 * Filter design-time attributes from a component definition
 * Removes attributes that are only used in the editor and should not be deployed
 */
export function filterDesignTimeAttributes(component: any): any {
  if (!component || typeof component !== 'object') {
    return component;
  }

  // Clone the component to avoid modifying the original
  const clone = JSON.parse(JSON.stringify(component));

  // Filter at root level
  const filtered: any = {};

  for (const [key, value] of Object.entries(clone)) {
    // Skip design-time attributes at root level
    if (DESIGN_TIME_ATTRIBUTES.has(key)) {
      continue;
    }

    // Recursively filter nested objects (including attributes section)
    if (typeof value === 'object' && value !== null) {
      filtered[key] = filterObjectRecursive(value);
    } else {
      filtered[key] = value;
    }
  }

  return filtered;
}

/**
 * Add a custom design-time attribute to the filter list
 * Useful for project-specific attributes
 */
export function addDesignTimeAttribute(attribute: string): void {
  DESIGN_TIME_ATTRIBUTES.add(attribute);
}

/**
 * Get list of all design-time attributes being filtered
 */
export function getDesignTimeAttributes(): string[] {
  return Array.from(DESIGN_TIME_ATTRIBUTES).sort();
}
