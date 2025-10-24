/**
 * Schema Inference - Generate JSON Schema from example JSON data
 * Based on specification: docs/mapper/14-schema-inference.md
 */

import type { JSONSchema, SchemaInferenceOptions, InferredSchema } from './types';

/**
 * Infer JSON Schema from one or more example JSON objects
 *
 * @param examples - Single example or array of examples
 * @param options - Inference options
 * @returns Inferred schema with metadata
 */
export function inferSchema(
  examples: any | any[],
  options: SchemaInferenceOptions = {}
): InferredSchema {
  const exampleArray = Array.isArray(examples) ? examples : [examples];
  const warnings: string[] = [];

  // Set default options
  const opts: Required<SchemaInferenceOptions> = {
    detectFormats: options.detectFormats ?? true,
    allRequired: options.allRequired ?? true,
    addConstraints: options.addConstraints ?? true,
    strictTypes: options.strictTypes ?? true
  };

  if (exampleArray.length === 0) {
    return {
      schema: { type: 'object', properties: {} },
      confidence: 0,
      warnings: ['No examples provided'],
      examples: 0
    };
  }

  // Infer types from all examples
  const schemas = exampleArray.map(example => inferType(example, opts, warnings));

  // Merge schemas from multiple examples
  const mergedSchema = schemas.length === 1 ? schemas[0] : mergeSchemas(schemas);

  // Calculate confidence based on consistency
  const confidence = calculateConfidence(exampleArray.length, warnings.length);

  return {
    schema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      ...mergedSchema
    },
    confidence,
    warnings,
    examples: exampleArray.length
  };
}

/**
 * Infer type from a single value
 */
function inferType(
  value: any,
  options: Required<SchemaInferenceOptions>,
  warnings: string[]
): JSONSchema {
  // 1. Null
  if (value === null) {
    warnings.push('Null value found - field may be nullable');
    return { type: 'null' };
  }

  // 2. Boolean
  if (typeof value === 'boolean') {
    return { type: 'boolean' };
  }

  // 3. Number (distinguish integer vs float)
  if (typeof value === 'number') {
    if (options.strictTypes && Number.isInteger(value)) {
      return { type: 'integer' };
    }
    return { type: 'number' };
  }

  // 4. String (detect formats)
  if (typeof value === 'string') {
    const schema: JSONSchema = { type: 'string' };

    if (options.detectFormats) {
      const format = detectStringFormat(value);
      if (format) {
        schema.format = format;
      }
    }

    if (options.addConstraints && value.length > 0) {
      schema.minLength = value.length;
      schema.maxLength = value.length;
    }

    return schema;
  }

  // 5. Array
  if (Array.isArray(value)) {
    if (value.length === 0) {
      warnings.push('Empty array found - cannot infer item type, defaulting to string');
      return {
        type: 'array',
        items: { type: 'string' }
      };
    }

    // Infer from all items
    const itemSchemas = value.map(item => inferType(item, options, warnings));

    // Merge item schemas
    const itemSchema = mergeSchemas(itemSchemas);

    const schema: JSONSchema = {
      type: 'array',
      items: itemSchema
    };

    if (options.addConstraints) {
      schema.minItems = value.length;
      schema.maxItems = value.length;
    }

    return schema;
  }

  // 6. Object
  if (typeof value === 'object') {
    const properties: Record<string, JSONSchema> = {};
    const required: string[] = [];

    for (const [key, val] of Object.entries(value)) {
      properties[key] = inferType(val, options, warnings);

      if (options.allRequired) {
        required.push(key);
      }
    }

    return {
      type: 'object',
      properties,
      ...(required.length > 0 && { required }),
      additionalProperties: false
    };
  }

  // Fallback
  return { type: 'string' };
}

/**
 * Detect string format (date-time, date, email, uri, uuid)
 */
function detectStringFormat(str: string): string | undefined {
  // Date-time (ISO 8601)
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:\d{2})?$/.test(str)) {
    return 'date-time';
  }

  // Date (ISO 8601)
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return 'date';
  }

  // Email
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)) {
    return 'email';
  }

  // UUID
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)) {
    return 'uuid';
  }

  // URI
  try {
    const url = new URL(str);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return 'uri';
    }
  } catch {
    // Not a valid URI
  }

  return undefined;
}

