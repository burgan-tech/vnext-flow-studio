# Agent Guide - Amorphie Mapper

**Purpose:** This document provides context for AI agents (like Claude) working on the Amorphie Mapper project. It serves as a quick reference for understanding the project, making decisions, and navigating the codebase.

**Last Updated:** 2025-10-22

---

## 🎯 Project Overview

> **⚠️ INTEGRATION PROJECT:** The mapper is being **added to the existing Amorphie Flow Studio** VS Code extension, NOT created as a standalone project!

**What:** Visual data mapping tool for transforming JSON data between schemas using a node-based canvas (like BizTalk Mapper)

**Why:** Enable non-developers to create complex data transformations visually, reducing development time and errors

**Parent Project:** Amorphie Flow Studio (Workflow Visual Editor)
- **Repository:** `/Users/U05366/wf/` (amorphie-flow-studio)
- **Existing Features:** Visual workflow editor with React Flow
- **New Feature:** Data mapper (this spec)

**Tech Stack:**
- **Frontend:** React 18 + Vite + @xyflow/react (React Flow v12) - ✅ Already in project
- **Backend/Core:** Node.js + TypeScript - ✅ Already in project
- **Code Generation:** JSONata (transformation language) - 🆕 New dependency
- **Validation:** AJV (JSON Schema) - ✅ Already in project
- **Editor:** VS Code Extension (webview-based) - ✅ Already exists
- **Monorepo:** npm workspaces - ✅ Already configured

**Status:** 📝 Specification Complete → 🚧 Implementation Phase Starting

**Integration Points:**
- Reuse existing React Flow setup from workflow editor
- Share common types and utilities from `packages/core`
- Add new custom editor alongside existing flow editor
- Coexist with `*.flow.json` files (workflows) as `*.mapper.json` files

---

## 📁 Project Structure

**IMPORTANT:** The mapper is being added to the **existing Amorphie Flow Studio** project!

```
amorphie-flow-studio/                      # Existing project root
├── packages/
│   ├── core/                              # ✅ EXISTING - Add mapper types here
│   │   ├── src/
│   │   │   ├── types.ts                   # Workflow types (existing)
│   │   │   ├── mapper/                    # 🆕 NEW - Mapper-specific code
│   │   │   │   ├── types.ts               # MapSpec, GraphLayout types
│   │   │   │   ├── schema.ts              # Schema validation (AJV)
│   │   │   │   ├── adapter.ts             # Schema flattening, tree building
│   │   │   │   ├── registry.ts            # Functoid definitions
│   │   │   │   ├── codegen/               # Code generation pipeline
│   │   │   │   │   ├── graph.ts           # Dependency graph
│   │   │   │   │   ├── lowering.ts        # AST transformations
│   │   │   │   │   ├── generators.ts      # Expression generators
│   │   │   │   │   └── index.ts           # Main codegen entry
│   │   │   │   ├── validation/            # Validation rules
│   │   │   │   └── testing/               # Test runner
│   │   │   ├── schema.ts                  # Workflow schema (existing)
│   │   │   ├── linter.ts                  # Workflow linter (existing)
│   │   │   └── ...                        # Other existing files
│   │   └── package.json
│   │
│   ├── webview/                           # ✅ EXISTING - Add mapper canvas
│   │   ├── src/
│   │   │   ├── App.jsx                    # Flow editor (existing)
│   │   │   ├── mapper/                    # 🆕 NEW - Mapper canvas
│   │   │   │   ├── MapperCanvas.jsx       # Mapper canvas component
│   │   │   │   ├── components/
│   │   │   │   │   ├── SchemaNodeTreeView.jsx
│   │   │   │   │   ├── SchemaTreeNode.jsx
│   │   │   │   │   ├── SchemaNodeTable.jsx
│   │   │   │   │   ├── FunctoidNode.jsx
│   │   │   │   │   ├── LabeledHandle.jsx
│   │   │   │   │   └── FunctoidPalette.jsx
│   │   │   │   └── utils/
│   │   │   │       ├── schemas.js         # Sample schemas
│   │   │   │       └── schemas-tree.js    # Tree building
│   │   │   ├── components/                # Workflow components (existing)
│   │   │   └── ...                        # Other existing files
│   │   ├── vite.config.js
│   │   └── package.json
│   │
│   └── extension/                         # ✅ EXISTING - Add mapper editor
│       ├── src/
│       │   ├── extension.ts               # Extension entry (existing)
│       │   ├── mapper/                    # 🆕 NEW - Mapper integration
│       │   │   ├── MapperEditorProvider.ts
│       │   │   ├── commands.ts
│       │   │   ├── diagnostics.ts
│       │   │   └── quickfix.ts
│       │   ├── FlowEditorProvider.ts      # Flow editor (existing)
│       │   ├── commands.ts                # Flow commands (existing)
│       │   └── ...                        # Other existing files
│       └── package.json
│
├── docs/mapper/                           # 📚 Mapper specifications (15 files)
├── prototype/mapper-v2/                   # 🧪 Working React Flow prototype
├── flows/                                 # ✅ EXISTING - Workflow examples
├── mappers/                               # 🆕 NEW - Mapper examples
├── schemas/                               # ✅ EXISTING - JSON schemas
└── package.json                           # Workspace root (existing)
```

