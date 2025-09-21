# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Install dependencies
npm install

# Build all packages (core → webview → extension)
npm run build

# Watch mode for development (runs all packages in parallel)
npm run watch

# Lint codebase
npm run lint

# Package VS Code extension
npm run package
```

## Architecture

This is a VS Code extension for editing Amorphie Workflow Definitions with a visual React Flow canvas. The project uses npm workspaces with three packages:

### Core Package (`packages/core`)
- **Purpose**: Shared types, schema validation, adapters, and utilities
- **Key modules**:
  - `schema.ts`: AJV-based workflow definition validation
  - `linter.ts`: Custom linting rules for workflow definitions
  - `adapter.ts`: Data transformation between formats
  - `registry.ts`: Task registry management
  - `types.ts`: TypeScript definitions for workflows
- **Build**: `npm run -w packages/core build` or `npm run -w packages/core watch`

### WebView Package (`packages/webview`)
- **Purpose**: React Flow-based visual editor UI
- **Tech stack**: React 18 + Vite + @xyflow/react
- **Build**: `npm run -w packages/webview build` or `npm run -w packages/webview dev`

### Extension Package (`packages/extension`)
- **Purpose**: VS Code host integration and commands
- **Key modules**:
  - `extension.ts`: Main extension entry point
  - `diagnostics.ts`: VS Code diagnostics integration
  - `commands.ts`: VS Code command implementations
  - `git.ts`: Git integration utilities
  - `quickfix.ts`: Quick fix providers
- **Build**: `npm run -w packages/extension build` or `npm run -w packages/extension watch`

## File Types and Structure

- **`*.flow.json`**: Workflow definitions (source of truth) with JSON schema validation
- **`*.diagram.json`**: Layout and positioning data for visual editor
- **`*.flow.lock.json`**: Deterministic build versions (optional)
- **`sys-tasks/`**: System task definitions
- **`schemas/`**: JSON schema files for validation
- **`flows/`**: Example workflow files

## VS Code Extension Features

- **Commands**:
  - `flowEditor.open`: Open Amorphie Flow in Canvas
  - `flowEditor.freezeVersions`: Freeze Versions (Lock)
- **JSON Validation**: Automatic validation for `*.flow.json` files
- **Custom Diagnostics**: Workflow-specific linting and error checking

## Development Notes

- Uses TypeScript with strict mode enabled
- ESLint for code linting
- Schema validation with AJV
- Git-native asset management for deterministic builds
- Extension activation on `flowEditor.open` command