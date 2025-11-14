# @amorphie-flow-studio/graph-core

Graph-based dependency analysis and drift detection for Amorphie workflow components.

## Overview

This package provides a comprehensive graph system for analyzing component dependencies, detecting drift between local and runtime environments, and performing impact analysis on workflow components.

## Features

### 1. **Local Graph Building**
Scans workspace directories and builds a dependency graph from local component files:
- Tasks, Schemas, Views, Functions, Extensions, Workflows
- Extracts component references and dependencies
- Computes API and config hashes for drift detection

### 2. **Runtime Graph Fetching**
Queries runtime APIs to fetch deployed component graphs:
- Uses workflow instance API pattern
- Each component type (Tasks, Schemas, etc.) is managed as workflow instances
- Supports paginated queries with filtering

### 3. **Graph Diff Engine**
Compares local and runtime graphs to detect:
- **Added/Removed Components**: Components that exist in one graph but not the other
- **Version Drift**: Same component with different versions
- **Semver Violations**: Dependencies that don't satisfy version ranges
- **Missing Dependencies**: Referenced components that don't exist
- **Circular Dependencies**: Detected via DFS traversal
- **API Drift**: Breaking changes detected via hash comparison
- **Config Drift**: Configuration changes detected via hash comparison

### 4. **Impact Analysis**
Performs reverse dependency traversal (BFS) to find affected components:
- Impact cone computation
- Deployment risk estimation
- Critical component identification
- Dependency path visualization

### 5. **Multi-Source Configuration**
Manages environment configurations with precedence:
1. VS Code settings (highest priority)
2. Environment files (`.env`, `.env.local`)
3. CLI integration (`vnext-workflow-cli`)

## Architecture

```
packages/graph-core/
├── src/
│   ├── types/           # Type definitions
│   │   ├── index.ts     # Graph, Node, Edge types
│   │   ├── diff.ts      # Violation and delta types
│   │   └── config.ts    # Configuration types
│   ├── graph/           # Core graph data structures
│   │   ├── Graph.ts     # Map-based multigraph implementation
│   │   └── utils.ts     # Hashing and normalization utilities
│   ├── builders/        # Graph construction
│   │   └── LocalGraphBuilder.ts
│   ├── adapters/        # Runtime API integration
│   │   ├── RuntimeAdapter.ts
│   │   └── AmorphieRuntimeAdapter.ts
│   ├── diff/            # Diff computation
│   │   └── DiffEngine.ts
│   ├── impact/          # Impact analysis
│   │   └── ImpactAnalysis.ts
│   └── config/          # Configuration management
│       └── ConfigManager.ts
```

## Usage

### Building Local Graph

```typescript
import { buildLocalGraph } from '@amorphie-flow-studio/graph-core';

const graph = await buildLocalGraph({
  basePath: '/path/to/workspace',
  computeHashes: true,
  includeTypes: ['workflow', 'task', 'schema']
});

console.log(`Loaded ${graph.nodes.size} components`);
```

### Fetching Runtime Graph

```typescript
import { AmorphieRuntimeAdapter } from '@amorphie-flow-studio/graph-core';

const adapter = new AmorphieRuntimeAdapter();
const graph = await adapter.fetchGraph({
  id: 'dev',
  name: 'Development',
  baseUrl: 'https://dev.example.com',
  domain: 'core',
  auth: {
    type: 'bearer',
    token: 'your-token'
  }
});
```

### Computing Diff

```typescript
import { diffGraphs } from '@amorphie-flow-studio/graph-core';

const delta = diffGraphs(localGraph, runtimeGraph);

console.log(`Found ${delta.stats.totalViolations} violations`);
console.log(`  Errors: ${delta.stats.errorCount}`);
console.log(`  Warnings: ${delta.stats.warningCount}`);

// Access violations by severity
for (const violation of delta.bySeverity.error) {
  console.log(`ERROR: ${violation.message}`);
}
```

### Impact Analysis

```typescript
import { impactCone } from '@amorphie-flow-studio/graph-core';

const cone = impactCone(graph, ['core/sys-flows/my-workflow@1.0.0'], {
  maxDepth: 5,
  includePaths: true
});

console.log(`${cone.stats.totalAffected} components affected`);
console.log(`Max dependency depth: ${cone.stats.maxDepth}`);

// Show dependency paths
for (const path of cone.dependencyPaths) {
  console.log(path.pathString);
}
```

### Configuration Management