**Integration Strategy:**
- Mapper functionality lives in **new subdirectories** within existing packages
- Reuse existing infrastructure (build, lint, test)
- Mapper files (*.mapper.json) coexist with workflow files (*.flow.json)
- Share common utilities where appropriate

---

## 🏗️ Architecture - Key Decisions

### 1. Schema Nodes ARE React Flow Nodes

**Decision:** Schema nodes (source/target) are implemented as React Flow custom nodes, not separate UI elements.

**Why:**
- Leverages React Flow's built-in connection system
- Consistent interaction model with functoids
- No custom connection logic needed

**Implementation:** `SchemaNodeTreeView` component renders as React Flow node with handles

### 2. Tree Structure Over Flat List

**Decision:** Schema fields displayed as hierarchical tree with expand/collapse, not flat list.

**Why:**
- Preserves semantic context (e.g., `customer.address.city` vs just `city`)
- Better UX for nested objects and arrays
- Handles large schemas better with collapse

**Implementation:** `buildSchemaTree()` converts JSON Schema → tree, `SchemaTreeNode` renders recursively

### 3. Labeled Handles Pattern

**Decision:** Use labeled handles (label integrated with connection point) matching React Flow UI patterns.

**Why:**
- Professional appearance
- Clear field identification
- Follows React Flow UI design system

**Implementation:** Custom `LabeledHandle` component (API-compatible with React Flow UI)

### 4. Handle IDs = JSONPath

**Decision:** Handle IDs use JSONPath notation (e.g., `$.items[].quantity`)

**Why:**
- Unique per field
- Semantic (describes location)
- Maps directly to JSONata expressions

**Implementation:** Handles created with `id={node.path}` where path is JSONPath

### 5. MapSpec + GraphLayout Separation

**Decision:** Separate semantic mapping (MapSpec) from visual layout (GraphLayout)

**Why:**
- MapSpec is source of truth (version controlled)
- GraphLayout is optional/regenerable (can be gitignored)
- Clean separation of concerns

**Files:**
- `order-to-invoice.mapper.json` (MapSpec - required)
- `order-to-invoice.mapper.diagram.json` (GraphLayout - optional)

### 6. JSONata as Target Language

**Decision:** Generate JSONata code (not JavaScript/TypeScript)

**Why:**
- Declarative, safe (no eval)
- Designed for JSON transformations
- Better for non-developers to read

**Alternative Considered:** JavaScript functions - rejected due to security and complexity

---

## 📚 Documentation Index

All specs in `/docs/mapper/`:

### Core Technical
1. **03-file-conventions.md** - File types, naming, git workflow
2. **04-mapspec-schema.md** - MapSpec data model (nodes, edges, tests)
3. **05-graphlayout-schema.md** - GraphLayout data model (positions, styles)
4. **06-schema-flattening.md** - Schema processing, tree building, conditionals
5. **09-functoid-visuals.md** - Visual design (9 categories, colors, icons)
6. **10-jsonata-codegen.md** - Code generation pipeline
7. **11-lowering-rules.md** - AST transformations (6 phases)
8. **12-validation.md** - Validation rules (5 levels, error codes)
9. **13-test-runner.md** - Test execution, coverage

