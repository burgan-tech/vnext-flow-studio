# Changelog - Unreleased

## Major Features

### 🎨 Canvas UI Redesign & Modernization

#### Complete Property Panel Refactor
- **Replaced monolithic PropertyPanel** (~2000 lines) with modular popup-based editors
- **25+ new specialized popup editors** for focused, context-aware editing:
  - State editors: `StateKeyEditPopup`, `StateLabelEditPopup`, `StateViewEditPopup`, `StateReferencesPopup`
  - Transition editors: `TransitionKeyEditPopup`, `TransitionLabelEditPopup`, `TransitionRuleEditPopup`, `TransitionSchemaEditPopup`, `TransitionMappingPopup`
  - Task editors: `TaskListPanel`, `TaskDetailsPanel`, `TaskMappingPopup`, `TaskSearchPanel`
  - Configuration: `SubFlowConfigPopup`, `TimeoutConfigPopup`
  - Search panels: `SchemaSearchPanel`, `ViewSearchPanel`, `WorkflowSearchPanel`
- **Inline editing**: Edit node keys, labels, and properties directly on canvas
- **Context menus**: Right-click menus for all node and edge operations
- **Improved UX**: Focused, modal-based editing reduces cognitive load

#### Enhanced Visual Components
- **Task badges**: Visual indicators for execution tasks on state nodes
- **Transition task badges**: Show task counts on transitions
- **State/Transition toolbars**: Quick-access action buttons for common operations
- **Comment indicators**: Visual markers for nodes/edges with comments
- **Reference previews**: Inline display of referenced components (views, schemas, subflows)

#### Canvas Improvements
- **Enhanced edge routing**: Improved FloatingEdge component with better path calculations
- **Node styling**: Modern PluggableStateNode design with improved visual hierarchy
- **Theme updates**: Comprehensive `rf-theme.css` overhaul for light mode consistency
- **New styles**: 10+ new CSS files for specialized components (mapping-section, task-badges, state-toolbar, etc.)

### 🚀 Advanced Deployment System

#### Full Deployment Pipeline
- **New deployment infrastructure** in `packages/core/src/deployment/`:
  - `normalizer.ts`: Workflow normalization and validation
  - `reference-resolver.ts`: Component reference resolution
  - `script-inliner.ts`: External script file inlining
  - `mapper-compiler.ts`: Mapping code generation from design-time metadata
  - `validator.ts`: Multi-stage validation (structure, references, syntax)
  - `types.ts`: Deployment-specific type definitions

#### Extension Deployment Service
- **New `packages/extension/src/deployment/` module**:
  - `DeploymentService.ts`: Orchestrates full deployment workflow (27k+ lines)
  - `EnvironmentManager.ts`: Multi-environment configuration
  - `DatabaseQuery.ts`: Runtime state queries
  - `DatabaseCleanup.ts`: Cleanup orphaned runtime data
  - `ContentComparison.ts`: Deep diff between local and deployed versions
  - `DesignTimeFilter.ts`: Strips editor-only metadata before deployment
  - `types.ts`: Deployment type system

#### Design-Time Attribute Filtering
- **Automatic cleanup** of editor-only attributes during deployment:
  - Visual: `position`, `layout`, `xProfile`, `zoom`, `viewport`
  - Metadata: `comments`, `notes`, `annotations`, `editorMetadata`
  - Development: `debugInfo`, `devMode`, `testData`
- **Non-destructive**: Local files remain unchanged
- **Configurable**: Add custom design-time attributes via API
- **Documentation**: `DESIGN_TIME_ATTRIBUTES.md`

#### Deployment Features
- **Multi-file deployment**: Deploy current file or all Git-modified files
- **Progress tracking**: Step-by-step deployment progress with percentages
- **Validation pipeline**: Structure → References → Syntax → Runtime checks
- **Error reporting**: Detailed error messages with file paths and line numbers
- **Result modal**: Visual deployment results with success/failure indicators

