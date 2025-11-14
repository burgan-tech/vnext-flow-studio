# Enhanced Mapping Structure - Implementation Guide

## Overview

The workflow definition schema has been updated to support flexible design-time mapping definitions while maintaining strict runtime requirements.

## Key Principle

**Runtime always requires a single `code` block, but design-time can be flexible.**

## Schema Changes

### Location
- **File**: `schemas/schemas/workflow-definition.schema.json`
- **Definition**: `scriptCode` (lines 328-459)

### New Structure

```json
{
  "code": "string (REQUIRED)",
  "location": "string (REQUIRED)",
  "designTime": {
    "mode": "unified | split",
    ...
  },
  "generatedAt": "ISO 8601 timestamp"
}
```

## Design-Time Modes

### Mode 1: Unified
Single CSX file contains both input and output mapping logic.

```json
{
  "code": "// generated runtime code",
  "location": "generated/mapping.csx",
  "designTime": {
    "mode": "unified",
    "unifiedRef": "mappings/complete-mapping.csx"
  },
  "generatedAt": "2025-01-15T10:00:00Z"
}
```

**Use Case**: Simple mappings where input/output are closely related.

---

### Mode 2: Split
Separate input and output definitions. Each can be:
- **Inline code** (`{ "code": "..." }`)
- **File reference** (`{ "ref": "path/to/file.csx" }`)
- **Null** (no mapping for that direction)

#### Example 2a: Both Inline
```json
{
  "code": "// generated combined code",
  "location": "generated/mapping.csx",
  "designTime": {
    "mode": "split",
    "input": {
      "code": "var x = context.GetData(\"x\");"
    },
    "output": {
      "code": "context.SetData(\"y\", result);"
    }
  },
  "generatedAt": "2025-01-15T10:00:00Z"
}
```

**Use Case**: Quick prototyping, small mappings.

---

#### Example 2b: Both File References
```json
{
  "code": "// generated from files",
  "location": "generated/mapping.csx",
  "designTime": {
    "mode": "split",
    "input": {
      "ref": "mappings/input/extract-data.csx"
    },
    "output": {
      "ref": "mappings/output/format-result.csx"
    }
  },
  "generatedAt": "2025-01-15T10:00:00Z"
}
```

**Use Case**: Reusable mappers, complex logic, team collaboration.

---

#### Example 2c: Mixed - Input Inline, Output Reference
```json
{
  "code": "// generated mixed",
  "location": "generated/mapping.csx",
  "designTime": {
    "mode": "split",
    "input": {
      "code": "var userId = context.GetData(\"userId\");"
    },
    "output": {
      "ref": "mappings/output/standard-response.csx"
    }
  },
  "generatedAt": "2025-01-15T10:00:00Z"
}
```

**Use Case**: Simple input extraction, standardized output formatting.

---

#### Example 2d: Mixed - Input Reference, Output Inline
```json
{
  "code": "// generated mixed",
  "location": "generated/mapping.csx",
  "designTime": {
    "mode": "split",
    "input": {
      "ref": "mappings/input/complex-extraction.csx"
    },
    "output": {
      "code": "context.SetData(\"status\", \"completed\");"
    }
  },
  "generatedAt": "2025-01-15T10:00:00Z"
}
```

**Use Case**: Complex input processing, simple status updates.

---

#### Example 2e: Input Only
```json
{
  "code": "// generated input-only",
  "location": "generated/mapping.csx",
  "designTime": {
    "mode": "split",
    "input": {
      "code": "var data = context.GetData(\"data\");"
    },
    "output": null
  },
  "generatedAt": "2025-01-15T10:00:00Z"
}
```

**Use Case**: Data extraction without transformation.

---

#### Example 2f: Output Only
```json
{
  "code": "// generated output-only",
  "location": "generated/mapping.csx",
  "designTime": {
    "mode": "split",
    "input": null,
    "output": {
      "ref": "mappings/output/finalize-state.csx"
    }
  },
  "generatedAt": "2025-01-15T10:00:00Z"
}
```

**Use Case**: State finalization without additional input.

---

### Mode 3: Manual (No Design-Time)
```json
{
  "code": "// manually written code",
  "location": "mappings/manual/custom.csx",
  "designTime": null
}
```

**Use Case**: Direct code authoring, legacy mappings, special cases.

## Build Process

### Design-Time → Runtime Code Generation

