import type { JSONSchema, MapSpec } from './types';

export interface FakeDataOptions {
  locale?: string;
  seed?: number;
  maxArrayItems?: number;
  maxDepth?: number;
}

const DEFAULT_OPTIONS: FakeDataOptions = {
  seed: 12345,
  maxArrayItems: 3,
  maxDepth: 10
};

// Lazy-loaded faker instance
let fakerInstance: any = null;

async function getFaker() {
  if (!fakerInstance) {
    const { faker } = await import('@faker-js/faker');
    fakerInstance = faker;
  }
  return fakerInstance;
}

/**
 * Generate fake data from a JSON Schema
 */
export async function generateFakeDataFromSchema(
  schema: JSONSchema | undefined,
  options: FakeDataOptions = {},
  depth: number = 0
): Promise<any> {
  // Merge options with defaults
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const faker = await getFaker();

  // Set seed for reproducible data
  if (opts.seed !== undefined) {
    faker.seed(opts.seed);
  }

  // Handle undefined schema
  if (!schema) {
    return null;
  }

  // Prevent infinite recursion
  if (depth > (opts.maxDepth || 10)) {
    return null;
  }

  // Handle enum
  if (schema.enum && Array.isArray(schema.enum) && schema.enum.length > 0) {
    return faker.helpers.arrayElement(schema.enum);
  }

  // Handle const
  if (schema.const !== undefined) {
    return schema.const;
  }

  // Handle oneOf/anyOf - pick the first schema for simplicity
  if (schema.oneOf && Array.isArray(schema.oneOf) && schema.oneOf.length > 0) {
    return await generateFakeDataFromSchema(schema.oneOf[0] as JSONSchema, opts, depth + 1);
  }
  if (schema.anyOf && Array.isArray(schema.anyOf) && schema.anyOf.length > 0) {
    return await generateFakeDataFromSchema(schema.anyOf[0] as JSONSchema, opts, depth + 1);
  }

  // Handle type
  const type = schema.type;

  if (type === 'null') {
    return null;
  }

  if (type === 'boolean') {
    return faker.datatype.boolean();
  }

  if (type === 'integer') {
    const min = schema.minimum ?? 0;
    const max = schema.maximum ?? 1000;
    return faker.number.int({ min, max });
  }

  if (type === 'number') {
    const min = schema.minimum ?? 0;
    const max = schema.maximum ?? 1000;
    return faker.number.float({ min, max, fractionDigits: 2 });
  }

  if (type === 'string') {
    return generateFakeString(schema, faker);
  }

  if (type === 'array') {
    return await generateFakeArray(schema, opts, depth, faker);
  }

  if (type === 'object') {
    return await generateFakeObject(schema, opts, depth, faker);
  }

  // Default fallback
  return null;
}

/**
 * Generate fake string based on format and constraints
 */
function generateFakeString(schema: JSONSchema, faker: any): string {
  const format = schema.format;
  const minLength = schema.minLength ?? 1;
  const maxLength = schema.maxLength ?? 50;

  // Handle format
  switch (format) {
    case 'email':
      return faker.internet.email();
    case 'uri':
    case 'url':
      return faker.internet.url();
    case 'uuid':
      return faker.string.uuid();
    case 'date':
      return faker.date.recent().toISOString().split('T')[0];
    case 'date-time':
      return faker.date.recent().toISOString();
    case 'time':
      return faker.date.recent().toISOString().split('T')[1];
    case 'ipv4':
      return faker.internet.ipv4();
    case 'ipv6':
      return faker.internet.ipv6();
    case 'hostname':
      return faker.internet.domainName();
    default:
      break;
  }

  // Handle pattern (simplified - just generate random string)
  if (schema.pattern) {
    // For now, just generate a string that might match common patterns
    if (schema.pattern.includes('[0-9]')) {
      return faker.string.numeric({ length: Math.min(maxLength, 10) });
    }
    if (schema.pattern.includes('[a-zA-Z]')) {
      return faker.string.alpha({ length: Math.min(maxLength, 10) });
    }
  }

  // Generate generic string
  const length = Math.min(maxLength, Math.max(minLength, 20));
  return faker.lorem.words(Math.ceil(length / 6)).substring(0, length);
}

/**
 * Generate fake array
 */
async function generateFakeArray(schema: JSONSchema, opts: FakeDataOptions, depth: number, faker: any): Promise<any[]> {
  const minItems = schema.minItems ?? 1;
  const maxItems = schema.maxItems ?? opts.maxArrayItems ?? 3;
  const itemCount = faker.number.int({ min: minItems, max: Math.max(minItems, maxItems) });

  const items: any[] = [];
  for (let i = 0; i < itemCount; i++) {
    if (schema.items) {
      // Items is a schema
      items.push(await generateFakeDataFromSchema(schema.items as JSONSchema, opts, depth + 1));
    } else {
      // No items schema defined
      items.push(faker.lorem.word());
    }
  }

  return items;
}

/**
 * Generate fake object
 */
async function generateFakeObject(schema: JSONSchema, opts: FakeDataOptions, depth: number, faker: any): Promise<Record<string, any>> {
  const obj: Record<string, any> = {};

  if (!schema.properties) {
    // No properties defined - return empty object or one with additionalProperties
    if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
      // Generate a few random properties
      const propCount = faker.number.int({ min: 1, max: 3 });
      for (let i = 0; i < propCount; i++) {
        const key = faker.lorem.word();
        obj[key] = await generateFakeDataFromSchema(schema.additionalProperties as JSONSchema, opts, depth + 1);
      }
    }
    return obj;
  }

  // Generate required properties
  const required = schema.required || [];
  for (const key of required) {
    const propSchema = schema.properties[key];
    if (propSchema) {
      obj[key] = await generateFakeDataFromSchema(propSchema as JSONSchema, opts, depth + 1);
    }
  }

  // Optionally generate some non-required properties
  const allKeys = Object.keys(schema.properties);
  const optionalKeys = allKeys.filter(key => !required.includes(key));

  // Generate about half of the optional properties
  const optionalToGenerate = optionalKeys.filter(() => faker.datatype.boolean());
  for (const key of optionalToGenerate) {
    const propSchema = schema.properties[key];
    if (propSchema) {
      obj[key] = await generateFakeDataFromSchema(propSchema as JSONSchema, opts, depth + 1);
    }
  }

  return obj;
}

/**
 * Generate fake data for a MapSpec's source or target
 * This generates a multipart structure: { partName: data, anotherPart: data }
 */
export async function generateFakeDataForMapSpec(
  mapSpec: MapSpec,
  side: 'source' | 'target',
  options: FakeDataOptions = {}
): Promise<Record<string, any>> {
  const parts = side === 'source' ? mapSpec.schemaParts?.source : mapSpec.schemaParts?.target;

  if (!parts || Object.keys(parts).length === 0) {
    return {};
  }

  const result: Record<string, any> = {};

  // Generate fake data for each part
  for (const [partName, partDef] of Object.entries(parts)) {
    if (partDef.schema) {
      result[partName] = await generateFakeDataFromSchema(partDef.schema, options);
    }
  }

  return result;
}
