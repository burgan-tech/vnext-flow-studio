# Changelog

All notable changes to the Amorphie Flow Studio extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **vNext Tools Sidebar**: New Activity Bar panel for project-level vnext-template tools
  - **Create New Project**: Scaffold new vnext-template projects via `npx @burgan-tech/vnext-template`
    - Prompts for domain name with validation
    - Folder picker for project location
    - Option to open in new window, current window, or stay in current workspace
  - **Project Detection**: Automatically detects vnext-template projects via `vnext.config.json` or package.json scripts
    - File system watcher for real-time detection
    - Window focus listener for immediate updates after folder operations
  - **Project Status Display**: Shows domain name, runtime version, schema version, and available scripts
  - **Validate Project**: Run `npm run validate` to check project structure and schemas
  - **Build Project**: Run `npm run build` with options for runtime, reference, or both package types
  - **Initialize Domain**: Run `npm run setup` for domain initialization
  - **Command Palette Integration**: All tools available via `Amorphie:` prefixed commands
  - **Output Channel**: Dedicated "vNext Tools" output channel for command results

- **Undo/Redo Functionality**: Added undo and redo support for workflow structure changes
  - Press `Cmd+Z` (Mac) or `Ctrl+Z` (Windows) to undo
  - Press `Cmd+Shift+Z` or `Cmd+Y` to redo
  - Tracks all workflow mutations: add/remove/update states, transitions, shared transitions, workflow settings
  - Maximum 50 undo steps stored per workflow
  - History is cleared when the panel is closed
  - Undo/redo properly updates the linter to reflect the restored state

### Fixed

- **Editor Hang on Open**: Fixed potential hang when opening workflow editor
  - Added missing `await` in model change event handler that could cause silent failures
  - Added 30-second webview ready timeout before sending init data
  - Prevents race conditions where init message was sent before webview was ready

- **Transition Mapping Editor Blackout**: Fixed `ReferenceError: availableMappers is not defined` that caused the editor to black out when editing transition mappings
  - Added missing `availableMappers` variable definition from `catalogs.mapper` in `TransitionMappingPopup.tsx`

- **State Creation - stateSubType Removed**: Removed deprecated `stateSubType` field from being set when creating new states via drag-and-drop
  - Final states no longer get `stateSubType = 1` automatically
  - stateSubType is a runtime concern and should not be set at design time
  - Removed stateSubType badge from node rendering (not needed at design time)

- **State Creation - xProfile Removed**: Removed deprecated `xProfile` field from state creation
  - Plugin states no longer set `xProfile` when using `plugin.createState()` or fallback creation
  - State type conversion no longer copies `xProfile` from source state
  - xProfile is still filtered out during deployment for backward compatibility with existing workflows

- **Dependencies Panel - Task Validation**: Fixed task references with `ref` paths being incorrectly reported as missing
  - Ref-style references (e.g., `./Tasks/mytask.json`) are now resolved relative to the workflow file directory instead of workspace root
  - Key-style references continue to use ComponentResolver with search paths

- **Task Reference Format**: Fixed task references being saved with malformed `ref` string format
  - **Before (wrong)**: `{ "ref": "core/sys-tasks/create-bank-account@1.0.0" }`
  - **After (correct)**: `{ "key": "create-bank-account", "domain": "core", "flow": "sys-tasks", "version": "1.0.0" }`
  - Tasks selected from catalog now use proper structured key/domain/flow/version format
  - Manual file path entry still uses `ref` field for backward compatibility

- **ComponentResolver - Flow-Based Patterns**: Added flow-based search patterns for finding tasks with `flow` field
  - Searches for tasks in paths like `Tasks/sys-tasks/create-bank-account.json` and `sys-tasks/create-bank-account.json`
  - Fixes "Could not find Task" errors for tasks that use the `flow` field as a subfolder path

- **Workflow Test Service - Transition Data Wrapping**: Fixed `executeTransition` to wrap transition data in `attributes` field
  - Now matches the same pattern used in `startInstance` for API compatibility
  - Platform expects input data wrapped in `{ attributes: data }` format

### Added
- **Set as Cancel Target**: Context menu option to configure workflow cancel transition
  - Right-click any state and select "Set as Cancel Target" to designate it as the cancel destination
  - Visual indicator (red ✕ badge and red dashed border) shows the current cancel target state
  - Creates `workflow.attributes.cancel` with proper CancelTransition structure
  - Linter recognizes cancel targets as having incoming transitions (no false "no incoming transitions" warnings)

