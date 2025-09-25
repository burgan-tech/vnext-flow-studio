# VNext Flow Studio

A VS Code extension for editing VNext Workflow Definitions.

## Features

- **Visual Workflow Editor**: Interactive canvas with React Flow for designing complex workflows
- **Enhanced IntelliSense**: Advanced C# code completion with BBT Workflow integration (90+ suggestions)
- **Schema Validation**: Real-time validation with AJV against workflow and task schemas
- **Custom Linting**: Comprehensive diagnostics and error detection
- **Git-Native Management**: Version control optimized asset management
- **Deterministic Builds**: Reproducible builds with lock files
- **Spell Check Optimization**: Smart spell checking that handles Base64-encoded mappings

## Development

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Watch mode for development
npm run watch

# Package extension
npm run package
```

## Architecture

- **Core Package**: Shared types, schema validation, adapters, and utilities
- **WebView Package**: React Flow-based visual editor
- **Extension Package**: VS Code host integration

## File Types

- `*.flow.json` or `workflows/**/*.json`: Workflow definitions (source of truth)
- `*.diagram.json`: Layout and positioning data
- `*.flow.lock.json`: Deterministic build versions (optional)

## Spell Checker Configuration

The workspace handles workflow files with Base64-encoded C# mappings:

### Automatic Configuration
- **Excluded Files**: `*.flow.json` and `**/workflows/**/*.json` are excluded from spell checking
- **Pattern Ignoring**: Large Base64 strings (`"code": "dXNpbmcgU3..."`) are automatically ignored
- **Custom Dictionary**: Includes workflow terms (IMapping, ScriptContext, triggerType, etc.)

### Configuration Files
- `.cspell.json` - Main spell checker configuration
- `.vscode/settings.json` - VS Code workspace settings
- `vnext-flow-studio.code-workspace` - Complete workspace configuration

### Resolving Spell Check Warnings
If you see "text without spaces or word breaks" warnings:
1. Files in `workflows/` directories are automatically excluded
2. Use the provided workspace file for optimal settings
3. Base64-encoded mappings are intentionally ignored for performance

## License

MIT
