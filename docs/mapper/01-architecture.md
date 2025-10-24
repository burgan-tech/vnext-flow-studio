# Architecture

## Overview

Amorphie Mapper is built as an integrated feature within Amorphie Flow Studio using npm workspaces. It follows the existing pattern of separating domain logic (`mapper-core`), UI (`mapper-webview`), and VS Code integration (`extension`).

## System Architecture

```
Amorphie Flow Studio Extension (npm workspaces)
├─ packages/mapper-core (TypeScript)
│   ├─ MapSpec validation (AJV, similar to workflow schema validation)
│   ├─ JSONata codegen (MapSpec → JSONata)
│   ├─ Test runner (jsonata JS + Ajv)
│   └─ Schema flattening utilities
├─ packages/mapper-webview (React + Vite)
│   ├─ MapperCanvas: React Flow canvas + side panels
│   ├─ SchemaTree components (source/target)
│   └─ Node components (Const, Binary, Conditional, etc.)
├─ packages/extension (updated)
│   ├─ Activation: open *.mapper.json or run mapper.open command
│   ├─ MapperEditorProvider: Custom webview panel
│   └─ Commands: mapper.open, mapper.runTests, mapper.exportJsonata
└─ File conventions (consistent with existing *.flow.json / *.diagram.json)
    ├─ *.mapper.json ← MapSpec (domain model)
    └─ *.mapper.diagram.json ← GraphLayout (UI only)
```

## Workspace Packages

### `packages/mapper-core`

**Purpose:** Shared domain logic, validation, and code generation

**Key Modules:**

- `types.ts` — TypeScript definitions for MapSpec, nodes, edges
- `schema.ts` — AJV-based validation for *.mapper.json files
- `codegen.ts` — MapSpec → JSONata transformation
- `testRunner.ts` — Execute tests using jsonata library
- `schemaFlattener.ts` — JSON Schema → field terminals with JSONPath
- `validator.ts` — Static validation (allow-list, wiring, type checks)

**Dependencies:**

- `ajv` + `ajv-formats` (already in core package)
- `jsonata` (NEW dependency)
- `semver` (version management)

**Build:** `npm run -w packages/mapper-core build`

### `packages/mapper-webview`

**Purpose:** React Flow-based visual editor UI

**Key Components:**

- `MapperCanvas.tsx` — Main canvas with 3-panel layout
- `SchemaTree.tsx` — Source/target schema tree views
- `nodes/` — Custom React Flow node components
  - `FunctoidNode.tsx` — Base functoid component
  - `StringFunctoids.tsx` — Concat, Uppercase, etc.
  - `MathFunctoids.tsx` — Add, Multiply, etc.
  - `LogicalFunctoids.tsx` — Equal, And, Or, etc.
  - `ConditionalFunctoids.tsx` — Conditional, Switch
  - `CollectionFunctoids.tsx` — ForEach, Filter, Sum, etc.
  - `ObjectFunctoids.tsx` — InitObject, InitArray
- `edges/` — Custom edge components
- `panels/` — Bottom panel tabs (Tests, Preview, Console, Properties)
- `hooks/` — React hooks for mapper state management
  - `useMapperState.ts` — MapSpec + GraphLayout state
  - `useBridge.ts` — VS Code extension messaging (reuse from workflow editor)

**Tech Stack:**

- React 18
- Vite (for build)
- `@xyflow/react` (React Flow library, already in webview)
- `@amorphie-flow-studio/mapper-core` (local dependency)

**Build:** `npm run -w packages/mapper-webview build`

### `packages/extension` (updates)

**Purpose:** VS Code host integration

**New Files:**

- `mapperCommands.ts` — Command implementations
- `MapperEditorProvider.ts` — Custom editor webview provider
- `mapperDiagnostics.ts` — Diagnostic provider for *.mapper.json validation

**Updated Files:**

- `extension.ts` — Register mapper activation events and commands
- `package.json` — Add command contributions and file associations

**Build:** `npm run -w packages/extension build`

## Separation of Concerns

**Strict rule:** MapSpec (semantics) **must not** include any layout data. GraphLayout **must not** include mapping semantics.

| Concern | File | Package | Contains |
|---------|------|---------|----------|
| **Domain Logic** | `*.mapper.json` | `mapper-core` | Nodes, edges, tests, schema refs |
| **UI Layout** | `*.mapper.diagram.json` | `mapper-webview` | Positions, zoom, viewport, collapsed state |
| **Validation** | `schema.ts` | `mapper-core` | AJV schemas for MapSpec + GraphLayout |
| **Rendering** | `MapperCanvas.tsx` | `mapper-webview` | React Flow components, styling |
| **Codegen** | `codegen.ts` | `mapper-core` | MapSpec → JSONata (no UI concerns) |
| **VS Code Integration** | `MapperEditorProvider.ts` | `extension` | File I/O, commands, diagnostics |

## Data Flow

```
User Action (Drag field)
  ↓
React Flow Event (onConnect)
  ↓
Mapper State Update (add edge to MapSpec)
  ↓
Validation (mapper-core)
  ↓
Codegen (generate JSONata)
  ↓
VS Code Message (save MapSpec)
  ↓
File System Write (*.mapper.json)
```

## Integration Points

### With Existing Workflow Editor

- **Shared:** ELK layout algorithms from `packages/core/src/layout.ts`
- **Shared:** AJV validation pattern from `packages/core/src/schema.ts`
- **Shared:** Webview messaging bridge from `packages/webview/src/hooks/useBridge.ts`
- **Shared:** Node rendering base components (extend for functoids)

### With Workflow Definitions

Mappers can be referenced from workflow ServiceTask nodes:

```json
{
  "name": "TransformOrder",
  "type": "ServiceTask",
  "properties": {
    "mapperRef": "./mappers/orders-to-shop-totals.mapper.json"
  }
}
```

The workflow engine can:
1. Load the mapper's generated JSONata
2. Execute the transformation at runtime
3. Validate output against target schema

## Build Process

### Development

```bash
# Watch mode (all packages in parallel)
npm run watch
# Runs:
# - npm -w packages/core run watch
# - npm -w packages/mapper-core run watch
# - npm -w packages/webview run dev
# - npm -w packages/mapper-webview run dev
# - npm -w packages/extension run watch
```

### Production

```bash
# Build in dependency order
npm run build
# Runs:
# 1. packages/core
# 2. packages/mapper-core
# 3. packages/webview
# 4. packages/mapper-webview
# 5. packages/extension
```

## Deployment

Mapper is bundled as part of the Amorphie Flow Studio VS Code extension (`.vsix` file). No separate installation required.

**Extension Activation Events:**

```json
{
  "activationEvents": [
    "onLanguage:json",
    "onCommand:flowEditor.open",
    "onCommand:mapper.open"
  ]
}
```

## Next Steps

- [File Conventions](./02-file-conventions.md) — Learn about file types and naming
- [MapSpec Schema](./03-mapspec-schema.md) — Dive into the domain model
