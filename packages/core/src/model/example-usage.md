# Model Abstraction Layer Usage Guide

This guide demonstrates how to use the new model abstraction layer that separates the physical storage (JSON files + .csx scripts) from the logical model representation.

## Overview

The model abstraction provides:
- **Unified Model**: Single in-memory representation combining workflow, components, and scripts
- **Component Resolution**: Automatic loading and caching of referenced tasks, schemas, views, functions, and extensions
- **Script Management**: Handling of C# script files (.csx) with Base64 encoding
- **VS Code Integration**: Ready-to-use integration layer for VS Code extensions

## Basic Usage

### Loading a Workflow Model

```typescript
import { ModelLoader, WorkflowModel } from '@amorphie-flow-studio/core';

// Load a workflow from file
const model = await ModelLoader.loadFromFile('my-workflow.flow.json', {
  resolveReferences: true,  // Resolve all component references
  loadScripts: true,        // Load .csx script contents
  validate: true            // Run validation after loading
});

// Access the workflow
const workflow = model.getWorkflow();
const diagram = model.getDiagram();

// Get resolved states with all references loaded
const states = model.getStates();
for (const [key, state] of states) {
  console.log(`State ${key}:`, {
    view: state.resolvedView,          // Resolved view definition
    onEntries: state.resolvedOnEntries, // Tasks with resolved definitions and scripts
    transitions: state.resolvedTransitions
  });
}
```

### Working with Scripts

```typescript
// Get a script by location
const script = model.getScript('./src/mappings/task1.csx');
if (script) {
  console.log('Script content:', script.content);
  console.log('Base64 encoded:', script.base64);
  console.log('File exists:', script.exists);
}

// Update script content
await model.updateScript('./src/mappings/task1.csx', newContent);

// Create a new script from template
const newScript = await model.createScript(
  './src/mappings/new-task.csx',
  'DaprHttpEndpoint'  // Use task-specific template
);

// Find where a script is used
const usages = model.findScriptUsages('./src/mappings/task1.csx');
for (const usage of usages) {
  console.log('Used in:', usage);
}
```

### Modifying the Model

```typescript
// Add a new state
model.addState({
  key: 'new-state',
  stateType: 2, // Intermediate
  versionStrategy: 'Minor',
  labels: [{ label: 'New State', language: 'en' }],
  transitions: []
});

// Update a state
model.updateState('existing-state', {
  labels: [{ label: 'Updated State', language: 'en' }]
});

// Delete a state (automatically removes targeting transitions)
model.deleteState('unused-state');

// Listen to changes
model.on('change', (event) => {
  console.log('Model changed:', event);
});
```

### Validation

```typescript
import { ModelValidator } from '@amorphie-flow-studio/core';

// Validate the model
const result = await ModelValidator.validate(model, {
  rules: [
    'schema',         // JSON schema validation
    'referential',    // Reference integrity
    'scripts',        // Script file validation
    'states',         // State machine validation
    'transitions',    // Transition validation
    'deadlock',       // Deadlock detection
    'unreachable',    // Unreachable state detection
    'bestPractices'   // Best practice checks
  ],
  checkScriptFiles: true,
  deepChecks: true
});

console.log('Valid:', result.valid);
console.log('Errors:', result.errors);
console.log('Warnings:', result.warnings);
```

### Saving Changes

```typescript
import { ModelSaver } from '@amorphie-flow-studio/core';

// Save the model back to files
const saveResult = await ModelSaver.save(model, {
  backup: true,              // Create backup files
  format: true,              // Format JSON output
  indent: 2,                 // JSON indentation
  updateScriptEncoding: true // Update Base64 encoding in workflow
});

console.log('Save result:', {
  success: saveResult.success,
  modified: saveResult.modified,
  created: saveResult.created,
  errors: saveResult.errors
});
```

## VS Code Integration

The `VSCodeModelIntegration` class provides a complete integration layer for VS Code:

