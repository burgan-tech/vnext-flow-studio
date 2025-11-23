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
  - `ModelBridge.ts`: Bridge between extension and workflow models, handles webview communication
  - `diagnostics.ts`: VS Code diagnostics integration
  - `commands.ts`: VS Code command implementations
  - `git.ts`: Git integration utilities
  - `quickfix.ts`: Quick fix providers
  - `cli.ts`: vnext-workflow-cli wrapper for deployment functionality
- **Build**: `npm run -w packages/extension build` or `npm run -w packages/extension watch`

## File Types and Structure

- **`*.json`**: Workflow definitions (source of truth) with JSON schema validation
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

## Workflow Deployment Integration

The extension integrates with **vnext-workflow-cli** (`@burgan-tech/vnext-workflow-cli`) for deploying workflows to the vNext API.

### Features

- **Deploy & Run Toolbar**: Lucidchart-style vertical icon bar with flyout panel
  - Always-visible icon strip on left side of canvas
  - Deploy & Run button with status indicators
  - States panel for drag-and-drop workflow building
  - Documentation viewer

- **CLI Integration** (`packages/extension/src/cli.ts`):
  - Automated CLI installation from extension UI
  - Project root configuration with folder picker
  - Status checking (CLI version, API connectivity, DB connectivity)
  - Deploy current workflow file
  - Deploy all Git-modified workflow files
  - Terminal-based execution with colored output

- **Smart UI States**:
  - Loading: Checking CLI status
  - Not Installed: Shows "Install CLI Now" button
  - Not Configured: Shows "Configure CLI Now" button
  - Configured: Shows deployment options with status indicators

### CLI Configuration

The CLI uses a config file at `~/.config/vnext-workflow-cli/config.json`:
```json
{
  "PROJECT_ROOT": "/path/to/your/project"
}
```

**Important**: All CLI commands run from the PROJECT_ROOT directory to properly detect:
- `Workflows/` folder
- `Tasks/` folder
- `Schemas/` folder
- `Views/` folder
- `Functions/` folder
- `Extensions/` folder

### Deployment Terminal

Deployments execute in a reusable VS Code terminal named "Workflow Deployment":
- Supports full ANSI colored output
- Preserves deployment history
- Automatically recreated if manually closed
- Commands run with proper shell environment and PROJECT_ROOT context

### Technical Implementation

- **Message Types** (`packages/core/src/messages.ts`):
  - `deploy:current`: Deploy currently open workflow file
  - `deploy:changed`: Deploy all Git-modified files
  - `deploy:checkStatus`: Check CLI installation and connectivity
  - `deploy:install`: Install vnext-workflow-cli globally
  - `deploy:configure`: Configure PROJECT_ROOT
  - `deploy:changeProjectRoot`: Change PROJECT_ROOT with folder picker
  - `deploy:status`: Status response (installed, configured, version, projectRoot, apiReachable, dbReachable)
  - `deploy:result`: Deployment result (success, message)

- **CLI Wrapper** (`packages/extension/src/cli.ts`):
  - `checkCliInstalled()`: Verify CLI is installed
  - `getCliVersion()`: Get installed CLI version
  - `getProjectRoot()`: Get configured PROJECT_ROOT (parses `wf config get PROJECT_ROOT` output)
  - `checkStatus()`: Run `wf check` and parse output for connectivity status
  - `deployFile()`: Deploy single file via terminal
  - `deployChanged()`: Deploy Git-modified files via terminal
  - `installCli()`: Install CLI via npm
  - `configureCli()`: Set PROJECT_ROOT configuration
  - `changeProjectRoot()`: Show folder picker and update PROJECT_ROOT

### Uninstalling CLI

```bash
npm uninstall -g @burgan-tech/vnext-workflow-cli
```

## Development Notes

- Uses TypeScript with strict mode enabled
- ESLint for code linting
- Schema validation with AJV
- Git-native asset management for deterministic builds
- Extension activation on `flowEditor.open` command

## Design System

- **Editor Theme**: The visual workflow editor uses **light mode** styling
- **Modal Dialogs**: All modals (comment viewers, documentation) use light mode with:
  - White backgrounds (`#ffffff`)
  - Dark slate text (`#1e293b`, `#0f172a`)
  - Light borders (`#e2e8f0`, `#cbd5e1`)
  - Blue accents (`#3b82f6`, `#2563eb`)
- **Contrast**: Light modals contrast with VS Code's dark theme environment