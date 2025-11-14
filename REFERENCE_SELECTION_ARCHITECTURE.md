# Reference Selection Architecture & UI Patterns

## Visual Architecture Diagram

```
WORKFLOW EDITOR
     │
     ├─► StateViewEditPopup
     │       │
     │       └─► ReferenceSelector
     │           ├─ label: "View Component"
     │           ├─ searchable: YES
     │           ├─ catalog: availableViews
     │           └─ output: ViewRef { key, domain, version, flow }
     │
     ├─► SubFlowConfigPopup
     │       │
     │       └─► ReferenceSelector
     │           ├─ label: "Process Reference"
     │           ├─ searchable: YES
     │           ├─ catalog: availableWorkflows
     │           └─ output: ProcessRef { key, domain, version, flow }
     │
     ├─► ServiceTaskProperties
     │       │
     │       └─► ExecutionTaskListEditor
     │           │
     │           ├─► Task 1
     │           │       └─► ReferenceSelector
     │           │           ├─ label: "Task"
     │           │           ├─ searchable: YES
     │           │           ├─ catalog: availableTasks
     │           │           └─ output: TaskRef { key, domain, version, flow }
     │           │
     │           ├─► Task 2
     │           │       └─► ReferenceSelector
     │           │           └─ ...
     │           │
     │           └─► [+ Add Task]
     │
     ├─► [Unused] SchemaEditor
     │       ├─ Mode selector: None | Ref | Full
     │       ├─ if Ref:
     │       │   ├─ Dropdown: availableSchemas
     │       │   └─ Text input: custom path
     │       └─ if Full:
     │           └─ 4 text inputs: key, domain, version, flow
     │
     ├─► [Unused] ViewEditor
     │       ├─ Mode selector: None | Ref | Full
     │       ├─ if Ref:
     │       │   ├─ Dropdown: availableViews
     │       │   └─ Text input: custom path
     │       └─ if Full:
     │           └─ 4 text inputs: key, domain, version, flow
     │
     ├─► [Unused] FunctionListEditor
     │       ├─ Add/Remove buttons
     │       ├─ For each function:
     │       │   ├─ Mode toggle: Ref | Full
     │       │   ├─ if Ref: Text input (path)
     │       │   └─ if Full: 4 text inputs (key, domain, flow, version)
     │       └─ Output: FunctionRef[] { ref } | { key, domain, flow, version }
     │
     └─► [Unused] ExtensionListEditor
         ├─ Add/Remove buttons
         ├─ For each extension:
         │   ├─ Mode toggle: Ref | Full
         │   ├─ if Ref: Text input (path)
         │   └─ if Full: 4 text inputs (key, domain, flow, version)
         └─ Output: ExtensionRef[] { ref } | { key, domain, flow, version }
```

## Reference Type Definitions

```typescript
// TaskRef - Task reference (used in ExecutionTask)
export type TaskRef = 
  | { ref: string }  // Path-based
  | { key: string; domain: string; version: string; flow: string };  // Full

// ViewRef - View component reference (used in State)
export type ViewRef = 
  | { ref: string }  // Path-based
  | { key: string; domain: string; version: string; flow: string };  // Full

// SchemaRef - Schema reference (used in State, Transition)
export type SchemaRef = 
  | { ref: string }  // Path-based
  | { key: string; domain: string; version: string; flow: string };  // Full

// ProcessRef - Process/Workflow reference (used in SubFlow)
export type ProcessRef = 
  { key: string; domain: string; version: string; flow: string };  // Full only

// FunctionRef - Function reference (used in Workflow)
export type FunctionRef = 
  | { ref: string }  // Path-based
  | { key: string; domain: string; version: string; flow: string };  // Full

// ExtensionRef - Extension reference (used in Workflow)
export type ExtensionRef = 
  | { ref: string }  // Path-based
  | { key: string; domain: string; version: string; flow: string };  // Full
```

## UI Pattern Comparison

### Pattern 1: Modern Search Dropdown (RECOMMENDED)
**Used by:** TaskRef, ProcessRef, ViewRef (StateViewEditPopup)
**File:** ReferenceSelector.tsx

Features:
- Real-time search filtering
- Multi-field matching (key, domain, title, tags)
- Dropdown with up to 20 results
- Visual selection indicator
- Clear button
- Detailed info panel
- Works with full catalog

Advantages:
- User-friendly for discovering options
- No manual typing required
- Consistent across reference types
- Supports large catalogs

Code:
```typescript
<ReferenceSelector
  label="Your Component"
  value={selectedRef}
  availableComponents={catalog}
  componentType="ComponentType"
  defaultFlow="sys-default"
  onChange={(ref) => handleChange(ref)}
  required={true}
  placeholder="Search..."
  helpText="Select from catalog"
/>
```

### Pattern 2: Mode Selector + Manual Input (LEGACY)
**Used by:** SchemaEditor, ViewEditor (unused)
**Files:** SchemaEditor.tsx, ViewEditor.tsx

Features:
- Three modes: None, Reference (path), Full Reference
- Mode dropdown selector
- For path mode: predefined dropdown + manual fallback
- For full mode: four text input fields
- Version pattern validation

Disadvantages:
- Three different UIs for one component
- No search integration
- Requires users to know reference format
- Limited discovery of available options

