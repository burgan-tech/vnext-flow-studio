# Changelog

All notable changes to the Amorphie Flow Studio extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Workflow Comments System**: Comprehensive comment support for workflows, states, and transitions
  - **Comment Storage**: Comments stored in workflow definition JSON with dedicated `comment` fields
  - **Visual Indicators**: Comment icon badge displays on elements with comments (states and transitions)
  - **Comment Modal**: Click badge to view/edit comments in a light-themed modal dialog
    - Modal matches editor's light theme design system
    - Markdown support for rich text formatting
    - Auto-focus on textarea when opening
    - Save/Cancel actions with visual feedback
  - **Element-Level Comments**:
    - Workflow-level comments for overall documentation
    - State comments for documenting business logic at each step
    - Transition comments for documenting conditions and rules
  - **UI Components**:
    - `CommentIcon.tsx`: Visual indicator badge with click handler
    - `CommentModal.tsx`: Full-featured comment editor dialog
    - Light theme styling matches other modals (white background, dark text, blue accents)

- **Documentation Viewer**: Built-in documentation browser for workflow specifications
  - Accessible from Deploy & Run toolbar's Documentation button
  - Modal dialog with light theme styling
  - Placeholder for embedding workflow documentation, guides, and references
  - `DocumentationViewer.tsx`: Reusable component for future documentation integration

- **Lucidchart-Style Toolbar**: Complete toolbar redesign with modern vertical layout
  - **Always-Visible Icon Bar**: Thin vertical strip (48px) on left side of canvas
    - Three icon buttons: States, Deploy & Run, Documentation
    - Uses Lucide React icons for modern, clean appearance
    - Active state highlighting with blue background
  - **Flyout Panels**: Click-based panel expansion system
    - Panels slide out to the right of icon bar
    - Outside-click detection for automatic panel closing
    - Overlay canvas without blocking workflow view
  - **States Panel**: Drag-and-drop workflow building (280px width)
    - Vertically expanding panel based on available states
    - Maintains all existing drag-and-drop functionality
  - **Deploy & Run Panel**: CLI integration and deployment controls (described below)
  - **Components**:
    - `ToolbarIconButton.tsx`: Reusable icon button component
    - `FlyoutPanel.tsx`: Reusable panel container with header and close button

- **vnext-workflow-cli Integration**: Complete deployment workflow integration
  - **Automated CLI Management**:
    - One-click CLI installation from extension UI
    - Automatic PROJECT_ROOT configuration with folder picker
    - Change project root with visual folder selection
    - Smart status checking (installation, configuration, API/DB connectivity)
  - **Smart UI States**: Progressive deployment panel based on CLI status
    - Loading state: "Checking CLI status..."
    - Not Installed: Shows "Install CLI Now" button with description
    - Not Configured: Shows "Configure CLI Now" button
    - Fully Configured: Shows deployment options with live status indicators
  - **Status Indicators**: Real-time display of system health
    - CLI version (e.g., "Installed (1.0.1)")
    - Project Root: Shows configured directory path with "Change Project Root" button
    - API connectivity: Green "Connected" or red "Not reachable"
    - Database connectivity: Green "Connected" or red "Not reachable"
  - **Deployment Actions**:
    - Deploy Current File: Saves and deploys currently open workflow
    - Deploy Changed Files: Deploys all Git-modified workflows
    - Refresh Status: Manually refresh CLI status and connectivity
  - **Terminal Integration**:
    - Commands execute in reusable "Workflow Deployment" terminal
    - Full ANSI color support (green checkmarks, colored output)
    - Deployment history preserved in single terminal instance
    - Terminal automatically recreated if manually closed
    - Commands run from PROJECT_ROOT for proper folder detection
  - **CLI Wrapper** (`packages/extension/src/cli.ts`):
    - `checkCliInstalled()`: Verify `wf` command availability
    - `getCliVersion()`: Get installed CLI version from `wf --version`
    - `getProjectRoot()`: Parse PROJECT_ROOT from CLI config
    - `checkStatus()`: Run `wf check` and parse connectivity status
    - `deployFile()`: Deploy single workflow file via terminal
    - `deployChanged()`: Deploy Git-modified files via terminal
    - `installCli()`: Install `@burgan-tech/vnext-workflow-cli` globally
    - `configureCli()`: Set PROJECT_ROOT configuration
    - `changeProjectRoot()`: Show folder picker and update PROJECT_ROOT
  - **Message Protocol** (bidirectional webview ↔ extension communication):
    - `deploy:current`: Deploy currently open workflow
    - `deploy:changed`: Deploy all Git-modified workflows
    - `deploy:checkStatus`: Check CLI installation and connectivity
    - `deploy:install`: Trigger global npm installation
    - `deploy:configure`: Configure PROJECT_ROOT
    - `deploy:changeProjectRoot`: Show folder picker and update root
    - `deploy:status`: Response with CLI state (installed, configured, version, projectRoot, apiReachable, dbReachable)
    - `deploy:result`: Deployment outcome (success, message)

