# GraphLayout Schema

**Status:** Draft
**Last Updated:** 2025-10-22

## Overview

The **GraphLayout** file stores the visual presentation layer for a mapper. While the [MapSpec](./04-mapspec-schema.md) defines the semantic mapping logic, the GraphLayout defines positions, sizes, zoom levels, and visual states for the canvas.

**Key Principle:** GraphLayout is **optional** and **regenerable**. If deleted, the mapper can be rendered with default auto-layout. This separation allows:
- Version control flexibility (can gitignore layout files)
- Team collaboration without merge conflicts on positions
- Programmatic layout generation
- Multiple views of the same mapper

## File Relationship

```
order-to-invoice.mapper.json          ← MapSpec (required, semantic)
order-to-invoice.mapper.diagram.json  ← GraphLayout (optional, visual)
```

The GraphLayout file references the MapSpec by convention (same base name) and stores **only visual properties** - no mapping logic.

## Schema Structure

```typescript
interface GraphLayout {
  version: string;              // GraphLayout schema version (e.g., "1.0")
  mapperFile: string;           // Relative path to MapSpec file
  viewport: Viewport;           // Canvas viewport state
  nodes: NodeLayout[];          // Visual properties for nodes
  metadata?: LayoutMetadata;    // Optional UI preferences
}

interface Viewport {
  x: number;                    // Pan X offset
  y: number;                    // Pan Y offset
  zoom: number;                 // Zoom level (0.1 to 2.0)
}

interface NodeLayout {
  id: string;                   // Must match node ID in MapSpec
  position: Position;           // Canvas coordinates
  dimensions?: Dimensions;      // Optional size override
  style?: NodeStyle;            // Optional visual overrides
  ui?: NodeUIState;             // UI-specific state
}

interface Position {
  x: number;                    // Canvas X coordinate
  y: number;                    // Canvas Y coordinate
}

interface Dimensions {
  width: number;                // Node width (pixels)
  height: number;               // Node height (pixels)
}

interface NodeStyle {
  backgroundColor?: string;     // CSS color
  borderColor?: string;         // CSS color
  borderWidth?: number;         // Pixels
  opacity?: number;             // 0.0 to 1.0
  zIndex?: number;              // Stacking order
}

interface NodeUIState {
  collapsed?: boolean;          // For tree nodes: expanded/collapsed
  selected?: boolean;           // Selection state
  highlighted?: boolean;        // Highlight state
  hidden?: boolean;             // Visibility toggle
  minimized?: boolean;          // Minimized view state
}

interface LayoutMetadata {
  layoutAlgorithm?: string;     // "manual" | "dagre" | "elk" | "auto"
  gridSnap?: boolean;           // Snap to grid enabled
  gridSize?: number;            // Grid size in pixels
  theme?: string;               // "light" | "dark"
  miniMapVisible?: boolean;     // Minimap visibility
  controlsVisible?: boolean;    // Controls panel visibility
}
```

## Complete Example

```json
{
  "version": "1.0",
  "mapperFile": "./order-to-invoice.mapper.json",
  "viewport": {
    "x": 120,
    "y": 80,
    "zoom": 1.0
  },
  "nodes": [
    {
      "id": "source-schema",
      "position": { "x": 50, "y": 50 },
      "dimensions": { "width": 350, "height": 600 },
      "ui": {
        "collapsed": false
      }
    },
    {
      "id": "target-schema",
      "position": { "x": 1200, "y": 50 },
      "dimensions": { "width": 350, "height": 500 },
      "ui": {
        "collapsed": false
      }
    },
    {
      "id": "func-multiply-1",
      "position": { "x": 650, "y": 200 },
      "dimensions": { "width": 120, "height": 80 },
      "style": {
        "backgroundColor": "#fef3c7",
        "borderColor": "#f59e0b"
      },
      "ui": {
        "selected": false,
        "minimized": false
      }
    },
    {
      "id": "func-concat-1",
      "position": { "x": 650, "y": 350 },
      "dimensions": { "width": 120, "height": 80 },
      "style": {
        "backgroundColor": "#dbeafe",
        "borderColor": "#3b82f6"
      }
    }
  ],
  "metadata": {
    "layoutAlgorithm": "manual",
    "gridSnap": true,
    "gridSize": 20,
    "theme": "light",
    "miniMapVisible": true,
    "controlsVisible": true
  }
}
```

## Node ID Matching

Every `NodeLayout.id` **must match** a node ID from the MapSpec:

**MapSpec nodes:**
```json
{
  "nodes": [
    { "id": "func-multiply-1", "kind": "Binary.Multiply", ... },
    { "id": "func-concat-1", "kind": "String.Concat", ... }
  ]
}
```

