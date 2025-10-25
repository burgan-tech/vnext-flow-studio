/**
 * URL Template Utilities
 *
 * Provides parsing and processing for URL templates with named parameters.
 * Example: "http://{hostname}/accounts/customernumber?custno={custno}"
 */

/**
 * Extract parameter names from a URL template
 *
 * @param template - URL template string with {paramName} placeholders
 * @returns Array of unique parameter names in order of appearance
 *
 * @example
 * extractTemplateParams("http://{hostname}/api/{version}/users/{userId}")
 * // Returns: ["hostname", "version", "userId"]
 */
export function extractTemplateParams(template: string): string[] {
  if (!template) return [];

  // Match all {paramName} patterns
  const paramRegex = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
  const params: string[] = [];
  const seen = new Set<string>();

  let match;
  while ((match = paramRegex.exec(template)) !== null) {
    const paramName = match[1];
    // Only add unique parameters, but preserve order
    if (!seen.has(paramName)) {
      params.push(paramName);
      seen.add(paramName);
    }
  }

  return params;
}

/**
 * Validate a URL template
 *
 * @param template - URL template string
 * @returns Object with isValid flag and optional error message
 */
export function validateUrlTemplate(template: string): { isValid: boolean; error?: string } {
  if (!template || template.trim() === '') {
    return { isValid: false, error: 'Template cannot be empty' };
  }

  // Check for unmatched braces
  const openBraces = (template.match(/\{/g) || []).length;
  const closeBraces = (template.match(/\}/g) || []).length;

  if (openBraces !== closeBraces) {
    return { isValid: false, error: 'Unmatched braces in template' };
  }

  // Check for invalid parameter names (must start with letter or underscore)
  const invalidParamRegex = /\{([^a-zA-Z_][^}]*)\}/;
  const invalidMatch = template.match(invalidParamRegex);

  if (invalidMatch) {
    return { isValid: false, error: `Invalid parameter name: {${invalidMatch[1]}}` };
  }

  // Check for empty parameter names
  if (template.includes('{}')) {
    return { isValid: false, error: 'Empty parameter names are not allowed' };
  }

  return { isValid: true };
}

/**
 * Build a string expression by replacing template parameters with values
 * This is used during code generation to create the final URL
 *
 * @param template - URL template string
 * @param paramValues - Map of parameter names to their values
 * @returns The resolved URL string
 */
export function resolveTemplate(template: string, paramValues: Record<string, any>): string {
  let result = template;

  for (const [paramName, value] of Object.entries(paramValues)) {
    const placeholder = `{${paramName}}`;
    result = result.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), String(value));
  }

  return result;
}

/**
 * Get display name for a parameter (capitalize first letter)
 * Used for input terminal labels
 *
 * @param paramName - Parameter name from template
 * @returns Formatted display name
 *
 * @example
 * getParamDisplayName("hostname") // Returns: "Hostname"
 * getParamDisplayName("userId") // Returns: "UserId"
 */
export function getParamDisplayName(paramName: string): string {
  if (!paramName) return '';
  return paramName.charAt(0).toUpperCase() + paramName.slice(1);
}
