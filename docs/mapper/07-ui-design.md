# Visual Interface Design

## Overview

The mapper interface uses a **BizTalk-style 3-panel layout** with source schema tree (left), mapping canvas (center), and target schema tree (right). This familiar design pattern makes it intuitive for users with BizTalk experience while adapting to modern web technologies.

## Main Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ [Mapper Toolbar: Save | Run Tests | Validate | Export JSONata] │
├────────────┬──────────────────────────────────┬─────────────────┤
│            │                                  │                 │
│  SOURCE    │        CANVAS                    │   TARGET        │
│  SCHEMA    │    (React Flow)                  │   SCHEMA        │
│  TREE      │                                  │   TREE          │
│            │  [Functoids + Connections]       │                 │
│  [Search]  │                                  │   [Search]      │
│            │                                  │                 │
│  □ Root    │    ┌──────┐   ┌──────┐          │   □ Root        │
│   ├─ items │    │ Add  │───│ Mult │──────────┼──  ├─ total     │
│   │ ├─ qty ├────┤  +   │   │  ×   │          │    ├─ count     │
│   │ └─price├────┤      │   └──────┘          │    └─ customer  │
│   └─ name  │    └──────┘                      │       └─ id     │
│            │                                  │                 │
│            │  [Right-click: Add functoid]     │                 │
└────────────┴──────────────────────────────────┴─────────────────┘
│ [Bottom Panel: Tests | Preview | Console | Properties]          │
└─────────────────────────────────────────────────────────────────┘
```

**Proportions:**

- Source tree: 20% width
- Canvas: 60% width
- Target tree: 20% width
- Bottom panel: 30% height (collapsible)

## Left Panel: Source Schema Tree

### Structure

Hierarchical tree view of input JSON Schema, flattened to terminals (leaf fields).

### Visual Elements

**Tree Node Components:**

```
□ customer                    ← Parent node (object)
 ├─ 🔵 id [string]            ← Required field
 ├─ ⚪ name [string]          ← Optional field
 ├─ ? email [string?]         ← Nullable field
 └─ 🔁 orders [array]         ← Collection (expandable)
     ├─ orderId [string]
     └─ amount [number]
```

**Field Indicators:**

- 🔵 **Blue dot:** Required field (bold text)
- ⚪ **White dot:** Optional field (normal weight)
- 🔁 **Recycle icon:** Collection/array
- **?** **Gray question mark:** Nullable field
- **[ ]** **Suffix:** Array notation (e.g., `orders[]`)

### Interaction

**Hover Behavior:**

- Shows pill-shaped drag handle on the right
- Tooltip displays:
  - Field name
  - JSONPath (e.g., `$.customer.orders[].amount`)
  - JSON Schema type
  - Description (if present in schema)

**Drag & Drop:**

1. **Drag field to canvas** → Creates `SourceField` node at drop position
2. **Drag field to target tree** → Creates direct 1:1 mapping (if types compatible)
3. **Drag field to functoid input port** → Creates connection

**Search:**

- Text input at top of panel
- Fuzzy match on field name
- Highlights matching fields, collapses non-matching branches

**Expand/Collapse:**

- Click ⊞/⊟ icon to expand/collapse parent nodes
- Double-click to expand all descendants
- Shift+click to collapse all siblings

### Example

```json
// Source: order.schema.json
{
  "orderNumber": "string",
  "customer": {
    "name": "string",
    "id": "string"
  },
  "items": [{
    "productId": "string",
    "quantity": "number",
    "price": "number"
  }]
}
```

**Rendered Tree:**

```
□ Root
 ├─ 🔵 orderNumber [string]
 ├─ □ customer [object]
 │   ├─ 🔵 name [string]
 │   └─ 🔵 id [string]
 └─ 🔁 items [array]
     ├─ 🔵 productId [string]
     ├─ 🔵 quantity [number]
     └─ 🔵 price [number]
```

## Center Panel: Mapping Canvas

### Canvas Properties

- **Library:** React Flow (`@xyflow/react`)
- **Background:** Dot grid (subtle, 10px spacing, `#e5e7eb` color)
- **Zoom:** 10% - 200% (mouse wheel or pinch)
- **Pan:** Click + drag on empty space, or Space + drag
- **Selection:** Marquee select with Shift + drag

### Functoid Nodes

See [Functoid Visual Design](./08-functoid-visuals.md) for detailed specs.

**Quick Reference:**

- Size: 80px × 60px (consistent for all)
- Shape: Rounded rectangle (8px radius)
- Icon: 24×24px centered, with label below
- Ports: Circles on left (inputs) and right (output)

