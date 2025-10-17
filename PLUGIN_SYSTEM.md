# Editor Plugin System for Specialized States

## Overview

The plugin system enables specialized state types (like Service Task) that provide enhanced editing capabilities while compiling down to the canonical state/transition model that the engine understands.

## How It Works

### 1. Plugin Registration

When the extension starts, plugins are registered with the Plugin Manager:

```typescript
// In ModelBridge.ts
pluginManager.register(ServiceTaskPlugin);
pluginManager.activate('ServiceTask');
```

### 2. Palette Population

The Service Task plugin automatically appears in the palette under "Specialized" section with:
- Main plugin button (Service Task)
- Variant buttons for discovered task types (HTTP Call, Send Email, etc.)

### 3. Creating a Service Task

When you click "Service Task" in the palette:
1. A new state is created with the plugin's configuration
2. Design hints are stored separately (editor-only metadata)
3. The state appears with specialized terminals (Success, Timeout, Error)

### 4. Terminal System

Service Task states have role-based terminals:
- **Success (✓)**: Required, triggers when task completes successfully
- **Timeout (⏱)**: Optional, triggers after specified duration
- **Error (⚠)**: Optional, handles task failures

Each terminal enforces specific transition rules (e.g., Timeout requires a timer).

### 5. Design Hints

Design hints store plugin-specific metadata:
- Terminal configurations and visibility
- Terminal-to-transition bindings
- Variant information
- Plugin-specific data

These are kept separate from the workflow definition and excluded from the engine payload.

## Service Task Plugin Features

### Terminals
- Success: Automatic trigger (required)
- Timeout: Timer-based trigger with ISO 8601 duration
- Error: Automatic or Event trigger for error handling

### Variants
The plugin discovers task presets from your project:
- HTTP Call
- Send Email
- Publish to Kafka
- Database Query
- Custom Task

### Validation Rules
- Must have at least one task in onEntries
- Exactly one Success transition required
- Timeout transitions must have valid timer
- Cannot have view or subflow

### Property Editor
- Task selection from registry
- Input/output mapping configuration
- Terminal management (enable/disable optional terminals)
- Timer configuration for timeouts

## File Structure

```
packages/core/src/plugins/
├── types.ts                    # Core plugin interfaces
├── designHints.ts              # Design hints management
├── PluginManager.ts            # Plugin lifecycle
└── serviceTask/
    ├── index.ts                # Service Task plugin
    ├── variantProvider.ts      # Task discovery
    └── lints.ts                # Validation rules
```

## Usage

1. **Open a workflow** in VS Code
2. **Look for "Specialized" section** in the palette
3. **Click "Service Task"** to add a service task state
4. **Configure the task** in the property panel
5. **Connect terminals** to other states as needed

## xProfile Support

Set the workflow profile to activate specialized features:

```json
{
  "attributes": {
    "xProfile": "ServiceTask",
    // ... other attributes
  }
}
```

Profiles:
- `Default`: Standard workflow editing
- `ServiceTask`: Service-oriented workflow with task focus

## Benefits

- **No engine changes**: Compiles to standard states/transitions
- **Enhanced UX**: Specialized editing without complexity
- **Discoverable**: Variants auto-discovered from project
- **Extensible**: Easy to add new plugins
- **Backward compatible**: Existing workflows continue working

## Creating Custom Plugins

To create your own plugin:

1. Implement the `StatePlugin` interface
2. Define terminals and their transition rules
3. Create variant provider (optional)
4. Add validation rules
5. Register with Plugin Manager

Example structure:
```typescript
const MyPlugin: StatePlugin = {
  id: 'MyPlugin',
  label: 'My Custom State',
  terminals: [...],
  createState: () => {...},
  hooks: {...},
  lintRules: [...]
};
```

## Troubleshooting

### Service Task not appearing in palette?
- Check that the extension is running
- Verify the plugin is registered in ModelBridge
- Check browser console for errors

### Terminals not visible?
- Ensure design hints are being saved
- Check that the node type is set to 'plugin'
- Verify terminal visibility in design hints

### Variants not showing?
- Check that task registry is populated
- Verify variant provider is discovering tasks
- Look for errors in variant discovery