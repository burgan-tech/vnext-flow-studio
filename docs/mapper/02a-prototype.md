# Working Prototype V1 (Proxy Nodes)

> **Note:** There are now **two prototypes** demonstrating different architectural approaches. This document covers V1. For a detailed comparison, see **[Prototype Comparison](./14-prototype-comparison.md)**.

## Overview

This prototype validates the "proxy nodes" architecture approach. It demonstrates that **schema trees can be separate components while React Flow manages all edges between canvas nodes**.

**Location:** `/prototype/mapper/`
**Architecture:** Separate schema trees + proxy nodes on canvas
**Alternative:** [V2 (Schema Nodes)](./14-prototype-comparison.md) uses schemas as React Flow nodes with field terminals

## What It Proves

✅ **All React Flow edges work perfectly**
- No custom edge rendering needed
- No coordinate translation issues
- All standard React Flow features work

✅ **Trees and canvas work together seamlessly**
- Drag from tree → creates node on canvas
- Visual indicators show mapping status
- Complete mapping graph visible on canvas

✅ **Performance is excellent**
- Trees handle 100+ fields
- Canvas shows only mapped nodes (10-30 typical)
- Smooth zoom, pan, animation

## Quick Start

```bash
cd prototype/mapper
npm install
npm run dev
```

Opens at http://localhost:3000

## Try It

1. **Drag fields** from Source Tree (left) to canvas
2. **Add Multiply node** using toolbar button
3. **Drag fields** from Target Tree (right) to canvas
4. **Connect nodes** by dragging handles
5. **See:** All edges are React Flow edges ✅

## Key Files

| File | Purpose |
|------|---------|
| `App.jsx` | Main 3-panel layout |
| `SchemaTree.jsx` | Tree component (not React Flow nodes) |
| `MapperCanvas.jsx` | React Flow canvas with drag-and-drop |
| `CustomNodes.jsx` | SourceField, TargetField, Functoid nodes |
| `schemas.js` | Sample data and flattening logic |

## Architecture Validation

The prototype validates our architectural decision:

### ✅ Schema Trees as Separate Components

```jsx
<div className="mapper-layout">
  <SchemaTree side="source" />      {/* NOT React Flow */}
  <ReactFlow nodes={...} edges={...}> {/* Canvas only */}
  <SchemaTree side="target" />     {/* NOT React Flow */}
</div>
```

### ✅ Proxy Nodes on Canvas

```typescript
// When dragging from tree → canvas
const newNode = {
  id: 'source_qty_123',
  type: 'sourceField',
  position: { x: 100, y: 200 },
  data: { label: 'quantity', type: 'number' }
};
```

### ✅ Pure React Flow Edges

```typescript
// All edges connect canvas nodes
const edge = {
  source: 'source_qty_123',    // React Flow node ✓
  target: 'functoid_multiply',  // React Flow node ✓
  type: 'smoothstep',
  animated: true
};
```

### ✅ Visual Indicators (CSS Only)

```css
/* Tree shows mapping status with CSS */
.tree-field.mapped::after {
  content: '';
  border-bottom: 2px dashed #3b82f6;
}
```

## Screenshots

Run the prototype to see:

![3-Panel Layout](./images/prototype-layout.png)
- Left: Source schema tree with search
- Center: React Flow canvas with custom nodes
- Right: Target schema tree with indicators

![Drag and Drop](./images/prototype-dragdrop.png)
- Drag from tree creates canvas node
- All edges connect canvas nodes

![Complete Mapping](./images/prototype-complete.png)
- Full mapping graph visible
- Animated edges show data flow

## Technical Details

### Dependencies

- React 18.3
- @xyflow/react 12.0
- Vite 5.4

### Features Demonstrated

- ✅ Drag-and-drop from trees to canvas
- ✅ Node creation on drop
- ✅ Edge connections between canvas nodes
- ✅ Visual mapping indicators in trees
- ✅ React Flow zoom, pan, controls
- ✅ MiniMap overview
- ✅ Animated edges

### Performance

- Handles 30+ canvas nodes smoothly
- Tree rendering is efficient (can add virtualization)
- No performance issues with zoom/pan

## Conclusion

✅ **The architecture is validated.**

This prototype proves that:
1. Schema trees can be separate components
2. All React Flow edges work perfectly
3. No custom rendering hacks needed
4. UX is excellent (matches BizTalk pattern)
5. Performance scales to real-world use

**Recommendation:** Use this architecture for full implementation.

## Next Steps

See [Implementation Plan](./17-implementation-plan.md) for building the production version based on this prototype.

---

**Status:** ✅ Working Prototype
**Location:** `/prototype/mapper/`
**Validation:** [ARCHITECTURE-VALIDATION.md](../../prototype/mapper/ARCHITECTURE-VALIDATION.md)
