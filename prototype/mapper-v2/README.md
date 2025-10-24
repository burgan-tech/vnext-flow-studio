# Mapper V2 - Database Schema Style

## Alternative Approach

This prototype demonstrates an **alternative architecture** where source and target schemas are **React Flow nodes** with each field exposed as a **labeled handle/terminal**.

**Inspired by:** [React Flow Database Schema Node](https://reactflow.dev/ui/components/database-schema-node)

### Key Features

- 📊 **Table structure** - Clean, organized field list in table format
- 🏷️ **Labeled handles** - Field names integrated with connection points
- 🎯 **Professional look** - Matches database diagram standards
- 💡 **Hover tooltips** - See full field paths on hover
- 🔍 **Field search** - Filter fields within each schema

## Key Differences from V1

| Aspect | V1 (Proxy Nodes) | V2 (Schema Nodes) ✨ |
|--------|------------------|----------------------|
| **Schema Representation** | Separate tree components | React Flow nodes |
| **Field Nodes** | Creates SourceField/TargetField nodes | Fields are handles on schema node |
| **Visual Clutter** | More nodes on canvas | Cleaner - only functoids |
| **Connections** | Source terminal → SourceField → Functoid → TargetField → Target terminal | Source terminal → Functoid → Target terminal |
| **BizTalk Similarity** | Less similar | **More similar** ✅ |

## What This Proves

✅ **Schemas can be React Flow nodes**
- Source schema = One large node (left side)
- Target schema = One large node (right side)
- Each field = A handle/terminal

✅ **Direct connections work**
- Connect source field → target field (1:1 mapping)
- Connect source field → functoid → target field (transformation)
- No intermediate proxy nodes needed

✅ **Less visual clutter**
- Canvas only shows functoids and connections
- Schema nodes stay on the edges (left/right)
- Easier to see the transformation logic

## Installation

```bash
cd prototype/mapper-v2
npm install
```

## Running

```bash
npm run dev
```

Opens at http://localhost:3001 (different port from V1)

## How to Use

1. **View the schemas**
   - Source schema on the left (blue)
   - Target schema on the right (green)
   - Each field has a handle/terminal

2. **Add functoids**
   - Click "Add Multiply (×)" or "Add Concat (&)"
   - Functoids appear in the center

3. **Create mappings**
   - **Direct:** Drag from source field handle → target field handle
   - **With transform:** Drag source → functoid → target
   - Example: `quantity` → Multiply → `lineTotal`

4. **See the graph**
   - All connections visible
   - Animated edges show data flow
   - Clean, uncluttered canvas

## Example Mapping

### Scenario: Calculate Line Total

```
SOURCE SCHEMA (left)       FUNCTOIDS           TARGET SCHEMA (right)
──────────────────────────────────────────────────────────────────
│ □ items[]            │                     │ □ lineItems[]
│  ├─ qty ◄────────────┼───► [Multiply] ────┼────► lineTotal
│  ├─ price ◄──────────┘         ×                   (handle)
│  └─ productId ◄──────────────────────────────────► productId
└────────────(handle)────────────────────────────(handle)────────
```

**Steps:**
1. Drag from `qty` handle → Multiply `in1`
2. Drag from `price` handle → Multiply `in2`
3. Drag from Multiply `out` → `lineTotal` handle

**Result:** One functoid, three edges, clean graph!

## Architecture

### Schema Node Structure (Database Style)

```jsx
<SchemaNodeTable data={{
  side: 'source',
  terminals: [
    { id: '$.orderNumber', name: 'orderNumber', type: 'string' },
    { id: '$.items[].qty', name: 'qty', type: 'number' },
    // ... more fields
  ]
}}>
  {/* Header with search */}
  {/* Table rows with labeled handles */}
</SchemaNodeTable>
```

### Labeled Handle Pattern

Each field is rendered as a table row with integrated handle:

```jsx
<div className="schema-table-row">
  <div className="schema-table-cell">
    <LabeledHandle
      id={terminal.id}
      type="source"  // or "target"
      position={Position.Right}  // or Left for target
      label={terminal.name}
    />
  </div>
  <div className="schema-table-cell">
    <span className="field-type-badge">{terminal.type}</span>
  </div>
</div>
```

**Benefits:**
- Handle and label are visually integrated
- Table structure provides clean alignment
- Professional database diagram aesthetic
- Easier to scan and understand field relationships

### Connections

All edges are standard React Flow edges:

```typescript
{
  source: 'source-schema',           // Schema node ID
  sourceHandle: '$.items[].qty',     // Field terminal ID
  target: 'functoid-multiply',       // Functoid node ID
  targetHandle: 'in1',               // Functoid input handle
  type: 'smoothstep',
  animated: true
}
```

## Pros ✅

1. **Cleaner Canvas**
   - No proxy nodes cluttering the view
   - Only functoids in the middle
   - Easier to understand transformation logic

2. **More BizTalk-like**
   - Schemas on the edges
   - Direct field-to-field connections
   - Familiar visual pattern for BizTalk users

3. **Simpler Mental Model**
   - Fields are terminals, not nodes
   - Schemas are fixed on left/right
   - Functoids are the only movable elements

4. **Better for Simple Mappings**
   - 1:1 mappings = one edge
   - No intermediate nodes to create/manage

5. **Scales Well**
   - 100+ fields = one node with 100 handles
   - React Flow handles this efficiently
   - Scrollable field list within node

## Cons ⚠️

1. **Schema Nodes are Large**
   - Can't zoom/pan schemas independently
   - Always visible (can't hide unused fields)
   - Take up fixed space on canvas

2. **Handle Positioning Challenges**
   - Dynamic top positions for each field
   - Edges can cross if fields are far apart
   - Need to calculate positions carefully

3. **Search Within Node**
   - Search is per-node, not global
   - Can't filter across both schemas at once

4. **Fixed Positions**
   - Schema nodes are `draggable: false`
   - Can't rearrange to reduce edge crossing
   - Layout is predetermined

## Comparison: Which Approach?

### Use V1 (Proxy Nodes) When:

- You need **flexibility** in node positioning
- You want **auto-layout** algorithms to work
- You have **complex, branching mappings**
- You need **fine-grained control** over each field

### Use V2 (Schema Nodes) When:

- You want **BizTalk-style** visual similarity
- You have **simpler mappings** (mostly 1:1)
- You want **less visual clutter** on canvas
- You prefer **schemas as fixed reference panels**

## Technical Notes

### React Flow Node with Many Handles

React Flow handles this well:
- Tested with 100+ handles per node
- Performance is good
- Edge routing works correctly

### Dynamic Handle Positions

```jsx
<Handle
  style={{ top: `${(index + 1) * 32 + headerHeight}px` }}
/>
```

React Flow automatically updates edge positions when handles move.

### Non-Draggable Nodes

```jsx
{
  id: 'source-schema',
  draggable: false,  // Fixed position
  position: { x: 50, y: 50 }
}
```

Keeps schemas in predictable locations.

## Next Steps

After testing both prototypes:

1. **Compare user experience** - Which feels more intuitive?
2. **Test with complex mappings** - Which handles complexity better?
3. **Measure performance** - Any differences with many fields?
4. **Gather feedback** - Which do users prefer?

## Conclusion

✅ **This approach works and is viable!**

**Key Decision Factors:**

| Factor | V1 Winner | V2 Winner |
|--------|-----------|-----------|
| Visual Simplicity | | ✅ |
| BizTalk Similarity | | ✅ |
| Flexibility | ✅ | |
| Complex Mappings | ✅ | |
| Simple Mappings | | ✅ |
| Auto-Layout | ✅ | |

**Recommendation:** Test both with real users and use cases.

---

**Status:** ✅ Working Prototype
**Port:** 3001
**Architecture:** Schema Nodes with Terminal Handles
