# Changelog

All notable changes to the Amorphie Flow Studio extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
