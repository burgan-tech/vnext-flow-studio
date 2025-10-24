# 15. Prototype Comparison: V1 vs V2

## Overview

We've built two working prototypes to validate different architectural approaches for the Amorphie Mapper canvas. Both solve the React Flow edge constraint (edges require both endpoints to be nodes), but use different strategies.

---

## 🔵 V1: Proxy Nodes (Separate Trees)

**Location:** `/prototype/mapper/`
**Port:** http://localhost:3000
**Architecture:** Separate schema trees + proxy nodes on canvas

### How It Works

```
┌─────────────────┐         ┌──────────────┐         ┌─────────────────┐
│  SOURCE TREE    │         │   CANVAS     │         │  TARGET TREE    │
│  (DOM elements) │         │ (React Flow) │         │  (DOM elements) │
├─────────────────┤         ├──────────────┤         ├─────────────────┤
│ ○ orderNumber   │         │              │         │ ○ invoiceNumber │
│ ○ customer      │    ┌────┤[SourceField] ├────┐    │ ○ customerId    │
│   ├─ id         │────┤    │   quantity   │    │    │ ○ customerName  │
│   └─ name       │    │    │              │    │    │ ○ lineItems[]   │
│ ○ items[]       │    │    │  [Multiply]  │    ├────│   ├─ productId  │
│   ├─ productId  │    │    │      ×       │    │    │   ├─ qty        │
│   ├─ quantity   ├────┘    │              │    │    │   ├─ unitPrice  │
│   └─ price      │─────────┤              ├────┘    │   └─ lineTotal  │
└─────────────────┘         │[TargetField] │         └─────────────────┘
                            │  lineTotal   │
                            └──────────────┘
```

### Data Flow

1. User drags field from tree → Creates proxy node on canvas
2. Edges connect: `SourceField` → `Functoid` → `TargetField`
3. Trees use CSS visual indicators (🔗, ✅, ⭕) to show mapping status

### Pros ✅

**Flexibility**
- Proxy nodes can be positioned anywhere on canvas
- Auto-layout algorithms can rearrange nodes
- Fine-grained control over each field's visual position

**Separation of Concerns**
- Trees handle schema navigation/search
- Canvas handles transformation logic
- Clear visual separation

**Complex Mappings**
- Multiple functoids can chain together
- Branching transformations are easy to visualize
- Each mapped field gets dedicated space

**Familiar Pattern**
- Similar to data flow tools (Node-RED, Airflow)
- Nodes represent units of work
- Standard graph visualization

### Cons ⚠️

**Visual Clutter**
- Every mapped field creates a node
- 50 fields = 50 proxy nodes + functoids
- Canvas gets crowded quickly

**Double Representation**
- Same field appears in tree AND on canvas
- Can be confusing: "Which do I interact with?"
- Mental overhead tracking both locations

**Extra Steps**
- User must drag field to canvas before mapping
- More clicks/interactions required
- Workflow: Find → Drag → Connect vs. Find → Connect

**Edge Crossings**
- More nodes = more potential edge crossings
- Harder to see clean data flow paths
- Layout becomes challenging

---

## 🟢 V2: Schema Nodes (Database Schema Style)

