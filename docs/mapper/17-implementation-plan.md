# Implementation Plan

**Status:** Draft
**Last Updated:** 2025-10-22

## Overview

This document outlines an **8-week implementation plan** for building the Amorphie Mapper MVP. The plan is designed for a small team (2-3 developers) and focuses on delivering core functionality first.

## Team Structure

**Recommended Team:**
- 1 Backend Developer (Node.js, TypeScript, JSONata)
- 1 Frontend Developer (React, React Flow, VS Code Extensions)
- 0.5 QA/DevOps (Testing, CI/CD, Documentation)

**Alternative (Smaller Team):**
- 1 Full-Stack Developer
- 0.5 QA/Documentation

## Timeline Overview

| Week | Focus | Deliverables |
|------|-------|-------------|
| 1 | Foundation & Architecture | Project setup, schema definitions |
| 2 | Core Canvas | Basic React Flow canvas with schema nodes |
| 3 | Functoid System | Functoid nodes and connection logic |
| 4 | Code Generation | JSONata code generation pipeline |
| 5 | Validation & Testing | Validation rules and test runner |
| 6 | VS Code Extension | Custom editor and integration |
| 7 | Polish & UX | UI refinements, error handling |
| 8 | Documentation & Release | Final testing, docs, packaging |

## Week 1: Foundation & Architecture

**Goals:**
- Set up project structure
- Define core data models
- Establish development workflow

### Tasks

#### 1.1 Project Setup (Day 1)

```bash
# Create monorepo structure
mkdir amorphie-mapper
cd amorphie-mapper

# Initialize workspace
npm init -y
npm install -D typescript @types/node jest ts-jest

# Create packages
mkdir -p packages/{core,webview,extension}

# Setup TypeScript configs
# packages/core/tsconfig.json
# packages/webview/tsconfig.json
# packages/extension/tsconfig.json
```

**Deliverables:**
- Monorepo structure with npm workspaces
- TypeScript configuration
- ESLint and Prettier setup
- Git repository with initial commit

#### 1.2 Core Package - Schema Definitions (Days 2-3)

Implement data models from specifications:

```typescript
// packages/core/src/types.ts
export interface MapSpec { /* ... */ }
export interface GraphLayout { /* ... */ }
export interface JSONSchema { /* ... */ }

// packages/core/src/schema.ts
import Ajv from 'ajv';

export function validateMapSpec(mapSpec: MapSpec): ValidationResult {
  // JSON Schema validation
}

// packages/core/src/adapter.ts
export function flattenSchema(schema: JSONSchema): Terminal[] {
  // Schema flattening
}

export function buildSchemaTree(schema: JSONSchema): TreeNode {
  // Tree building
}
```

**Deliverables:**
- TypeScript type definitions
- JSON Schema validation (AJV)
- Schema flattening utilities
- Tree building functions
- Unit tests (80%+ coverage)

#### 1.3 Development Workflow (Day 4)

Setup CI/CD pipeline:

```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run lint
      - run: npm test
      - run: npm run build
```

**Deliverables:**
- GitHub Actions CI pipeline
- Pre-commit hooks (Husky)
- npm scripts for build/test/lint
- README with setup instructions

#### 1.4 Documentation (Day 5)

**Deliverables:**
- Architecture diagrams
- API documentation (TypeDoc)
- Contributing guide
- Code review checklist

**Week 1 Milestone:** ✅ Foundation complete, ready for canvas development

---

## Week 2: Core Canvas

**Goals:**
- Implement basic React Flow canvas
- Schema nodes with tree hierarchy
- Handle connections

### Tasks

#### 2.1 Webview Package Setup (Day 1)

```bash
cd packages/webview
npm install react react-dom @xyflow/react
npm install -D vite @vitejs/plugin-react
```

Setup Vite build:

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../../dist/webview',
    rollupOptions: {
      output: {
        entryFileNames: 'webview.js',
        assetFileNames: 'webview.css'
      }
    }
  }
});
```

**Deliverables:**
- Vite build configuration
- React app structure
- Hot reload development server

#### 2.2 Schema Node - Tree View (Days 2-3)

Implement tree hierarchy schema nodes:

```typescript
// packages/webview/src/components/SchemaNodeTreeView.tsx
export function SchemaNodeTreeView({ data }) {
  return (
    <div className="schema-node">
      <SchemaTreeNode
        node={data.tree}
        depth={0}
        handleType={data.side === 'source' ? 'source' : 'target'}
        handlePosition={data.side === 'source' ? Position.Right : Position.Left}
      />
    </div>
  );
}

