# MapSpec Schema

## Overview

**MapSpec** is the domain model for a mapper. It describes **what** the mapping does (semantic data), not **where** things are positioned on screen (that's GraphLayout).

**File:** `*.mapper.json`

**Purpose:**
- Define transformation logic
- Store nodes (functoids) and edges (connections)
- Include test cases
- Reference source/target schemas
- Generate JSONata code from this model

---

## Schema Structure

```typescript
interface MapSpec {
  version: string;                    // Schema version (e.g., "1.0.0")
  metadata: MapMetadata;              // Descriptive information
  inputSchemaRef: string;             // Path to source JSON Schema
  outputSchemaRef: string;            // Path to target JSON Schema
  nodes: MapNode[];                   // Functoid nodes (NOT schema nodes)
  edges: MapEdge[];                   // Connections between handles
  tests?: MapTest[];                  // Test cases (optional)
}
```

---

## Metadata

```typescript
interface MapMetadata {
  name: string;                       // Display name (e.g., "Order to Invoice")
  description?: string;               // Human-readable description
  author?: string;                    // Creator
  createdAt: string;                  // ISO 8601 timestamp
  updatedAt: string;                  // ISO 8601 timestamp
  tags?: string[];                    // Categorization tags
}
```

**Example:**

```json
{
  "metadata": {
    "name": "Order to Invoice Mapper",
    "description": "Transforms order data to invoice format with line item calculations",
    "author": "user@example.com",
    "createdAt": "2025-01-15T10:30:00Z",
    "updatedAt": "2025-01-20T14:45:00Z",
    "tags": ["order-processing", "invoicing"]
  }
}
```

---

## Schema References

```typescript
interface MapSpec {
  inputSchemaRef: string;   // Relative path to source schema
  outputSchemaRef: string;  // Relative path to target schema
}
```

**Rules:**
- Paths are **relative** to mapper file location
- Schema files must be JSON Schema (Draft 7 or later)
- Schemas are **not embedded** in MapSpec (referenced only)

**Example:**

```json
{
  "inputSchemaRef": "../schemas/order.schema.json",
  "outputSchemaRef": "../schemas/invoice.schema.json"
}
```

**Why separate?**
- Schemas can be reused across multiple mappers
- Schema changes don't require mapper file edits
- Cleaner separation of concerns
- Easier schema management

---

## Node Types

### Important: Schema Nodes Are Implicit

**Schema nodes are NOT stored in MapSpec.**

They are **always present** with fixed IDs:
- `source-schema` - Source schema node (left side)
- `target-schema` - Target schema node (right side)

These are reconstructed from `inputSchemaRef` and `outputSchemaRef` when the mapper loads.

### Stored Nodes: Functoids and Constants

```typescript
interface MapNode {
  id: string;                         // Unique node ID (e.g., "functoid-multiply-1")
  kind: NodeKind;                     // Node type
  data: Record<string, any>;          // Node-specific data
}

type NodeKind =
  | 'Binary'       // Binary operations (Add, Subtract, Multiply, etc.)
  | 'Unary'        // Unary operations (Negate, Not, etc.)
  | 'String'       // String functions (Concat, Substring, etc.)
  | 'Conditional'  // If/Then/Else logic
  | 'Collection'   // Array operations (Map, Filter, Reduce, etc.)
  | 'Aggregate'    // Aggregations (Sum, Count, Max, etc.)
  | 'Const'        // Literal constant values
  | 'Custom';      // Custom functoid (JSONata expression)
```

---

## Node Examples

### Binary Functoid (Multiply)

```json
{
  "id": "functoid-multiply-1",
  "kind": "Binary",
  "data": {
    "op": "Mul",
    "label": "Multiply"
  }
}
```

**Handles:**
- Input: `in1`, `in2`
- Output: `out`

### String Functoid (Concat)

```json
{
  "id": "functoid-concat-1",
  "kind": "String",
  "data": {
    "op": "Concat",
    "separator": " ",
    "label": "Concatenate"
  }
}
```

**Handles:**
- Input: `in1`, `in2`, ... `inN` (variable arity)
- Output: `out`

### Conditional Functoid

```json
{
  "id": "functoid-if-1",
  "kind": "Conditional",
  "data": {
    "op": "If",
    "label": "If Then Else"
  }
}
```

**Handles:**
- Input: `condition`, `then`, `else`
- Output: `out`

### Collection Functoid (Map)

```json
{
  "id": "functoid-map-1",
  "kind": "Collection",
  "data": {
    "op": "Map",
    "label": "Map Array"
  }
}
```

**Handles:**
- Input: `array`, `fn`
- Output: `out`

### Const Node (Literal Value)

```json
{
  "id": "const-1",
  "kind": "Const",
  "data": {
    "value": 0.08,
    "type": "number",
    "label": "Tax Rate"
  }
}
```

**Handles:**
- Input: none
- Output: `out`

### Custom Functoid (Raw JSONata)

```json
{
  "id": "functoid-custom-1",
  "kind": "Custom",
  "data": {
    "expression": "$sum(items.price) * 1.08",
    "label": "Custom Total Calculation"
  }
}
```

**Handles:**
- Input: `in` (context)
- Output: `out`

---

## Edges

### Edge Structure

```typescript
interface MapEdge {
  id: string;                         // Unique edge ID
  from: string;                       // Source node ID
  fromHandle: string;                 // Source handle ID
  to: string;                         // Target node ID
  toHandle: string;                   // Target handle ID
  label?: string;                     // Optional edge label
}
```

### Handle IDs for Schema Nodes

For schema nodes (`source-schema`, `target-schema`), handle IDs are **JSONPath expressions**:

```typescript
// Simple field
'$.orderNumber'

// Nested field
'$.customer.name'

// Array item field
'$.items[].quantity'

// Deeply nested
'$.customer.addresses[].city'
```

**Why JSONPath?**
- ✅ Unique identifier for each field
- ✅ Semantic meaning (describes location in schema)
- ✅ Direct mapping to JSONata expressions
- ✅ Human-readable in saved files

### Edge Examples

**Direct field-to-field mapping:**

```json
{
  "id": "edge-1",
  "from": "source-schema",
  "fromHandle": "$.orderNumber",
  "to": "target-schema",
  "toHandle": "$.invoiceNumber"
}
```

**Field to functoid:**

```json
{
  "id": "edge-2",
  "from": "source-schema",
  "fromHandle": "$.items[].quantity",
  "to": "functoid-multiply-1",
  "toHandle": "in1"
}
```

**Functoid to field:**

```json
{
  "id": "edge-3",
  "from": "functoid-multiply-1",
  "fromHandle": "out",
  "to": "target-schema",
  "toHandle": "$.lineItems[].lineTotal"
}
```

**Functoid chain:**

```json
{
  "id": "edge-4",
  "from": "functoid-multiply-1",
  "fromHandle": "out",
  "to": "functoid-if-1",
  "toHandle": "then"
}
```

---

## Complete Example

```json
{
  "version": "1.0.0",
  "metadata": {
    "name": "Order to Invoice",
    "description": "Calculate invoice line totals and apply tax",
    "author": "developer@company.com",
    "createdAt": "2025-01-15T10:00:00Z",
    "updatedAt": "2025-01-20T15:30:00Z",
    "tags": ["invoicing", "order-processing"]
  },
  "inputSchemaRef": "../schemas/order.schema.json",
  "outputSchemaRef": "../schemas/invoice.schema.json",
  "nodes": [
    {
      "id": "functoid-multiply-1",
      "kind": "Binary",
      "data": {
        "op": "Mul",
        "label": "Calculate Line Total"
      }
    },
    {
      "id": "const-tax-rate",
      "kind": "Const",
      "data": {
        "value": 0.08,
        "type": "number",
        "label": "Tax Rate"
      }
    },
    {
      "id": "functoid-multiply-2",
      "kind": "Binary",
      "data": {
        "op": "Mul",
        "label": "Calculate Tax"
      }
    }
  ],
  "edges": [
    {
      "id": "edge-1",
      "from": "source-schema",
      "fromHandle": "$.orderNumber",
      "to": "target-schema",
      "toHandle": "$.invoiceNumber"
    },
    {
      "id": "edge-2",
      "from": "source-schema",
      "fromHandle": "$.items[].quantity",
      "to": "functoid-multiply-1",
      "toHandle": "in1"
    },
    {
      "id": "edge-3",
      "from": "source-schema",
      "fromHandle": "$.items[].price",
      "to": "functoid-multiply-1",
      "toHandle": "in2"
    },
    {
      "id": "edge-4",
      "from": "functoid-multiply-1",
      "fromHandle": "out",
      "to": "target-schema",
      "toHandle": "$.lineItems[].lineTotal"
    },
    {
      "id": "edge-5",
      "from": "functoid-multiply-1",
      "fromHandle": "out",
      "to": "functoid-multiply-2",
      "toHandle": "in1"
    },
    {
      "id": "edge-6",
      "from": "const-tax-rate",
      "fromHandle": "out",
      "to": "functoid-multiply-2",
      "toHandle": "in2"
    },
    {
      "id": "edge-7",
      "from": "functoid-multiply-2",
      "fromHandle": "out",
      "to": "target-schema",
      "toHandle": "$.tax"
    }
  ],
  "tests": [
    {
      "name": "Basic calculation",
      "input": {
        "orderNumber": "ORD-001",
        "items": [
          { "quantity": 2, "price": 10.00 }
        ]
      },
      "expected": {
        "invoiceNumber": "ORD-001",
        "lineItems": [
          { "lineTotal": 20.00 }
        ],
        "tax": 1.60
      }
    }
  ]
}
```

---

## Test Cases

```typescript
interface MapTest {
  name: string;                       // Test case name
  description?: string;               // Optional description
  input: any;                         // Input JSON (matches inputSchema)
  expected: any;                      // Expected output (matches outputSchema)
  enabled?: boolean;                  // Whether test is active (default: true)
}
```

**Example:**

```json
{
  "name": "Single item order",
  "description": "Test basic calculation with one item",
  "input": {
    "orderNumber": "ORD-123",
    "items": [
      { "productId": "P001", "quantity": 3, "price": 15.99 }
    ]
  },
  "expected": {
    "invoiceNumber": "ORD-123",
    "lineItems": [
      { "productId": "P001", "lineTotal": 47.97 }
    ]
  },
  "enabled": true
}
```

**Test Execution:**
1. Load MapSpec and schemas
2. Generate JSONata code from MapSpec
3. Execute JSONata with `test.input`
4. Compare result with `test.expected`
5. Show pass/fail with diff

---

## Node Kind Reference

### Binary Operations

**`kind: "Binary"`**

Supported operations (`data.op`):
- `Add` - Addition
- `Subtract` - Subtraction
- `Multiply` - Multiplication
- `Divide` - Division
- `Modulo` - Remainder
- `Power` - Exponentiation
- `And` - Logical AND
- `Or` - Logical OR
- `Equal` - Equality check
- `NotEqual` - Inequality check
- `Greater` - Greater than
- `GreaterEqual` - Greater than or equal
- `Less` - Less than
- `LessEqual` - Less than or equal

**Handles:** `in1`, `in2`, `out`

### Unary Operations

**`kind: "Unary"`**

Supported operations:
- `Negate` - Numeric negation
- `Not` - Logical NOT
- `Abs` - Absolute value
- `Ceil` - Round up
- `Floor` - Round down
- `Round` - Round to nearest

**Handles:** `in`, `out`

### String Operations

**`kind: "String"`**

Supported operations:
- `Concat` - Concatenate strings (variable arity)
- `Substring` - Extract substring
- `Uppercase` - Convert to uppercase
- `Lowercase` - Convert to lowercase
- `Trim` - Remove whitespace
- `Replace` - Replace substring
- `Split` - Split string to array
- `Join` - Join array to string

**Handles:** Varies by operation

### Conditional

**`kind: "Conditional"`**

Operations:
- `If` - If-then-else logic

**Handles:** `condition`, `then`, `else`, `out`

### Collection Operations

**`kind: "Collection"`**

Operations:
- `Map` - Transform each element
- `Filter` - Select elements matching condition
- `Reduce` - Aggregate array to single value
- `ForEach` - Iterate over array (for side effects)
- `Flatten` - Flatten nested arrays
- `Unique` - Remove duplicates
- `Sort` - Sort array

**Handles:** Varies by operation

### Aggregate Operations

**`kind: "Aggregate"`**

Operations:
- `Sum` - Sum of array elements
- `Count` - Count elements
- `Average` - Mean value
- `Max` - Maximum value
- `Min` - Minimum value
- `GroupBy` - Group elements by key

**Handles:** `array`, `out` (plus operation-specific inputs)

---

## Validation Rules

### MapSpec Validation

**File must:**
1. ✅ Have valid `version` field
2. ✅ Reference existing schema files
3. ✅ Have unique node IDs
4. ✅ Have unique edge IDs
5. ✅ Reference valid node IDs in edges
6. ✅ Reference valid handle IDs
7. ✅ Have no circular dependencies
8. ✅ Have valid node `kind` values
9. ✅ Have required `data` fields for each node kind
10. ✅ Match test input/output to schemas

### Edge Validation

**Edges must:**
- Connect valid nodes
- Reference existing handles
- Not create cycles (for non-feedback nodes)
- Match handle types (source → target, target → source not allowed)

### Handle Validation

**Schema node handles must:**
- Use valid JSONPath syntax
- Reference fields that exist in schema
- Match field types at connection endpoints

---

## Serialization Format

**File format:** JSON with 2-space indentation

**Example file structure:**

```json
{
  "version": "1.0.0",
  "metadata": { ... },
  "inputSchemaRef": "...",
  "outputSchemaRef": "...",
  "nodes": [ ... ],
  "edges": [ ... ],
  "tests": [ ... ]
}
```

**Deterministic ordering:**
- Nodes sorted by ID
- Edges sorted by ID
- Tests in definition order

**Why deterministic?**
- Git-friendly diffs
- Easier code reviews
- Consistent file format

---

## MapSpec vs GraphLayout

| Aspect | MapSpec | GraphLayout |
|--------|---------|-------------|
| **What** | Transformation logic | Visual layout |
| **File** | `*.mapper.json` | `*.mapper.diagram.json` |
| **Contains** | Nodes, edges, tests | Positions, zoom, viewport |
| **Changes when** | Logic changes | Canvas rearranged |
| **Version control** | Always commit | Optional (can regenerate) |
| **Affects output** | Yes (JSONata code) | No |

**Separation benefits:**
- Logic changes don't trigger layout changes
- Can auto-layout without affecting MapSpec
- Cleaner git diffs
- Layout is regeneratable from MapSpec

---

## JSON Schema Definition

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://amorphie.io/schemas/mapper/mapspec-v1.json",
  "title": "MapSpec",
  "description": "Amorphie Mapper specification - defines JSON-to-JSON transformation logic",
  "type": "object",
  "required": ["version", "metadata", "inputSchemaRef", "outputSchemaRef", "nodes", "edges"],
  "properties": {
    "version": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+\\.\\d+$",
      "description": "Semantic version of MapSpec format"
    },
    "metadata": {
      "type": "object",
      "required": ["name", "createdAt", "updatedAt"],
      "properties": {
        "name": { "type": "string", "minLength": 1 },
        "description": { "type": "string" },
        "author": { "type": "string" },
        "createdAt": { "type": "string", "format": "date-time" },
        "updatedAt": { "type": "string", "format": "date-time" },
        "tags": { "type": "array", "items": { "type": "string" } }
      }
    },
    "inputSchemaRef": {
      "type": "string",
      "description": "Relative path to source JSON Schema"
    },
    "outputSchemaRef": {
      "type": "string",
      "description": "Relative path to target JSON Schema"
    },
    "nodes": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "kind", "data"],
        "properties": {
          "id": { "type": "string", "pattern": "^[a-z0-9-]+$" },
          "kind": {
            "type": "string",
            "enum": ["Binary", "Unary", "String", "Conditional", "Collection", "Aggregate", "Const", "Custom"]
          },
          "data": { "type": "object" }
        }
      }
    },
    "edges": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "from", "fromHandle", "to", "toHandle"],
        "properties": {
          "id": { "type": "string", "pattern": "^edge-[0-9]+$" },
          "from": { "type": "string" },
          "fromHandle": { "type": "string" },
          "to": { "type": "string" },
          "toHandle": { "type": "string" },
          "label": { "type": "string" }
        }
      }
    },
    "tests": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["name", "input", "expected"],
        "properties": {
          "name": { "type": "string", "minLength": 1 },
          "description": { "type": "string" },
          "input": {},
          "expected": {},
          "enabled": { "type": "boolean", "default": true }
        }
      }
    }
  }
}
```

---

## Usage in Code

### Loading MapSpec

```typescript
import { readFile } from 'fs/promises';
import Ajv from 'ajv';
import { MapSpec } from './types';

