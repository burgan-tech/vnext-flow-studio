# Final Schema Enhancements Summary

## Overview

The workflow definition schema has been enhanced with two new definitions:
1. **`scriptCode`** - For mappings (data transformation)
2. **`ruleCode`** - For rules (boolean evaluation)

## Quick Reference

### Mappings (scriptCode)

**Purpose**: Data transformation
**Modes**: unified, split
**Usage**: Tasks, transitions, subflows

```json
{
  "code": "// runtime code",
  "location": "generated/mapping.csx",
  "designTime": {
    "mode": "unified",  // OR "split"
    // ... mode-specific fields
  },
  "generatedAt": "2025-01-15T10:00:00Z"
}
```

### Rules (ruleCode)

**Purpose**: Boolean evaluation
**Options**: inline code, file reference
**Usage**: Automatic transitions (triggerType: 1)

```json
{
  "code": "return x > 100;",
  "location": "generated/rule.csx",
  "designTime": {
    "source": {
      "code": "..."  // OR "ref": "..."
    }
  },
  "generatedAt": "2025-01-15T10:00:00Z"
}
```

## Mappings Deep Dive

### Unified Mode
Single CSX file for complete transformation.

```json
{
  "designTime": {
    "mode": "unified",
    "unifiedRef": "mappings/complete-transform.csx"
  }
}
```

**Use Cases**:
- Simple, cohesive transformations
- All logic in one place
- Quick prototyping

### Split Mode
Separate input and output handling. Each can be:
- Inline code: `{ "code": "..." }`
- File reference: `{ "ref": "..." }`
- Null: `null`

```json
{
  "designTime": {
    "mode": "split",
    "input": { "code": "..." },   // or { "ref": "..." } or null
    "output": { "ref": "..." }    // or { "code": "..." } or null
  }
}
```

**Use Cases**:
- **Task mappings** (two-way):
  - Input: Extract data from context
  - Output: Format data for task/state
- **Transition mappings** (one-way merge):
  - Input: Extract incoming transition data
  - Output: Merge into workflow state
- **SubFlow mappings**:
  - Input: Extract parent workflow data
  - Output: Prepare subflow parameters

### Mapping Combinations

1. **Both inline** - Quick, self-contained
2. **Both file references** - Reusable, shared
3. **Input inline, output file** - Simple extraction, standard formatting
4. **Input file, output inline** - Complex extraction, simple merge
5. **Input only** - Extract without transformation
6. **Output only** - Transform without extraction

## Rules Deep Dive

### Inline Code
Simple, self-contained boolean logic.

```json
{
  "designTime": {
    "source": {
      "code": "return context.GetData<decimal>(\"amount\") > 1000;"
    }
  }
}
```

**Use Cases**:
- Simple threshold checks
- Single comparisons
- Quick validations

### File Reference
Reusable, complex boolean logic.

```json
{
  "designTime": {
    "source": {
      "ref": "rules/eligibility-check.csx"
    }
  }
}
```

**Use Cases**:
- Reusable business rules
- Complex validation logic
- Shared across workflows
- Team collaboration

### Manual (No Design-Time)
For both mappings and rules, you can omit design-time metadata.

```json
{
  "code": "// manual code",
  "location": "manual/custom.csx",
  "designTime": null
}
```

## Key Differences

| Feature | Mappings | Rules |
|---------|----------|-------|
| **Purpose** | Data transformation | Boolean evaluation |
| **Direction** | Two-way or one-way | One-way |
| **Return Type** | Any | Boolean |
| **Complexity** | Can be complex | Keep simple |
| **Modes** | unified, split | inline, file ref |
| **Design-Time** | 3 options (unified, split, manual) | 3 options (inline, file, manual) |

## Usage Context

### Mappings Are Used In:

1. **SubFlow Mapping**
   - `attributes.subFlow.mapping`
   - Prepare parameters for subflow

2. **Task Execution Mapping**
   - `attributes.states[].onEntries[].mapping`
   - `attributes.states[].onExits[].mapping`
   - `attributes.states[].transitions[].onExecutionTasks[].mapping`
   - Transform data for tasks

3. **Transition Mapping**
   - `attributes.states[].transitions[].mapping`
   - `attributes.sharedTransitions[].mapping`
   - `attributes.startTransition.mapping`
   - Merge incoming data to workflow

### Rules Are Used In:

1. **Automatic Transitions** (triggerType: 1)
   - `attributes.states[].transitions[].rule`
   - `attributes.sharedTransitions[].rule`
   - Determine if transition should fire

## Common Patterns