// packages/webview/src/components/SchemaTreeNode.tsx
export function SchemaTreeNode({ node, depth, handleType, handlePosition }) {
  // Recursive tree rendering with labeled handles
}
```

**Deliverables:**
- SchemaNodeTreeView component
- SchemaTreeNode component (recursive)
- LabeledHandle component
- Tree expand/collapse functionality
- CSS styling

#### 2.3 Canvas Integration (Days 4-5)

Integrate schema nodes with React Flow:

```typescript
// packages/webview/src/App.tsx
import { ReactFlow, useNodesState, useEdgesState } from '@xyflow/react';

function MapperCanvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      fitView
    >
      <Background />
      <Controls />
      <MiniMap />
    </ReactFlow>
  );
}
```

**Deliverables:**
- React Flow integration
- Canvas controls (zoom, pan)
- MiniMap
- Background grid
- Connection validation

**Week 2 Milestone:** ✅ Canvas with schema nodes rendering correctly

---

## Week 3: Functoid System

**Goals:**
- Implement functoid nodes for all categories
- Functoid palette/toolbar
- Drag-and-drop functoids

### Tasks

#### 3.1 Functoid Node Component (Days 1-2)

Implement base functoid component:

```typescript
// packages/webview/src/components/FunctoidNode.tsx
export function FunctoidNode({ data, selected }) {
  const category = getCategoryFromKind(data.kind);

  return (
    <div className={`functoid functoid-${category} ${selected ? 'selected' : ''}`}>
      <div className="header">
        <span className="icon">{data.icon}</span>
        <span className="label">{data.label}</span>
      </div>

      <div className="inputs">
        {data.inputs.map((input, i) => (
          <LabeledHandle
            key={i}
            id={`input-${i + 1}`}
            type="target"
            position={Position.Left}
            title={input}
          />
        ))}
      </div>

      <div className="outputs">
        <LabeledHandle
          id="output"
          type="source"
          position={Position.Right}
          title="Output"
        />
      </div>
    </div>
  );
}
```

**Deliverables:**
- FunctoidNode component
- Category styling (9 categories)
- Input/output handles
- Visual states (hover, selected, error)

#### 3.2 Functoid Registry (Day 3)

Define all functoid types:

```typescript
// packages/core/src/registry.ts
export const functoidRegistry: Record<NodeKind, FunctoidDefinition> = {
  'Binary.Add': {
    label: 'Add',
    icon: '+',
    category: 'math',
    inputs: ['Left', 'Right'],
    output: 'Sum'
  },
  'Binary.Multiply': {
    label: 'Multiply',
    icon: '×',
    category: 'math',
    inputs: ['Left', 'Right'],
    output: 'Product'
  },
  // ... all other functoids
};
```

**Deliverables:**
- Complete functoid registry
- Functoid metadata (labels, icons, categories)
- Unit tests for registry

#### 3.3 Functoid Palette (Days 4-5)

Implement drag-and-drop palette:

```typescript
// packages/webview/src/components/FunctoidPalette.tsx
export function FunctoidPalette() {
  const categories = groupByCategory(functoidRegistry);

  return (
    <div className="functoid-palette">
      {Object.entries(categories).map(([category, functoids]) => (
        <FunctoidCategory
          key={category}
          category={category}
          functoids={functoids}
        />
      ))}
    </div>
  );
}
```

**Deliverables:**
- Functoid palette component
- Category tabs/accordion
- Search/filter functionality
- Drag-and-drop to canvas

**Week 3 Milestone:** ✅ Full functoid system with palette

---

## Week 4: Code Generation

**Goals:**
- Implement JSONata code generation
- Lowering and optimization passes
- Test with sample mappers

### Tasks

#### 4.1 Dependency Graph (Day 1)

Build dependency graph from MapSpec:

```typescript
// packages/core/src/codegen/graph.ts
export function buildDependencyGraph(mapSpec: MapSpec): DependencyGraph {
  // Build graph from edges
}

export function topologicalSort(graph: DependencyGraph): GraphNode[] {
  // Topological sort with cycle detection
}
```

**Deliverables:**
- Dependency graph builder
- Topological sort algorithm
- Cycle detection

#### 4.2 Expression Generation (Days 2-3)

Generate JSONata expressions for each node type:

```typescript
// packages/core/src/codegen/generators.ts
export function generateBinaryExpression(
  node: MapSpecNode,
  inputs: [string, string]
): string {
  // Binary operations
}

