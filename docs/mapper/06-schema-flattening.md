# Schema Flattening and Tree Building

## Overview

JSON Schemas are hierarchical (objects, arrays, nested properties). To use them in a mapper, we need to:

1. **Extract field terminals** - Leaf nodes that can be mapped (strings, numbers, booleans)
2. **Generate JSONPath identifiers** - Unique IDs for each field
3. **Preserve or flatten hierarchy** - Depending on UI needs

We provide **two approaches**:
- **Flat list** - All terminals in a flat array (for table view)
- **Tree structure** - Preserves hierarchy (for tree view) ✅ **Recommended**

---

## Approach 1: Flat Terminals (Table View)

### Concept

Extract **only leaf nodes** (actual data fields) into a flat array, losing hierarchy context.

**Use case:** Simple table display where hierarchy isn't important.

### Implementation

```javascript
/**
 * Flatten JSON Schema to terminals (leaf fields only)
 * @param {object} schema - JSON Schema
 * @param {string} path - Current JSONPath (default: '$')
 * @param {array} result - Accumulator array
 * @returns {array} Array of terminal objects
 */
export function flattenSchema(schema, path = '$', result = []) {
  if (schema.type === 'object' && schema.properties) {
    for (const [key, prop] of Object.entries(schema.properties)) {
      const newPath = path === '$' ? `$.${key}` : `${path}.${key}`;

      if (prop.type === 'object') {
        // Recurse into nested object
        flattenSchema(prop, newPath, result);
      } else if (prop.type === 'array') {
        // Recurse into array items
        flattenSchema(prop.items, `${newPath}[]`, result);
      } else {
        // Leaf node - add to result
        result.push({
          id: newPath,
          name: key,
          path: newPath,
          type: prop.type
        });
      }
    }
  }
  return result;
}
```

### Example Input

```json
{
  "type": "object",
  "properties": {
    "orderNumber": { "type": "string" },
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

### Example Output

```javascript
[
  { id: '$.orderNumber', name: 'orderNumber', path: '$.orderNumber', type: 'string' },
  { id: '$.customer.id', name: 'id', path: '$.customer.id', type: 'string' },
  { id: '$.customer.name', name: 'name', path: '$.customer.name', type: 'string' },
  { id: '$.items[].productId', name: 'productId', path: '$.items[].productId', type: 'string' },
  { id: '$.items[].quantity', name: 'quantity', path: '$.items[].quantity', type: 'number' },
  { id: '$.items[].price', name: 'price', path: '$.items[].price', type: 'number' }
]
```

### Problems with Flat Approach

❌ **Context is lost** - Field `id` could be from `customer`, `product`, etc.
❌ **No hierarchy** - Can't see nested structure
❌ **Ambiguous names** - Multiple fields named "id" or "name"
❌ **Can't collapse** - All fields always visible

---

## Approach 2: Tree Structure (Recommended) ✅

### Concept

Build a **hierarchical tree** that preserves the schema structure, with expand/collapse capability.

**Use case:** Tree view where users can see and navigate structure.

### Implementation

```javascript
/**
 * Build hierarchical tree from JSON Schema
 * @param {object} schema - JSON Schema
 * @param {string} path - Current JSONPath (default: '$')
 * @param {string} name - Node name (default: 'root')
 * @returns {object} Tree node with children
 */
