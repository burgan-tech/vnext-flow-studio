# File Conventions

## Overview

The Amorphie Mapper uses **multiple files** to separate concerns:

- **Logic** (MapSpec) - Domain model, transformation rules
- **Layout** (GraphLayout) - UI positions, zoom, viewport
- **Schemas** (JSON Schema) - Source and target data structures
- **Tests** (optional) - Can be embedded or separate

This separation provides:
- ✅ **Cleaner git diffs** - Layout changes don't pollute logic commits
- ✅ **Auto-layout capability** - Can regenerate layout without affecting logic
- ✅ **Schema reuse** - Multiple mappers can share schemas
- ✅ **Optional layout** - Can run headless without layout data

---

## File Types

### 1. MapSpec File (Required)

**Filename:** `<name>.mapper.json`

**Purpose:** Defines the mapping logic

**Contains:**
- Metadata (name, description, timestamps)
- Schema references (input/output)
- Nodes (functoids, constants)
- Edges (connections between handles)
- Tests (optional, can be external)

**Example:** `order-to-invoice.mapper.json`

**Version controlled:** ✅ **Always commit**

---

### 2. GraphLayout File (Optional)

**Filename:** `<name>.mapper.diagram.json`

**Purpose:** Stores visual layout data

**Contains:**
- Node positions (x, y coordinates)
- Canvas viewport (zoom, pan)
- Node dimensions (width, height)
- Collapsed/expanded state
- UI preferences

**Example:** `order-to-invoice.mapper.diagram.json`

**Version controlled:** ⚠️ **Optional** (can be regenerated)

**Why optional?**
- Auto-layout can regenerate positions
- Personal preference (different developers may prefer different layouts)
- Not required for JSONata generation

---

### 3. JSON Schema Files (Required)

**Filename:** `<name>.schema.json`

**Purpose:** Define source and target data structures

**Contains:**
- JSON Schema (Draft 7+)
- Property definitions
- Type constraints
- Descriptions

**Examples:**
- `order.schema.json` (source)
- `invoice.schema.json` (target)

**Version controlled:** ✅ **Always commit**

**Location:** Typically in `schemas/` directory

---

### 4. Test Files (Optional)

**Option A:** Embedded in MapSpec (simple)

**Option B:** Separate files (recommended for many tests)

**Filename:** `<name>.mapper.test.json`

**Purpose:** Test cases for mapper

**Contains:**
- Input/expected output pairs
- Test names and descriptions
- Enabled/disabled flags

**Example:** `order-to-invoice.mapper.test.json`

**Version controlled:** ✅ **Always commit**

---

### 5. Generated Output (Build Artifacts)

**Filename:** `<name>.mapper.jsonata`

**Purpose:** Generated JSONata code

**Contains:**
- Executable JSONata expression
- Generated from MapSpec
- Ready to run

**Example:** `order-to-invoice.mapper.jsonata`

**Version controlled:** ❌ **Do not commit** (generated)

**Location:** `dist/` or `build/` directory

---

## Naming Conventions

### Mapper Names

**Pattern:** `<source>-to-<target>.mapper.json`

**Examples:**
- `order-to-invoice.mapper.json`
- `customer-to-contact.mapper.json`
- `api-response-to-database-record.mapper.json`

**Rules:**
- Lowercase with hyphens
- Descriptive source and target
- Must end with `.mapper.json`

### Schema Names

**Pattern:** `<entity>.schema.json`

**Examples:**
- `order.schema.json`
- `invoice.schema.json`
- `customer.schema.json`

**Rules:**
- Singular entity name
- Lowercase with hyphens for multi-word
- Must end with `.schema.json`

### Test Files

**Pattern:** `<mapper-name>.test.json` or `<mapper-name>.<test-name>.json`

**Examples:**
- `order-to-invoice.test.json` (all tests)
- `order-to-invoice.basic.json` (specific test suite)
- `order-to-invoice.edge-cases.json`

---

## Directory Structure

### Recommended Layout