export function generateStringExpression(
  node: MapSpecNode,
  inputs: string[]
): string {
  // String operations
}

// ... generators for all node types
```

**Deliverables:**
- Expression generators for all functoid types
- Array handling logic
- Type coercion
- Unit tests

#### 4.3 Lowering & Optimization (Day 4)

Implement optimization passes:

```typescript
// packages/core/src/codegen/lowering.ts
export function lowerMapSpec(mapSpec: MapSpec): LoweredMapSpec {
  let ir = initializeIR(mapSpec);

  ir = inferTypes(ir);
  ir = extractConstants(ir);
  ir = desugar(ir);
  ir = simplify(ir);
  ir = optimize(ir);

  return ir;
}
```

**Deliverables:**
- Type inference
- Constant folding
- Dead code elimination
- Common subexpression elimination

#### 4.4 Integration & Testing (Day 5)

Test code generation end-to-end:

```typescript
// packages/core/src/codegen/index.ts
export function generateJSONata(mapSpec: MapSpec): string {
  const lowered = lowerMapSpec(mapSpec);
  const graph = buildDependencyGraph(lowered);
  const sorted = topologicalSort(graph);
  const expressions = generateExpressions(sorted);
  const final = composeTargetExpression(lowered, expressions);

  return formatJSONata(final);
}
```

**Deliverables:**
- Complete code generation pipeline
- Integration tests with real mappers
- Example mappers

**Week 4 Milestone:** ✅ Working code generation

---

## Week 5: Validation & Testing

**Goals:**
- Implement validation rules
- Test runner
- Error reporting

### Tasks

#### 5.1 Validation Engine (Days 1-2)

Implement all validation levels:

```typescript
// packages/core/src/validation/index.ts
export async function validateMapSpec(mapSpec: MapSpec): Promise<ValidationResult> {
  const results: ValidationResult[] = [];

  results.push(await validateSchema(mapSpec));
  results.push(await validateStructure(mapSpec));
  results.push(await validateTypes(mapSpec));
  results.push(await validateCompleteness(mapSpec));
  results.push(await validateSemantics(mapSpec));

  return mergeResults(results);
}
```

**Deliverables:**
- 5 validation levels
- Error codes and messages
- Quick fix suggestions

#### 5.2 Test Runner (Days 3-4)

Implement test execution:

```typescript
// packages/core/src/testing/runner.ts
export async function runTests(
  mapSpec: MapSpec,
  generatedCode: string
): Promise<TestResult[]> {
  const expression = jsonata(generatedCode);
  const results: TestResult[] = [];

  for (const test of mapSpec.tests || []) {
    const result = await runSingleTest(expression, test);
    results.push(result);
  }

  return results;
}
```

**Deliverables:**
- Test execution engine
- Deep equality comparison
- Diff generation
- Coverage tracking

#### 5.3 Error Reporting (Day 5)

Implement error UI:

```typescript
// packages/webview/src/components/ErrorPanel.tsx
export function ErrorPanel({ errors }) {
  return (
    <div className="error-panel">
      {errors.map(error => (
        <ErrorItem key={error.id} error={error} />
      ))}
    </div>
  );
}
```

**Deliverables:**
- Error panel component
- Error highlighting on canvas
- Quick fix buttons

**Week 5 Milestone:** ✅ Validation and testing complete

---

## Week 6: VS Code Extension

**Goals:**
- Custom editor for `.mapper.json`
- Commands and keybindings
- Diagnostics integration

### Tasks

#### 6.1 Extension Setup (Day 1)

Setup VS Code extension:

```bash
cd packages/extension
npm install vscode
npm install -D @types/vscode @vscode/test-electron
```

Configure extension:

```json
// package.json
{
  "name": "amorphie-mapper",
  "displayName": "Amorphie Mapper",
  "engines": { "vscode": "^1.80.0" },
  "activationEvents": ["onCustomEditor:amorphie.mapperEditor"],
  "main": "./dist/extension.js"
}
```

**Deliverables:**
- Extension package structure
- Manifest (package.json)
- Build configuration

#### 6.2 Custom Editor (Days 2-3)

Implement custom editor:

```typescript
// packages/extension/src/MapperEditorProvider.ts
export class MapperEditorProvider implements vscode.CustomTextEditorProvider {
  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel
  ): Promise<void> {
    // Setup webview
    // Handle messages
    // Update on document changes
  }
}
```

**Deliverables:**
- Custom editor provider
- Webview integration
- Document synchronization

#### 6.3 Commands & Diagnostics (Days 4-5)

Implement commands and diagnostics:

```typescript
// packages/extension/src/commands.ts
export function registerCommands(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('amorphie.mapper.generateCode', generateCode),
    vscode.commands.registerCommand('amorphie.mapper.runTests', runTests),
    vscode.commands.registerCommand('amorphie.mapper.validate', validate)
  );
}