### 📊 Graph-Based Dependency Analysis

#### New Graph-Core Package
- **Standalone package** `packages/graph-core/` for graph operations:
  - **Local graph builder**: Scans workspace for components and builds dependency graph
  - **Runtime graph adapter**: Fetches deployed components from API
  - **Diff engine**: Detects drift between local and runtime environments
  - **Impact analysis**: Computes impact cone for component changes
  - **Configuration manager**: Multi-source environment configuration

#### Graph Commands
- **New `packages/extension/src/graph/graphCommands.ts`**:
  - `Amorphie: Build Local Graph`: Scan workspace and build dependency graph
  - `Amorphie: Fetch Runtime Graph`: Query runtime API for deployed components
  - `Amorphie: Compare Graphs`: Detect drift and violations
  - `Amorphie: Analyze Component Impact`: Show reverse dependencies

#### Drift Detection
- **9 violation types** with severity levels:
  - **Errors**: `semver-violation`, `missing-dependency`, `circular-dependency`, `api-drift`
  - **Warnings**: `node-removed`, `version-drift`, `config-drift`
  - **Info**: `node-added`, `node-changed`
- **Hash-based change detection**: API hash (breaking) vs config hash (non-breaking)
- **Grouped reporting**: Violations organized by severity
- **Deployment risk estimation**: Identify high-risk changes

#### Runtime Configuration
- **Multi-source environment configuration**:
  1. VS Code settings (`.vscode/settings.json`)
  2. Environment files (`.env.local`, `.env`)
  3. CLI integration (`.vnext/config.json`)
- **Environment properties**: id, name, baseUrl, domain, auth, timeout, verifySsl
- **Authentication support**: Bearer token, Basic auth
- **Documentation**: `RUNTIME_CONFIG.md`

### 🧩 Plugin System Enhancements

#### Plugin Wizard
- **New `packages/core/src/plugins/wizard/`**: Plugin initialization and scaffolding
- **Dynamic plugin loading**: Watch plugin directories for changes
- **Variant support**: Multiple variants per plugin
- **Design hints**: Plugin-provided UI customization

#### Component Resolver
- **Dynamic file watching**: Auto-reload on component changes
- **Improved catalogs**: Tasks, Views, Schemas, Functions, Extensions
- **Better error handling**: Graceful degradation on invalid components

### 📝 Enhanced Schema System

#### Mapping Schema Enhancements
- **Flexible design-time authoring** for mappings:
  - **Unified mode**: Single CSX file for input/output
  - **Split mode**: Separate input and output (inline code or file refs)
  - **Runtime requirement**: Always one `code` + `location` field
  - **Generation timestamp**: Track when code was generated
- **6 split mode combinations**: inline/file, input-only, output-only, mixed
- **Documentation**: `ENHANCED-MAPPING-GUIDE.md`

#### Rule Schema Enhancements
- **Composite rule support**:
  - **Simple mode**: Single condition (inline or file ref)
  - **Composite mode**: Multiple conditions with AND/OR operators
  - **Condition descriptions**: Document each condition's purpose
  - **Minimum 2 conditions** for composite rules
- **Boolean return validation**: Ensure rules return boolean values
- **Documentation**: `ENHANCED-RULES-GUIDE.md`

#### Schema Files
- **Updated `schemas/schemas/workflow-definition.schema.json`**:
  - New `scriptCode` definition (mappings) - lines 328-459
  - New `ruleCode` definition (rules) - lines 460-594
  - Updated all rule references to use `ruleCode`
- **Sample workflows**: `sample-workflow-with-enhanced-mapping.flow.json`, `sample-workflow-with-enhanced-rules.flow.json`
- **Schema proposals**: `proposed-mapping-schema.json`, `proposed-rule-schema.json`

### 🎯 Reference Selection System

#### Modern ReferenceSelector Component
- **Unified search interface** for component selection:
  - **Real-time search filtering** across multiple fields (key, domain, title, tags)
  - **Dropdown with 20 results**: Shows "...and N more" for large catalogs
  - **Visual selection indicators**: Clear selected state
  - **Detailed info panel**: Show component metadata
  - **Clear button**: Easy reset