### Integration & Implementation
10. **16-integration.md** - VS Code extension + Flow Studio
11. **17-implementation-plan.md** - 8-week roadmap
12. **18-risk-assessment.md** - 19 risks with mitigation
13. **19-roadmap.md** - Post-MVP features (v1.1 - v2.0+)

### Architecture (Previous)
- **02-canvas-architecture.md** - Canvas design, node types

---

## 🔑 Key Concepts

### MapSpec

The semantic data model for a mapper:

```typescript
interface MapSpec {
  version: string;
  metadata: { name, description, source, target };
  schemas: { source: string, target: string };  // Paths to JSON Schema files
  nodes: MapSpecNode[];      // Functoid nodes (NOT schema nodes)
  edges: Edge[];             // Connections
  tests?: TestCase[];        // Test cases
}
```

**Key Point:** Schema nodes (`source-schema`, `target-schema`) are **implicit** in MapSpec, **explicit** in GraphLayout.

### Functoids

Transformation nodes with categories:

| Category | Color | Examples |
|----------|-------|----------|
| Math | Amber | Add, Multiply, Divide |
| String | Blue | Concat, Uppercase, Substring |
| Logical | Purple | And, Or, Not, Equal |
| Conditional | Indigo | If/Then/Else |
| Collection | Green | Map, Filter, Sort |
| Aggregate | Teal | Sum, Average, Min, Max |
| Conversion | Orange | ToString, ToNumber |
| Date/Time | Pink | Now, Format, Parse |
| Custom | Gray | User-defined functions |

### Code Generation Pipeline

```
MapSpec
  → Validation (5 levels)
  → Lowering (6 phases: type inference, constant extraction, desugaring,
              simplification, optimization, validation)
  → Dependency Graph
  → Topological Sort
  → Expression Generation (per node)
  → Target Composition
  → JSONata Code
```

### Terminal

A "terminal" is a connection point (handle) on a schema node:

```typescript
interface Terminal {
  id: string;        // JSONPath (e.g., "$.items[].quantity")
  name: string;      // Field name (e.g., "quantity")
  type: string;      // JSON Schema type (e.g., "number")
  path: string;      // Full path (same as id)
  optional: boolean; // Is field optional?
}
```

---

## 🛠️ Development Workflow

### Running the Prototype

```bash
cd /Users/U05366/wf/prototype/mapper-v2
npm install
npm run dev
# Opens at http://localhost:5173
```

**What you'll see:**
- Source schema (left) and target schema (right) as tree nodes
- Add Multiply and Add Concat buttons in toolbar
- Click to add functoids, drag to connect
- Toggle `SCHEMA_VIEW_MODE` in `App.jsx` ('tree' or 'table')

### Key Prototype Files

- `App.jsx` - Main canvas, view mode toggle
- `schemas.js` - Sample order/invoice schemas
- `schemas-tree.js` - `buildSchemaTree()` function
- `components/SchemaNodeTreeView.jsx` - Tree container
- `components/SchemaTreeNode.jsx` - Recursive tree node
- `components/LabeledHandle.jsx` - Handle with label
- `components/FunctoidNode.jsx` - Functoid node

### Creating New Features

1. **Read the spec** - Find relevant doc in `/docs/mapper/`
2. **Check prototype** - See if similar feature exists in `/prototype/mapper-v2/`
3. **Start with types** - Define TypeScript types in `packages/core/src/types.ts`
4. **Write tests** - TDD approach, aim for 80%+ coverage
5. **Implement** - Follow patterns from prototype
6. **Document** - Update relevant spec doc if behavior changes

---

## 🎨 Design Patterns

### Recursive Tree Rendering

```jsx
// Pattern: Recursive component with depth tracking
function SchemaTreeNode({ node, depth, handleType, handlePosition }) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div style={{ paddingLeft: `${depth * 16}px` }}>
      {/* Node content */}

      {node.children && isExpanded && (
        node.children.map(child => (
          <SchemaTreeNode
            key={child.id}
            node={child}
            depth={depth + 1}
            handleType={handleType}
            handlePosition={handlePosition}
          />
        ))
      )}
    </div>
  );
}
```

### Labeled Handle Integration

```jsx
// Pattern: Handle with label, matches React Flow UI API
<LabeledHandle
  id={node.id}              // JSONPath (e.g., "$.orderNumber")
  type={handleType}         // "source" or "target"
  position={handlePosition} // Position.Left or Position.Right
  title={`${node.name}: ${node.type}`}  // "orderNumber: string"
/>
```

