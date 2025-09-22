# VNext Flow Studio

A VS Code extension for editing VNext Workflow Definitions.

## Features

- Visual workflow editor with React Flow
- Schema validation with AJV
- Custom linting and diagnostics
- Git-native asset management
- Deterministic builds with lock files

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

## License

MIT