**GraphLayout nodes:**
```json
{
  "nodes": [
    { "id": "func-multiply-1", "position": { "x": 650, "y": 200 } },
    { "id": "func-concat-1", "position": { "x": 650, "y": 350 } }
  ]
}
```

**Schema nodes (`source-schema`, `target-schema`)** are implicit in MapSpec but **explicit in GraphLayout** because they have visual positions.

## Viewport Management

The viewport defines the canvas view state:

```json
{
  "viewport": {
    "x": 120,      // Pan offset X (positive = panned right)
    "y": 80,       // Pan offset Y (positive = panned down)
    "zoom": 1.0    // Zoom level (1.0 = 100%, 0.5 = 50%, 2.0 = 200%)
  }
}
```

**Zoom Range:** Typically 0.1 (10%) to 2.0 (200%)

**Pan Coordinates:** React Flow uses a coordinate system where:
- Positive X = canvas moved right (nodes appear left)
- Positive Y = canvas moved down (nodes appear up)

## Node Dimensions

Dimensions can be:
1. **Omitted** - Let React Flow auto-calculate based on content
2. **Explicit** - Store fixed dimensions
3. **Partially specified** - Store only width or height

```json
// Auto-size (recommended for dynamic content)
{
  "id": "func-multiply-1",
  "position": { "x": 650, "y": 200 }
}

// Fixed size
{
  "id": "func-multiply-1",
  "position": { "x": 650, "y": 200 },
  "dimensions": { "width": 120, "height": 80 }
}

// Width only (height auto)
{
  "id": "source-schema",
  "position": { "x": 50, "y": 50 },
  "dimensions": { "width": 350 }
}
```

**Recommendation:** Use auto-size for functoids (content-driven), explicit dimensions for schema nodes (user-resizable).

## Node Styles

Visual overrides allow per-node customization:

```json
{
  "id": "func-multiply-1",
  "position": { "x": 650, "y": 200 },
  "style": {
    "backgroundColor": "#fef3c7",    // Light amber
    "borderColor": "#f59e0b",        // Amber-500
    "borderWidth": 2,
    "opacity": 1.0,
    "zIndex": 1
  }
}
```

**Default Behavior:** If styles are omitted, nodes use theme defaults from CSS.

**Use Cases:**
- Custom functoid colors
- Highlighting specific nodes
- Visual grouping (similar colors)
- Fade out inactive nodes (opacity)

## UI State

The `ui` object stores ephemeral UI state:

```json
{
  "id": "source-schema",
  "position": { "x": 50, "y": 50 },
  "ui": {
    "collapsed": false,      // Tree expansion state
    "selected": false,       // Selection state (can persist)
    "highlighted": false,    // Temporary highlight
    "hidden": false,         // Visibility toggle
    "minimized": false       // Minimized view
  }
}
```

**Persistence Decision:**
- **Commit to git:** `collapsed` (affects layout)
- **Session only:** `selected`, `highlighted` (transient)
- **User preference:** `hidden`, `minimized` (depends on workflow)

### Tree Node Collapse State

For schema nodes with tree structure:

```json
{
  "id": "source-schema",
  "position": { "x": 50, "y": 50 },
  "ui": {
    "collapsed": false,           // Root level expanded
    "collapsedPaths": [           // Specific paths collapsed
      "$.items",
      "$.customer.addresses"
    ]
  }
}
```

The `collapsedPaths` array stores JSONPath expressions for collapsed tree branches.

**Example Visualization:**
```
Order (expanded)
├─ orderNumber: string
├─ orderDate: string
├─ items: array [collapsed]
└─ customer: object
   ├─ name: string
   └─ addresses: array [collapsed]
```

## Layout Algorithms

The `layoutAlgorithm` metadata indicates how positions were determined:

```json
{
  "metadata": {
    "layoutAlgorithm": "manual"    // or "dagre" | "elk" | "auto"
  }
}
```

**Options:**
- **`manual`** - User-positioned nodes (default)
- **`dagre`** - Dagre hierarchical layout
- **`elk`** - Eclipse Layout Kernel
- **`auto`** - Simple automatic layout (left-to-right)

**When regenerating layout:**
```bash
# Delete layout file, mapper will auto-layout on open
rm order-to-invoice.mapper.diagram.json

# Or regenerate with specific algorithm
mapper layout order-to-invoice.mapper.json --algorithm=dagre
```

## Grid and Snapping

Grid settings affect editor behavior:

```json
{
  "metadata": {
    "gridSnap": true,      // Snap nodes to grid
    "gridSize": 20         // Grid spacing in pixels
  }
}
```

**Common Grid Sizes:**
- `10px` - Fine control
- `20px` - Standard (recommended)
- `50px` - Coarse alignment

**Snapping Behavior:**
- When `gridSnap: true`, node positions round to nearest grid multiple
- Example: Moving node to (67, 134) snaps to (60, 140) with gridSize=20

