/**
 * Content comparison utilities for change detection
 */

/**
 * Comparison result
 */
export interface ComparisonResult {
  /** Whether content is identical */
  identical: boolean;

  /** Reason for difference (if not identical) */
  reason?: string;
}

/**
 * Recursively normalize object by sorting keys
 * This ensures consistent comparison regardless of key order
 */
export function normalizeKeys(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(normalizeKeys);
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  const sorted: any = {};
  const keys = Object.keys(obj).sort();

  for (const key of keys) {
    sorted[key] = normalizeKeys(obj[key]);
  }

  return sorted;
}

/**
 * Compare two component definitions for content equality
 * Normalizes key order before comparison
 */
export function compareContent(
  local: any,
  database: any
): ComparisonResult {
  try {
    // Handle null/undefined cases
    if (!local && !database) {
      return { identical: true };
    }

    if (!local) {
      return { identical: false, reason: 'Local content is missing' };
    }

    if (!database) {
      return { identical: false, reason: 'Database content is missing' };
    }

    // Normalize both objects (sort keys recursively)
    const localNormalized = normalizeKeys(local);
    const databaseNormalized = normalizeKeys(database);

    // Compare as JSON strings
    const localJson = JSON.stringify(localNormalized);
    const databaseJson = JSON.stringify(databaseNormalized);

    if (localJson === databaseJson) {
      return { identical: true };
    }

    // Find first difference for debugging
    const minLen = Math.min(localJson.length, databaseJson.length);
    for (let i = 0; i < minLen; i++) {
      if (localJson[i] !== databaseJson[i]) {
        const context = localJson.substring(Math.max(0, i - 20), i + 20);
        return {
          identical: false,
          reason: `Content differs at position ${i}: "${context}"`
        };
      }
    }

    // Length difference
    if (localJson.length !== databaseJson.length) {
      return {
        identical: false,
        reason: `Length differs: local=${localJson.length}, db=${databaseJson.length}`
      };
    }

    return { identical: false, reason: 'Content differs' };
  } catch (error) {
    return {
      identical: false,
      reason: `Comparison error: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Extract attributes section from component definition
 * Handles both full definitions and attributes-only data
 */
export function extractAttributes(component: any): any {
  if (!component) {
    return null;
  }

  // If it has an attributes field, extract it along with metadata
  if (component.attributes) {
    return {
      ...component.attributes,
      // Include metadata for comparison (excluding version - we only care about content changes)
      _metadata: {
        domain: component.domain,
        flow: component.flow,
        key: component.key
      }
    };
  }

  // Otherwise assume it's already the attributes section
  return component;
}