```typescript
import { ConfigManager } from '@amorphie-flow-studio/graph-core';

const config = new ConfigManager();

// Load from all sources
await config.load({
  workspaceRoot: '/path/to/workspace',
  vscodeSettings: vscode.workspace.getConfiguration()
});

// Get active environment
const activeEnv = config.getActiveEnvironment();

// Add new environment
config.setEnvironment('prod', {
  id: 'prod',
  name: 'Production',
  baseUrl: 'https://api.example.com',
  domain: 'core',
  auth: { type: 'bearer', token: 'xxx' }
});
```

## VS Code Integration

The package is integrated into the VS Code extension with the following commands:

- **Graph: Build Local Dependency Graph** - Scans workspace and builds local graph
- **Graph: Fetch Runtime Graph** - Fetches deployed components from active environment
- **Graph: Compare Local vs Runtime** - Computes diff and shows violations
- **Graph: Analyze Component Impact** - Shows impact cone for selected component
- **Graph: Configure Environment** - Manages environment configurations

## Component Type Mappings

Each local component type corresponds to a runtime workflow:

| Component Type | Runtime Workflow | Directories |
|---------------|-----------------|-------------|
| `task` | `Tasks` | `Tasks/`, `tasks/`, `sys-tasks/` |
| `schema` | `Schemas` | `Schemas/`, `schemas/`, `sys-schemas/` |
| `view` | `Views` | `Views/`, `views/`, `sys-views/` |
| `function` | `Functions` | `Functions/`, `functions/`, `sys-functions/` |
| `extension` | `Extensions` | `Extensions/`, `extensions/`, `sys-extensions/` |
| `workflow` | `Workflows` | `Workflows/`, `workflows/`, `flows/`, `sys-flows/` |

## Data Structures

### Graph
Map-based directed multigraph with:
- `nodes: Map<ComponentId, GraphNode>` - All components
- `outgoingEdges: Map<ComponentId, GraphEdge[]>` - Dependencies
- `incomingEdges: Map<ComponentId, GraphEdge[]>` - Dependents

### GraphNode
```typescript
{
  id: string;              // domain/flow/key@version
  ref: ComponentRef;
  type: ComponentType;
  label?: string;
  definition?: any;        // Full component definition
  apiHash?: string;        // For breaking change detection
  configHash?: string;     // For config drift detection
  source: 'local' | 'runtime';
  tags?: string[];
  metadata?: Record<string, any>;
}
```

### GraphEdge
```typescript
{
  id: string;
  from: ComponentId;
  to: ComponentId;
  type: 'function' | 'extension' | 'schema' | 'workflow' | 'task' | 'view';
  versionRange?: string;   // For semver validation
  required?: boolean;
  metadata?: Record<string, any>;
}
```

## Violation Types

1. **node-added** (info) - Component in local but not runtime
2. **node-removed** (warning) - Component in runtime but not local
3. **node-changed** (info) - Component differs between environments
4. **version-drift** (warning) - Different versions deployed
5. **semver-violation** (error) - Version doesn't satisfy dependency range
6. **missing-dependency** (error) - Referenced component doesn't exist
7. **circular-dependency** (error) - Circular dependency detected
8. **api-drift** (error) - Breaking API change detected
9. **config-drift** (warning) - Configuration changed

## Environment Configuration

### VS Code Settings

```json
{
  "amorphieFlow.graph": {
    "environments": {
      "dev": {
        "id": "dev",
        "name": "Development",
        "baseUrl": "https://dev.example.com",
        "domain": "core",
        "auth": {
          "type": "bearer",
          "token": "dev-token"
        }
      },
      "prod": {
        "id": "prod",
        "name": "Production",
        "baseUrl": "https://api.example.com",
        "domain": "core"
      }
    },
    "activeEnvironment": "dev"
  }
}
```

### Environment Files

```env
# .env.local
AMORPHIE_ACTIVE_ENV=dev

# Development Environment
AMORPHIE_ENV_DEV_URL=https://dev.example.com
AMORPHIE_ENV_DEV_DOMAIN=core
AMORPHIE_ENV_DEV_AUTH_TOKEN=dev-token

# Production Environment
AMORPHIE_ENV_PROD_URL=https://api.example.com
AMORPHIE_ENV_PROD_DOMAIN=core
AMORPHIE_ENV_PROD_AUTH_TOKEN=prod-token
```

## Dependencies

- `@amorphie-flow-studio/core` - Component resolution and model layer
- `semver` - Semantic version parsing and validation

## License

MIT