## Theme Support

Theme setting affects visual appearance:

```json
{
  "metadata": {
    "theme": "light"    // or "dark"
  }
}
```

**Theme Behavior:**
- Overrides system/editor theme preference
- Affects node colors, edge colors, canvas background
- If omitted, uses system theme

## Versioning

GraphLayout uses semantic versioning:

```json
{
  "version": "1.0"
}
```

**Version Changes:**
- **Major (1.0 → 2.0)** - Breaking schema changes
- **Minor (1.0 → 1.1)** - New optional fields
- **Patch (1.0.0 → 1.0.1)** - Documentation/clarifications

**Backward Compatibility:**
- Older editors can ignore unknown fields
- Missing fields use sensible defaults
- Validation warns on version mismatch

## Validation Rules

1. **Node ID Existence:**
   - Every `nodes[].id` must exist in referenced MapSpec
   - Exception: `source-schema`, `target-schema` (implicit)

2. **Viewport Constraints:**
   - `zoom` must be between 0.1 and 2.0
   - `x`, `y` can be any number (no limits)

3. **Dimension Constraints:**
   - `width`, `height` must be positive numbers
   - Minimum recommended: 50px

4. **Style Constraints:**
   - Colors must be valid CSS (hex, rgb, named)
   - `opacity` must be 0.0 to 1.0
   - `borderWidth` must be non-negative

5. **File Reference:**
   - `mapperFile` path must be valid relative path
   - Must point to a `.mapper.json` file

## Example Validation Error

```json
// ❌ Invalid: references non-existent node
{
  "version": "1.0",
  "mapperFile": "./order-to-invoice.mapper.json",
  "nodes": [
    {
      "id": "func-nonexistent",    // Not in MapSpec!
      "position": { "x": 100, "y": 100 }
    }
  ]
}
```

**Error:**
```
GraphLayout Validation Error:
  Node ID "func-nonexistent" not found in MapSpec "order-to-invoice.mapper.json"
```

## Default Layout Generation

If no GraphLayout file exists, generate default positions:

```typescript
function generateDefaultLayout(mapSpec: MapSpec): GraphLayout {
  return {
    version: "1.0",
    mapperFile: `./${mapSpec.metadata.name}.mapper.json`,
    viewport: {
      x: 0,
      y: 0,
      zoom: 1.0
    },
    nodes: [
      {
        id: "source-schema",
        position: { x: 50, y: 50 }
      },
      {
        id: "target-schema",
        position: { x: 1200, y: 50 }
      },
      // Position functoids in vertical column between schemas
      ...mapSpec.nodes.map((node, index) => ({
        id: node.id,
        position: {
          x: 625,                    // Center X
          y: 100 + (index * 120)     // Vertical spacing
        }
      }))
    ],
    metadata: {
      layoutAlgorithm: "auto",
      gridSnap: false,
      theme: "light"
    }
  };
}
```

## Git Workflow

**Option 1: Commit Layout (Recommended for small teams)**
```bash
git add order-to-invoice.mapper.json
git add order-to-invoice.mapper.diagram.json
git commit -m "Add order-to-invoice mapper with layout"
```

**Option 2: Ignore Layout (Recommended for large teams)**
```bash
# .gitignore
*.mapper.diagram.json

git add order-to-invoice.mapper.json
git commit -m "Add order-to-invoice mapper (layout auto-generated)"
```

**Trade-offs:**
- **Commit layout:** Preserves exact visual arrangement, but causes merge conflicts
- **Ignore layout:** Clean merges, but loses custom positioning

**Recommendation:** Ignore layout files initially, commit once design stabilizes.

## Schema Node Special Handling

Schema nodes (`source-schema`, `target-schema`) have special considerations:

1. **User Resizable:**
   - Users can resize schema nodes to show more/fewer fields
   - Store dimensions explicitly

2. **Collapse State:**
   - Tree branches can be collapsed
   - Store `collapsedPaths` to preserve state

3. **Scroll Position:**
   - If schema node has internal scrolling, can store scroll offset
   - Optional: `ui.scrollTop`, `ui.scrollLeft`

```json
{
  "id": "source-schema",
  "position": { "x": 50, "y": 50 },
  "dimensions": { "width": 350, "height": 600 },
  "ui": {
    "collapsed": false,
    "collapsedPaths": ["$.items", "$.customer.addresses"],
    "scrollTop": 120
  }
}
```

## Functoid Node Layout

Functoids are simpler than schema nodes:

```json
{
  "id": "func-multiply-1",
  "position": { "x": 650, "y": 200 },
  "style": {
    "backgroundColor": "#fef3c7"    // Category color
  },
  "ui": {
    "minimized": false                // Show full vs icon-only
  }
}
```

