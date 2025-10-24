# Schema Inference from Example JSON

**Status:** Draft
**Last Updated:** 2025-10-22

## Overview

**Schema Inference** automatically generates JSON Schema definitions from example JSON data. This dramatically reduces the barrier to entry for creating mappers by eliminating the need to manually write JSON Schema files.

**User Story:**
> "As a mapper user, I want to paste example JSON data and automatically get a schema, so I can start mapping immediately without writing JSON Schema by hand."

## Use Cases

### 1. Quick Start
User has sample JSON from an API response and wants to create a mapper quickly.

```json
// User pastes this example
{
  "orderId": "ORD-12345",
  "total": 99.99,
  "items": [
    { "name": "Widget", "quantity": 2, "price": 49.99 }
  ]
}

// System generates JSON Schema
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "orderId": { "type": "string" },
    "total": { "type": "number" },
    "items": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "quantity": { "type": "integer" },
          "price": { "type": "number" }
        },
        "required": ["name", "quantity", "price"]
      }
    }
  },
  "required": ["orderId", "total", "items"]
}
```

### 2. Schema Refinement
User has an initial schema but wants to refine it with more examples.

### 3. Migration from Other Tools
User has existing data transformations and wants to migrate to Amorphie Mapper.

### 4. Testing with Real Data
User wants to test mapper with production data samples.

## Inference Algorithm

### Type Inference Rules

```typescript
function inferType(value: any): JSONSchemaType {
  // 1. Null
  if (value === null) {
    return { type: 'null' };
  }

  // 2. Boolean
  if (typeof value === 'boolean') {
    return { type: 'boolean' };
  }

  // 3. Number (distinguish integer vs float)
  if (typeof value === 'number') {
    return {
      type: Number.isInteger(value) ? 'integer' : 'number'
    };
  }

  // 4. String (detect formats)
  if (typeof value === 'string') {
    const schema: any = { type: 'string' };

    // Detect common formats
    if (isDateTimeISO8601(value)) {
      schema.format = 'date-time';
    } else if (isDateISO8601(value)) {
      schema.format = 'date';
    } else if (isEmailAddress(value)) {
      schema.format = 'email';
    } else if (isURI(value)) {
      schema.format = 'uri';
    } else if (isUUID(value)) {
      schema.format = 'uuid';
    }

    // Add constraints
    if (value.length > 0) {
      schema.minLength = value.length;
      schema.maxLength = value.length;
    }

    return schema;
  }

  // 5. Array
  if (Array.isArray(value)) {
    if (value.length === 0) {
      // Empty array - can't infer item type
      return {
        type: 'array',
        items: { type: 'string' }  // Default assumption
      };
    }

    // Infer from all items
    const itemSchemas = value.map(item => inferType(item));

    // Merge item schemas
    const itemSchema = mergeSchemas(itemSchemas);

    return {
      type: 'array',
      items: itemSchema,
      minItems: value.length,
      maxItems: value.length
    };
  }

  // 6. Object
  if (typeof value === 'object') {
    const properties: Record<string, JSONSchemaType> = {};
    const required: string[] = [];

    for (const [key, val] of Object.entries(value)) {
      properties[key] = inferType(val);
      required.push(key);  // All present fields are required
    }

    return {
      type: 'object',
      properties,
      required,
      additionalProperties: false
    };
  }

  // Fallback
  return { type: 'string' };
}
```

### Format Detection

```typescript
// Date-time detection
function isDateTimeISO8601(str: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/.test(str);
}

// Date detection
function isDateISO8601(str: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(str);
}

// Email detection
function isEmailAddress(str: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
}

// URI detection
function isURI(str: string): boolean {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

// UUID detection
function isUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}
```

### Schema Merging

When inferring from multiple examples, merge schemas:

```typescript
function mergeSchemas(schemas: JSONSchemaType[]): JSONSchemaType {
  if (schemas.length === 0) {
    return { type: 'string' };
  }

  if (schemas.length === 1) {
    return schemas[0];
  }

  // 1. Check if all same type
  const types = new Set(schemas.map(s => s.type));

  if (types.size === 1) {
    const type = schemas[0].type;

    switch (type) {
      case 'object':
        return mergeObjectSchemas(schemas as any[]);

      case 'array':
        return mergeArraySchemas(schemas as any[]);

      case 'string':
        return mergeStringSchemas(schemas as any[]);

      case 'number':
      case 'integer':
        return mergeNumberSchemas(schemas as any[]);

      default:
        return schemas[0];
    }
  }

  // 2. Multiple types - use anyOf
  return {
    anyOf: schemas
  };
}

function mergeObjectSchemas(schemas: any[]): any {
  const allProperties = new Set<string>();
  const propertiesMap = new Map<string, JSONSchemaType[]>();

  // Collect all properties
  for (const schema of schemas) {
    for (const key of Object.keys(schema.properties || {})) {
      allProperties.add(key);

      if (!propertiesMap.has(key)) {
        propertiesMap.set(key, []);
      }
      propertiesMap.get(key)!.push(schema.properties[key]);
    }
  }

  // Merge each property
  const properties: Record<string, JSONSchemaType> = {};
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
    required: required.length > 0 ? required : undefined,
    additionalProperties: false
  };
}

function mergeArraySchemas(schemas: any[]): any {
  const itemSchemas = schemas.map(s => s.items);
  const itemSchema = mergeSchemas(itemSchemas);

  return {
    type: 'array',
    items: itemSchema,
    minItems: Math.min(...schemas.map(s => s.minItems || 0)),
    maxItems: Math.max(...schemas.map(s => s.maxItems || Infinity))
  };
}

function mergeStringSchemas(schemas: any[]): any {
  const formats = new Set(schemas.map(s => s.format).filter(Boolean));

  const schema: any = { type: 'string' };

  if (formats.size === 1) {
    schema.format = Array.from(formats)[0];
  }

  // Min/max length
  const minLengths = schemas.map(s => s.minLength).filter(Boolean);
  const maxLengths = schemas.map(s => s.maxLength).filter(Boolean);

  if (minLengths.length > 0) {
    schema.minLength = Math.min(...minLengths);
  }

  if (maxLengths.length > 0) {
    schema.maxLength = Math.max(...maxLengths);
  }

  return schema;
}

function mergeNumberSchemas(schemas: any[]): any {
  // If any is 'number', result is 'number'
  const hasFloat = schemas.some(s => s.type === 'number');

  return {
    type: hasFloat ? 'number' : 'integer',
    minimum: Math.min(...schemas.map(s => s.minimum || -Infinity).filter(isFinite)),
    maximum: Math.max(...schemas.map(s => s.maximum || Infinity).filter(isFinite))
  };
}
```

## User Interface

### 1. Schema Import Dialog

**Trigger:** Click "Import from JSON" button when creating/editing mapper

**Dialog:**
```
┌─────────────────────────────────────────────────────┐
│ Import Schema from JSON                         [×] │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Schema Type: ◉ Source Schema  ○ Target Schema      │
│                                                     │
│ Paste your JSON example:                           │
│ ┌─────────────────────────────────────────────┐   │
│ │ {                                           │   │
│ │   "orderId": "ORD-12345",                   │   │
│ │   "total": 99.99,                           │   │
│ │   "items": [...]                            │   │
│ │ }                                           │   │
│ │                                             │   │
│ │                                             │   │
│ └─────────────────────────────────────────────┘   │
│                                                     │
│ [Choose File...] or drag and drop JSON file        │
│                                                     │
│ ☑ Detect string formats (date, email, UUID, etc.)  │
│ ☑ Mark all present fields as required             │
│ ☑ Add constraints (min/max length, items)         │
│                                                     │
│           [Cancel]  [Preview Schema]  [Import]      │
└─────────────────────────────────────────────────────┘
```

### 2. Preview & Edit

After clicking "Preview Schema", show generated schema with edit capabilities:

```
┌─────────────────────────────────────────────────────┐
│ Generated Schema Preview                        [×] │
├─────────────────────────────────────────────────────┤
│                                                     │
│ ┌─ Generated Schema ─────────────┬─ Examples ────┐ │
│ │ {                              │ orderId:      │ │
│ │   "$schema": "...",            │   "ORD-12345" │ │
│ │   "type": "object",            │               │ │
│ │   "properties": {              │ total:        │ │
│ │     "orderId": {               │   99.99       │ │
│ │       "type": "string"  [Edit] │               │ │
│ │     },                         │ items:        │ │
│ │     "total": {                 │   [Array(3)]  │ │
│ │       "type": "number"  [Edit] │               │ │
│ │     },                         │               │ │
│ │     ...                        │               │ │
│ │   }                            │               │ │
│ │ }                              │               │ │
│ └────────────────────────────────┴───────────────┘ │
│                                                     │
│ ⚠️ Warnings:                                        │
│ • Field 'items' is empty array - assumed string[]  │
│ • Field 'date' detected as string, should be       │
│   date-time format? [Fix]                          │
│                                                     │
│ Schema Name: [order-schema.json      ]              │
│ Description: [Order data structure   ]              │
│                                                     │
│           [Back]  [Save Schema]  [Use & Continue]   │
└─────────────────────────────────────────────────────┘
```