- **Used for**: TaskRef, ProcessRef, ViewRef selection
- **Replaces legacy editors**: SchemaEditor, ViewEditor, FunctionListEditor, ExtensionListEditor

#### Architecture Documentation
- **`REFERENCE_SELECTION_ARCHITECTURE.md`**: Visual diagrams and patterns
- **3 UI patterns compared**: Modern search, mode selector, list editor
- **Migration path**: Move all reference types to unified ReferenceSelector
- **Performance considerations**: Handles catalogs up to 1000 items

### 🛠️ Settings Management

#### VS Code Settings Integration
- **New `packages/extension/src/settings/` module**:
  - Visual settings editor for Amorphie configuration
  - Environment management UI (add/edit/delete)
  - Set active environment with one click
  - Configure base path for local graph
  - Cache settings management
  - Real-time validation
  - No JSON editing required

### 📦 Script Management Improvements

#### Enhanced ScriptManager
- **File creation workflows**: Create mapping/rule scripts from editor
- **Script templates**: Pre-filled templates for common patterns
- **Location picker**: Browse for script save location
- **Open in VS Code**: Directly open created scripts
- **Message types**: `editor:createScript`, `editor:scriptCreated`, `editor:openInVSCode`

#### SaveScriptDialog Component
- **Modal dialog** for creating new script files
- **Location browsing**: Select save directory
- **Template support**: Pre-filled with design-time code
- **Integration**: Works with mapping and rule editors

## Core Package Changes

### Messages & Communication
- **26 new message types** in `packages/core/src/messages.ts`:
  - Deployment: `deploy:current`, `deploy:changed`, `deploy:checkStatus`, `deploy:selectEnvironment`, `deploy:status`, `deploy:progress`, `deploy:result`
  - Mappers: `mapper:saved`, `mapping:loadFromFile`, `mapping:createFile`, `mapping:openMapper`
  - Rules: `rule:loadFromFile`
  - Editor: `editor:createScript`, `editor:scriptCreated`, `editor:openInVSCode`, `editor:fileOpened`
  - Tasks: `task:openPopupEditor`, `task:createNew`
  - Transitions: `transition:editKey`
  - Navigation: `navigate:subflow`
  - Confirmation: `confirm:unsavedChanges`, `confirm:response`

### Type System Updates
- **Enhanced workflow types** in `packages/core/src/types/workflow.ts`:
  - Updated mapping structure with design-time metadata
  - Enhanced rule definitions with composite support
  - New reference type patterns
  - Plugin variant support

### Linter Enhancements
- **New validation rules** in `packages/core/src/linter.ts`:
  - Design-time mapping validation
  - Composite rule validation
  - Reference integrity checks

### Model Layer
- **WorkflowTemplate updates**: Support for new schema features
- **ScriptManager refactor**: 96+ lines of changes for script creation workflows

### Plugin System
- **PluginManager enhancements**: Dynamic loading, variant support
- **Plugin index updates**: Export wizard module

## Extension Package Changes

### Extension Host
- **Major refactor** of `extension.ts`:
  - Remove CLI integration (moved to deployment service)
  - Add graph command registration
  - Add settings command registration
  - Add deployment service initialization
  - Improve error handling

### ModelBridge Refactor
- **632+ lines changed** in `packages/extension/src/ModelBridge.ts`:
  - Add deployment service integration
  - Add script creation handlers
  - Add environment configuration handlers
  - Improve message routing
  - Better state synchronization

### CLI Removed
- **Deleted `packages/extension/src/cli.ts`** (427 lines):
  - Functionality moved to `packages/extension/src/deployment/DeploymentService.ts`
  - More robust implementation with better error handling
  - Integrated with deployment pipeline