```typescript
import { VSCodeModelIntegration } from '@amorphie-flow-studio/core';

// Create integration instance
const integration = new VSCodeModelIntegration();

// Register event listeners
integration.on('onDidChangeModel', (event) => {
  console.log('Model changed:', event);
});

integration.on('onDirtyStateChange', (isDirty) => {
  // Update VS Code UI to show dirty state
  vscode.window.showInformationMessage(
    isDirty ? 'Unsaved changes' : 'All changes saved'
  );
});

// Open a workflow
const model = await integration.openWorkflow('my-workflow.flow.json');

// Handle document changes from VS Code
integration.handleDocumentChange({
  type: 'workflow',
  path: 'my-workflow.flow.json',
  content: updatedJsonContent
});

// Get diagnostics for VS Code
const diagnostics = await integration.getDiagnostics();
for (const diagnostic of diagnostics) {
  console.log(`${diagnostic.severity}: ${diagnostic.message}`);
}

// Get quick fixes
const fixes = integration.getQuickFixes(diagnostic);
for (const fix of fixes) {
  console.log(`Fix: ${fix.title}`);
}

// Save the active model
await integration.save();

// Export/Import bundles
await integration.exportBundle('workflow-bundle.json');
const imported = await integration.importBundle('bundle.json', './target-dir');
```

## Advanced Features

### Component Resolution

The `ComponentResolver` automatically resolves and caches component references:

```typescript
import { ComponentResolver } from '@amorphie-flow-studio/core';

const resolver = new ComponentResolver({
  basePath: '/path/to/project',
  searchPaths: {
    tasks: ['Tasks', 'sys-tasks'],
    schemas: ['Schemas', 'sys-schemas'],
    views: ['Views', 'sys-views'],
    functions: ['Functions', 'sys-functions'],
    extensions: ['Extensions', 'sys-extensions']
  },
  useCache: true
});

// Resolve a task reference
const task = await resolver.resolveTask({
  key: 'http-task',
  domain: 'core',
  flow: 'sys-tasks',
  version: '1.0.0'
});

// Or with ref style
const task2 = await resolver.resolveTask({
  ref: './Tasks/my-task.json'
});
```

### Script Templates

The `ScriptManager` provides templates for different task types:

```typescript
import { ScriptManager } from '@amorphie-flow-studio/core';

const scriptManager = new ScriptManager();

// Get template for specific task type
const template = scriptManager.getTemplate('DaprHttpEndpoint');

// Create a new script from template
const script = await scriptManager.createScript(
  './src/mappings/new.csx',
  'HumanTask',
  '/base/path'
);
```

### Model Discovery

Find all workflows in a directory:

```typescript
const discovered = await ModelLoader.discoverWorkflows({
  rootDir: './workflows',
  maxDepth: 5,
  includePattern: /\.flow\.json$/,
  excludePattern: /node_modules|\.git/
});

for (const workflow of discovered) {
  console.log(`Found: ${workflow.key} v${workflow.version}`);
  console.log(`  Path: ${workflow.workflowPath}`);
  console.log(`  Has diagram: ${workflow.hasDiagram}`);
}
```

### Bundle Export/Import

Export a workflow with all its dependencies:

```typescript
// Export to a single bundle file
await ModelSaver.exportBundle(model, 'workflow-bundle.json', {
  includeScripts: true,
  includeDiagram: true
});

// Import from bundle
const imported = await ModelSaver.importBundle(
  'workflow-bundle.json',
  './target-directory',
  { overwrite: false }
);
```

## Model State Structure

The complete model state includes:

```typescript
interface WorkflowModelState {
  // Core workflow definition
  workflow: Workflow;

  // Optional diagram for layout
  diagram?: Diagram;

  // Resolved states with all references loaded
  resolvedStates: Map<string, ResolvedState>;

  // Resolved function definitions
  resolvedFunctions: Map<string, FunctionDefinition>;

  // Resolved extension definitions
  resolvedExtensions: Map<string, ExtensionDefinition>;

  // Resolved shared transitions
  resolvedSharedTransitions: Map<string, ResolvedSharedTransition>;

  // All script files (.csx) used in the workflow
  scripts: Map<string, ResolvedScript>;

  // Referenced component definitions
  components: {
    tasks: Map<string, TaskComponentDefinition>;
    schemas: Map<string, SchemaDefinition>;
    views: Map<string, ViewDefinition>;
  };

  // Metadata
  metadata: {
    workflowPath: string;
    diagramPath?: string;
    basePath: string;
    lastLoaded: Date;
    isDirty: boolean;
  };
}
```

## Benefits

1. **Separation of Concerns**: Physical storage is separate from logical model
2. **Unified Access**: Single API to access all workflow components
3. **Automatic Resolution**: Components and scripts are automatically loaded
4. **Caching**: Efficient caching prevents redundant file reads
5. **Change Tracking**: Built-in dirty state and change events
6. **Validation**: Comprehensive validation including deadlock detection
7. **VS Code Ready**: Complete integration layer for VS Code extensions
8. **Script Management**: Full support for C# script files with templates