### Pattern 1: Task with Split Mapping
```json
{
  "task": { "key": "validate-user", "..." },
  "mapping": {
    "code": "// generated",
    "location": "generated/task-mapping.csx",
    "designTime": {
      "mode": "split",
      "input": {
        "code": "var userId = context.GetData(\"userId\");"
      },
      "output": {
        "code": "context.SetData(\"validated\", result);"
      }
    }
  }
}
```

### Pattern 2: Transition with Inline Rule
```json
{
  "key": "auto-approve",
  "target": "approved",
  "triggerType": 1,
  "rule": {
    "code": "return context.GetData<decimal>(\"amount\") < 1000;",
    "location": "generated/auto-approve.csx",
    "designTime": {
      "source": {
        "code": "return context.GetData<decimal>(\"amount\") < 1000;"
      }
    }
  }
}
```

### Pattern 3: Transition with Mapping (Merge Incoming)
```json
{
  "key": "manual-transition",
  "target": "next-state",
  "triggerType": 0,
  "mapping": {
    "code": "// merge incoming data",
    "location": "generated/transition-mapping.csx",
    "designTime": {
      "mode": "split",
      "input": {
        "code": "var incomingData = context.GetData(\"transitionData\");"
      },
      "output": {
        "code": "context.SetData(\"mergedData\", incomingData);"
      }
    }
  }
}
```

## File Organization

```
project/
├── mappings/
│   ├── input/              # Input extraction mappers
│   ├── output/             # Output formatting mappers
│   └── unified/            # Complete transformation mappers
├── rules/
│   ├── eligibility-check.csx
│   ├── amount-threshold.csx
│   └── credit-validation.csx
└── generated/
    ├── mappings/           # Generated mapping runtime code
    └── rules/              # Generated rule runtime code
```

## Build Process

```
┌─────────────────────────────────────┐
│   Designer Defines                   │
│   - Mappings (unified/split)        │
│   - Rules (inline/file)             │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│   Build Tool                         │
│   - Reads design-time metadata      │
│   - Combines/reads files             │
│   - Generates runtime code           │
│   - Updates workflow definition      │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│   Runtime                            │
│   - Reads "code" field only          │
│   - Ignores "designTime" field       │
│   - Executes generated code          │
└─────────────────────────────────────┘
```

## Migration

### Existing Workflows
All existing workflows continue to work. During migration, add `designTime: null`:

```json
{
  "code": "existing code",
  "location": "existing/path.csx",
  "designTime": null  // Add this
}
```

### Adopting New Features
Gradually adopt new features by:
1. Start with inline code for simple cases
2. Extract reusable logic to files
3. Use split mode for task mappings
4. Share common rules/mappings across workflows

## Best Practices

### For Mappings
1. **Use unified** for simple, cohesive transformations
2. **Use split** for task mappings (clear input/output separation)
3. **Use split** for transition mappings (extract + merge pattern)
4. **Extract to files** for reusable mapping logic
5. **Inline code** for one-off, simple transformations

### For Rules
1. **Use inline** for simple threshold checks
2. **Use file reference** for complex business rules
3. **Keep rules simple** - complex logic belongs in mappings/tasks
4. **Reuse rules** - create a library of common conditions
5. **Document** - add comments explaining business logic

## Next Steps

1. **Phase 1: Schema** ✅ Complete
   - Defined `scriptCode` and `ruleCode`
   - Created samples and documentation

2. **Phase 2: Code Generation** (Pending)
   - Implement generators for mappings and rules
   - Watch files for changes
   - Validate generated code

3. **Phase 3: VS Code Extension** (Pending)
   - Build mapping editor UI
   - Build rule editor UI
   - Add code preview and validation

4. **Phase 4: CLI Tool** (Pending)
   - Add build/validation commands
   - Generate code from workflows
   - Report status

5. **Phase 5: Migration** (Pending)
   - Migrate existing workflows
   - Create migration tools
   - Update documentation

## Documentation

- **`ENHANCED-MAPPING-GUIDE.md`** - Complete mapping documentation
- **`ENHANCED-RULES-GUIDE.md`** - Complete rule documentation
- **`sample-workflow-with-enhanced-mapping.flow.json`** - Mapping examples
- **`sample-workflow-with-enhanced-rules.flow.json`** - Rule examples
- **`proposed-mapping-schema.json`** - Mapping proposal details
- **`proposed-rule-schema.json`** - Rule proposal details (legacy, shows composite mode)

## Summary

✅ **Mappings** - Flexible data transformation with unified/split modes
✅ **Rules** - Simple boolean evaluation with inline/file options
✅ **Backward Compatible** - Existing workflows work unchanged
✅ **Runtime Simple** - Always one `code` block to execute
✅ **Design-Time Flexible** - Multiple authoring options
✅ **Auditable** - Generation timestamps track changes

The schema is now ready for implementation in the build tooling and VS Code extension!