### Dependency Graph & Topological Sort

```typescript
// Pattern: Build graph, sort, detect cycles
function buildDependencyGraph(mapSpec: MapSpec): DependencyGraph {
  // Create nodes
  // Build edges from mapSpec.edges
  // Track dependencies
}

function topologicalSort(graph: DependencyGraph): GraphNode[] {
  // Visit nodes depth-first
  // Detect cycles (throw error if found)
  // Return sorted list
}
```

---

## 🚨 Common Pitfalls

### 1. Schema Nodes vs Functoid Nodes

**❌ Wrong:** Adding schema nodes to `mapSpec.nodes[]`
**✅ Right:** Schema nodes are implicit, only functoids in `nodes[]`

### 2. Handle IDs

**❌ Wrong:** Using auto-generated IDs like `handle-1`, `handle-2`
**✅ Right:** Use JSONPath: `$.orderNumber`, `$.items[].quantity`

### 3. Array Handling

**❌ Wrong:** Creating separate nodes for each array item
**✅ Right:** Use `[]` notation in path: `$.items[]` (implicit iteration)

### 4. Type Inference

**❌ Wrong:** Assuming all numbers are integers
**✅ Right:** Preserve JSON Schema type info (`integer` vs `number`)

### 5. Validation Timing

**❌ Wrong:** Validating only on save
**✅ Right:** Real-time validation as user edits (debounced)

---

## 📊 Key Metrics

### Performance Targets

- Canvas: 60 FPS with 100+ nodes
- Code generation: < 1 second for typical mapper (50 nodes)
- Test execution: < 5 seconds for 100 tests
- Schema tree: Handle 1000+ fields smoothly

### Quality Targets

- Test coverage: 80%+ for core package
- Validation: Catch 95%+ of errors before runtime
- Documentation: Every public API documented
- TypeScript: Strict mode, no `any` types

---

## 🐛 Debugging Tips

### Canvas Not Rendering

1. Check React Flow version (must be v12+)
2. Verify node types registered: `nodeTypes={{ schema: SchemaNode, functoid: FunctoidNode }}`
3. Ensure nodes have `id`, `type`, `position`, `data`

### Handles Not Connecting

1. Verify handle `type` matches (`source` connects to `target`)
2. Check `position` is set (`Position.Left` or `Position.Right`)
3. Ensure handle IDs are unique within node

### Tree Not Expanding

1. Check `buildSchemaTree()` generates `children` array
2. Verify `isExpanded` state is working
3. Ensure recursive rendering has proper key props

### Generated Code Fails

1. Check topological sort (may have cycle)
2. Verify all dependencies exist
3. Test JSONata syntax in https://try.jsonata.org
4. Check for type mismatches

---

## 🔄 Updating This Guide

**When to update:**
- Major architectural decisions made
- New patterns established
- Common issues discovered
- Project structure changes

**Who updates:**
- Any team member can update
- AI agents should suggest updates when they notice gaps

**How to update:**
- Edit this file directly
- Keep "Last Updated" date current
- Use clear, concise language
- Include code examples for new patterns

---

## 📝 Quick Reference Commands

```bash
# Prototype
cd /Users/U05366/wf/prototype/mapper-v2
npm run dev

# Core package (when created)
cd packages/core
npm test
npm run build

# Webview package (when created)
cd packages/webview
npm run dev      # Development server
npm run build    # Production build

# Extension package (when created)
cd packages/extension
npm run watch    # Watch mode
vsce package     # Package extension

# Workspace root
npm install              # Install all packages
npm run build           # Build all packages
npm run test            # Test all packages
npm run lint            # Lint all packages
```

---

## 🤝 Collaborating with Multiple Agents

### Agent Roles

**Possible Division:**
- **Agent A (Core):** Focus on `packages/core` (types, validation, codegen)
- **Agent B (UI):** Focus on `packages/webview` (React components, canvas)
- **Agent C (Extension):** Focus on `packages/extension` (VS Code integration)

### Communication Protocol

**When starting work:**
1. Read this guide first
2. Check relevant spec docs in `/docs/mapper/`
3. Review prototype if working on UI
4. Check for existing similar code