- **Transition Double-Click Smart Navigation**: Double-clicking on a transition edge now routes to the appropriate editor based on transition type
  - **Automatic transitions (triggerType 1)**:
    - If rule has a file location → Opens the rule file in VS Code editor (right panel)
    - If no rule or no file location → Opens the TransitionRuleEditPopup
  - **Manual transitions (triggerType 0)**: Opens the task editor popup
  - **Scheduled/Timer transitions (triggerType 2)**: Opens the timer configuration popup
    - **Note**: Schema now requires `timer.code` and `timer.location` (script-based timers), but runtime doesn't support this yet. Editor currently uses legacy `duration`/`reset` configuration until runtime implementation catches up.
  - **Event transitions (triggerType 3)**: Opens the task editor popup (same as manual)
  - Works for both local and shared transitions
  - Complements existing right-click context menu functionality
  - Terminology aligned with workflow-definition.schema.json

- **Workflow Test Runner Panel**: Interactive testing panel for executing workflows against runtime API
  - **Test Panel UI**: Side panel with workflow instance management and execution controls
    - Start new workflow instances with input data
    - Execute manual transitions with form-based or JSON input
    - View current instance state, available transitions, and instance data
    - Connect/disconnect from canvas for visual state highlighting during testing
    - Transition history with request/response tracking and status indicators
  - **API Integration**: Full workflow runtime API integration via WorkflowTestService
    - Instance creation with `/instances/start` endpoint
    - Transition execution with `/instances/{id}/transitions/{key}` endpoint and sync mode
    - State querying with `/functions/state` endpoint for transitions and data
    - Environment-based configuration with authentication support (bearer/basic)
    - Comprehensive error handling and API response parsing
  - **SubFlow Support**: Automatic detection and handling of SubFlow/SubProcess instances
    - Displays parent and subflow instance data separately
    - Automatically switches to subflow transitions when subflow activates
    - Shows subflow correlation metadata (type, domain, version, state)
    - Returns to parent transitions when subflow completes
    - Fetches and displays complete subflow instance data
  - **Test Case Management** (Backend): Infrastructure for saving and loading test cases
    - TestCaseManager class with full CRUD operations
    - Test cases stored per workflow in VS Code workspace state
    - Backend message handlers for save/load/delete operations
    - Timestamps for creation and last used tracking
    - **Note**: UI for test case management not yet implemented
  - **Canvas Integration**: Visual feedback during testing
    - Highlight executed states on the canvas during test runs
    - Show transition history path with color-coded indicators
    - Connect/disconnect toggle for on-demand visual feedback
    - Instance state highlighting synced with current test state
  - **Schema-Based Forms**: Auto-generated forms from transition schemas
    - See "Test Runner Form Generation" below for form features

### Fixed
- **Task Quick Editor Schema Alignment**: Updated task quick editor to support all task types defined in the schema
  - Added **Type 8 - Condition Task** (configuration details TBD)
  - Added **Type 9 - Timer Task** (configuration details TBD)
  - Added **Type 10 - Notification Task** with metadata configuration
  - Added **Type 11 - Trigger Task** with full support for subtypes:
    - Start: Start a new workflow instance
    - Trigger: Trigger an existing workflow
    - SubProcess: Execute a subprocess (with required key and version fields)
    - GetInstanceData: Retrieve instance data
  - Type 11 includes dynamic form fields that show/hide based on selected subtype
  - All new types properly integrated with field mapping, validation, and data collection

- **Shared Transitions Array Preservation**: The `sharedTransitions` array now remains in the workflow model even when all shared transitions are removed, preserving the empty array instead of deleting the property
  - Prevents model structure changes when the last shared transition is deleted or converted to a local transition
  - Maintains consistent workflow schema structure