/**
 * Merge multiple schemas into one
 */
function mergeSchemas(schemas: JSONSchema[]): JSONSchema {
  if (schemas.length === 0) {
    return { type: 'string' };
  }

  if (schemas.length === 1) {
    return schemas[0];
  }

  // Check if all same type
  const types = new Set(schemas.map(s => s.type));

  if (types.size === 1) {
    const type = schemas[0].type;

    switch (type) {
      case 'object':
        return mergeObjectSchemas(schemas);

      case 'array':
        return mergeArraySchemas(schemas);

      case 'string':
        return mergeStringSchemas(schemas);

      case 'number':
      case 'integer':
        return mergeNumberSchemas(schemas);

      default:
        return schemas[0];
    }
  }

  // Multiple types - use anyOf
  return {
    anyOf: schemas
  };
}

/**
 * Merge object schemas
 */
function mergeObjectSchemas(schemas: JSONSchema[]): JSONSchema {
  const allProperties = new Set<string>();
  const propertiesMap = new Map<string, JSONSchema[]>();

  // Collect all properties
  for (const schema of schemas) {
    if (!schema.properties) continue;

    for (const key of Object.keys(schema.properties)) {
      allProperties.add(key);

      if (!propertiesMap.has(key)) {
        propertiesMap.set(key, []);
      }
      propertiesMap.get(key)!.push(schema.properties[key]);
    }
  }

  // Merge each property
  const properties: Record<string, JSONSchema> = {};
  const required: string[] = [];

  for (const key of allProperties) {
    const propSchemas = propertiesMap.get(key)!;
    properties[key] = mergeSchemas(propSchemas);

    // Required if present in all examples
    if (propSchemas.length === schemas.length) {
      required.push(key);
    }
  }

  return {
    type: 'object',
    properties,
    ...(required.length > 0 && { required }),
    additionalProperties: false
  };
}

/**
 * Merge array schemas
 */
function mergeArraySchemas(schemas: JSONSchema[]): JSONSchema {
  const itemSchemas = schemas
    .map(s => s.items)
    .filter((items): items is JSONSchema => items !== undefined);

  const itemSchema = mergeSchemas(itemSchemas);

  const minItems = Math.min(...schemas.map(s => s.minItems || 0));
  const maxItems = Math.max(...schemas.map(s => s.maxItems || Infinity).filter(isFinite));

  return {
    type: 'array',
    items: itemSchema,
    ...(minItems > 0 && { minItems }),
    ...(isFinite(maxItems) && { maxItems })
  };
}

/**
 * Merge string schemas
 */
function mergeStringSchemas(schemas: JSONSchema[]): JSONSchema {
  const formats = new Set(schemas.map(s => s.format).filter(Boolean));

  const schema: JSONSchema = { type: 'string' };

  // Only keep format if all schemas agree
  if (formats.size === 1) {
    schema.format = Array.from(formats)[0];
  }

  // Min/max length
  const minLengths = schemas.map(s => s.minLength).filter((l): l is number => l !== undefined);
  const maxLengths = schemas.map(s => s.maxLength).filter((l): l is number => l !== undefined);

  if (minLengths.length > 0) {
    schema.minLength = Math.min(...minLengths);
  }

  if (maxLengths.length > 0) {
    schema.maxLength = Math.max(...maxLengths);
  }

  return schema;
}

/**
 * Merge number/integer schemas
 */
function mergeNumberSchemas(schemas: JSONSchema[]): JSONSchema {
  // If any is 'number' (float), result is 'number'
  const hasFloat = schemas.some(s => s.type === 'number');

  const minimums = schemas.map(s => s.minimum).filter((m): m is number => m !== undefined);
  const maximums = schemas.map(s => s.maximum).filter((m): m is number => m !== undefined);

  return {
    type: hasFloat ? 'number' : 'integer',
    ...(minimums.length > 0 && { minimum: Math.min(...minimums) }),
    ...(maximums.length > 0 && { maximum: Math.max(...maximums) })
  };
}

/**
 * Calculate confidence score (0.0 to 1.0)
 */
