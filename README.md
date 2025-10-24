# Amorphie Flow Studio

A comprehensive VS Code extension for visual workflow design and JSON transformation mapping.

## Features

### 🎨 Visual Mapper - JSON-to-JSON Transformations

**BizTalk-style visual mapper for building complex data transformations without code.**

- **Visual 3-Panel Interface**: Source schema → Canvas → Target schema
- **40+ Functoid Library**: String, math, logic, collections, aggregates, date/time, and more
- **Schema Intelligence**: Automatic inference from JSON examples, or paste/link schemas
- **Live Testing**: Execute transformations with sample data and see results instantly
- **Code Generation**: Export to JSONata or C# for production use
- **Free-Form Schemas**: Extend objects with custom properties at design time

**Quick Start:**
```bash
# Command Palette (Ctrl+Shift+P)
> New Amorphie Mapper

# Or right-click a folder in Explorer
> New Amorphie Mapper
```

See [mapper specification](./mapper_spec.md) for complete documentation.

---

### 🔀 Visual Workflow Editor

- **Interactive Canvas**: React Flow-based visual designer for complex workflows
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

### Workflow Files
- `*.flow.json` or `workflows/**/*.json`: Workflow definitions (source of truth)
- `*.diagram.json`: Layout and positioning data
- `*.flow.lock.json`: Deterministic build versions (optional)

### Mapper Files
- `*.mapper.json`: Mapper definition with nodes, edges, and transformation logic
- `*.mapper.diagram.json`: Canvas layout and UI state (optional)
- Tests stored in adjacent `tests/` directory

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