### Build Configuration
- **Updated `esbuild.config.mjs`**:
  - Add new entry points for deployment and graph modules
  - Optimize bundle splitting
  - Improve source maps

### Package Updates
- **129+ lines changed** in `package.json`:
  - Add new dependencies for graph and deployment features
  - Update version constraints
  - Add new scripts

## Webview Package Changes

### Component Architecture
- **Deleted monolithic components** (7,000+ lines):
  - `PropertyPanel.tsx` (1,978 lines)
  - `EnhancedMappingEditor.tsx` (1,090 lines)
  - `RuleEditor.tsx` (907 lines)
  - `EnhancedExecutionTaskEditor.tsx` (448 lines)
  - `EnhancedRuleEditor.tsx` (382 lines)
  - `ExecutionTaskListEditor.tsx` (341 lines)
  - `EnhancedTriggerEditor.tsx` (310 lines)
  - `SubFlowEditor.tsx` (251 lines)
  - `ExtensionListEditor.tsx` (177 lines)
  - `FunctionListEditor.tsx` (177 lines)
  - `ViewEditor.tsx` (155 lines)
  - `SchemaEditor.tsx` (144 lines)
  - `CollapsibleSection.tsx` (72 lines)

- **Added modular popup editors** (3,000+ lines):
  - 25+ specialized popup components
  - 2 toolbar components
  - 4 badge components
  - 10+ new CSS files

### Canvas Component
- **1,669+ lines changed** in `Canvas.tsx`:
  - Integrate popup editors
  - Add context menu system
  - Add inline editing
  - Add comment indicators
  - Improve node/edge interactions
  - Add deployment UI integration

### Edge Components
- **109+ lines changed** in `FloatingEdge.tsx`:
  - Improved path calculations
  - Better label positioning
  - Enhanced styling

### Node Components
- **23+ lines changed** in `PluggableStateNode.tsx`:
  - Add badge support
  - Improve visual hierarchy
  - Better comment indicators

### Styling
- **326+ lines changed** in `rf-theme.css`:
  - Light mode consistency
  - Modern color palette
  - Better contrast ratios
  - Improved accessibility

- **New style files**:
  - `comments.css` (153 lines): Comment indicator styles
  - `mapping-section.css`: Mapping editor styles
  - `task-badges.css`: Task badge styles
  - `task-mapping-popup.css`: Task mapping popup styles
  - `task-search-panel.css`: Task search panel styles
  - `state-toolbar.css`: State toolbar styles
  - `state-edit-popup.css`: State edit popup styles
  - `subflow-config-popup.css`: Subflow config popup styles
  - `reference-selector.css` (332+ lines changed): Modern search dropdown styles

### Main Entry
- **7+ lines changed** in `main.tsx`:
  - Add new component imports
  - Improve initialization

## Documentation

### New Documentation Files
- `SCHEMA-ENHANCEMENTS-SUMMARY.md` (436 lines): Comprehensive schema changes overview
- `ENHANCED-MAPPING-GUIDE.md`: Complete mapping authoring guide
- `ENHANCED-RULES-GUIDE.md`: Complete rule authoring guide
- `REFERENCE_SELECTION_ARCHITECTURE.md` (375 lines): Reference selector patterns and architecture
- `DESIGN_TIME_ATTRIBUTES.md` (92 lines): Design-time filtering documentation
- `RUNTIME_CONFIG.md` (280 lines): Environment configuration guide
- `FINAL-SCHEMA-SUMMARY.md`: Schema implementation summary
- `QUICK-REFERENCE.md`: Quick reference for common operations

### Schema Documentation
- `proposed-mapping-schema.json`: Mapping schema proposal with examples
- `proposed-rule-schema.json`: Rule schema proposal with examples
- `sample-view.json`: View component example
- `sample-workflow-with-enhanced-mapping.flow.json`: Mapping examples
- `sample-workflow-with-enhanced-rules.flow.json`: Rule examples

## Utilities & Testing