**When completing work:**
1. Update this guide if new patterns added
2. Run tests and linting
3. Document any decisions made
4. Note any blockers or dependencies

### Shared Context

**Always check:**
- `/docs/mapper/` for specs
- `/prototype/mapper-v2/` for working examples
- This guide for patterns and decisions

**Never assume:**
- Don't guess at data structures - check `types.ts`
- Don't invent new patterns - follow existing ones
- Don't change architecture without discussion

---

## 🎯 Current Status & Next Steps

### Completed ✅

- ✅ Complete specification (15 documents + agent guide)
- ✅ Working V2 prototype (tree hierarchy + labeled handles)
- ✅ Architecture decisions documented
- ✅ File conventions defined
- ✅ Code generation pipeline designed
- ✅ Schema inference from JSON examples specified

### Ready to Implement 🚀

**Week 1: Foundation** (Ready to start NOW - INTEGRATION APPROACH)

Since we're integrating into existing Amorphie Flow Studio:

1. **Core Package Integration** - Add mapper subdirectory
   ```bash
   cd /Users/U05366/wf/packages/core/src
   mkdir -p mapper/codegen mapper/validation mapper/testing
   ```

2. **Create Mapper Types** - Start with TypeScript definitions
   ```typescript
   // packages/core/src/mapper/types.ts
   export interface MapSpec { ... }
   export interface GraphLayout { ... }
   export interface Terminal { ... }
   ```

3. **Copy from Prototype** - Port working code
   - Copy `schemas-tree.js` → `mapper/adapter.ts`
   - Copy functoid definitions → `mapper/registry.ts`

4. **Webview Integration** - Add mapper canvas
   ```bash
   cd /Users/U05366/wf/packages/webview/src
   mkdir -p mapper/components mapper/utils
   ```

5. **Extension Registration** - Register mapper editor
   ```typescript
   // packages/extension/src/extension.ts
   import { MapperEditorProvider } from './mapper/MapperEditorProvider';

   // Register custom editor for *.mapper.json
   context.subscriptions.push(
     vscode.window.registerCustomEditorProvider(
       'amorphie.mapperEditor',
       new MapperEditorProvider(context)
     )
   );
   ```

**Key Difference from Standalone:**
- ✅ Reuse existing build/test infrastructure
- ✅ Share common utilities (AJV, React Flow setup)
- ✅ Follow existing code patterns
- ✅ Add to existing extension (not new extension)

### Questions? Need Clarification?

**Check these first:**
1. This guide for patterns
2. Relevant spec doc for detailed design
3. Prototype for working code

**If still unclear:**
- Ask specific questions with context
- Reference doc section numbers
- Share what you've already tried

---

## 🎓 Learning Resources

### React Flow

- Docs: https://reactflow.dev/
- Examples: https://reactflow.dev/examples
- Custom Nodes: https://reactflow.dev/examples/nodes/custom-node

### JSONata

- Docs: https://docs.jsonata.org/
- Try it: https://try.jsonata.org
- Exerciser: https://jsonata.org/

### VS Code Extensions

- Guide: https://code.visualstudio.com/api
- Custom Editors: https://code.visualstudio.com/api/extension-guides/custom-editors
- Webview: https://code.visualstudio.com/api/extension-guides/webview

### JSON Schema

- Spec: https://json-schema.org/
- Understanding: https://json-schema.org/understanding-json-schema/

---

## 💡 Pro Tips

1. **Start with the prototype** - Copy working code, then refactor
2. **Types first** - Define types before implementation
3. **Test early** - Write tests as you code, not after
4. **Small commits** - Commit working increments frequently
5. **Follow specs** - Don't deviate without good reason
6. **Ask early** - If unclear, ask before implementing
7. **Document decisions** - Update this guide when making choices
8. **Use examples** - All specs have example code

---

## 📞 Support

**For AI Agents:**
- You have all context needed in this guide + specs
- If missing info, suggest update to this guide
- Make informed decisions based on documented patterns

**For Humans:**
- This guide should help onboard new team members
- Specs are comprehensive and example-rich
- Prototype demonstrates key concepts

---

**Remember:** This is a visual data mapping tool. Users should be able to:
1. See their schemas as trees
2. Drag and connect fields
3. Add transformation nodes (functoids)
4. Generate working code
5. Test their mappings
6. Deploy to production

Keep the user experience front and center! 🎨✨