async function loadMapSpec(path: string): Promise<MapSpec> {
  const content = await readFile(path, 'utf-8');
  const mapSpec = JSON.parse(content) as MapSpec;

  // Validate against schema
  const ajv = new Ajv();
  const valid = ajv.validate(mapSpecSchema, mapSpec);

  if (!valid) {
    throw new Error(`Invalid MapSpec: ${ajv.errorsText()}`);
  }

  return mapSpec;
}
```

### Saving MapSpec

```typescript
async function saveMapSpec(path: string, mapSpec: MapSpec): Promise<void> {
  // Update timestamp
  mapSpec.metadata.updatedAt = new Date().toISOString();

  // Sort for deterministic output
  mapSpec.nodes.sort((a, b) => a.id.localeCompare(b.id));
  mapSpec.edges.sort((a, b) => a.id.localeCompare(b.id));

  const json = JSON.stringify(mapSpec, null, 2);
  await writeFile(path, json, 'utf-8');
}
```

---

## Next Steps

- **[GraphLayout Schema](./05-graphlayout-schema.md)** — Visual layout data
- **[Schema Flattening](./06-schema-flattening.md)** — JSON Schema → tree structure
- **[JSONata Codegen](./10-jsonata-codegen.md)** — MapSpec → JSONata transformation
- **[Validation Rules](./12-validation.md)** — Validation implementation