### Connections

**Visual Style:**

- **Line type:** Bezier curves (smooth, curved)
- **Width:** 2px (default), 3px (hover/selected)
- **Color:**
  - Default: `#9ca3af` (gray)
  - Hover: `#3b82f6` (blue)
  - Selected: `#3b82f6` (blue, dashed)
  - Type mismatch: `#f59e0b` (orange, dashed)
  - Error: `#ef4444` (red, dashed)

**Data Flow Animation:**

During preview/test execution, animated dots move along connections to visualize data flow.

```css
/* Dot animation */
@keyframes flow {
  from { stroke-dashoffset: 0; }
  to { stroke-dashoffset: 24; }
}
.edge-animated {
  stroke-dasharray: 8 4;
  animation: flow 1s linear infinite;
}
```

### Context Menu

**Right-click canvas → "Add Functoid" submenu:**

```
Add Functoid ►
  String ►
    ├─ Concat
    ├─ Uppercase
    ├─ Lowercase
    └─ ...
  Mathematical ►
    ├─ Add
    ├─ Multiply
    └─ ...
  Logical ►
  Conditional ►
  Conversion ►
  Collection ►
  Object ►
  Advanced ►
```

**Right-click node:**

```
• Edit Properties
• Duplicate
• Delete
───────────────
• Copy
• Paste
───────────────
• View Generated JSONata
```

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Delete / Backspace | Delete selected nodes/edges |
| Ctrl+C | Copy selected nodes |
| Ctrl+V | Paste nodes |
| Ctrl+Z | Undo |
| Ctrl+Y / Ctrl+Shift+Z | Redo |
| Ctrl+A | Select all |
| Ctrl+F | Focus search (schema trees) |
| Space + Drag | Pan canvas |
| Ctrl+0 | Reset zoom to 100% |
| Shift+Drag | Marquee select |

## Right Panel: Target Schema Tree

### Structure

Same as source tree, but with **mapping indicators** to show completion status.

### Mapping Indicators

**Field Status Icons:**

- ✅ **Green checkmark:** Field has valid mapping
- ⚠️ **Orange warning:** Field mapped but has validation issues (e.g., type mismatch)
- ⭕ **Gray circle:** Field not mapped
  - **Bold + red outline:** Required field not mapped (error)
  - **Normal:** Optional field not mapped (OK)
- 🔗 **Blue link icon:** Click to highlight mapping path on canvas

**Example:**

```
□ Root
 ├─ ✅ invoiceNumber [string]       ← Mapped, valid
 ├─ ⚠️ customerId [string]          ← Mapped, type warning
 ├─ ⭕ customerName [string]         ← Not mapped (optional)
 └─ 🔁 lineItems [array]
     ├─ ✅ productId [string]
     └─ ⭕ qty [number]              ← Not mapped, required (red)
```

### Auto-Map Button

**Location:** Top of target tree panel

**Behavior:**

1. Click "Auto-Map" button
2. Algorithm compares source and target field names (fuzzy match)
3. Creates direct connections for matching fields with compatible types
4. Shows summary: "Mapped 8/12 fields (4 require manual mapping)"

**Matching Strategy:**

- Exact match (case-insensitive): `orderNumber` ↔ `invoiceNumber` (100% confidence)
- Camel/snake case variants: `order_id` ↔ `orderId` (90% confidence)
- Substring match: `customer.name` ↔ `customerName` (80% confidence)
- Only creates mappings for ≥80% confidence + type compatibility

### Drop Targets

**Drop functoid output on target field:**

- Validates type compatibility
- Creates `TargetField` node + connection
- Updates mapping indicator to ✅

**Drop source field on target field:**

- Creates direct 1:1 mapping (no functoid)
- Auto-creates `SourceField` → `TargetField` connection

## Bottom Panel: Tabs

### 1. Tests Tab

**Layout:**

```
┌─────────────────────────────────────────────────────────────┐
│ [+ Add Test] [▶ Run All] [⚙️ Settings]                      │
├─────────────────────────────────────────────────────────────┤
│ Name                        Status    Duration   Actions     │
├─────────────────────────────────────────────────────────────┤
│ ✅ Basic order with 2 items  PASS      12ms      [▶][✏️][🗑️]│
│ ⚠️ Empty order               FAIL      8ms       [▶][✏️][🗑️]│
│ ⏸️ Large order (100 items)   SKIP      -         [▶][✏️][🗑️]│
└─────────────────────────────────────────────────────────────┘
```

**Test Editor (click ✏️):**