- **Script Template Creation with Override Support**: Improved template creation flow with proper handling of existing files and bound scripts
  - **Override Dialog**: When a script is already bound and user clicks a template, shows dialog offering to "Override Existing File" or "Create New File"
  - **File Existence Checking**: Extension validates file existence and prevents accidental overwrites in all scenarios:
    - "Create New File" mode → rejects if filename already exists on disk
    - "Override" mode → allows overwriting the bound file
    - User can change filename in override dialog → automatically switches to create mode with file existence check
  - **Smart Mode Switching**: If user is in override mode but changes the filename, automatically switches to create mode to trigger file existence validation
  - **Optimistic Binding with Rollback**: Webview optimistically binds new script but automatically rolls back if extension returns error
  - **New Message Types**: Added `editor:createOrBindScript` with mode parameter ('create' | 'override') and `editor:scriptOperationResult` response
  - **Mode-Aware Dialogs**: SaveScriptDialog shows "Override" vs "Create" based on mode, with contextual warnings and help text
  - Fixes race condition where optimistic binding wasn't updated with newly created file reference
  - Ensures mode is set to 'code' when creating script from template

### Added
- **vnext.config.json Support**: Project-based configuration for component discovery
  - Created config loader with TypeScript types for vnext.config.json structure
  - Config-based directory discovery replacing glob-based searching
  - Finds project root by locating vnext.config.json in directory tree
  - Supports configurable component directories via `paths.componentsRoot` and component-specific paths
  - ModelBridge automatically detects and uses vnext.config.json when available
  - Falls back to glob-based discovery for projects without configuration file

- **Script File Watching**: Real-time monitoring and cache invalidation for script files
  - Watches .csx, .cs, .js, and .mapper.json files for changes
  - Automatic cache invalidation when scripts are added, changed, or deleted
  - Extended watch paths to include Scripts, scripts, and src directories
  - Emits scriptAdded, scriptChanged, scriptDeleted events
  - No VS Code restart needed when scripts change

- **Dependencies Panel**: New panel showing all workflow dependencies with validation
  - Tree view organized by state showing tasks, schemas, views, scripts, functions, and extensions
  - Visual validation indicators - red X icon for broken/missing dependencies
  - Click to open dependencies in VS Code
  - Compact monospace design matching schema editor
  - Automatic validation on panel load
  - Flexible width based on content
  - Enhanced ComponentResolver with dynamic directory discovery and dot-separated version support

- **Workflow Settings Panel**: Comprehensive tabbed panel for editing workflow-level properties
  - **General Tab**: Edit key, domain, version, and type configuration (C/F/S/P with subFlowType)
  - **Labels & Tags Tab**: Multi-language label editor with required languages (en-US, tr-TR) and tag management
  - **Timeout Tab**: Configure workflow timeout with state dropdown, ISO 8601 duration format, and presets
  - **Dependencies Tab**: Manage workflow-level functions, features, and extensions with component search
  - Timeout configuration automatically renders as a state node on the canvas
  - Real-time validation with immediate feedback on all fields
  - UI styling matches existing popup editors (StateLabelEditPopup, TimeoutConfigPopup)
  - Accessible from vertical toolbar Settings icon
  - Component search panel for intelligent dependency selection

- **Auto Layout Improvements**: Enhanced automatic layout algorithm
  - Direction options: RIGHT (default), DOWN, LEFT, UP
  - Accounts for edge label widths in layout calculations
  - Optimized spacing and node positioning
  - Better handling of complex workflow structures