function calculateConfidence(exampleCount: number, warningCount: number): number {
  // Base confidence increases with more examples
  let confidence = Math.min(exampleCount / 10, 1.0); // Max out at 10 examples

  // Reduce confidence for warnings
  const warningPenalty = warningCount * 0.1;
  confidence = Math.max(0, confidence - warningPenalty);

  return Number(confidence.toFixed(2));
}

/**
 * Infer both source and target schemas from input/output pairs
 * Useful for migrating existing transformations
 *
 * @param inputOutputPairs - Array of [input, output] pairs
 * @param options - Inference options
 * @returns Source and target schemas
 */
export function inferSchemaPair(
  inputOutputPairs: [any, any][],
  options: SchemaInferenceOptions = {}
): { source: InferredSchema; target: InferredSchema } {
  const inputs = inputOutputPairs.map(([input]) => input);
  const outputs = inputOutputPairs.map(([, output]) => output);

  return {
    source: inferSchema(inputs, options),
    target: inferSchema(outputs, options)
  };
}

/**
 * Simplify schema by removing constraints
 * Useful when inferred schema is too strict
 *
 * @param schema - JSON Schema to simplify
 * @returns Simplified schema
 */
export function simplifySchema(schema: JSONSchema): JSONSchema {
  const simplified: JSONSchema = {
    ...schema
  };

  // Remove length constraints
  delete simplified.minLength;
  delete simplified.maxLength;
  delete simplified.minItems;
  delete simplified.maxItems;
  delete simplified.minimum;
  delete simplified.maximum;

  // Recursively simplify nested schemas
  if (simplified.properties) {
    simplified.properties = Object.fromEntries(
      Object.entries(simplified.properties).map(([key, prop]) => [
        key,
        simplifySchema(prop)
      ])
    );
  }

  if (simplified.items) {
    simplified.items = simplifySchema(simplified.items);
  }

  if (simplified.anyOf) {
    simplified.anyOf = simplified.anyOf.map(simplifySchema);
  }

  return simplified;
}

/**
 * Make all fields optional in schema
 *
 * @param schema - JSON Schema
 * @returns Schema with all fields optional
 */
export function makeOptional(schema: JSONSchema): JSONSchema {
  const optional: JSONSchema = { ...schema };

  // Remove required array
  delete optional.required;

  // Recursively make nested fields optional
  if (optional.properties) {
    optional.properties = Object.fromEntries(
      Object.entries(optional.properties).map(([key, prop]) => [
        key,
        makeOptional(prop)
      ])
    );
  }

  if (optional.items) {
    optional.items = makeOptional(optional.items);
  }

  return optional;
}

/**
 * Validate that a value matches an inferred schema
 * Useful for testing inference quality
 *
 * @param value - Value to validate
 * @param schema - Inferred schema
 * @returns True if valid
 */
export function validateAgainstSchema(value: any, schema: JSONSchema): boolean {
  // Simple validation - just check type matches
  if (schema.type === 'null') {
    return value === null;
  }

  if (schema.type === 'boolean') {
    return typeof value === 'boolean';
  }

  if (schema.type === 'number') {
    return typeof value === 'number';
  }

  if (schema.type === 'integer') {
    return typeof value === 'number' && Number.isInteger(value);
  }

  if (schema.type === 'string') {
    return typeof value === 'string';
  }

  if (schema.type === 'array') {
    if (!Array.isArray(value)) return false;
    if (schema.items) {
      return value.every(item => validateAgainstSchema(item, schema.items as JSONSchema));
    }
    return true;
  }

  if (schema.type === 'object') {
    if (typeof value !== 'object' || value === null) return false;

    // Check required fields
    if (schema.required) {
      for (const field of schema.required) {
        if (!(field in value)) return false;
      }
    }

    // Check properties
    if (schema.properties) {
      for (const [key, val] of Object.entries(value)) {
        if (key in schema.properties) {
          if (!validateAgainstSchema(val, schema.properties[key])) {
            return false;
          }
        }
      }
    }

    return true;
  }

  // anyOf - value must match at least one schema
  if (schema.anyOf) {
    return schema.anyOf.some(s => validateAgainstSchema(value, s));
  }

  return true;
}