**Minimized Functoids:**
- `minimized: false` - Show full node (label + icon + handles)
- `minimized: true` - Show icon only (compact view)

## Multi-View Support

One MapSpec can have multiple GraphLayout files:

```
order-to-invoice.mapper.json              ← Semantic mapping
order-to-invoice.mapper.diagram.json      ← Default view
order-to-invoice-compact.mapper.diagram.json  ← Compact view
order-to-invoice-debug.mapper.diagram.json    ← Debug view with all nodes
```

Each layout can have:
- Different zoom/pan settings
- Different node positions
- Different collapse states
- Different visibility settings

## Integration with React Flow

The GraphLayout maps directly to React Flow state:

```typescript
// Load GraphLayout
const layout = JSON.parse(fs.readFileSync('order-to-invoice.mapper.diagram.json'));

// Initialize React Flow
const [nodes, setNodes] = useNodesState(
  layout.nodes.map(nodeLayout => ({
    id: nodeLayout.id,
    type: 'functoid',    // Determine from MapSpec
    position: nodeLayout.position,
    data: { /* from MapSpec */ },
    style: nodeLayout.style,
    // Map dimensions to React Flow
    width: nodeLayout.dimensions?.width,
    height: nodeLayout.dimensions?.height
  }))
);

// Initialize viewport
const [viewport, setViewport] = useState(layout.viewport);
```

**Saving Layout:**
```typescript
function saveLayout(nodes: Node[], viewport: Viewport) {
  const layout: GraphLayout = {
    version: "1.0",
    mapperFile: "./order-to-invoice.mapper.json",
    viewport,
    nodes: nodes.map(node => ({
      id: node.id,
      position: node.position,
      dimensions: node.width && node.height ? {
        width: node.width,
        height: node.height
      } : undefined,
      style: node.style,
      ui: {
        collapsed: node.data.collapsed,
        collapsedPaths: node.data.collapsedPaths
      }
    }))
  };

  fs.writeFileSync(
    'order-to-invoice.mapper.diagram.json',
    JSON.stringify(layout, null, 2)
  );
}
```

## JSON Schema Definition

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "GraphLayout",
  "type": "object",
  "required": ["version", "mapperFile", "viewport", "nodes"],
  "properties": {
    "version": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+(\\.\\d+)?$"
    },
    "mapperFile": {
      "type": "string",
      "pattern": "\\.mapper\\.json$"
    },
    "viewport": {
      "type": "object",
      "required": ["x", "y", "zoom"],
      "properties": {
        "x": { "type": "number" },
        "y": { "type": "number" },
        "zoom": {
          "type": "number",
          "minimum": 0.1,
          "maximum": 2.0
        }
      }
    },
    "nodes": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "position"],
        "properties": {
          "id": { "type": "string" },
          "position": {
            "type": "object",
            "required": ["x", "y"],
            "properties": {
              "x": { "type": "number" },
              "y": { "type": "number" }
            }
          },
          "dimensions": {
            "type": "object",
            "properties": {
              "width": {
                "type": "number",
                "minimum": 50
              },
              "height": {
                "type": "number",
                "minimum": 50
              }
            }
          },
          "style": {
            "type": "object",
            "properties": {
              "backgroundColor": { "type": "string" },
              "borderColor": { "type": "string" },
              "borderWidth": {
                "type": "number",
                "minimum": 0
              },
              "opacity": {
                "type": "number",
                "minimum": 0,
                "maximum": 1
              },
              "zIndex": { "type": "number" }
            }
          },
          "ui": {
            "type": "object",
            "properties": {
              "collapsed": { "type": "boolean" },
              "collapsedPaths": {
                "type": "array",
                "items": { "type": "string" }
              },
              "selected": { "type": "boolean" },
              "highlighted": { "type": "boolean" },
              "hidden": { "type": "boolean" },
              "minimized": { "type": "boolean" },
              "scrollTop": { "type": "number" },
              "scrollLeft": { "type": "number" }
            }
          }
        }
      }
    },
    "metadata": {
      "type": "object",
      "properties": {
        "layoutAlgorithm": {
          "type": "string",
          "enum": ["manual", "dagre", "elk", "auto"]
        },
        "gridSnap": { "type": "boolean" },
        "gridSize": {
          "type": "number",
          "minimum": 1
        },
        "theme": {
          "type": "string",
          "enum": ["light", "dark"]
        },
        "miniMapVisible": { "type": "boolean" },
        "controlsVisible": { "type": "boolean" }
      }
    }
  }
}
```

## See Also

- [MapSpec Schema](./04-mapspec-schema.md) - Semantic mapping logic
- [File Conventions](./03-file-conventions.md) - File naming and structure
- [Canvas Architecture](./02-canvas-architecture.md) - UI components
- [React Flow Docs](https://reactflow.dev/) - React Flow API reference
