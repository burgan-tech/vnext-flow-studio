/**
 * String Template Utilities
 *
 * Provides parsing and processing for string templates with named parameters.
 * Can be used for URLs, paths, messages, or any other string interpolation needs.
 *
 * Examples:
 * - URLs: "http://{hostname}/accounts/customernumber?custno={custno}"
 * - Paths: "/api/v{version}/users/{userId}/profile"
 * - Messages: "Hello {firstName} {lastName}, welcome to {siteName}!"
 * - SQL: "SELECT * FROM {tableName} WHERE id = {userId}"
 */

/**
 * Extract parameter names from a string template
 *
 * @param template - Template string with {paramName} placeholders
 * @returns Array of unique parameter names in order of appearance
 *
 * @example
 * extractTemplateParams("Hello {firstName} {lastName}!")
 * // Returns: ["firstName", "lastName"]
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
 * Validate a string template
 *
 * @param template - Template string
 * @returns Object with isValid flag and optional error message
 */
export function validateTemplate(template: string): { isValid: boolean; error?: string } {
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
 * Build a string by replacing template parameters with values
 * This is used during code generation or runtime evaluation
 *
 * @param template - Template string
 * @param paramValues - Map of parameter names to their values
 * @returns The resolved string with all parameters replaced
 *
 * @example
 * resolveTemplate("Hello {name}!", { name: "World" })
 * // Returns: "Hello World!"
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
 * getParamDisplayName("firstName") // Returns: "FirstName"
 */
export function getParamDisplayName(paramName: string): string {
  if (!paramName) return '';
  return paramName.charAt(0).toUpperCase() + paramName.slice(1);
}