```
project/
├── mappers/                           # Mapper definitions
│   ├── order-to-invoice.mapper.json
│   ├── order-to-invoice.mapper.diagram.json
│   ├── customer-to-contact.mapper.json
│   └── customer-to-contact.mapper.diagram.json
│
├── schemas/                           # JSON Schemas
│   ├── order.schema.json
│   ├── invoice.schema.json
│   ├── customer.schema.json
│   └── contact.schema.json
│
├── tests/                             # Test cases (optional)
│   ├── order-to-invoice.test.json
│   └── customer-to-contact.test.json
│
└── dist/                              # Generated output
    ├── order-to-invoice.mapper.jsonata
    └── customer-to-contact.mapper.jsonata
```

### Alternative: Co-located Tests

```
project/
├── mappers/
│   ├── order-to-invoice/
│   │   ├── mapper.json               # MapSpec
│   │   ├── diagram.json              # GraphLayout
│   │   ├── basic.test.json           # Test: basic case
│   │   └── edge-cases.test.json      # Test: edge cases
│   └── customer-to-contact/
│       ├── mapper.json
│       └── diagram.json
│
├── schemas/
│   ├── order.schema.json
│   └── ...
│
└── dist/
    └── ...
```

---

## File Relationships

### Reference Graph

```
order-to-invoice.mapper.json
├─► references: order.schema.json       (inputSchemaRef)
├─► references: invoice.schema.json     (outputSchemaRef)
├─► generates: order-to-invoice.mapper.jsonata
└─► tested by: order-to-invoice.test.json

order-to-invoice.mapper.diagram.json
└─► layout for: order-to-invoice.mapper.json
```

### Path Resolution

**Relative paths** from mapper file location:

```json
{
  "inputSchemaRef": "../schemas/order.schema.json",
  "outputSchemaRef": "../schemas/invoice.schema.json"
}
```

**Rules:**
- Paths are relative to the mapper file
- Use forward slashes (works on all platforms)
- No absolute paths (portability)

---

## MapSpec File Structure

### Minimal Example

```json
{
  "version": "1.0.0",
  "metadata": {
    "name": "Order to Invoice",
    "createdAt": "2025-01-20T10:00:00Z",
    "updatedAt": "2025-01-20T10:00:00Z"
  },
  "inputSchemaRef": "../schemas/order.schema.json",
  "outputSchemaRef": "../schemas/invoice.schema.json",
  "nodes": [],
  "edges": []
}
```

### Full Example

```json
{
  "version": "1.0.0",
  "metadata": {
    "name": "Order to Invoice",
    "description": "Transform order data to invoice format",
    "author": "developer@company.com",
    "createdAt": "2025-01-20T10:00:00Z",
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
    }
  ],
  "edges": [
    {
      "id": "edge-1",
      "from": "source-schema",
      "fromHandle": "$.items[].quantity",
      "to": "functoid-multiply-1",
      "toHandle": "in1"
    }
  ],
  "tests": [
    {
      "name": "Basic calculation",
      "input": { "orderNumber": "ORD-001" },
      "expected": { "invoiceNumber": "ORD-001" }
    }
  ]
}
```

---

## GraphLayout File Structure

### Purpose

Stores **UI-only data** that doesn't affect transformation logic.

### Example

```json
{
  "version": "1.0.0",
  "viewport": {
    "x": 0,
    "y": 0,
    "zoom": 1.0
  },
  "nodes": {
    "source-schema": {
      "position": { "x": 50, "y": 50 },
      "expanded": true
    },
    "target-schema": {
      "position": { "x": 950, "y": 50 },
      "expanded": true
    },
    "functoid-multiply-1": {
      "position": { "x": 500, "y": 200 },
      "width": 100,
      "height": 80
    }
  },
  "schemaTreeState": {
    "source": {
      "expandedNodes": ["$.customer", "$.items"],
      "scrollPosition": 0
    },
    "target": {
      "expandedNodes": ["$.lineItems"],
      "scrollPosition": 0
    }
  }
}
```

### Schema