- **Task Creation Modal** ([#22](https://github.com/burgan-tech/vnext-flow-studio/pull/22)): Webview-based task creation with direct Quick Editor opening
  - Create new tasks directly from task detail panel
  - Auto-populate task reference after creation
  - Auto-select newly created task in task reference field
  - Workflow domain and configurable version support
  - Tasks created with version in filename: `task-name.1.0.0.json`
  - Tasks created in closest sibling Tasks folder relative to workflow
  - Normalized task reference format: `{key, domain, version, flow}` instead of `{ref: "..."}`

- **Visual Diff Command**: New "Amorphie: Open Visual Diff" command for side-by-side visual comparison
  - Opens git HEAD and working tree in separate visual editor panels
  - Left panel shows committed version (read-only), right panel shows working tree (editable)
  - Accessible via command palette, context menu, and editor toolbar
  - Provides visual workflow comparison for users who prefer graphical diff

- **Clickable Task References**: Task references in task detail panel now clickable to open in Quick Editor

- **Schema File Viewer**: Added "Open Schema File" button to transition schema editor popup
  - Button appears when a schema is configured on a transition
  - Opens the schema JSON file in a new editor column to the right
  - Displays current schema as "domain/flow/key@version" format
  - Uses existing dependency:open infrastructure for file resolution
  - Helps users reference schema structure while editing transitions

- **ISubProcessMapping Support**: Added detection and template for subprocess mappings
  - ScriptManager now detects `ISubProcessMapping` interface in script analysis
  - Created subprocess mapping template with proper `InputHandler` structure
  - Added `ISubProcessMapping` to spell checker dictionary
  - Template accessible via `getTemplate('subprocess')` or `getTemplate('subprocessMapping')`
  - **Smart Mapper Filtering**: SubFlow configuration now filters available mappers by type
    - SubProcess (Type 'P'): Only shows scripts implementing `ISubProcessMapping`
    - SubFlow (Type 'S'): Shows scripts implementing `ISubFlowMapping` or `IMapping` (excludes `ISubProcessMapping`)
    - Automatically clears invalid mapping selection when type changes
    - Helpful hints displayed explaining which interface types are expected
    - Fixed double-filtering issue where MappingSection was re-filtering already filtered scripts

### Changed

- **Domain Configuration**: Domain is now exclusively configured in vnext.config.json (project-level) instead of environment settings
  - **BREAKING**: Removed `domain` field from `EnvironmentConfig` type
  - Environment settings no longer store domain - it's read from vnext.config.json
  - Deploy panel displays domain from vnext.config.json
  - Settings UI shows note that domain is configured in vnext.config.json
  - RuntimeAdapter API updated to accept domain as parameter (from vnext.config.json)
  - Environment validation no longer requires domain field
  - Deployment operations use project domain from vnext.config.json
  - Migration: Move domain from environment settings to vnext.config.json `domain` field

- **Design-Time Attribute Filter**: Added `_comment`, `stateSubType`, and `xProfile` to design-time attributes
  - `_comment` fields are now filtered out during deployment (editor-only inline comments)
  - `stateSubType` is filtered out during deployment (not used by runtime engine)
  - `xProfile` is filtered out during deployment (plugin identification, editor-only, backward compatibility for old flows)
  - These attributes remain in workflow files for editor use but are stripped before API deployment

### Removed

- **Service Task Plugin**: Removed specialized service task plugin and xProfile attribute system
  - Removed entire ServiceTask plugin (index.ts, lints.ts, variantProvider.ts)
  - Removed ServiceTask registration and activation from ModelBridge
  - Removed xProfile attribute from State and Workflow type definitions
  - Removed xProfile-based plugin detection logic from PluginManager
  - Removed xProfile checks from plugin deserialization hooks (Initial, Intermediate, Final, SubFlow, Wizard)
  - Removed ServiceTaskProperties UI component
  - Removed ServiceTask CSS styling rules from rf-theme.css
  - Removed ServiceTask class mappings from Canvas and PluggableStateNode components
  - Removed xProfile from design-time attribute filter
  - Removed WorkflowAttributesWithProfile interface
  - Removed test and example workflow files (test-service-task.flow.json, test-xprofile.flow.json, example-service-task.*)
  - Plugin system now relies solely on stateType and plugin-specific deserialization hooks for state identification
  - Simplified plugin architecture with cleaner separation of concerns

### Improved

- **Universal Lightweight Component Reloading**: Eliminated full component rescanning for ALL component types
  - **ALL component changes now use incremental updates** - no more full directory rescans
  - When ANY component file changes (task, schema, view, function, extension, script), only that component is reloaded
  - ComponentResolver cache automatically invalidated for changed components only
  - Lightweight messages sent to webview: `script:updated`, `component:updated`
  - **Before**: Saved 1 task → Rescanned all directories → Reloaded all 75 scripts + all tasks + all schemas + all views → Full catalog rebuild
  - **After**: Saved 1 task → Reloaded only that task → ComponentResolver cache updated → Next request gets fresh data
  - **Script optimization**: ScriptManager.reloadScript() + WorkflowModel.refreshScript() for single-script refresh
  - **Workflow save protection**: Auto-saved workflows skip reload (500ms window) to prevent reload loops
  - Reduces reload time from ~2 seconds to ~50ms for typical workflows
  - Console logs show `⚡ Lightweight [component type] update` for all component types

- **Embedded Script Content Auto-Update**: Workflow model files automatically update when referenced scripts change
  - When a script is saved, the workflow model searches for all references to that script
  - Automatically updates base64-encoded `code` fields in mappings and rules that reference the script
  - Searches all workflow locations: startTransition, sharedTransitions, state onEntries/onExits, transitions, subFlow mappings
  - WorkflowModel.updateEmbeddedScriptContent() method for precise base64 updates
  - Auto-save triggered after script content update (100ms delay)
  - **Path normalization**: Script paths normalized to be relative to workflow file (not project root) for accurate matching
  - **Smart reload prevention**: Skips full component rescan when workflow is auto-saved (prevents reload loop)
  - **Readonly display auto-refresh**: Script viewers in popups (SubFlowConfigPopup, TransitionMappingPopup, TaskDetailsPanel) automatically refresh when catalog updates
  - **Before**: Changed script → Needed to manually redeploy or run normalizer to update workflow model
  - **After**: Changed script → Workflow model auto-updates with new base64 content → Auto-saved to disk → Readonly displays refresh → No unnecessary rescans
  - Comprehensive logging for debugging: Shows original path, normalized path, workflow directory, and match results
  - Matches deployment normalizer behavior: same base64 encoding, same search patterns, same relative path resolution

- **Test Runner Form Generation**: Enhanced JSON Schema form rendering with industry-standard library
  - Replaced custom form generator with React JSON Schema Form (@rjsf/core)
  - Added full support for JSON Schema keywords: `oneOf`, `anyOf`, `enum`, `const`, `pattern`, `minLength`, `maxLength`
  - Integrated @faker-js/faker for realistic test data generation
  - Semantic field-based test data: email fields generate valid emails, names generate realistic names, etc.
  - Fields with `const` values are pre-populated and marked read-only to prevent user modification
  - Fixed regex pattern anchor stripping (^...$) for clean generated values
  - Custom CSS styling matching original clean design aesthetic
  - Enhanced form validation with HTML5 pattern attributes
  - **Pattern Validation with Retry Logic**: Intelligent regex pattern matching with fallback
    - Attempts up to 5 generations per pattern field to match regex requirements
    - Validates each generated value against the pattern before accepting
    - Falls back to simple generation if all retry attempts fail
    - Detailed console logging for debugging pattern generation issues
  - **Editable JSON View**: Manual JSON editing with apply-on-demand workflow
    - Uncontrolled textarea allows free editing without React interference
    - "Apply JSON Changes" button syncs JSON edits to form fields
    - Real-time error display for invalid JSON syntax
    - Two-way sync: edit form OR JSON, both stay in sync after apply
  - **SubFlow Data Display**: Enhanced instance data viewer for subflows
    - Separate panels for parent instance data and subflow instance data
    - SubFlow correlation info showing subflow metadata (type, domain, version, state)
    - Fetches and displays complete subflow instance data when subflow is active
    - Automatic data refresh when transitioning between parent and subflow states
  - **Form Data Management**: Robust state handling for schema-based forms
    - Fixed race conditions between form initialization and data reset
    - SchemaFormGenerator properly initializes with generated test data
    - Form data correctly submitted for transitions with schemas
    - No-schema transitions use JSON editor with empty object initialization

### Fixed

- **Task Open Button**: Fixed "Open Task" button in task details panel to properly open referenced tasks in Quick Task Editor
  - Added `__filePath` property attachment in all three component resolution paths (`resolveExplicitRef`, `resolveRefPath`, `searchForComponent`)
  - Previously, file path was only set in one resolution path, causing button to fail depending on how task was resolved
  - Now consistently opens tasks regardless of reference format (ref-style, explicit reference, or pattern-based search)

- **Message Handler Registration for Subflow Panels**: Fixed message handling in subflow editor panels opened via navigate:subflow
  - Subflow panels now properly register message handlers for all message types (task:open, domain:*, etc.)
  - Previously, only a temporary 'ready' message handler was registered, which disposed itself immediately
  - All subsequent messages to subflow panels were silently dropped, breaking features like task opening
  - Now uses same message handler registration pattern as main workflow panels

- **Diagnostic Links to Canvas**: Fixed validation error links to navigate to correct canvas elements
  - Updated to use `error.location` field directly as ownerId instead of extracting from `error.path`
  - Diagnostic links now correctly jump to the appropriate state/component when clicked in Problems panel
  - Improved fallback logic for positioning when JSON path is not available

- **Component Catalog Architecture Refactoring**: Eliminated redundant component data copying for improved performance and reliability
  - Removed duplicate storage of components in both global resolver cache and model state
  - Model now reads directly from ComponentResolver cache (single source of truth)
  - `ModelValidator` and `WorkflowModel.validate()` now access catalogs via `getComponentResolver()` method
  - Removed ~30 lines of copying code and eliminated need for redundant second `model.load()` call
  - Fixes synchronization issues where linter saw different component counts than UI
  - Reduces memory usage and simplifies architecture

- **Workflow Loading Timeout Protection**: Added 30-second timeout protection for workflow loading operations
  - Prevents indefinite hangs when filesystem operations are slow or unresponsive
  - Uses `Promise.race()` to timeout model loading and component preloading
  - Shows clear error message when timeout occurs
  - Fixes intermittent "Loading workflow..." hangs on slow filesystems

- **Empty Workflows List in SubFlow Configuration**: Fixed catalog access to use correct ComponentResolver method
  - Changed from non-existent `this.globalResolver?.['cache']` to proper `getCachedComponents()` method
  - SubFlow configuration popup now correctly displays available workflows for selection
  - Fixed intermittent empty workflows list issue

- **SubFlow/SubProcess Mapping Interface Enforcement**: Fixed mapping script selection to enforce strict interface requirements
  - SubFlow (type 'S') now only shows scripts implementing `ISubFlowMapping` interface (strict filtering)
  - SubProcess (type 'P') continues to only show scripts implementing `ISubProcessMapping` interface
  - Removed generic `IMapping` scripts from SubFlow configuration - these are not valid for runtime execution
  - Created new `ISubFlowMapping` template with both `InputHandler` and `OutputHandler` methods
  - Added `ISubFlowMapping` template to ScriptManager's `getTemplate()` method (accessible via 'subflow' or 'subflowMapping')
  - Updated MappingSection to hide Quick Templates when used in SubFlow/SubProcess context (interfaceType='none')
  - Updated help text in SubFlowConfigPopup to accurately reflect strict interface requirements
  - Ensures runtime compatibility - only valid mapping interfaces can be configured

- **Workflow Settings Panel UI**: Enhanced user experience with multiple improvements
  - Right-aligned Cancel and Apply buttons (renamed from "Save" to "Apply")
  - Cancel button now properly closes the panel after discarding changes
  - Apply button automatically closes panel after successful save with validation
  - Dirty indicator displays on the left side of button group

- **Global Component Catalog Sharing**: Fixed component discovery inconsistency across workflow files
  - All workflows in the same workspace now share the global component catalog
  - Previously, each workflow only saw components discovered relative to its own directory location
  - `getCatalogsFromModel()` now uses `globalResolver` cache for workspace-wide component discovery
  - Fixes issue where schemas, tasks, views, functions, and extensions weren't visible in all workflow files
  - Solves "model manager not shared across tabs" problem

- **Schema Editor Dropdown**: Increased schema display limit from 20 to 100 items
  - Users can now see more schemas without needing to search
  - Applies to both initial display and search results

- **SubFlow Configuration Popup**: Fixed positioning to center in canvas
  - Changed popup structure from siblings to proper parent-child relationship
  - Overlay now properly contains and centers the popup modal
  - Previously displayed in top-right corner instead of centered

- **Click-Outside-to-Close**: Enhanced all popups and panels with smart click-outside behavior
  - Added conditional transparent backdrop to FlyoutPanel for reliable click-outside detection
  - Backdrop only renders when `closeOnClickOutside={true}` (default)
  - Deploy & Run, Workflow Settings, and Dependencies panels now close when clicking outside
  - States panel excluded from click-outside behavior (`closeOnClickOutside={false}`) to preserve drag-and-drop functionality
  - Backdrop intercepts ReactFlow's mousedown events, solving issue where canvas prevented click-outside detection
  - All modal popups already supported click-outside-to-close
  - Added debug logging to track drag & drop event flow for future troubleshooting

- **SubFlow Configuration Popup**: Fixed subflow selection not showing SubFlow/SubProcess workflows
  - WorkflowSearchPanel now receives filtered `subflowWorkflows` list instead of all workflows
  - Only workflows with type 'S' (SubFlow) or 'P' (SubProcess) are displayed in the workflow selector
  - Previously, the filtering logic existed but wasn't being used when rendering the search panel
  - Wrapped filter logic in `useMemo` for proper memoization and added enhanced debug logging
  - Console logs now show which workflows are being filtered out and their types for debugging

- **Workflow Template**: Fixed new workflow template generation issues
  - Removed `stateSubType` field from final state (runtime doesn't support it yet)
  - Changed subflow transition from auto (triggerType: 1) to manual (triggerType: 0)
  - Auto transitions require rules; manual transitions are simpler for templates
  - Updated language codes to use country codes (en-US, tr-TR) instead of just language (en)
  - All states and transitions include bilingual labels (English and Turkish) by default

- **Start Transition Editing**: Fixed task and schema editors for start transitions
  - Task editor popup now opens and displays tasks when clicking "Edit Tasks" on start transitions
  - Task changes are now properly saved to the workflow model via `domain:updateStartTransition` message
  - Schema editor button now appears in context menu for start transitions regardless of trigger type
  - Removed redundant `supportsSchema` check in TransitionToolbar that was hiding schema button
  - Schema popup correctly retrieves and displays schema from `workflow.attributes.startTransition`
  - Added safety check to ensure startTransition exists before accessing its properties
  - Start transitions now have full feature parity with local and shared transitions for task and schema editing

- **Dependencies Panel View Display**: Fixed view dependencies not showing in dependencies panel
  - Panel now handles nested view configuration structure `{ view: {...}, loadData, extensions }`
  - Correctly extracts view references from both state views and transition views
  - Views now display with proper icon, key, domain, version, and context information
  - Works with both direct ViewRef and nested view config formats

- **Deployment View Resolution**: Fixed view component resolution during workflow deployment normalization
  - Added component preloading before normalization to populate ComponentResolver cache
  - DeploymentService now finds project root via vnext.config.json and sets correct basePath
  - Cache is cleared and reloaded when deploying workflows from different projects
  - Fixed ReferenceResolver to handle nested view configuration structure `{ view: {...}, loadData, extensions }`
  - Fixed DeploymentValidator to validate inner view reference in nested configurations
  - Both direct ViewRef and nested view config formats now supported in normalization and validation
  - Resolves "Reference missing or unresolved" errors for view components during deployment

- **Component Cache Persistence**: Fixed issue where catalog lists would become empty after file changes
  - ComponentWatcher was clearing entire cache when a single file changed
  - Now only invalidates the specific changed/deleted component
  - Preserves all other components in cache, preventing empty dropdowns
  - File additions and changes no longer trigger full cache clear

- **Content-Based Component Type Detection**: ComponentWatcher now uses authoritative metadata
  - Component types determined by reading the `flow` field from JSON content
  - Maps flow values to component types (sys-tasks → Task, sys-schemas → Schema, etc.)
  - Warns when directory location doesn't match component content type
  - Falls back to directory-based detection only when content can't be read
  - Fixes incorrect type detection when components are placed in non-standard directories

- **Git Diff Support** ([#18](https://github.com/burgan-tech/vnext-flow-studio/issues/18)): Fixed git "Open Changes" to show text diff by default
  - Changed custom editor priority from "default" to "option" - text editor is now the default for workflow files
  - Fixed diagram loading from git commits (supports both `.flow.json` and `.diagram.json` from same commit)
  - Git panel changes now show proper text diff with JSON comparison
  - Fixed read-only enforcement for git URIs (prevents editing committed versions)
  - Separate model instances for git vs. working tree (enables future visual diff overlays)

- **Task Creation Improvements**: Fixed task creation location and format
  - Tasks now correctly created in sibling Tasks folder relative to workflow
  - Uses workflow path from model instead of activeEditor (fixes webview context issue)
  - Task references saved in normalized format with key, domain, version, flow fields

- **Task Editor Fixes** ([#22](https://github.com/burgan-tech/vnext-flow-studio/pull/22)):
  - Keep flow editor open when creating new task
  - Use correct Quick Task Editor view type when opening tasks
  - Parse task reference correctly when opening tasks
  - Improve task resolution by passing complete task info
  - Clear task reference field when adding new empty task
  - Prevent duplicate task display in search panel
  - Set flowVersion to 1.0.0 for sys-tasks model

- **Edge Label Comment Icons**: Fixed clickability and visibility
  - Comment icons now properly clickable
  - Improved icon visibility on edge labels
  - Prevent edge label clicks from triggering edit key popup
  - Disable pointer events on SVG to ensure button receives clicks

- **Code Quality**: Linting fixes across codebase
  - Fixed React Hook dependencies in DependenciesPanel and TaskDetailsPanel
  - Replaced require() with ES6 imports
  - Removed unused parameters and variables
  - Escaped special characters in JSX

- **Component Resolution**: Eliminated redundant component loading
  - Share global ComponentResolver across all models
  - Improved performance by reducing duplicate file system operations

### Changed
- **SubFlow Configuration Simplified**: Changed to single mapping attribute
  - Removed separate `inputMapping` and `outputMapping` properties from `SubFlowConfig`
  - Now uses single required `mapping: Mapping` field that matches JSON schema specification
  - Updated `SubFlowConfigPopup` to use unified "Mapping" tab instead of separate "Input Mapping" tab
  - Breaking change: Existing code using `inputMapping`/`outputMapping` needs to migrate to `mapping`

- **SubFlow/SubProcess Execution Behavior Documentation**: Clarified blocking vs. parallel execution
  - **SubFlow (Type 'S')**: Creates separate instance and blocks parent until completion (synchronous)
  - **SubProcess (Type 'P')**: Creates separate instance and runs in parallel without blocking (asynchronous)
  - Updated UI descriptions in SubFlow configuration popup
  - Added TypeScript documentation to `SubFlowConfig` interface
  - Enhanced subprocess mapping template with execution behavior comments

- **Code Architecture Refactoring**: Comprehensive refactoring to eliminate duplication and improve maintainability
  - **Centralized Configuration** (~92 lines of duplicate code removed):
    - Exported DEFAULT_COMPONENT_SEARCH_PATHS from ComponentResolver
    - Created shared filesystem utilities (findJsonFiles, scanJsonFiles, findDirectories)
    - Updated LocalGraphBuilder to use shared constants and utilities
  - **Resolver Lifecycle Management** (prevents memory leaks):
    - Created ComponentResolverManager singleton for centralized resolver management
    - Provides getOrCreateGlobalResolver() for shared workspace resolvers
    - Provides createIsolatedResolver() for temporary resolvers
    - Added lifecycle callbacks: onCacheInvalidated, onError, onDispose
    - Updated ModelBridge and MapperEditorProvider to use manager pattern
    - Added proper disposal in extension deactivation
  - **Unified Reference Normalization** (~155 lines of duplicate code removed):
    - Created reference-normalizer.ts with unified normalization logic
    - Handles all reference formats: structured refs, ref-style strings, file paths
    - Supports optional resolver for content validation
    - Added normalizeWorkflowReferences() for deep workflow traversal
    - Updated LocalGraphBuilder to use shared normalization with caching
  - **Net Impact**: ~247 lines of duplicate code eliminated, improved maintainability, reduced memory footprint

- **Default Editor Behavior**: Text editor is now the default for workflow files
  - Users can still access visual editor via "Open With..." → "Amorphie Flow Studio"
  - "Amorphie: Open Workflow" command continues to open visual editor directly
  - Improved developer experience with standard git diff workflows

## [2.2.0] - 2025-11-17

### Added
- **Schema Editing for Start Transitions**: Start transitions now support full schema configuration
  - Schema editor popup accessible from start transition edge
  - Allows defining input validation for workflow initialization
  - Consistent with regular transition schema editing experience

## [2.1.9] - 2025-11-16

### Added
- **Workflow Settings Panel Enhancements**: Comprehensive workflow-level configuration
  - Multi-tab interface for general settings, labels & tags, timeout, and dependencies
  - Multi-language label support with required languages (en-US, tr-TR)
  - Real-time validation and immediate feedback

### Improved
- **ComponentWatcher Refactoring**: Eliminated code duplication and improved maintainability
  - Unified normalization logic between LocalGraphBuilder and GraphDeployAdapter
  - Shared caching infrastructure for improved performance
  - Reduced memory footprint

### Fixed
- **Linting Errors**: Resolved unused variable warnings throughout codebase

## [2.0.0] - 2025-11-14

### Major Release - Complete Platform Modernization

This major release features a complete redesign of the canvas UI, advanced deployment system with dependency analysis, graph-based drift detection, and comprehensive schema enhancements.


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