- **New Mapper Dialog**: Popup dialog for creating new mappers
  - Single popup form replaces multiple top-bar input prompts
  - Fields: mapper name (validated), description (optional), and "Open in Mapper Editor" checkbox
  - Shows target folder location
  - Real-time validation with error messages
  - Creates file directly without additional save dialog
  - Checks for existing files and shows error if name conflicts

- **Drag-and-Drop Part Reordering**: Reorder document parts in Part Manager Panel
  - HTML5 drag-and-drop with visual feedback (drag handles ⋮⋮, opacity changes, cursor states)
  - Separate ordering for source and target parts
  - Changes tracked in pending state until "Apply Changes" is clicked
  - Order persisted in `.map.json` files via `sourceOrder` and `targetOrder` arrays

- **Part Manager Schema Management**: Enhanced schema selection and inference capabilities
  - **Search/Filter**: Real-time search for platform schemas by key, domain, title, or description
  - **JSON Schema Inference**: Restored "Infer from Example" functionality
    - JSON textarea for pasting example data
    - Four configurable inference options (detectFormats, allRequired, addConstraints, strictTypes)
    - Results display with confidence score, warnings, and schema preview
    - All staged to pending state before applying

- **Part Order Persistence**: Part ordering respected throughout entire application
  - Order saved to and loaded from `.map.json` files
  - Applied in Part Manager Panel display
  - Applied in schema tree building
  - Applied in JSONata code generation (root level properties)
  - Applied in C# code generation (variable declarations and return statements)

