# Canvas Architecture: Schema Nodes with Tree Hierarchy

## Architecture Decision

**After prototyping two approaches (V1 and V2), we've adopted the Schema Node architecture** where source and target schemas are React Flow nodes with hierarchical tree structure and labeled handles.

**Inspired by:** [React Flow Database Schema Node](https://reactflow.dev/ui/components/database-schema-node)

**Working Prototypes:**
- **V1** (Proxy Nodes): `/prototype/mapper/` - Separate trees + proxy nodes
- **V2** (Schema Nodes): `/prototype/mapper-v2/` - **Recommended approach** ✅
- **Comparison:** See [14-prototype-comparison.md](./02b-prototype-comparison.md)

---

## React Flow Scope: What's a Node and What's Not

### ✅ **ARE React Flow Nodes**

**Everything on the canvas:**

1. **Source Schema Node** — Left side, fixed position, contains tree of source fields
2. **Target Schema Node** — Right side, fixed position, contains tree of target fields
3. **Functoid Nodes** — Center area, draggable transformation functions
4. **Const Nodes** — Literal values (optional)

### Key Insight: Schemas ARE Nodes

Unlike traditional approaches where schemas are separate components, **the schemas themselves are React Flow nodes**. This means:

- ✅ Source and target schemas live **inside** the React Flow canvas
- ✅ Each field is a **labeled handle** (React Flow Handle component)
- ✅ All connections are **pure React Flow edges**
- ✅ No proxy nodes needed
- ✅ Cleaner visual design

---

## Schema Node Structure

### Node Definition

```typescript
const sourceSchemaNode = {
  id: 'source-schema',
  type: 'schema',
  position: { x: 50, y: 50 },
  draggable: false,  // Fixed position
  data: {
    side: 'source',
    schema: sourceJSONSchema,
    tree: buildSchemaTree(sourceJSONSchema)
  }
};
```

### Tree Hierarchy

The schema node internally renders a **hierarchical tree** with expand/collapse:

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

**Key Features:**
- ▶ ▼ **Expand/collapse** for objects and arrays
- **○ Labeled handles** only on leaf nodes (actual data fields)
- **Indentation** shows nesting level
- **Tree lines** provide visual hierarchy
- **Search** filters through tree structure

### Labeled Handle Pattern

Each leaf field (actual data field) gets a `LabeledHandle` component:

```jsx
<LabeledHandle
  id="$.items[].quantity"        // JSONPath for handle ID
  title="quantity: number"       // Field name + type
  type="source"                  // or "target"
  position={Position.Right}      // or Position.Left for target
/>
```

**Benefits:**
- Handle and label are visually integrated
- No separate proxy nodes needed
- Follows React Flow Database Schema pattern
- Professional, clean appearance

---

## Visual Representation

```
┌────────────────────────────────────────────────────────────────┐
│                    REACT FLOW CANVAS                           │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────────────┐                    ┌──────────────────┐ │
│  │ SOURCE SCHEMA    │                    │ TARGET SCHEMA    │ │
│  │ (React Flow Node)│                    │ (React Flow Node)│ │
│  ├──────────────────┤                    ├──────────────────┤ │
│  │ 📤 Source Schema │                    │ 📥 Target Schema │ │
│  │ [Search...]      │                    │ [Search...]      │ │
│  ├──────────────────┤                    ├──────────────────┤ │
│  │ orderNumber: str○│                    │○ invoiceNumber   │ │
│  │ ▼ customer {}    │                    │○ customerId      │ │
│  │   id: string    ○│                    │○ customerName    │ │
│  │   name: string  ○│    ┌─────────┐    │○ ▼ lineItems[]   │ │
│  │ ▼ items []       │    │ Multiply│    │  ○ productId     │ │
│  │   ▼ [items] {}   │    │    ×    │    │  ○ qty           │ │
│  │     productId:  ○├───►│ in1 out │───►┼─►○ unitPrice     │ │
│  │     quantity:   ○├───►│ in2     │    │  ○ lineTotal     │ │
│  │     price:      ○│    └─────────┘    │○ subtotal        │ │
│  └──────────────────┘                    │○ tax             │ │
│   Fixed left edge                        │○ total           │ │
│                                          └──────────────────┘ │
│                                           Fixed right edge    │
│                                                                │
└────────────────────────────────────────────────────────────────┘
     ALL are React Flow nodes
     ALL edges are pure React Flow edges ✅
```

---

## Connection Flow

### Direct Field → Field Connection

**User Action:** Drag from `orderNumber: string ○` handle to `○ invoiceNumber` handle

**What Happens:**

1. React Flow `onConnect` callback fires
2. Creates edge directly between handles:

```typescript
{
  id: 'edge_123',
  source: 'source-schema',           // Schema node ID
  sourceHandle: '$.orderNumber',     // Handle ID (JSONPath)
  target: 'target-schema',           // Schema node ID
  targetHandle: '$.invoiceNumber',   // Handle ID (JSONPath)
  type: 'smoothstep',
  animated: true
}
```

3. Edge renders automatically (pure React Flow edge)
4. **No proxy nodes created** - connection is direct!

### Field → Functoid → Field Connection

**User Action:**
1. Add Multiply functoid to canvas
2. Connect `quantity: number ○` → Multiply `in1`
3. Connect `price: number ○` → Multiply `in2`
4. Connect Multiply `out` → `○ lineTotal`

**What Happens:**

```typescript
// Edge 1: Source field → Functoid input
{
  source: 'source-schema',
  sourceHandle: '$.items[].quantity',
  target: 'functoid-multiply-1',
  targetHandle: 'in1'
}

// Edge 2: Source field → Functoid input
{
  source: 'source-schema',
  sourceHandle: '$.items[].price',
  target: 'functoid-multiply-1',
  targetHandle: 'in2'
}

// Edge 3: Functoid output → Target field
{
  source: 'functoid-multiply-1',
  sourceHandle: 'out',
  target: 'target-schema',
  targetHandle: '$.lineItems[].lineTotal'
}
```

**Result:** Three clean edges, no intermediate proxy nodes!

---

## Implementation Details

### Building the Tree Structure

```typescript
// schemas-tree.js

export function buildSchemaTree(schema, path = '$', name = 'root') {
  const node = {
    id: path,
    name: name,
    path: path,
    type: schema.type,
    children: []
  };

  if (schema.type === 'object' && schema.properties) {
    // Add children for each property
    for (const [key, prop] of Object.entries(schema.properties)) {
      const childPath = path === '$' ? `$.${key}` : `${path}.${key}`;
      const child = buildSchemaTree(prop, childPath, key);
      if (child) {
        node.children.push(child);
      }
    }
  } else if (schema.type === 'array' && schema.items) {
    // Add array item node
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

### Schema Node Component

```jsx
// SchemaNodeTreeView.jsx

export function SchemaNodeTreeView({ data }) {
  const { side, schema, tree } = data;
  const [search, setSearch] = useState('');

  const isSource = side === 'source';
  const handleType = isSource ? 'source' : 'target';
  const handlePosition = isSource ? Position.Right : Position.Left;

  return (
    <div className={`schema-node-tree-view schema-node-${side}`}>
      {/* Header with search */}
      <div className="schema-node-tree-header">
        <div className="schema-title">
          {isSource ? '📤 Source Schema' : '📥 Target Schema'}
        </div>
        <input
          type="search"
          placeholder="Search fields..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Recursive tree rendering */}
      <div className="schema-tree-body">
        {tree.children.map((child) => (
          <SchemaTreeNode
            key={child.id}
            node={child}
            depth={0}
            handleType={handleType}
            handlePosition={handlePosition}
            isSource={isSource}
          />
        ))}
      </div>
    </div>
  );
}
```

### Tree Node with Handles

```jsx
// SchemaTreeNode.jsx

export function SchemaTreeNode({ node, depth, handleType, handlePosition }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  const showHandle = node.isLeaf; // Only leaf nodes get handles

  return (
    <div className="schema-tree-node">
      <div className="tree-node-row" style={{ paddingLeft: `${depth * 16}px` }}>
        {/* Expand/collapse button */}
        {hasChildren && (
          <button onClick={() => setIsExpanded(!isExpanded)}>
            {isExpanded ? '▼' : '▶'}
          </button>
        )}

        {/* Node content */}
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

### Labeled Handle Component

```jsx
// LabeledHandle.jsx
// Compatible with React Flow UI API

import { Handle } from '@xyflow/react';

export function LabeledHandle({
  id,
  type,
  position,
  title,
  className = '',
  handleClassName = '',
  labelClassName = ''
}) {
  return (
    <div className={`labeled-handle labeled-handle-${type} ${className}`}>
      <span className={`labeled-handle-label ${labelClassName}`}>
        {title}
      </span>
      <Handle
        type={type}
        position={position}
        id={id}
        className={`labeled-handle-connector ${handleClassName}`}
      />
    </div>
  );
}
```

---

## Advantages of This Approach

### ✅ Visual Clarity

- **No canvas clutter** - Only functoids appear in the center
- **Schema context always visible** - Fixed panels show source/target structure
- **BizTalk-style layout** - Familiar pattern for integration developers
- **Clean connections** - Direct handle-to-handle edges

### ✅ Simplified Architecture

- **No proxy nodes** - Eliminates SourceField/TargetField node types
- **Fewer node types** - Just schema nodes and functoid nodes
- **Pure React Flow** - All edges are standard React Flow edges
- **No coordinate translation** - Everything is in React Flow coordinate space

### ✅ Better UX

- **Expand/collapse** - Hide complexity of large schemas
- **Search within schema** - Filter fields without cluttering canvas
- **Hierarchical context** - See nested structure clearly
- **Direct connections** - Obvious source → target data flow

### ✅ Scalability

- **100+ field schemas** - Tree view handles this efficiently
- **Canvas stays clean** - Only functoids and edges in center
- **One node per schema** - Not one node per mapped field
- **Handle positioning** - React Flow efficiently manages many handles

---

## Comparison: Proxy Nodes vs Schema Nodes

| Aspect | V1: Proxy Nodes | V2: Schema Nodes ✅ |
|--------|-----------------|---------------------|
| **Schema Representation** | Separate tree components outside canvas | React Flow nodes on canvas |
| **Field Representation** | SourceField/TargetField proxy nodes | Handles on schema node |
| **Node Count (50 mappings)** | 2 schemas + 100 proxy nodes + functoids | 2 schema nodes + functoids |
| **Visual Clutter** | High (many proxy nodes) | Low (only functoids) ✅ |
| **BizTalk Similarity** | Moderate | High ✅ |
| **Connection Pattern** | Source proxy → Functoid → Target proxy | Source handle → Functoid → Target handle |
| **Canvas Middle Area** | Crowded with proxy nodes | Clean, only functoids ✅ |
| **Hierarchy Display** | Flat (context lost) | Tree structure ✅ |

---

## MapSpec Representation

**Important:** MapSpec stores which **handles** are connected, not proxy nodes.

```json
{
  "nodes": [
    // No schema nodes in MapSpec (they're always present)

    // Only functoids are stored
    {
      "id": "functoid-multiply-1",
      "kind": "Binary",
      "data": { "op": "Mul" }
    }
  ],
  "edges": [
    // Edges reference schema node handles
    {
      "from": "source-schema",
      "fromHandle": "$.items[].quantity",
      "to": "functoid-multiply-1",
      "toHandle": "in1"
    },
    {
      "from": "source-schema",
      "fromHandle": "$.items[].price",
      "to": "functoid-multiply-1",
      "toHandle": "in2"
    },
    {
      "from": "functoid-multiply-1",
      "fromHandle": "out",
      "to": "target-schema",
      "toHandle": "$.lineItems[].lineTotal"
    }
  ]
}
```

**Schema nodes are reconstructed** from `inputSchemaRef` and `outputSchemaRef` - they're always present with fixed IDs (`source-schema`, `target-schema`).

---

## Handle Management

### Handle IDs = JSONPath

Each handle ID is the field's JSONPath:

```typescript
// Simple field
'$.orderNumber'

// Nested field
'$.customer.name'

// Array item field
'$.items[].quantity'
```

This provides:
- ✅ **Unique IDs** for each field
- ✅ **Semantic meaning** (path describes location)
- ✅ **Traceability** to original schema
- ✅ **JSONata generation** (use paths directly)

### Dynamic Handle Positioning

Handles are positioned dynamically based on tree structure:

```jsx
<Handle
  type="source"
  position={Position.Right}
  id={terminal.id}
  style={{
    top: `${(index + 1) * 32 + 80}px`  // Header offset + row height
  }}
/>
```

React Flow automatically:
- ✅ Updates edge positions when handles move
- ✅ Recalculates edge paths on scroll
- ✅ Handles zoom/pan correctly

---

## React Flow Configuration

### Node Types

```typescript
const nodeTypes = {
  schema: SchemaNodeTreeView,    // Source and target schemas
  functoid: FunctoidNode         // Transformation functions
};
```

### Initial Nodes

```typescript
const initialNodes = [
  {
    id: 'source-schema',
    type: 'schema',
    position: { x: 50, y: 50 },
    draggable: false,
    data: {
      side: 'source',
      schema: sourceJSONSchema,
      tree: buildSchemaTree(sourceJSONSchema)
    }
  },
  {
    id: 'target-schema',
    type: 'schema',
    position: { x: 950, y: 50 },
    draggable: false,
    data: {
      side: 'target',
      schema: targetJSONSchema,
      tree: buildSchemaTree(targetJSONSchema)
    }
  }
];
```

### Edge Configuration

```typescript
const onConnect = useCallback((params) => {
  setEdges((eds) => addEdge({
    ...params,
    type: 'smoothstep',
    animated: true,
    style: { stroke: '#3b82f6', strokeWidth: 2 }
  }, eds));
}, [setEdges]);
```

---

## Performance Considerations

### Large Schemas (100+ Fields)

**Handled efficiently because:**

1. **Tree virtualization** - Can add virtual scrolling if needed
2. **Expand/collapse** - Only visible nodes render handles
3. **React Flow optimization** - Handles many handles per node efficiently
4. **Single node per schema** - Not O(n) nodes for n fields

### Many Connections (50+ Edges)

**React Flow handles this well:**

- Edge rendering is optimized
- Only visible edges in viewport are rendered
- Smooth animations even with many edges
- No performance degradation observed in prototypes

---

## Testing and Validation

### Working Prototype

**Location:** `/prototype/mapper-v2/`

**Run it:**
```bash
cd /Users/U05366/wf/prototype/mapper-v2
npm install
npm run dev
# Opens at http://localhost:3001
```

**Try these scenarios:**
1. Expand/collapse tree nodes
2. Search for nested fields
3. Connect source → target directly
4. Add functoid and create transformation chain
5. Verify edge routing with tree scrolling

### What We Validated

✅ Tree structure with labeled handles works
✅ Expand/collapse doesn't break edge connections
✅ Search filters tree without losing connections
✅ Handle positioning is accurate
✅ Edge routing updates correctly
✅ Scales to 20+ fields comfortably
✅ Performance is excellent

---

## Alternative Considered (and Why We Chose This)

### Flat Table View

We also implemented a **flat table view** (see `SchemaNodeTable.jsx`):

```
Field: Type
─────────────────
orderNumber: string ○
id: string ○
name: string ○
productId: string ○
quantity: number ○
```

**Pros:** Simpler, more compact
**Cons:** Loses hierarchical context

**Decision:** Use **tree view as default** because:
- Better matches JSON structure
- Shows nesting context
- BizTalk uses hierarchy
- Can collapse unused sections

Both implementations exist in the prototype - toggle with `SCHEMA_VIEW_MODE` constant in `App.jsx`.

---

## Summary

| Component | React Flow Node? | Has Handles? | Purpose |
|-----------|------------------|--------------|---------|
| Source Schema | ✅ YES | ✅ YES (on leaf fields) | Show source structure, provide connection points |
| Target Schema | ✅ YES | ✅ YES (on leaf fields) | Show target structure, provide connection points |
| Functoid | ✅ YES | ✅ YES (inputs/outputs) | Transform data |
| Const | ✅ YES | ✅ YES (output only) | Provide literal values |

**Architecture Benefits:**
- ✨ Cleaner canvas (only functoids in center)
- ✨ No proxy nodes needed
- ✨ Pure React Flow edges everywhere
- ✨ BizTalk-style visual similarity
- ✨ Hierarchical context preserved
- ✨ Scales well to large schemas

---

## Next Steps

- **[Prototype Comparison](./14-prototype-comparison.md)** — See V1 vs V2 detailed analysis
- **[Visual Interface Design](./07-ui-design.md)** — Full UI layout and interactions
- **[Schema Flattening](./06-schema-flattening.md)** — How JSON Schema becomes tree data
- **[MapSpec Schema](./04-mapspec-schema.md)** — What gets saved to disk