```
┌─────────────────────────────────────┐
│   Designer Creates Mapping          │
│   (unified, split, or manual)       │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│   Build/Compile Step                │
│   - Reads referenced CSX files      │
│   - Combines input + output code    │
│   - Generates single runtime code   │
│   - Sets generatedAt timestamp      │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│   Workflow Definition Persisted     │
│   - code: generated runtime code    │
│   - location: runtime file path     │
│   - designTime: metadata preserved  │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│   Runtime Execution                 │
│   - Reads "code" field only         │
│   - Ignores "designTime" field      │
│   - Executes generated code         │
└─────────────────────────────────────┘
```

## Where Mappings Are Used

The `scriptCode` definition is referenced in:

1. **SubFlow Mapping** (line 419)
   - `attributes.subFlow.mapping`

2. **Task Execution Mapping** (line 456)
   - `attributes.states[].onEntries[].mapping`
   - `attributes.states[].onExits[].mapping`
   - `attributes.states[].transitions[].onExecutionTasks[].mapping`

3. **Transition Rule** (line 506)
   - `attributes.states[].transitions[].rule`
   - `attributes.sharedTransitions[].rule`

4. **Transition Mapping** (line 559, 800)
   - `attributes.states[].transitions[].mapping`
   - `attributes.sharedTransitions[].mapping`

5. **Start Transition Mapping** (line 993)
   - `attributes.startTransition.mapping`

## Validation Rules

### Runtime Requirements (ALWAYS)
- ✅ `code` field must be present and non-empty
- ✅ `location` field must be present and non-empty

### Design-Time Requirements (OPTIONAL)
- ✅ If `designTime` is present, `mode` is required
- ✅ If `mode: "unified"`, `unifiedRef` is required
- ✅ If `mode: "split"`, at least one of `input` or `output` must be present
- ✅ `input` and `output` can be `{ code }`, `{ ref }`, or `null`

## Migration Path

### From Old Format
```json
{
  "type": "L",
  "code": "var x = 1;",
  "location": "mappings/old.csx"
}
```

### To New Format
```json
{
  "code": "var x = 1;",
  "location": "mappings/old.csx",
  "designTime": null
}
```

**Note**: The `type` field ("G", "L") is no longer used. All mappings now require `code` and `location`.

## Tooling Requirements

### VS Code Extension Updates
1. **Mapping Editor UI**
   - Toggle between "Unified" and "Split" modes
   - For split mode: separate editors for input/output
   - Toggle between "Code" and "File Reference" per direction
   - File picker for CSX file references

2. **Code Generator**
   - Watch design-time files for changes
   - Combine input/output into single runtime code
   - Update `generatedAt` timestamp
   - Validate generated code syntax

3. **Validation**
   - Ensure `code` and `location` are always present
   - Verify referenced CSX files exist
   - Check for circular dependencies

### CLI Tool Updates
1. **Build Command**
   ```bash
   wf build --generate-mappings
   ```
   - Scans all workflow definitions
   - Generates runtime code from design-time metadata
   - Updates workflow files with generated code

2. **Validation Command**
   ```bash
   wf validate --check-mappings
   ```
   - Verifies all mappings have runtime code
   - Checks referenced files exist
   - Validates generated code is up-to-date

## Sample Implementation

See `sample-workflow-with-enhanced-mapping.flow.json` for a complete example demonstrating:
- Start transition with split inline mapping
- State entry task with unified mapping
- Transition with mixed (ref + inline) mapping
- Task execution with both file references
- Manual mapping without design-time metadata
- Final state with both inline code

## Benefits

1. **Runtime Simplicity**: Always one `code` block to execute
2. **Design Flexibility**: Mix and match inline code with file references
3. **Code Reuse**: Share input/output mappers across workflows
4. **Maintainability**: Separate concerns (input extraction vs output formatting)
5. **Team Collaboration**: Different team members can work on input/output independently
6. **Backward Compatible**: Old workflows can set `designTime: null`
7. **Auditable**: `generatedAt` timestamp tracks code generation

## Next Steps

1. ✅ Update schema definition
2. ✅ Create sample workflow
3. ⏳ Update VS Code extension UI
4. ⏳ Implement code generator
5. ⏳ Update CLI tool
6. ⏳ Write unit tests
7. ⏳ Update documentation
8. ⏳ Migrate existing workflows