### 3. Multiple Examples

Support refining schema with multiple examples:

```
┌─────────────────────────────────────────────────────┐
│ Refine Schema with More Examples               [×] │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Current Schema: order-schema.json                   │
│ Examples: 1                                         │
│                                                     │
│ Add another example to improve schema:              │
│ ┌─────────────────────────────────────────────┐   │
│ │ {                                           │   │
│ │   "orderId": "ORD-67890",                   │   │
│ │   "total": 149.50,                          │   │
│ │   "items": [                                │   │
│ │     { "name": "Gadget", "quantity": 1 }     │   │
│ │   ],                                        │   │
│ │   "customer": {                             │   │
│ │     "name": "John Doe"                      │   │
│ │   }                                         │   │
│ │ }                                           │   │
│ └─────────────────────────────────────────────┘   │
│                                                     │
│ Changes detected:                                   │
│ • New field: customer (object)                      │
│ • Items array now has example data                  │
│                                                     │
│           [Cancel]  [Merge Changes]  [Replace]      │
└─────────────────────────────────────────────────────┘
```

## CLI Support

```bash
# Infer schema from single file
mapper infer example.json --output order.schema.json

# Infer from multiple examples
mapper infer example1.json example2.json example3.json \
  --output order.schema.json

# Customize inference
mapper infer example.json \
  --output order.schema.json \
  --detect-formats \
  --all-required \
  --no-constraints

# Pipe from stdin
cat example.json | mapper infer --output order.schema.json

# Infer both source and target from existing transformation
mapper infer-pair input.json output.json \
  --source-schema source.schema.json \
  --target-schema target.schema.json
```

## Integration with Mapper

### 1. During Mapper Creation

When creating a new mapper:

```typescript
// Mapper creation wizard
const wizard = {
  step1: 'Choose source schema',
  options: [
    'Select existing schema file',
    'Import from JSON example',  // ← New option
    'Create manually'
  ]
};
```

### 2. Schema Management

In mapper editor:

```
[Source Schema ▼]
  ├─ Change Schema...
  ├─ Import from JSON...    ← Add this option
  ├─ Refine with Examples...
  └─ Edit Schema Manually...
```

### 3. Quick Fix

If user tries to connect incompatible types:

```
⚠️ Type mismatch: Cannot connect string to number

Quick fixes:
• Insert type conversion (ToString/ToNumber)
• Update source schema from example  ← New option
• Update target schema from example
```

## Limitations & Edge Cases

### 1. Empty Arrays

**Problem:** Cannot infer item type from `[]`

**Solution:**
- Default to `{ type: 'string' }`
- Show warning
- Allow user to refine with non-empty example

### 2. Null Values

**Problem:** `{ "field": null }` - is field nullable or missing?

**Solution:**
- Mark as nullable: `{ "type": ["string", "null"] }`
- Suggest user provide non-null example

### 3. Type Conflicts

**Problem:** Multiple examples with different types

**Example:**
```json
// Example 1
{ "id": "ABC123" }

// Example 2
{ "id": 12345 }
```

**Solution:**
- Use `anyOf`: `{ "anyOf": [{ "type": "string" }, { "type": "integer" }] }`
- Show warning: "Field 'id' has inconsistent types"
- Suggest manual review

### 4. Large Objects

**Problem:** Deeply nested objects with many fields

**Solution:**
- Show progress indicator
- Limit nesting depth (default: 10 levels)
- Provide "Simplify" option to flatten

### 5. Ambiguous Formats

**Problem:** String could be multiple formats

**Example:** `"2024-01-15"` (date or just a string?)

**Solution:**
- Apply heuristics (if matches date pattern → date format)
- Show confidence level
- Allow user to override

## Performance Considerations

### Optimization Strategies

1. **Lazy Inference:** Only infer visible portions of large objects
2. **Caching:** Cache inferred schemas for repeated examples
3. **Streaming:** Process large JSON files in chunks
4. **Web Worker:** Run inference in background thread