```typescript
interface GraphLayout {
  version: string;
  viewport: {
    x: number;
    y: number;
    zoom: number;
  };
  nodes: {
    [nodeId: string]: {
      position: { x: number; y: number };
      width?: number;
      height?: number;
      expanded?: boolean;
    };
  };
  schemaTreeState?: {
    source?: {
      expandedNodes?: string[];
      scrollPosition?: number;
    };
    target?: {
      expandedNodes?: string[];
      scrollPosition?: number;
    };
  };
}
```

---

## Schema File Format

### Standard JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://company.com/schemas/order.json",
  "title": "Order",
  "description": "Customer order data",
  "type": "object",
  "required": ["orderNumber"],
  "properties": {
    "orderNumber": {
      "type": "string",
      "description": "Unique order identifier"
    },
    "customer": {
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "name": { "type": "string" }
      }
    },
    "items": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "productId": { "type": "string" },
          "quantity": { "type": "number" },
          "price": { "type": "number" }
        }
      }
    }
  }
}
```

### Requirements

- ✅ Must be valid JSON Schema (Draft 7 or later)
- ✅ Must have `type` at root level
- ✅ Should include descriptions
- ✅ Should define required fields

---

## Test File Format

### Embedded Tests (Simple)

Tests can be included in MapSpec:

```json
{
  "version": "1.0.0",
  "metadata": { ... },
  "inputSchemaRef": "...",
  "outputSchemaRef": "...",
  "nodes": [ ... ],
  "edges": [ ... ],
  "tests": [
    {
      "name": "Basic case",
      "input": { "orderNumber": "ORD-001" },
      "expected": { "invoiceNumber": "ORD-001" }
    }
  ]
}
```

### Separate Test File (Recommended)

**File:** `order-to-invoice.test.json`

```json
{
  "version": "1.0.0",
  "mapperRef": "./order-to-invoice.mapper.json",
  "tests": [
    {
      "name": "Single item order",
      "description": "Basic calculation with one line item",
      "input": {
        "orderNumber": "ORD-001",
        "items": [
          { "productId": "P001", "quantity": 2, "price": 10.00 }
        ]
      },
      "expected": {
        "invoiceNumber": "ORD-001",
        "lineItems": [
          { "productId": "P001", "lineTotal": 20.00 }
        ]
      },
      "enabled": true
    },
    {
      "name": "Multiple items",
      "description": "Order with multiple line items",
      "input": { ... },
      "expected": { ... }
    }
  ]
}
```

---

## Git Workflow

### What to Commit

**Always commit:**
- ✅ `*.mapper.json` (MapSpec - logic)
- ✅ `*.schema.json` (Schemas - data structures)
- ✅ `*.test.json` (Tests - validation)

**Optional:**
- ⚠️ `*.mapper.diagram.json` (GraphLayout - personal preference)

**Never commit:**
- ❌ `*.mapper.jsonata` (Generated output)
- ❌ `dist/` or `build/` directories
- ❌ `.mapper.lock.json` (if using lock files)

### `.gitignore`

```gitignore
# Generated files
dist/
build/
*.mapper.jsonata

# Optional: Diagram files (personal preference)
# *.mapper.diagram.json

# Lock files
*.mapper.lock.json
```

---

## VS Code Integration

### File Associations

**`.vscode/settings.json`**

```json
{
  "files.associations": {
    "*.mapper.json": "json",
    "*.schema.json": "json",
    "*.test.json": "json",
    "*.mapper.diagram.json": "json"
  },
  "json.schemas": [
    {
      "fileMatch": ["*.mapper.json"],
      "url": "./schemas/mapspec.schema.json"
    },
    {
      "fileMatch": ["*.schema.json"],
      "url": "http://json-schema.org/draft-07/schema#"
    }
  ]
}
```

### Custom Icons

**File icon theme** can distinguish mapper files:

- `*.mapper.json` - 🗺️ (map icon)
- `*.schema.json` - 📋 (schema icon)
- `*.mapper.diagram.json` - 📐 (diagram icon)

---

## Build Process

### Generate JSONata

```bash
# Single mapper
mapper-cli build order-to-invoice.mapper.json