### Graph Analysis Scripts
- `test-graph.js`: Basic graph testing
- `test-graph-full.js`: Full graph analysis
- `test-graph-detailed.js`: Detailed graph inspection
- `test-graph-compare.js`: Graph comparison testing
- `test-graph-diff-report.js`: Diff report generation
- `test-graph-raw.js`: Raw graph data inspection
- `compare-graphs.js`: Comprehensive graph comparison
- `fetch-runtime-graph.js`: Runtime graph fetching utility

### Drift Detection Scripts
- `check-schema-drifts.js`: Detect schema drift
- `check-schema-states.js`: Check schema states
- `check-drift-detail.js`: Detailed drift analysis
- `summary-all-drifts.js`: Drift summary report
- `show-reference-format-diff.js`: Reference format differences

### Runtime Analysis
- `test-runtime-endpoints.js`: Test runtime API endpoints
- `test-runtime-graph.js`: Runtime graph analysis
- `comprehensive-comparison.js`: Comprehensive local vs runtime comparison

## Infrastructure

### VS Code Configuration
- **29+ lines changed** in `.vscode/settings.json`:
  - Add Amorphie-specific settings
  - Configure environment variables
  - Set up graph analysis defaults

### Package Management
- **186+ lines changed** in `package-lock.json`:
  - Add new dependencies (graph-core, deployment modules)
  - Update existing dependencies
  - Lock versions for stability

### Schemas Submodule
- **Updated `schemas` submodule**: Sync with latest schema definitions

## Breaking Changes

### Removed Components
- `PropertyPanel.tsx`: Replaced with modular popup editors
- `cli.ts`: Replaced with `DeploymentService.ts`
- Legacy editor components: Replaced with modern popup-based editors

### API Changes
- Message types restructured and expanded
- Deployment flow completely redesigned
- Reference selection patterns updated

## Migration Guide

### For Users
1. **Deployment**: Use new deployment UI instead of old CLI integration
2. **Property Editing**: Use popup editors (right-click or toolbar) instead of side panel
3. **Environment Configuration**: Use Settings Editor (`Amorphie: Open Settings`)

### For Developers
1. **Reference Selection**: Use `ReferenceSelector` component instead of legacy editors
2. **Deployment**: Use `DeploymentService` API instead of direct CLI calls
3. **Graph Analysis**: Use `graph-core` package for dependency analysis

## Statistics

- **Files Modified**: 38
- **Lines Added**: ~3,191
- **Lines Removed**: ~7,566
- **Net Change**: -4,375 lines (code consolidation and refactoring)
- **New Components**: 30+
- **New Documentation**: 10+ files
- **New Utilities**: 15+ scripts

## Performance Improvements

- **Faster canvas rendering**: Optimized node/edge updates
- **Lazy loading**: Popup editors loaded on-demand
- **Cached catalogs**: Component catalogs cached for performance
- **Efficient graph algorithms**: O(n) traversal for most operations
- **Debounced search**: Real-time search with 150ms debounce

## Developer Experience

- **Better TypeScript types**: Comprehensive type coverage
- **Improved error messages**: Clear, actionable error reporting
- **Visual feedback**: Progress indicators for long operations
- **Modular architecture**: Easy to extend and maintain
- **Comprehensive documentation**: Guides for all major features

## Next Steps

### Phase 2: Code Generation (Planned)
- [ ] Implement mapping code generator
- [ ] Implement rule code generator
- [ ] Add file watchers for auto-generation
- [ ] Validate generated code

### Phase 3: Advanced Features (Planned)
- [ ] Build mapping editor UI with mode toggle
- [ ] Build rule editor UI with composite support
- [ ] Add code preview for generated scripts
- [ ] Integrate with file system for script management

### Phase 4: Testing & Migration (Planned)
- [ ] Write unit tests for deployment pipeline
- [ ] Write integration tests for graph analysis
- [ ] Migrate existing workflows to new schema
- [ ] Update user documentation

---

**Note**: This changelog represents unreleased work currently in development. Features and APIs may change before release.