export function buildSchemaTree(schema, path = '$', name = 'root') {
  if (!schema) return null;

  const node = {
    id: path,
    name: name,
    path: path,
    type: schema.type,
    children: []
  };

  if (schema.type === 'object' && schema.properties) {
    // Object type: add children for each property
    for (const [key, prop] of Object.entries(schema.properties)) {
      const childPath = path === '$' ? `$.${key}` : `${path}.${key}`;
      const child = buildSchemaTree(prop, childPath, key);
      if (child) {
        node.children.push(child);
      }
    }
  } else if (schema.type === 'array' && schema.items) {
    // Array type: add array indicator and recurse into items
    const childPath = `${path}[]`;
    const child = buildSchemaTree(schema.items, childPath, 'items');
    if (child) {
      child.isArrayItem = true;
      node.children.push(child);
    }
  }

  // Mark leaf nodes (actual data fields)
  node.isLeaf = node.children.length === 0 &&
                node.type !== 'object' &&
                node.type !== 'array';

  return node;
}
```

### Example Output (Tree Structure)

```javascript
{
  id: '$',
  name: 'root',
  type: 'object',
  isLeaf: false,
  children: [
    {
      id: '$.orderNumber',
      name: 'orderNumber',
      path: '$.orderNumber',
      type: 'string',
      isLeaf: true,
      children: []
    },
    {
      id: '$.customer',
      name: 'customer',
      path: '$.customer',
      type: 'object',
      isLeaf: false,
      children: [
        {
          id: '$.customer.id',
          name: 'id',
          path: '$.customer.id',
          type: 'string',
          isLeaf: true,
          children: []
        },
        {
          id: '$.customer.name',
          name: 'name',
          path: '$.customer.name',
          type: 'string',
          isLeaf: true,
          children: []
        }
      ]
    },
    {
      id: '$.items',
      name: 'items',
      path: '$.items',
      type: 'array',
      isLeaf: false,
      children: [
        {
          id: '$.items[]',
          name: 'items',
          path: '$.items[]',
          type: 'object',
          isArrayItem: true,
          isLeaf: false,
          children: [
            {
              id: '$.items[].productId',
              name: 'productId',
              path: '$.items[].productId',
              type: 'string',
              isLeaf: true,
              children: []
            },
            {
              id: '$.items[].quantity',
              name: 'quantity',
              path: '$.items[].quantity',
              type: 'number',
              isLeaf: true,
              children: []
            },
            {
              id: '$.items[].price',
              name: 'price',
              path: '$.items[].price',
              type: 'number',
              isLeaf: true,
              children: []
            }
          ]
        }
      ]
    }
  ]
}
```

### Benefits of Tree Approach

✅ **Preserves context** - Clear parent-child relationships
✅ **Hierarchy visible** - Can see structure at a glance
✅ **Expand/collapse** - Hide complexity
✅ **Semantic clarity** - `customer.id` vs `product.id` is obvious
✅ **Navigation** - Users can browse structure
✅ **Matches JSON** - Visual representation matches actual data

---

## Node Properties

### Common Properties

```typescript
interface TreeNode {
  id: string;           // JSONPath (handle ID)
  name: string;         // Field name
  path: string;         // Full JSONPath
  type: string;         // JSON Schema type
  children: TreeNode[]; // Child nodes
  isLeaf: boolean;      // Is this a data field?
}
```

### Special Flags

**`isLeaf: boolean`**
- `true` - Actual data field (string, number, boolean, null)
- `false` - Container (object or array)
- **Only leaf nodes get handles** in the tree view

**`isArrayItem: boolean`**
- `true` - This node represents array items (`[]` in path)
- Used to render array notation in UI

---

## JSONPath Generation Rules

### Simple Field

```json
{ "orderNumber": { "type": "string" } }
```

**JSONPath:** `$.orderNumber`

### Nested Field

```json
{
  "customer": {
    "type": "object",
    "properties": {
      "name": { "type": "string" }
    }
  }
}
```

**JSONPath:** `$.customer.name`

### Array Field

```json
{
  "items": {
    "type": "array",
    "items": {
      "type": "object",
      "properties": {
        "quantity": { "type": "number" }
      }
    }
  }
}
```

**JSONPath:** `$.items[].quantity`

**Note:** `[]` indicates "for each item in array"

### Deeply Nested

```json
{
  "customer": {
    "type": "object",
    "properties": {
      "addresses": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "city": { "type": "string" }
          }
        }
      }
    }
  }
}
```

**JSONPath:** `$.customer.addresses[].city`

---

## Rendering Trees with Labeled Handles

### Tree Node Component

```jsx
export function SchemaTreeNode({ node, depth, handleType, handlePosition }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  const showHandle = node.isLeaf; // Only leaf nodes

  return (
    <div className="schema-tree-node">
      <div
        className="tree-node-row"
        style={{ paddingLeft: `${depth * 16}px` }}
      >
        {/* Expand/collapse button for parent nodes */}
        {hasChildren && (
          <button onClick={() => setIsExpanded(!isExpanded)}>
            {isExpanded ? '▼' : '▶'}
          </button>
        )}

        {/* Content */}
        {showHandle ? (
          // Leaf node: show labeled handle
          <LabeledHandle
            id={node.id}
            type={handleType}
            position={handlePosition}
            title={`${node.name}: ${node.type}`}
          />
        ) : (
          // Parent node: just show name
          <div className="tree-node-label">
            <span>{node.name}</span>
            {node.type === 'object' && <span>{'{}'}</span>}
            {node.type === 'array' && <span>{'[]'}</span>}
          </div>
        )}
      </div>

      {/* Children (recursive) */}
      {hasChildren && isExpanded && (
        <div className="tree-node-children">
          {node.children.map((child) => (
            <SchemaTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              handleType={handleType}
              handlePosition={handlePosition}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

### Visual Result

```
Source Schema
├─ ▼ orderNumber: string ○
├─ ▼ customer {}
│  ├─ id: string ○
│  └─ name: string ○
└─ ▼ items []
   └─ ▼ [items] {}
      ├─ productId: string ○
      ├─ quantity: number ○
      └─ price: number ○
```

**Legend:**
- `▼` / `▶` - Expand/collapse button
- `{}` - Object type
- `[]` - Array type
- `○` - Labeled handle (connection point)

---

## Handle ID Generation

### Rule: Use JSONPath as Handle ID

**Why?**
1. **Unique** - No two fields have the same path
2. **Semantic** - Path describes field location
3. **JSONata ready** - Directly maps to JSONata expressions
4. **Traceable** - Easy to find field in schema

### Examples

```typescript
// Handle IDs match JSONPath
const handleIds = [
  '$.orderNumber',
  '$.customer.id',
  '$.customer.name',
  '$.items[].productId',
  '$.items[].quantity',
  '$.items[].price'
];
```

### Edge Connection

```json
{
  "id": "edge-1",
  "from": "source-schema",
  "fromHandle": "$.items[].quantity",
  "to": "target-schema",
  "toHandle": "$.lineItems[].qty"
}
```

**React Flow** uses these handle IDs to connect edges.

---

## Search and Filtering

### Search Through Tree

```javascript
function filterTree(node, query) {
  if (!query) return node;

  const matchesSearch = node.name.toLowerCase().includes(query.toLowerCase()) ||
                       node.path.toLowerCase().includes(query.toLowerCase());

  if (matchesSearch) return node;

  // Check if any children match
  if (node.children && node.children.length > 0) {
    const filteredChildren = node.children
      .map(child => filterTree(child, query))
      .filter(Boolean);

    if (filteredChildren.length > 0) {
      return { ...node, children: filteredChildren };
    }
  }

  return null;
}
```

**Behavior:**
- Matches node name or path
- Keeps parent nodes if children match
- Removes non-matching branches
- Preserves hierarchy

---

## Type Support

### JSON Schema Types

**Primitive types (leaf nodes):**
- `string`
- `number`
- `integer`
- `boolean`
- `null`

**Container types (parent nodes):**
- `object` - Nested properties
- `array` - Collection of items

### Type Mapping

```typescript
const typeIcons = {
  string: 'Abc',
  number: '123',
  integer: '№',
  boolean: '☑',
  null: '∅',
  object: '{}',
  array: '[]'
};
```

### Handle Type Inference

```javascript
function getHandleDataType(schemaType) {
  switch (schemaType) {
    case 'string': return 'string';
    case 'number':
    case 'integer': return 'number';
    case 'boolean': return 'boolean';
    case 'null': return 'null';
    case 'array': return 'array';
    case 'object': return 'object';
    default: return 'any';
  }
}
```

---

## Array Handling

### Array Field Notation

Arrays use `[]` notation in JSONPath:

```javascript
'$.items[]'           // The array container
'$.items[].quantity'  // Field within array items
```

### Array Tree Structure

```javascript
{
  id: '$.items',
  name: 'items',
  type: 'array',
  children: [
    {
      id: '$.items[]',
      name: 'items',
      type: 'object',
      isArrayItem: true,  // Special flag
      children: [
        { id: '$.items[].quantity', name: 'quantity', type: 'number', isLeaf: true }
      ]
    }
  ]
}
```

### Visual Representation

```
items []
└─ [items] {}
   ├─ productId: string ○
   ├─ quantity: number ○
   └─ price: number ○
```

**Note:** `[items]` indicates "for each item in array"

---

## Comparison: Flat vs Tree

| Aspect | Flat List | Tree Structure |
|--------|-----------|----------------|
| **Hierarchy** | Lost | Preserved ✅ |
| **Context** | None | Full ✅ |
| **Navigation** | Linear | Hierarchical ✅ |
| **Expand/Collapse** | N/A | Yes ✅ |
| **Complexity** | Simple | Moderate |
| **Use Case** | Table view | Tree view ✅ |
| **BizTalk-like** | No | Yes ✅ |
| **Field Disambiguation** | Difficult | Clear ✅ |

**Recommendation:** Use **tree structure** for mapper UI.

---

## Implementation Notes

### Performance

**Large schemas (100+ fields):**
- ✅ Tree building is O(n) - one pass
- ✅ Only visible nodes render (with expand/collapse)
- ✅ Virtual scrolling can be added if needed
- ✅ React reconciliation is efficient for tree updates

### Memory

**Tree structure:**
- Each node: ~100 bytes
- 100 fields: ~10KB
- Negligible overhead for typical schemas

### Caching

```javascript
// Cache tree building results
const treeCache = new Map();

function getCachedTree(schema) {
  const key = JSON.stringify(schema);
  if (!treeCache.has(key)) {
    treeCache.set(key, buildSchemaTree(schema));
  }
  return treeCache.get(key);
}
```

---

## TypeScript Definitions

```typescript
// Terminal (flat list)
interface Terminal {
  id: string;          // JSONPath
  name: string;        // Field name
  path: string;        // JSONPath
  type: string;        // JSON Schema type
}

// Tree Node (hierarchical)
interface TreeNode {
  id: string;          // JSONPath
  name: string;        // Field name
  path: string;        // JSONPath
  type: string;        // JSON Schema type
  children: TreeNode[];
  isLeaf: boolean;     // True for data fields
  isArrayItem?: boolean; // True for array items
}

// API
export function flattenSchema(
  schema: JSONSchema,
  path?: string,
  result?: Terminal[]
): Terminal[];

export function buildSchemaTree(
  schema: JSONSchema,
  path?: string,
  name?: string
): TreeNode;
```

---

## Usage in Mapper

### Load Schema and Build Tree

```typescript
import { buildSchemaTree } from './schema-flattening';

async function loadMapper(mapperPath: string) {
  // Load MapSpec
  const mapSpec = await loadMapSpec(mapperPath);

  // Load schemas
  const sourceSchema = await loadSchema(mapSpec.inputSchemaRef);
  const targetSchema = await loadSchema(mapSpec.outputSchemaRef);

  // Build trees
  const sourceTree = buildSchemaTree(sourceSchema);
  const targetTree = buildSchemaTree(targetSchema);

  return {
    mapSpec,
    sourceTree,
    targetTree
  };
}
```

### Create Schema Nodes

```typescript
const sourceNode = {
  id: 'source-schema',
  type: 'schema',
  position: { x: 50, y: 50 },
  draggable: false,
  data: {
    side: 'source',
    schema: sourceSchema,
    tree: sourceTree  // Tree structure for rendering
  }
};
```

### Extract Leaf Nodes (Alternative)

```typescript
function extractLeafNodes(tree: TreeNode): Terminal[] {
  const leaves: Terminal[] = [];

  function traverse(node: TreeNode) {
    if (node.isLeaf) {
      leaves.push({
        id: node.id,
        name: node.name,
        path: node.path,
        type: node.type
      });
    } else {
      node.children.forEach(traverse);
    }
  }

  traverse(tree);
  return leaves;
}
```

---

## Testing

### Unit Tests

```javascript
describe('buildSchemaTree', () => {
  it('should handle simple object', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' }
      }
    };

    const tree = buildSchemaTree(schema);

    expect(tree.children).toHaveLength(1);
    expect(tree.children[0].id).toBe('$.name');
    expect(tree.children[0].isLeaf).toBe(true);
  });

  it('should handle nested objects', () => {
    const schema = {
      type: 'object',
      properties: {
        customer: {
          type: 'object',
          properties: {
            name: { type: 'string' }
          }
        }
      }
    };

    const tree = buildSchemaTree(schema);

    expect(tree.children[0].id).toBe('$.customer');
    expect(tree.children[0].isLeaf).toBe(false);
    expect(tree.children[0].children[0].id).toBe('$.customer.name');
  });

  it('should handle arrays', () => {
    const schema = {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              qty: { type: 'number' }
            }
          }
        }
      }
    };

    const tree = buildSchemaTree(schema);

    expect(tree.children[0].id).toBe('$.items');
    expect(tree.children[0].children[0].id).toBe('$.items[]');
    expect(tree.children[0].children[0].isArrayItem).toBe(true);
    expect(tree.children[0].children[0].children[0].id).toBe('$.items[].qty');
  });
});
```

---

---

## Advanced: Handling Conditional Schemas

### Challenge

JSON Schema supports **conditional keywords** that create dynamic structures:

```json
{
  "anyOf": [
    { "properties": { "email": { "type": "string" } } },
    { "properties": { "phone": { "type": "string" } } }
  ]
}
```

**Problem:** Which fields exist at runtime depends on the data.

### Conditional Keywords

**`anyOf`** - Match **any one or more** schemas
```json
{
  "anyOf": [
    { "properties": { "creditCard": { "type": "string" } } },
    { "properties": { "bankAccount": { "type": "string" } } }
  ]
}
```

**`oneOf`** - Match **exactly one** schema
```json
{
  "oneOf": [
    { "properties": { "internalId": { "type": "string" } } },
    { "properties": { "externalId": { "type": "string" } } }
  ]
}
```

**`allOf`** - Match **all** schemas (composition)
```json
{
  "allOf": [
    { "properties": { "name": { "type": "string" } } },
    { "properties": { "age": { "type": "number" } } }
  ]
}
```

**`if/then/else`** - Conditional application
```json
{
  "if": { "properties": { "country": { "const": "US" } } },
  "then": { "properties": { "zipCode": { "type": "string" } } },
  "else": { "properties": { "postalCode": { "type": "string" } } }
}
```

---

### Approach 1: Union All Variants (Simple) ✅ **MVP Recommendation**

**Strategy:** Show **all possible fields** from all variants.

**Implementation:**

```javascript
function buildSchemaTree(schema, path = '$', name = 'root') {
  // ... existing code ...

  // Handle anyOf - union all schemas
  if (schema.anyOf) {
    const variants = schema.anyOf.map((variant, idx) =>
      buildSchemaTree(variant, `${path}[variant-${idx}]`, `variant ${idx + 1}`)
    );

    // Merge all variant children
    const allFields = new Map();
    variants.forEach(variant => {
      variant.children.forEach(child => {
        if (!allFields.has(child.id)) {
          allFields.set(child.id, { ...child, optional: true, variants: [] });
        }
        allFields.get(child.id).variants.push(variant.name);
      });
    });

    node.children.push(...allFields.values());
  }

  // Handle oneOf - similar to anyOf
  if (schema.oneOf) {
    // Same logic as anyOf
  }

  // Handle allOf - merge all schemas
  if (schema.allOf) {
    schema.allOf.forEach(subSchema => {
      const child = buildSchemaTree(subSchema, path, name);
      node.children.push(...child.children);
    });
  }

  return node;
}
```

**Visual Result:**

```
Payment Method
├─ ⚠️ creditCard: string ○ (variant 1)
├─ ⚠️ bankAccount: string ○ (variant 2)
└─ ⚠️ paypalEmail: string ○ (variant 3)
```

**Pros:**
- ✅ Simple to implement
- ✅ All fields visible
- ✅ User can map any variant
- ✅ No runtime complexity

**Cons:**
- ⚠️ Confusing - not all fields will exist at runtime
- ⚠️ Validation is harder
- ⚠️ Generated JSONata needs conditionals

**Use Case:** MVP - show all fields, let user decide which to map.

---

### Approach 2: Discriminator-Based Selection ✅ **Recommended for Production**

**Strategy:** Use a **discriminator field** to determine which variant applies.

**Schema Example:**

```json
{
  "type": "object",
  "properties": {
    "paymentType": {
      "type": "string",
      "enum": ["card", "bank", "paypal"]
    }
  },
  "oneOf": [
    {
      "properties": {
        "paymentType": { "const": "card" },
        "cardNumber": { "type": "string" },
        "cvv": { "type": "string" }
      }
    },
    {
      "properties": {
        "paymentType": { "const": "bank" },
        "accountNumber": { "type": "string" },
        "routingNumber": { "type": "string" }
      }
    }
  ]
}
```

**Implementation:**

```javascript
function buildSchemaTreeWithDiscriminator(schema, path = '$', name = 'root') {
  if (schema.oneOf && schema.properties) {
    // Find discriminator
    const discriminator = findDiscriminator(schema);

    if (discriminator) {
      // Create variant nodes
      const variantNodes = schema.oneOf.map(variant => {
        const discriminatorValue = getDiscriminatorValue(variant, discriminator);
        return {
          id: `${path}[${discriminatorValue}]`,
          name: `[when ${discriminator}=${discriminatorValue}]`,
          type: 'variant',
          discriminator: discriminator,
          discriminatorValue: discriminatorValue,
          children: extractChildren(variant, path)
        };
      });

      node.children = variantNodes;
      return node;
    }
  }

  // ... handle other cases ...
}

function findDiscriminator(schema) {
  // Look for common field in all variants
  const commonFields = schema.oneOf[0].properties ?
    Object.keys(schema.oneOf[0].properties) : [];

  return commonFields.find(field =>
    schema.oneOf.every(variant =>
      variant.properties &&
      variant.properties[field] &&
      variant.properties[field].const !== undefined
    )
  );
}
```

**Visual Result:**

```
Payment
├─ paymentType: string ○
├─ ▼ [when paymentType=card]
│  ├─ cardNumber: string ○
│  └─ cvv: string ○
├─ ▼ [when paymentType=bank]
│  ├─ accountNumber: string ○
│  └─ routingNumber: string ○
└─ ▼ [when paymentType=paypal]
   └─ paypalEmail: string ○
```

**Pros:**
- ✅ Clear structure
- ✅ Shows which fields go together
- ✅ Validation is straightforward
- ✅ Generated code uses discriminator

**Cons:**
- ⚠️ Requires discriminator field
- ⚠️ More complex implementation
- ⚠️ User must map discriminator first

**Generated JSONata:**

```jsonata
{
  "paymentInfo": paymentType = "card" ? {
    "type": "card",
    "number": cardNumber,
    "cvv": cvv
  } : paymentType = "bank" ? {
    "type": "bank",
    "account": accountNumber,
    "routing": routingNumber
  } : {
    "type": "paypal",
    "email": paypalEmail
  }
}
```

---

### Approach 3: Multiple Schema Views

**Strategy:** Let user **choose which variant** to work with.

**UI:**

```
┌─────────────────────────────┐
│ Source Schema               │
│                             │
│ Payment Method:             │
│ [Select variant ▼]          │
│   ○ Credit Card             │
│   ○ Bank Account            │
│   ○ PayPal                  │
│                             │
│ [Currently: Credit Card]    │
├─────────────────────────────┤
│ ▼ cardNumber: string ○      │
│ ▼ cvv: string ○             │
│ ▼ expiryDate: string ○      │
└─────────────────────────────┘
```

**Implementation:**

```javascript
function SchemaNodeTreeView({ data }) {
  const { side, schema, tree } = data;
  const [selectedVariant, setSelectedVariant] = useState(0);

  // Detect variants
  const hasVariants = schema.oneOf || schema.anyOf;
  const variants = hasVariants ? (schema.oneOf || schema.anyOf) : [schema];

  // Build tree for selected variant
  const currentTree = buildSchemaTree(variants[selectedVariant]);

  return (
    <div className="schema-node-tree-view">
      <div className="schema-node-tree-header">
        {/* ... */}

        {hasVariants && (
          <select
            value={selectedVariant}
            onChange={(e) => setSelectedVariant(Number(e.target.value))}
          >
            {variants.map((v, idx) => (
              <option key={idx} value={idx}>
                Variant {idx + 1}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Render tree for selected variant */}
      <SchemaTreeBody tree={currentTree} />
    </div>
  );
}
```

**Pros:**
- ✅ Simple UX
- ✅ No field confusion
- ✅ Clear which structure you're mapping

**Cons:**
- ⚠️ Can only map one variant at a time
- ⚠️ Need to switch variants to map different cases
- ⚠️ Doesn't show relationships between variants

---

### Approach 4: Merge with Annotations (Hybrid)

**Strategy:** Merge all variants but **annotate** each field with its conditions.

**Visual Result:**

```
Payment
├─ paymentType: string ○
├─ cardNumber: string ○
│  └─ 🔸 Only when: paymentType = "card"
├─ cvv: string ○
│  └─ 🔸 Only when: paymentType = "card"
├─ accountNumber: string ○
│  └─ 🔸 Only when: paymentType = "bank"
└─ routingNumber: string ○
   └─ 🔸 Only when: paymentType = "bank"
```

**Implementation:**

```javascript
function buildSchemaTreeWithAnnotations(schema, path = '$', name = 'root') {
  const node = {
    id: path,
    name: name,
    path: path,
    type: schema.type,
    children: []
  };

  if (schema.oneOf) {
    const discriminator = findDiscriminator(schema);

    schema.oneOf.forEach(variant => {
      const condition = getCondition(variant, discriminator);
      const variantTree = buildSchemaTree(variant, path, name);

      // Annotate each child with condition
      variantTree.children.forEach(child => {
        child.condition = condition;
        node.children.push(child);
      });
    });
  }

  return node;
}
```

**Pros:**
- ✅ All fields visible
- ✅ Clear conditions
- ✅ Can map all variants
- ✅ Good for documentation

**Cons:**
- ⚠️ Can be cluttered with many variants
- ⚠️ Complex to implement
- ⚠️ Requires careful UX design

---

## Recommendations by Use Case

### MVP / Simple Mappers
**Use Approach 1** (Union All Variants)
- Show all fields
- Mark as optional
- Let JSONata handle missing fields gracefully

### Production / Complex Schemas
**Use Approach 2** (Discriminator-Based)
- Detect discriminator fields
- Show conditional branches
- Generate conditional JSONata

### User Control
**Use Approach 3** (Multiple Views)
- Let user select variant
- Cleaner UI
- Explicit choice

---

## Special Case: `allOf` (Composition)

**`allOf`** is simpler - just **merge** all schemas:

```javascript
if (schema.allOf) {
  schema.allOf.forEach(subSchema => {
    const child = buildSchemaTree(subSchema, path, name);
    // Merge children
    node.children.push(...child.children);
  });
}
```

**Example:**

```json
{
  "allOf": [
    { "properties": { "name": { "type": "string" } } },
    { "properties": { "age": { "type": "number" } } }
  ]
}
```

**Result:** Both `name` and `age` appear as fields (no conditionals needed).

---

## Implementation Plan

### Phase 1: Basic Support (MVP)
1. ✅ Handle simple schemas (no conditionals)
2. ✅ Support `allOf` (merge)
3. ⚠️ Show warning for `anyOf`/`oneOf` (not supported yet)

### Phase 2: Discriminator Detection
1. Detect discriminator fields
2. Build conditional branches
3. Generate conditional JSONata

### Phase 3: Advanced UI
1. Variant selector
2. Conditional annotations
3. Validation for conditional mappings

---

## Example: Payment Schema

### Input Schema

```json
{
  "type": "object",
  "properties": {
    "orderId": { "type": "string" },
    "paymentType": { "type": "string", "enum": ["card", "bank"] }
  },
  "oneOf": [
    {
      "properties": {
        "paymentType": { "const": "card" },
        "payment": {
          "type": "object",
          "properties": {
            "cardNumber": { "type": "string" },
            "cvv": { "type": "string" }
          }
        }
      }
    },
    {
      "properties": {
        "paymentType": { "const": "bank" },
        "payment": {
          "type": "object",
          "properties": {
            "accountNumber": { "type": "string" },
            "routingNumber": { "type": "string" }
          }
        }
      }
    }
  ]
}
```

### Approach 1 Output (Union All)

```
Order
├─ orderId: string ○
├─ paymentType: string ○
└─ payment {}
   ├─ ⚠️ cardNumber: string ○ (optional)
   ├─ ⚠️ cvv: string ○ (optional)
   ├─ ⚠️ accountNumber: string ○ (optional)
   └─ ⚠️ routingNumber: string ○ (optional)
```

### Approach 2 Output (Discriminator)

```
Order
├─ orderId: string ○
├─ paymentType: string ○
└─ payment {}
   ├─ ▼ [when paymentType=card]
   │  ├─ cardNumber: string ○
   │  └─ cvv: string ○
   └─ ▼ [when paymentType=bank]
      ├─ accountNumber: string ○
      └─ routingNumber: string ○
```

---

## Next Steps

- **[Canvas Architecture](./02-canvas-architecture.md)** — How trees fit into React Flow
- **[MapSpec Schema](./04-mapspec-schema.md)** — Handle IDs in edges
- **[JSONata Codegen](./10-jsonata-codegen.md)** — JSONPath → JSONata expressions (including conditionals)
- **[Visual Interface Design](./07-ui-design.md)** — Tree rendering and interaction
- **[Validation Rules](./12-validation.md)** — Handling conditional schema validation