// packages/extension/src/diagnostics.ts
export class DiagnosticsProvider {
  public async updateDiagnostics(document: vscode.TextDocument) {
    // Run validation
    // Publish diagnostics
  }
}
```

**Deliverables:**
- generateCode command
- runTests command
- validate command
- Diagnostics integration
- Keybindings
- Context menus

**Week 6 Milestone:** ✅ VS Code extension working

---

## Week 7: Polish & UX

**Goals:**
- UI refinements
- Error handling improvements
- Performance optimization

### Tasks

#### 7.1 UI Polish (Days 1-2)

Refine user interface:
- Smooth animations
- Improved color scheme
- Better spacing and alignment
- Loading states
- Empty states

**Deliverables:**
- Polished UI components
- Animation library
- Responsive design

#### 7.2 Error Handling (Day 3)

Improve error handling:
- Better error messages
- Error recovery strategies
- Graceful degradation
- User-friendly dialogs

**Deliverables:**
- Comprehensive error handling
- Error boundaries (React)
- User notifications

#### 7.3 Performance (Days 4-5)

Optimize performance:
- Code generation caching
- Virtual scrolling for large schemas
- Debounced validation
- Bundle size optimization

**Deliverables:**
- Performance benchmarks
- Optimization report
- Lazy loading

**Week 7 Milestone:** ✅ Production-ready UX

---

## Week 8: Documentation & Release

**Goals:**
- Comprehensive documentation
- End-to-end testing
- Package and release

### Tasks

#### 8.1 Documentation (Days 1-2)

Complete documentation:
- User guide
- Tutorial videos
- API reference
- Examples

**Deliverables:**
- User documentation
- Developer documentation
- Video tutorials
- Example mappers

#### 8.2 Testing (Day 3)

Final testing round:
- Manual testing
- Integration tests
- Performance tests
- Accessibility testing

**Deliverables:**
- Test report
- Bug fixes
- Performance report

#### 8.3 Packaging (Day 4)

Package extension:

```bash
# Build all packages
npm run build

# Package extension
cd packages/extension
vsce package

# Output: amorphie-mapper-1.0.0.vsix
```

**Deliverables:**
- Extension package (.vsix)
- Release notes
- Changelog

#### 8.4 Release (Day 5)

Release to production:
- Internal deployment
- VS Code Marketplace (optional)
- Announcement

**Deliverables:**
- Released extension
- Announcement post
- Support channels setup

**Week 8 Milestone:** ✅ MVP RELEASED! 🎉

---

## Risk Mitigation

### Technical Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| JSONata complexity | High | Start with simple transformations, iterate |
| React Flow performance | Medium | Use virtual rendering, optimize nodes |
| Schema flattening edge cases | Medium | Comprehensive test suite, handle conditionals |
| VS Code API changes | Low | Pin VS Code engine version |

### Schedule Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Underestimated complexity | High | Buffer time in each week, prioritize ruthlessly |
| Team availability | Medium | Document everything, pair programming |
| Scope creep | Medium | Strict MVP scope, defer non-essential features |

## Success Metrics

**MVP Success Criteria:**
- ✅ Can create mappers visually
- ✅ Generated code runs correctly
- ✅ Validation catches errors
- ✅ Tests pass reliably
- ✅ VS Code extension installs and works
- ✅ Documentation is complete

**Performance Targets:**
- Canvas renders 1000+ nodes smoothly
- Code generation < 1 second for typical mapper
- Test execution < 5 seconds for 100 tests

## Post-MVP Priorities

After MVP, focus on:
1. Advanced functoids (regex, custom functions)
2. Visual debugging
3. Schema diff and migration
4. Performance optimization
5. Cloud integration

## See Also

- [Roadmap](./19-roadmap.md) - Post-MVP features
- [Risk Assessment](./18-risk-assessment.md) - Detailed risk analysis
- [Canvas Architecture](./02-canvas-architecture.md) - Technical architecture