Code:
```typescript
<select value={mode}>
  <option value="none">None</option>
  <option value="ref">Reference (by path)</option>
  <option value="full">Full Reference</option>
</select>

{mode === 'ref' && (
  <>
    <select>{availableOptions}</select>
    <input placeholder="custom path" />
  </>
)}

{mode === 'full' && (
  <>
    <input placeholder="key" />
    <input placeholder="domain" />
    <input placeholder="version" pattern="^\d+\.\d+\.\d+$" />
    <input placeholder="flow" />
  </>
)}
```

### Pattern 3: List Editor + Mode Toggle (LEGACY)
**Used by:** FunctionListEditor, ExtensionListEditor (unused)
**Files:** FunctionListEditor.tsx, ExtensionListEditor.tsx

Features:
- Add/remove items buttons
- Mode toggle per item
- For path mode: text input for path
- For full mode: four text input fields
- Manual entry only, no search

Disadvantages:
- No search/discovery
- List management overhead
- Mode toggle adds complexity
- Requires manual entry

Code:
```typescript
{items.map((item, idx) => (
  <>
    <select onChange={(e) => switchMode(idx, e.target.value)}>
      <option value="ref">Path Reference</option>
      <option value="full">Full Reference</option>
    </select>
    
    {mode === 'ref' && (
      <input placeholder="path" />
    )}
    
    {mode === 'full' && (
      <>
        <input placeholder="key" />
        <input placeholder="domain" />
        <input placeholder="flow" />
        <input placeholder="version" />
      </>
    )}
    
    <button onClick={() => removeItem(idx)}>Remove</button>
  </>
))}

<button onClick={addItem}>+ Add</button>
```

## Component Catalog Integration

### ReferenceSelector Catalog Props
```typescript
interface AvailableComponent {
  key: string;
  domain: string;
  version: string;
  flow: string;
  title?: string;
  tags?: string[];
  [key: string]: any;
}

// Search filters across:
// - comp.key
// - comp.domain
// - comp.title
// - comp.tags[] elements
// - formatComponent(comp) = "domain/key@version"
```

### Expected Catalog Sources
```
TaskRef:
  availableComponents={availableTasks}
  defaultFlow="sys-tasks"

ProcessRef:
  availableComponents={availableWorkflows}
  defaultFlow="sys-flows"

ViewRef:
  availableComponents={availableViews}
  defaultFlow="sys-views"

SchemaRef: (not integrated with ReferenceSelector)
  availableSchemas={[{key, domain, version, flow, path}]}
  // Uses dropdown only, no search

FunctionRef: (not integrated)
  // Manual input only, no catalog support

ExtensionRef: (not integrated)
  // Manual input only, no catalog support
```

## Usage Recommendations

### For Single Reference Selection
Use `ReferenceSelector`:
```typescript
<ReferenceSelector
  label="Select Component"
  value={ref}
  availableComponents={catalog}
  componentType="ComponentType"
  defaultFlow="sys-default"
  onChange={setRef}
/>
```

### For List of References
If you need list management, create a new component:
```typescript
<UnifiedListEditor
  label="Components"
  items={refs}
  availableComponents={catalog}
  onChange={setRefs}
  onAdd={() => addRef()}
  onRemove={(idx) => removeRef(idx)}
/>
```

Or extend ExecutionTaskListEditor pattern for task-like items.

### For Path-Based References
Support both path and full reference modes:
```typescript
<ReferenceSelector
  label="Reference"
  value={ref && 'key' in ref ? ref : null}  // Convert path to component ref
  availableComponents={catalog}
  componentType="Type"
  defaultFlow="sys-default"
  onChange={setRef}
/>
```

## Migration Path

### Current State (Inconsistent)
```
TaskRef ────► ReferenceSelector (modern)
ProcessRef ──► ReferenceSelector (modern)
ViewRef ─────► ReferenceSelector (modern, via StateViewEditPopup)
              + ViewEditor (legacy, unused)
SchemaRef ───► SchemaEditor (legacy, unused)
FunctionRef ─► FunctionListEditor (legacy, unused)
ExtensionRef ► ExtensionListEditor (legacy, unused)
```

### Target State (Consistent)
Option 1: Unified ReferenceSelector
```
TaskRef ──────────┐
ProcessRef ───────┼─► ReferenceSelector (search dropdown)
ViewRef ──────────┤
SchemaRef ────────┤
FunctionRef ──────┤
ExtensionRef ─────┘
```

Option 2: Split by cardinality
```
Single references:
  TaskRef ────────┐
  ProcessRef ─────┼─► ReferenceSelector (search dropdown)
  ViewRef ────────┤
  SchemaRef ──────┘

Multiple references:
  FunctionRef ────┐
  ExtensionRef ───┼─► UnifiedListEditor (list + search)
                  └─  with add/remove, mode toggle
```

## Performance Considerations

### ReferenceSelector Performance
- Filters on every keystroke
- Supports up to 20 results displayed
- Shows "...and N more" if exceeds 20
- Sorting by domain/key on each filter

### Search Complexity
- Multi-field matching (O(n * m) where n=items, m=search chars)
- Already optimized for real-time UI

### Catalog Size Impact
- Works well with catalogs up to ~1000 items
- For larger catalogs, consider server-side search
- Current implementation does client-side filtering