- **Random String Generator Functoid**: New String.RandomString functoid for generating random strings
  - Configurable string length (1-1000 characters, default: 10)
  - Three character set options: alphanumeric (A-Z, a-z, 0-9), numeric only (0-9), and symbols (!@#$%^&*...)
  - Default configuration generates alphanumeric strings
  - Both JSONata and C# code generation fully supported
  - Configuration panel with intuitive checkboxes for character set selection
  - Visual representation using dice icon in functoid palette

- **Auto-Map Feature**: Intelligent automatic field mapping between source and target schemas
  - Auto Map button in mapper toolbar (enabled when both schemas present)
  - Fuzzy string matching using Levenshtein distance algorithm
  - Semantic field relationship detection (email/mail, phone/tel, etc.)
  - Context-aware matching based on parent paths
  - Configurable minimum similarity threshold (default: 0.5)
  - Two-phase optimal matching algorithm prioritizes best matches globally
  - Visual feedback: auto-mapped edges flash green for 2 seconds, then settle to blue
  - Console summary showing high/medium/low confidence mappings

- **Platform Schema Import**: Import schemas from the low-code platform's ModelManager
  - New "Platform Schemas" tab in schema import modal (appears as first tab)
  - Searchable list of all schemas scanned from the project
  - One-click schema import: clicking a schema immediately applies it (no preview/confirmation needed)
  - Automatically extracts JSON Schema from `attributes.schema` property
  - Integrates with existing ModelManager to avoid duplicate scanning
  - Supports schemas from any `Schemas` folder in the workspace hierarchy (`**/Schemas/**`)
  - Hides "Reference File" tab when in platform mode for cleaner UX

### Fixed

- **Workflow Editor - Stale Content Cache**: Fixed critical issue where editor showed outdated workflow content
  - **Problem**: When closing and reopening workflow files, editor displayed stale cached content instead of current file contents
  - **Root Cause**: Core library's `VSCodeModelIntegration` maintains a model cache for cross-model queries (subflows, references) and returned cached models without reloading from disk
  - **Solution**: Force `model.load()` after retrieving model from cache to refresh content from disk
  - **Impact**: Preserves cache benefits for cross-model queries while ensuring editor always shows fresh file content
  - Also applies to external file changes detected by file watchers

- **Mapper Code Generation - Nested Objects**: Fixed flat key generation to produce proper nested object structures
  - **JSONata Generator**: Replaced flat keys like `"body.address.city"` with nested `{ body: { address: { city: ... } } }`
    - Added `buildNestedObject()` method to convert dotted paths to nested objects
    - Added `objectToJSONata()` method to format nested structures with proper indentation
    - Fixed both simple mappings and array mappings
  - **C# Generator**: Implemented intermediate object creation for nested paths
    - Added null-coalescing operator (`??=`) to ensure parent objects exist before assigning nested properties
    - Properly handles deeply nested structures (3+ levels)
    - Fixed both simple mappings and array mappings

- **Mapper Code Generation - Array Field Naming**: Removed `[]` suffix from property names in generated code
  - **JSONata Generator**: Stripped array suffix from all path parts in both simple and array mappings
  - **C# Generator**: Removed suffix from variable names, property paths, intermediate objects, and field names
  - Ensures valid identifiers and proper JSON property names (e.g., `"hobbies"` instead of `"hobbies[]"`)

- **Part Manager Panel - Change Detection**: Fixed schema change detection and staging behavior
  - Added `partName` tracking to properly identify which part was updated
  - Added `applyImmediately` flag to distinguish between Part Manager browsing (staged) and "Update All" (immediate)
  - Fixed order change detection to trigger "Apply Changes" button visibility
  - Changes only applied when explicitly confirmed by user

- **Part Manager Panel - Schema Tree Building**: Fixed `__filePath` metadata pollution
  - Extracts `__filePath` before processing to prevent schema corruption
  - Stores clean schema without metadata that would break tree building
  - Stores file path separately in `schemaSourcePath` field for change detection

- **Part Manager Panel - Order Preservation**: Fixed Part Manager to honor saved part order
  - Panel now displays parts in saved order on open
  - Preserved order when adding/removing parts
  - Fixed `useEffect` hooks to maintain order instead of resetting to `Object.keys()`

- **Viewport Persistence**: Fixed zoom and pan changes not being saved
  - Added `onMoveEnd` handler to ReactFlow component
  - Debounced saves (500ms) to avoid excessive file writes
  - Checks for loading/reloading states to avoid unnecessary saves

- **Edge Selection and Deletion**: Significantly improved edge interaction and deletion reliability
  - Wider clickable area (20px invisible stroke) for easier edge selection
  - Visual feedback: selected edges show amber/orange glow, hovered edges show blue glow
  - Fixed Delete/Backspace key support for edge deletion
  - Added explicit `deletable: true` property to all edges (manual, auto-mapped, and loaded)
  - Fixed deletion of redirected edges (when handles are collapsed)
  - Proper ID mapping for redirected edges ensures deletion works in all scenarios

- **Duplicate Edge Prevention**: Prevents invalid and duplicate connections
  - Blocks exact duplicate edges (same source handle to same target handle)
  - Enforces single-input rule: each target handle can only accept one incoming connection
  - Clear error messages in console when attempting invalid connections
  - Source handles can still connect to multiple targets (one-to-many broadcast)

### Changed

- **Mapper Type System**: Enhanced `SchemaParts` interface to support part ordering
  - Added optional `sourceOrder?: string[]` field to track source part order
  - Added optional `targetOrder?: string[]` field to track target part order
  - Order arrays stored in and loaded from `.map.json` files
  - Backward compatible: existing files without order arrays continue to work

- **Schema Building Functions**: Updated all schema building functions to accept and use order parameters
  - `buildCompositeSchemaFromParts()` in MapperCanvas
  - `buildCompositeSchema()` in mapperAdapter
  - `generateJSONata()` and `generateJSONataFromIR()` with targetOrder
  - `generateCSharp()` and `generateCSharpFromIR()` with targetOrder
  - Order applied consistently across initialization, updates, and code generation

- **Part Manager Panel UI**: Enhanced user experience with staging workflow
  - "Apply Changes" button now appears for any pending changes (parts, schemas, or order)
  - "Discard Changes" button resets all pending changes including order
  - Visual indicators show pending changes with orange badges
  - Changes only applied when user explicitly confirms

- **Edge Interaction**: Enhanced edge selection and visual clarity
  - Cursor changes to pointer when hovering over edges
  - Selected edges display with thicker stroke (4px) and orange glow effect
  - Hover effect shows blue glow to indicate clickability
  - Selection styles work consistently in both light and dark themes
  - Delete/Backspace keys now properly remove selected edges

- **Component Discovery**: ComponentResolver now searches for component folders anywhere in workspace
  - Searches for `Schemas`, `Tasks`, `Views`, etc. folders recursively (`**/Schemas/**`)
  - Finds components in nested project structures and monorepos
  - Deduplicates components when found in multiple locations
  - Supports maximum search depth of 5 levels for performance

### Known Issues

- **Mapper Editor - Multiple Tabs**: VS Code's Preview Mode affects mapper editor tabs
  - When single-clicking mapper files in the file explorer, they open in preview mode (tab title in *italics*)
  - Preview tabs are temporary and get replaced when clicking another file
  - This causes the first mapper tab to close when opening a second mapper
  - **Workarounds:**
    1. **Double-click** files to open as permanent tabs (recommended)
    2. Disable preview mode globally: Add `"workbench.editor.enablePreview": false` to VS Code settings
    3. Pin tabs manually after opening (right-click tab → "Keep Open" or make an edit)
  - This is VS Code's default behavior, not a bug in the extension

## [1.2.1] - 2025-11-06

### Fixed

- **Functoid Palette UI**: Fixed horizontal scrollbar issue and improved palette usability
  - Increased palette width from 100px to 140px to prevent horizontal scrollbar
  - Fixed light scrollbar styling using programmatic style injection
  - Resolved scrollbar color issues that appeared dark in some environments

- **Schema Node Handle Positioning**: Significantly improved handle positioning and edge connection reliability
  - Positioned handles at the outer edges of schema nodes for better visual clarity
  - Fixed handle visibility issues with proper z-index management
  - Adjusted handle positioning to account for tree indentation at all depth levels (0-5)
  - Added special handling for items with expand/collapse chevrons
  - Fixed array item positioning that appeared at wrong indentation levels
  - Resolved issues with root level empty objects not displaying handles
  - Fixed edge connection gaps for free-form objects at root level
  - Improved hover state positioning for all depth levels

### Changed

- **Schema Tree Node Rendering**: Enhanced tree node display and interaction
  - Empty objects (free-form) now properly display handles for edge connections
  - Improved CSS specificity for reliable handle positioning across different node types
  - Better visual hierarchy with consistent indentation and handle alignment

### Added

- **Schema Property Editing**: Added ability to edit and rename user-added properties
  - Right-click context menu now includes "Edit Property" option for user-added properties
  - Edit modal allows renaming properties and changing their schema types
  - Proper path handling preserves synthetic notation for variant-specific properties
  - Modal reuses the same AddPropertyModal component in edit mode

## [1.2.0] - 2025-11-05

### Added

- **cSpell Auto-Configuration**: Extension now automatically configures cSpell for user projects
  - Adds Turkish workflow labels to spell checker dictionary on activation
  - Configures regex patterns to ignore label and language fields in JSON files
  - Updates workspace settings to prevent false positives on multilingual content
  - Works with any project that has the extension installed

### Fixed

- **JSON Schema Validation**: Fixed schema loading to use extension-bundled schemas instead of looking in project directories
  - Schemas are now registered programmatically using the extension's path
  - Removed $schema property from newly created workflow files to avoid path issues
  - Resolves "Schema not found" errors when opening workflow files
  - Works correctly regardless of project structure

### Changed

- **Spell Check Configuration**: Fixed cSpell configuration for multilingual workflow support
  - Applied regex patterns to all .json files (workflow files are regular .json, not .flow.json)
  - Simplified file-specific overrides to match actual workflow file patterns
  - Added common Turkish workflow labels to the dictionary (Başlat, Onayla, İptal, etc.)
  - Ignores "label", "language" fields and entire "labels" arrays in JSON files
  - Prevents false positives while maintaining spell checking for code and comments

- **Workflow Validation**: Initial state is no longer required for workflows
  - Removed error for missing initial state from ModelValidator
  - Workflows can now be started using only startTransition without an initial state
  - Final state warning remains but is not an error

## [1.1.14] - 2025-11-05

### Fixed

- **Start Transition Editing**: Start transitions are now fully editable with complete feature parity with normal transitions
  - Added property panel support for start transition when clicked
  - Added execution tasks, rules, schema, and view sections
  - Aligned UI to be identical with normal transitions
- **Diagram File Persistence**: Diagram files now correctly save to `.meta` subdirectory alongside workflow files
- **Performance**: Optimized file watchers to prevent unnecessary component rescanning when saving files
- **JSON Schema Validation**: Fixed JSON validation configuration to use relative paths for schema files
- **Sample Tasks in Empty Projects**: Removed hardcoded sample tasks from toolbar when no tasks exist in project
  - ServiceTaskVariantProvider now returns empty array instead of default variants
- **CI/CD Workflow**: Fixed YAML syntax error in release notes extraction

### Added

- **Release Workflow Documentation**: Added RELEASE_WORKFLOW.md and changelog update script
- **Automated Release Notes**: GitHub releases now include content from CHANGELOG.md

## [1.1.0-alpha.0] - 2025-10-24

### ⚠️ Alpha Release

This is an alpha release of the Amorphie Mapper feature. The implementation is complete but may contain bugs. We welcome feedback and testing from early adopters.

### Added

#### 🎨 **Amorphie Mapper** - Visual JSON-to-JSON Transformation Editor

A new BizTalk-style mapper for building complex JSON transformations without writing code. The mapper provides a visual canvas with schema-aware field discovery and a comprehensive functoid library.

**Key Features:**

- **Visual 3-Panel Interface**
  - Source schema tree (left panel) with collapsible nodes
  - React Flow canvas (center) for mapping logic
  - Target schema tree (right panel) with real-time validation
  - Drag-and-drop connections between source and target fields

- **Schema Management**
  - **Automatic Schema Inference**: Paste example JSON to generate JSON Schema automatically
  - **Direct Schema Input**: Paste existing JSON Schema definitions
  - **File References**: Link to external schema files
  - **Schema Editing**: Add, edit, and remove properties on free-form objects
  - **Format Detection**: Automatic detection of dates, emails, UUIDs, and other formats
  - **Type Constraints**: Configurable string length, number ranges, and required fields

- **40+ Functoid Library** organized by category:
  - 🔢 **Math**: Add, Subtract, Multiply, Divide, Round, Abs, Min, Max, Power, Sqrt
  - 📝 **String**: Concat, Substring, Replace, Split, Join, Upper, Lower, Trim, Length, Regex
  - 🔀 **Logical**: And, Or, Not, Equal, NotEqual, GreaterThan, LessThan, IsNull
  - ❓ **Conditional**: IfElse, Switch, Coalesce, DefaultValue
  - 📦 **Collection**: Map, Filter, ForEach, Flatten, Distinct, Sort, Reverse
  - ∑ **Aggregate**: Sum, Count, Average, GroupBy, Reduce
  - 🔄 **Conversion**: ToString, ToNumber, ParseJSON, FormatJSON, Base64Encode/Decode
  - 📅 **Date/Time**: Now, FormatDate, ParseDate, AddDays, DateDiff
  - ⚙️ **Custom**: JSONata expression support for advanced transformations

- **Code Generation**
  - **JSONata Output**: Generates executable JSONata expressions from visual mappings
  - **C# Preview**: View equivalent C# transformation code
  - **Export to Files**: Save generated code to project files
  - **Optimization**: Automatic expression simplification and constant folding

- **Execution Preview Panel**
  - **Live Testing**: Execute transformations with sample input data
  - **Side-by-Side View**: Compare input JSON with output JSON
  - **Error Handling**: Clear error messages with line numbers
  - **Copy Output**: One-click copy of transformation results
  - **Example Data**: Pre-loaded Order → Invoice example for quick testing

- **Canvas Interactions**
  - **Drag-and-Drop**: Add functoids from palette to canvas
  - **Auto-Layout**: ELK-based automatic graph layout
  - **Mini-Map**: Navigate large mappings with minimap overview
  - **Zoom Controls**: Pan, zoom, and fit-to-screen
  - **Edge Validation**: Real-time type compatibility checking
  - **Undo/Redo**: Full history support for mapping changes

- **VS Code Integration**
  - **Custom Editor**: Native VS Code experience for `*.mapper.json` files
  - **Context Menu**: "Open in Amorphie Mapper" for mapper files
  - **Command Palette**:
    - `New Amorphie Mapper` - Create new mapper from folder
    - `Open in Amorphie Mapper` - Open existing mapper file
  - **File Conventions**:
    - `*.mapper.json` - Mapper definition (domain model)
    - `*.mapper.diagram.json` - Layout data (UI state, optional)
    - Tests stored in adjacent `tests/` directory

- **Advanced Features**
  - **Polymorphic Schema Support**: Handle oneOf/anyOf with discriminators
  - **Free-Form Objects**: Extend schemas with custom properties at runtime
  - **User-Added Properties**: Visual badges for custom schema extensions
  - **Collapsed Parent Handles**: Connect to collapsed nodes for cleaner layouts
  - **Schema File References**: Link to external JSON Schema files

**Example Use Case:**

Transform e-commerce orders to invoices with complex logic:

- Map customer data (`order.customer.name` → `invoice.customerName`)
- Transform arrays (`order.items[]` → `invoice.lineItems[]`)
- Calculate totals with aggregate functoids (Sum, GroupBy)
- Apply conditional logic (payment terms based on customer type)
- Format dates (`order.orderDate` → `invoice.invoiceDate`)

**Documentation:**

See [`mapper_spec.md`](./mapper_spec.md) and [`docs/mapper/`](./docs/mapper/) for complete specification:

- [Architecture](./docs/mapper/01-architecture.md)
- [UI Design](./docs/mapper/07-ui-design.md)
- [Functoid Library](./docs/mapper/08-functoid-library.md)
- [Complete Example: Order → Invoice](./docs/mapper/15-example-order-invoice.md)

### Fixed

- **VS Code Webview Compatibility**: Fixed CSS preload error by configuring Vite to use relative paths instead of absolute paths
  - Updated `vite.config.ts` to use `base: './'` for proper webview URI resolution
  - Added manifest generation (`manifest: true`) for asset mapping
  - Updated `MapperEditorProvider.ts` to correctly replace relative paths (`./`) with webview URIs
  - Webviews now load all assets correctly without localhost references

### Changed

- **Build Configuration**
  - Disabled Vite module preload polyfill to prevent CSP issues in VS Code webviews
  - Added CommonJS optimization for `@amorphie-flow-studio/core` package
  - Webview assets now use relative paths for proper VS Code webview URI mapping

### Improved

- **Code Quality**: Fixed all ESLint errors (30 errors → 0 errors)
  - Applied `prefer-const` rule across codebase (2 fixes)
  - Removed unused variables and imports (11 fixes)
  - Wrapped case block declarations in braces (2 fixes)
  - Escaped HTML entities in JSX (2 fixes)
  - Removed unused catch parameters (3 fixes)
  - Prefixed intentionally unused variables with `_` for clarity

- **CI/CD Reliability**
  - GitHub Actions workflow now passes all lint checks
  - Build verification confirmed: all packages compile successfully
  - TypeScript compilation clean (no type errors)

### Technical Details

**Packages:**

- `packages/core`: Mapper engine, functoid registry, schema inference, JSONata/C# code generation
- `packages/webview`: React Flow-based visual mapper UI with schema inference dialog
- `packages/extension`: VS Code custom editor provider for `*.mapper.json` files

**Key Files:**

- `packages/core/src/mapper/` - Mapper engine implementation
  - `registry.ts` - 40+ functoid definitions and search
  - `adapter.ts` - Schema flattening and tree building
  - `inferSchema.ts` - JSON → JSON Schema inference engine
  - `lower.ts` - AST lowering and optimization passes
  - `generateJSONata.ts` - JSONata code generation
  - `generateCSharp.ts` - C# code generation

- `packages/webview/src/mapper/` - React components
  - `MapperCanvas.tsx` - Main canvas with React Flow
  - `SchemaInferenceDialog.tsx` - 3-mode schema import (infer/paste/file)
  - `ExecutionPreviewPanel.tsx` - Live transformation testing
  - `FunctoidPalette.tsx` - Draggable functoid library
  - `SchemaTreeNode.tsx` - Recursive tree with context menus

- `packages/extension/src/mapper/` - VS Code integration
  - `MapperEditorProvider.ts` - Custom editor provider with webview

## [1.0.0] - 2025-01-15

### Added

- Initial release of Amorphie Flow Studio
- Visual workflow editor with React Flow canvas
- Enhanced IntelliSense for C# code completion
- Schema validation with AJV
- Custom linting and diagnostics
- Git-native asset management
- Deterministic builds with lock files

---

**Legend:**

- 🎨 Visual/UI features
- 🔢 Math/calculation features
- 📝 Text/string features
- 🔀 Logic/flow features
- 📦 Collection features
- ∑ Aggregation features
- 🔄 Conversion features
- 📅 Date/time features
- ⚙️ Configuration/system features