```
┌─────────────────────────────────────────────────────────────┐
│ Test Name: [Basic order with 2 items___________________]    │
├─────────────────────────────────────────────────────────────┤
│ Input (JSON):                │ Expected Output (JSON):      │
│ {                            │ {                            │
│   "orderNumber": "ORD-001",  │   "invoiceNumber": "ORD-001",│
│   "items": [...]             │   "total": 49.5              │
│ }                            │ }                            │
└─────────────────────────────────────────────────────────────┘
│ [Cancel] [Save] [Run Test]                                  │
└─────────────────────────────────────────────────────────────┘
```

**Diff View (failed tests):**

```
┌─────────────────────────────────────────────────────────────┐
│ Expected                     │ Actual                        │
├─────────────────────────────────────────────────────────────┤
│ {                            │ {                            │
│   "total": 49.5,             │   "total": 45.0,  ← ERROR    │
│   "tax": 4.5                 │   "tax": 0.0      ← ERROR    │
│ }                            │ }                            │
└─────────────────────────────────────────────────────────────┘
```

### 2. Preview Tab

**Layout:**

```
┌─────────────────────────────────────────────────────────────┐
│ Sample Input (JSON)          │ Generated Output (JSON)      │
├─────────────────────────────────────────────────────────────┤
│ {                            │ {                            │
│   "orderNumber": "TEST-001", │   "invoiceNumber": "TEST-001"│
│   "items": [                 │   "total": 100.0             │
│     {                        │ }                            │
│       "qty": 2,              │                              │
│       "price": 50.0          │                              │
│     }                        │                              │
│   ]                          │                              │
│ }                            │                              │
└─────────────────────────────────────────────────────────────┘
│ [▶ Run Transformation] [📋 Copy Output] [💾 Save as Test]   │
└─────────────────────────────────────────────────────────────┘
```

### 3. Console Tab

**Output Types:**

```
┌─────────────────────────────────────────────────────────────┐
│ [All] [Validation] [Codegen] [Tests] [Clear]                │
├─────────────────────────────────────────────────────────────┤
│ ⚠️ 14:23:45 [Validation] Type mismatch: customerId          │
│    Expected: string, got: number                            │
│ ✅ 14:23:46 [Codegen] Generated JSONata (12 expressions)    │
│ ✅ 14:23:50 [Tests] All 3 tests passed (42ms)               │
└─────────────────────────────────────────────────────────────┘
```

### 4. Properties Tab

**Appears when functoid selected:**

```
┌─────────────────────────────────────────────────────────────┐
│ Functoid: Multiply                                          │
├─────────────────────────────────────────────────────────────┤
│ ID: node_abc123                                             │
│ Kind: Binary                                                │
│ Operation: Mul                                              │
│                                                             │
│ Inputs:                                                     │
│  • Port 1: quantity (number)                                │
│  • Port 2: price (number)                                   │
│                                                             │
│ Output: 20.0 (preview)                                      │
│                                                             │
│ Generated JSONata:                                          │
│ quantity * price                                            │
│                                                             │
│ [🗑️ Delete] [📋 Duplicate]                                  │
└─────────────────────────────────────────────────────────────┘
```

## Toolbar

**Top bar with common actions:**

```
┌─────────────────────────────────────────────────────────────┐
│ 💾 Save | ▶ Run Tests | ✓ Validate | 📤 Export JSONata     │
│                                           🔍 100% [-][+][⊡] │
└─────────────────────────────────────────────────────────────┘
```

**Buttons:**

- 💾 **Save:** Save MapSpec + GraphLayout to disk
- ▶ **Run Tests:** Execute all test cases
- ✓ **Validate:** Run static validation checks
- 📤 **Export JSONata:** Generate *.mapping-table.json + *.whole-object.jsonata
- 🔍 **Zoom controls:** Current zoom level, zoom out, zoom in, fit to screen

## Responsive Behavior

**Narrow windows (<1200px):**

- Collapse source/target trees to tabs (switch between)
- Canvas becomes full-width
- Bottom panel remains at bottom

**Wide windows (>1600px):**

- Source tree: 300px fixed width
- Target tree: 300px fixed width
- Canvas: Remaining space

## Accessibility

- **Keyboard navigation:** Tab through all interactive elements
- **Screen reader support:** ARIA labels on all nodes and controls
- **High contrast mode:** Respect OS preference
- **Focus indicators:** Clear visual focus states (blue outline, 2px)

## Next Steps

- [Functoid Library](./07-functoid-library.md) — Complete catalog of functoids
- [Functoid Visual Design](./08-functoid-visuals.md) — Colors, icons, animations
- [Complete Example](./14-example-order-invoice.md) — See the interface in action