**Location:** `/prototype/mapper-v2/`
**Port:** http://localhost:3001
**Architecture:** Schemas ARE React Flow nodes with field terminals
**Inspired by:** [React Flow Database Schema Node](https://reactflow.dev/ui/components/database-schema-node)

### Design Pattern

Uses a **table-based structure** with **labeled handles** - field names are integrated directly with connection points, providing a clean, professional look that matches database diagram conventions.

### How It Works

```
                    ┌──────────────────────────────┐
                    │   CANVAS (React Flow)        │
                    ├──────────────────────────────┤
┌──────────────┐    │                              │    ┌──────────────┐
│ SOURCE NODE  │    │     ┌───────────┐            │    │ TARGET NODE  │
│ (React Flow) │    │     │ [Multiply]│            │    │ (React Flow) │
├──────────────┤    │     │     ×     │            │    ├──────────────┤
│ orderNumber ◄├────┼─────┤           ├────────────┼───►│ invoiceNumber│
│ customer.id ◄├────┼────►│ in1   out ├────────────┼───►│ customerId   │
│ customer.name│    │     │ in2       │            │    │ customerName │
│ items[].qty ◄├────┼─────┘           │            │    │ lineItems[]  │
│ items[].price◄    │                 │            │    │   productId ◄│
│              │    │                 │            │    │   qty       ◄│
└──────────────┘    │                 │            │    │   unitPrice ◄│
  ▲ Fixed position  │                 │            │    │   lineTotal ◄│
  │ Non-draggable   │                 │            │    └──────────────┘
                    │                 │            │      ▲ Fixed position
                    └──────────────────────────────┘      │ Non-draggable
```

### Data Flow

1. Schemas are always visible (fixed React Flow nodes)
2. Each field is a Handle/terminal on the schema node
3. Edges connect: Source terminal → Functoid → Target terminal
4. Direct connections possible: Source terminal → Target terminal

### Pros ✅

**Visual Clarity**
- Only functoids appear on canvas
- Schemas are fixed reference panels (left/right)
- Clean, uncluttered middle area for transformation logic

**BizTalk Similarity**
- Matches BizTalk Mapper visual pattern exactly
- Users coming from BizTalk feel at home
- Industry-standard visual language

**Fewer Interactions**
- No need to drag fields to canvas
- Direct connect from source → target
- Workflow: Find → Connect (one step removed)

**Simpler Mental Model**
- Fields are terminals, not nodes
- Schemas are fixed structures
- Only functoids move around

**Scales Well**
- 100+ fields = one node with 100 handles
- React Flow handles many handles efficiently
- Scrollable field list within node

### Cons ⚠️

**Large Fixed Nodes**
- Schema nodes take up vertical space
- Can't zoom/pan schemas independently
- Always visible even if not needed

**Handle Positioning**
- Dynamic top positions calculated per field
- Edges can cross if fields are far apart
- Visual alignment can be tricky

**Search Limitations**
- Search is per-schema (within node)
- Can't filter across both schemas globally
- Need to search source and target separately

**Fixed Layout**
- Schemas are `draggable: false`
- Can't rearrange to reduce edge crossing
- Predetermined left/right positions

**Less Flexible**
- Auto-layout algorithms won't work
- Can't reposition schema fields visually
- Graph algorithms have limited impact

---

## Comparison Table

| Aspect | V1 (Proxy Nodes) | V2 (Schema Nodes) |
|--------|------------------|-------------------|
| **Schema Representation** | Separate tree components | React Flow nodes |
| **Field Representation** | Proxy nodes on canvas | Handles on schema node |
| **Visual Clutter** | High (many proxy nodes) | Low (only functoids) |
| **Connections** | Source proxy → Functoid → Target proxy | Source terminal → Functoid → Target terminal |
| **BizTalk Similarity** | Moderate | High ✅ |
| **Flexibility** | High ✅ | Low |
| **Auto-Layout** | Works ✅ | Limited |
| **Complex Mappings** | Easier ✅ | Harder |
| **Simple Mappings (1:1)** | More steps | Easier ✅ |
| **User Workflow** | Find → Drag → Connect | Find → Connect |
| **Scalability** | Degrades with many fields | Scales well ✅ |
| **Mental Model** | Nodes = data points | Terminals = data points |
| **Learning Curve** | Steeper (two representations) | Gentler ✅ |

---

## React Flow Technical Details

### V1: Proxy Node Pattern

```typescript
// Tree creates proxy node on drag
const onDrop = (event) => {
  const fieldData = JSON.parse(event.dataTransfer.getData('application/json'));
  const newNode = {
    id: `source_${nodeId++}`,
    type: 'sourceField',
    position: screenToFlowPosition({ x: event.clientX, y: event.clientY }),
    data: { label: fieldData.name, type: fieldData.type }
  };
  setNodes((nds) => nds.concat(newNode));
};

// Edge connects proxy nodes
const edge = {
  source: 'source_123',      // SourceField proxy node
  target: 'functoid_456',    // Functoid node
  sourceHandle: 'out',
  targetHandle: 'in1'
};
```

### V2: Schema Node with Labeled Handles (Database Style)

```typescript
// Schema is initialized as fixed node
const initialNodes = [
  {
    id: 'source-schema',
    type: 'schema',
    position: { x: 50, y: 50 },
    data: {
      side: 'source',
      terminals: [
        { id: '$.orderNumber', name: 'orderNumber', type: 'string' },
        { id: '$.items[].qty', name: 'qty', type: 'number' },
        // ... more fields
      ]
    },
    draggable: false
  }
];

// Each field rendered as table row with labeled handle
<div className="schema-table-row">
  <LabeledHandle
    id="$.items[].qty"
    label="quantity"
    type="source"
    position={Position.Right}
  />
  <span className="field-type-badge">number</span>
</div>

// Edge connects schema handles
const edge = {
  source: 'source-schema',      // Schema node ID
  sourceHandle: '$.items[].qty', // Field terminal ID
  target: 'functoid-multiply',   // Functoid node ID
  targetHandle: 'in1'
};
```

### Handle Performance

Both approaches tested with 100+ handles:
- React Flow handles this well
- No performance degradation
- Edge routing works correctly
- Dynamic handle positions update smoothly

---

## Use Case Recommendations

### Choose V1 (Proxy Nodes) When:

✅ **Flexibility is critical**
- Need to position fields for optimal layout
- Want to use auto-layout algorithms (dagre, elk)
- Complex transformations with many intermediate steps

✅ **Graph analysis is needed**
- Want to analyze data flow paths programmatically
- Need to optimize layouts based on connections
- Building advanced features (impact analysis, lineage tracking)

✅ **Users expect standard graph tools**
- Coming from Node-RED, Airflow, n8n
- Familiar with node-based editors
- Want drag-and-drop flexibility

✅ **Complex, multi-step transformations**
- Many functoids chained together
- Branching logic with multiple paths
- Need clear separation between transformation steps

### Choose V2 (Schema Nodes) When:

✅ **BizTalk migration is the goal**
- Users are familiar with BizTalk Mapper
- Visual similarity reduces training time
- Industry standard for integration teams

✅ **Simplicity is preferred**
- Mostly 1:1 or simple mappings
- Users want minimal canvas interaction
- Focus on "what connects" not "how it's laid out"

✅ **Schema as reference is expected**
- Users want fixed schema panels as reference
- Don't need to reposition fields
- Schemas are navigation/documentation tools

✅ **Visual clarity is paramount**
- Canvas should only show transformation logic
- Avoid clutter from many proxy nodes
- Clean, simple visual design

---

## Hybrid Approach (Future)

Could we combine both approaches?

**Idea: Toggle between modes**

```typescript
// User preference setting
const [viewMode, setViewMode] = useState('schema-nodes'); // or 'proxy-nodes'

// Renderer switches based on mode
{viewMode === 'schema-nodes' ? (
  <SchemaNodesView />
) : (
  <ProxyNodesView />
)}
```

**Pros:**
- Best of both worlds
- Users choose preferred workflow
- Migration path from V2 → V1 as complexity grows

**Cons:**
- Maintains two codebases
- State synchronization complexity
- Potential confusion switching between modes

---

## Recommendation

**For Amorphie Mapper:**

Start with **V2 (Schema Nodes)** because:

1. **BizTalk users** are the primary audience → Visual familiarity is critical
2. **Most mappings are simple** → 1:1 or basic transformations with 1-2 functoids
3. **Less training required** → Simpler mental model
4. **Cleaner UI** → Less visual noise for business users

**Monitor for:**
- User feedback on complex transformations
- Edge crossing issues with deep schemas
- Need for auto-layout features

**Future migration:**
- If complexity grows, add V1 as "Advanced Mode"
- Detect complex mappings and suggest switching modes
- Provide both options based on use case

---

## Testing Both Prototypes

**V1 (Proxy Nodes):**
```bash
cd /Users/U05366/wf/prototype/mapper
npm run dev
# Opens at http://localhost:3000
```

**V2 (Schema Nodes):**
```bash
cd /Users/U05366/wf/prototype/mapper-v2
npm run dev
# Opens at http://localhost:3001
```

**Test Scenarios:**

1. **Simple 1:1 mapping**
   - Map `orderNumber` → `invoiceNumber`
   - Which approach feels faster?

2. **Transformation mapping**
   - Map `quantity × price` → `lineTotal`
   - Which approach is clearer?

3. **Complex multi-step**
   - Create 3+ chained functoids
   - Which handles complexity better?

4. **Visual clarity**
   - Create 10+ mappings
   - Which remains easier to understand?

5. **Search & discovery**
   - Find and map a deeply nested field
   - Which workflow is faster?

---

## Next Steps

1. **User Testing**
   - Get feedback from BizTalk users
   - Test with real mapping scenarios
   - Measure task completion time

2. **Performance Testing**
   - Test with 100+ field schemas
   - Measure rendering performance
   - Test edge rendering with many connections

3. **Feature Parity**
   - Ensure both prototypes support same features
   - Validate JSONata code generation works for both
   - Test validation and linting

4. **Decision**
   - Choose primary approach for MVP
   - Document decision rationale
   - Plan potential hybrid approach for future

---

**Status:** ✅ Both prototypes working and ready for comparison testing
**V1 Port:** http://localhost:3000
**V2 Port:** http://localhost:3001