# All mappers in directory
mapper-cli build mappers/*.mapper.json

# Watch mode
mapper-cli build --watch mappers/
```

### Output

```
mappers/order-to-invoice.mapper.json
  → dist/order-to-invoice.mapper.jsonata
```

### CI/CD

```yaml
# .github/workflows/build.yml
name: Build Mappers

on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3

      - name: Install dependencies
        run: npm install

      - name: Build mappers
        run: npm run build:mappers

      - name: Run tests
        run: npm run test:mappers
```

---

## File Size Considerations

### MapSpec

**Typical size:** 5-50 KB

**Large schemas:** May reference complex schemas, but schemas are external

**Optimization:** Remove unnecessary metadata, compact JSON

### GraphLayout

**Typical size:** 1-10 KB

**Can grow with:** Many nodes, complex state

**Optimization:** Can be regenerated, so commit is optional

### Schemas

**Typical size:** 5-100 KB

**Complex schemas:** Can be large with many properties

**Optimization:** Break into smaller schemas with `$ref`

---

## Schema References ($ref)

### External Schema References

Schemas can reference other schemas:

```json
{
  "type": "object",
  "properties": {
    "customer": {
      "$ref": "../schemas/customer.schema.json"
    }
  }
}
```

### Benefits

- ✅ Schema reuse across multiple mappers
- ✅ Smaller file sizes
- ✅ Single source of truth
- ✅ Easier maintenance

### Resolution

Mapper must resolve `$ref` when loading schemas.

---

## Lock Files (Optional)

### Purpose

Lock specific schema versions for deterministic builds.

### Format

**File:** `order-to-invoice.mapper.lock.json`

```json
{
  "version": "1.0.0",
  "locked": "2025-01-20T15:30:00Z",
  "schemas": {
    "input": {
      "path": "../schemas/order.schema.json",
      "hash": "sha256:abc123...",
      "version": "2.3.0"
    },
    "output": {
      "path": "../schemas/invoice.schema.json",
      "hash": "sha256:def456...",
      "version": "1.5.0"
    }
  }
}
```

### Use Case

- Production deployments
- Regression testing
- Schema version management

---

## Migration and Versioning

### MapSpec Version

```json
{
  "version": "1.0.0",
  ...
}
```

**Breaking changes** increment major version.

### Schema Compatibility

**Backward compatible changes:**
- Adding optional fields
- Adding descriptions
- Relaxing constraints

**Breaking changes:**
- Removing fields
- Changing types
- Adding required fields

### Migration Strategy

1. Update schema version
2. Run mapper validator
3. Update mappers as needed
4. Test with all test cases
5. Commit changes

---

## Example: Complete Project

```
my-integration-project/
├── .gitignore
├── .vscode/
│   └── settings.json
│
├── mappers/
│   ├── order-to-invoice.mapper.json
│   ├── order-to-invoice.mapper.diagram.json
│   ├── customer-to-contact.mapper.json
│   └── customer-to-contact.mapper.diagram.json
│
├── schemas/
│   ├── order.schema.json
│   ├── invoice.schema.json
│   ├── customer.schema.json
│   └── contact.schema.json
│
├── tests/
│   ├── order-to-invoice.test.json
│   └── customer-to-contact.test.json
│
├── dist/                              # Generated (gitignored)
│   ├── order-to-invoice.mapper.jsonata
│   └── customer-to-contact.mapper.jsonata
│
└── package.json
```

**package.json scripts:**

```json
{
  "scripts": {
    "build:mappers": "mapper-cli build mappers/*.mapper.json",
    "test:mappers": "mapper-cli test tests/*.test.json",
    "watch": "mapper-cli build --watch mappers/"
  }
}
```

---

## Next Steps

- **[MapSpec Schema](./04-mapspec-schema.md)** — Detailed MapSpec structure
- **[GraphLayout Schema](./05-graphlayout-schema.md)** — Layout data format
- **[Schema Flattening](./06-schema-flattening.md)** — How schemas become trees
- **[Test Runner](./13-test-runner.md)** — Running tests