```typescript
// Optimized inference for large files
async function inferSchemaLarge(
  jsonFile: File,
  options: InferOptions
): Promise<JSONSchema> {
  const worker = new Worker('schema-inference-worker.js');

  return new Promise((resolve, reject) => {
    worker.postMessage({ file: jsonFile, options });

    worker.onmessage = (e) => {
      resolve(e.data.schema);
      worker.terminate();
    };

    worker.onerror = (err) => {
      reject(err);
      worker.terminate();
    };
  });
}
```

## Testing Strategy

### Test Cases

```typescript
describe('Schema Inference', () => {
  it('should infer primitive types', () => {
    const input = { name: 'John', age: 30, active: true };
    const schema = inferSchema(input);

    expect(schema.properties.name.type).toBe('string');
    expect(schema.properties.age.type).toBe('integer');
    expect(schema.properties.active.type).toBe('boolean');
  });

  it('should detect date-time format', () => {
    const input = { timestamp: '2024-01-15T10:30:00Z' };
    const schema = inferSchema(input);

    expect(schema.properties.timestamp.format).toBe('date-time');
  });

  it('should infer nested objects', () => {
    const input = {
      user: {
        name: 'John',
        address: {
          city: 'NYC'
        }
      }
    };

    const schema = inferSchema(input);

    expect(schema.properties.user.type).toBe('object');
    expect(schema.properties.user.properties.address.type).toBe('object');
  });

  it('should merge multiple examples', () => {
    const ex1 = { name: 'John', age: 30 };
    const ex2 = { name: 'Jane', email: 'jane@example.com' };

    const schema = inferSchema([ex1, ex2]);

    expect(Object.keys(schema.properties)).toContain('name');
    expect(Object.keys(schema.properties)).toContain('age');
    expect(Object.keys(schema.properties)).toContain('email');

    // name is required (in both), age and email are optional
    expect(schema.required).toContain('name');
    expect(schema.required).not.toContain('age');
  });

  it('should handle empty arrays', () => {
    const input = { items: [] };
    const schema = inferSchema(input);

    expect(schema.properties.items.type).toBe('array');
    expect(schema.properties.items.items).toBeDefined();
  });

  it('should handle type conflicts with anyOf', () => {
    const ex1 = { id: 'ABC123' };
    const ex2 = { id: 12345 };

    const schema = inferSchema([ex1, ex2]);

    expect(schema.properties.id.anyOf).toBeDefined();
    expect(schema.properties.id.anyOf.length).toBe(2);
  });
});
```

## Library Options

### Option 1: json-schema-generator

```bash
npm install json-schema-generator
```

**Pros:**
- Mature library
- Handles most cases

**Cons:**
- No format detection
- Limited customization

### Option 2: to-json-schema

```bash
npm install to-json-schema
```

**Pros:**
- Good format detection
- Customizable options

**Cons:**
- Doesn't merge multiple examples

### Option 3: Custom Implementation

**Pros:**
- Full control
- Tailored to our needs
- Better error messages

**Cons:**
- More work
- Need to handle edge cases

**Recommendation:** Start with `to-json-schema`, extend with custom logic for merging and refinement.

## Implementation Plan

### Phase 1: Basic Inference (Week 1)

- Implement core inference algorithm
- Support primitive types, objects, arrays
- Basic format detection (date, email)
- Unit tests

### Phase 2: UI Integration (Week 1)

- Add "Import from JSON" dialog
- Show generated schema preview
- Save to file

### Phase 3: Multiple Examples (Week 2)

- Implement schema merging
- "Refine with examples" feature
- Conflict detection and warnings

### Phase 4: Advanced Features (Week 2)

- CLI support
- Large file handling
- Web worker optimization
- Format customization

### Phase 5: Polish (Week 3)

- Error messages
- Edge case handling
- Documentation
- Examples library

## Success Metrics

**Adoption:**
- 80% of new mappers use inference feature
- Average time to create mapper reduced by 60%

**Quality:**
- 95% of inferred schemas require no manual edits
- < 5% false positive on format detection

**Performance:**
- Inference completes in < 1 second for typical JSON (< 100 fields)
- Handles files up to 10MB

## See Also

- [MapSpec Schema](./04-mapspec-schema.md) - MapSpec format
- [Canvas Architecture](./02-canvas-architecture.md) - Canvas design
- [File Conventions](./03-file-conventions.md) - Schema file conventions
- [JSON Schema Docs](https://json-schema.org/) - JSON Schema reference
