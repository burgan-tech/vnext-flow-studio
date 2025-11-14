# Schema Enhancements Summary

## Overview

The workflow definition schema has been enhanced to support flexible design-time authoring for both **mappings** and **rules** while maintaining strict runtime requirements.

## Files Modified

### Schema Files
- ✅ `schemas/schemas/workflow-definition.schema.json`
  - Added `scriptCode` definition (mappings) - lines 328-459
  - Added `ruleCode` definition (rules) - lines 460-594
  - Updated all `rule` references to use `ruleCode`

### Documentation Files
- ✅ `ENHANCED-MAPPING-GUIDE.md` - Complete mapping documentation
- ✅ `ENHANCED-RULES-GUIDE.md` - Complete rule documentation
- ✅ `proposed-mapping-schema.json` - Mapping proposal with examples
- ✅ `proposed-rule-schema.json` - Rule proposal with examples

### Sample Files
- ✅ `sample-view.json` - View component example
- ✅ `sample-workflow-with-enhanced-mapping.flow.json` - Mapping examples
- ✅ `sample-workflow-with-enhanced-rules.flow.json` - Rule examples

## Core Principles

### Common to Both
1. **Runtime Requirement**: Always one `code` + `location` field
2. **Design-Time Flexibility**: Optional `designTime` metadata
3. **Generation Timestamp**: Optional `generatedAt` field
4. **Backward Compatible**: Set `designTime: null` for existing code

### Mappings vs Rules

| Aspect | Mappings | Rules |
|--------|----------|-------|
| **Purpose** | Data transformation | Boolean evaluation |
| **Direction** | Two-way (input/output) | One-way (condition) |
| **Return Type** | Any | Boolean |
| **Modes** | unified, split | simple, composite |
| **Usage** | Tasks, transitions | Automatic transitions (triggerType: 1) |

## Mapping Structure

### Runtime (Always Required)
```json
{
  "code": "string (REQUIRED)",
  "location": "string (REQUIRED)",
  "designTime": { ... },
  "generatedAt": "ISO timestamp"
}
```

### Design-Time Modes

#### 1. Unified Mode
Single CSX file for both input and output.

```json
{
  "designTime": {
    "mode": "unified",
    "unifiedRef": "mappings/complete.csx"
  }
}
```

#### 2. Split Mode
Separate input and output. Each can be:
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

**Split Mode Combinations:**
1. Both inline code
2. Both file references
3. Input inline, output file reference
4. Input file reference, output inline
5. Input only (output: null)
6. Output only (input: null)

### Where Mappings Are Used
1. SubFlow mapping
2. Task execution mapping (onEntries, onExits, onExecutionTasks)
3. Transition mapping
4. Start transition mapping

## Rule Structure

### Runtime (Always Required)
```json
{
  "code": "string (REQUIRED, must return boolean)",
  "location": "string (REQUIRED)",
  "designTime": { ... },
  "generatedAt": "ISO timestamp"
}
```

### Design-Time Modes

#### 1. Simple Mode
Single condition - inline code or file reference.

```json
{
  "designTime": {
    "mode": "simple",
    "rule": {
      "code": "return x > 100;"  // or { "ref": "..." }
    }
  }
}
```

#### 2. Composite Mode
Multiple conditions (min 2) combined with AND or OR.

```json
{
  "designTime": {
    "mode": "composite",
    "operator": "AND",  // or "OR"
    "conditions": [
      {
        "code": "return x > 100;",
        "description": "Threshold check"
      },
      {
        "ref": "rules/verify.csx",
        "description": "Verification check"
      }
    ]
  }
}
```

### Where Rules Are Used
- State transitions with `triggerType: 1` (automatic)
- Shared transitions with `triggerType: 1` (automatic)

## Code Generation

### Mapping Generation
```
Unified Mode:
  → Read unified CSX file
  → Use content as-is

Split Mode:
  → Read/use input code
  → Read/use output code
  → Combine into single runtime code
```

### Rule Generation
```
Simple Mode:
  → Use inline code or read CSX file
  → Ensure boolean return

Composite AND Mode:
  → Evaluate all conditions
  → Combine with && operator
  → return cond1 && cond2 && ... && condN;

Composite OR Mode:
  → Evaluate all conditions
  → Combine with || operator
  → return cond1 || cond2 || ... || condN;
```

## Migration Guide

### Old Mapping Format
```json
{
  "type": "L",
  "code": "var x = 1;",
  "location": "mappings/old.csx"
}
```

### New Mapping Format
```json
{
  "code": "var x = 1;",
  "location": "mappings/old.csx",
  "designTime": null
}
```

**Note**: The `type` field ("G", "L") is removed. All mappings now require `code` and `location`.

### Old Rule Format
```json
{
  "code": "return x > 100;",
  "location": "rules/old.csx"
}
```

### New Rule Format (Same Structure)
```json
{
  "code": "return x > 100;",
  "location": "rules/old.csx",
  "designTime": null
}
```

**Note**: Existing rules work as-is. Just set `designTime: null`.

## Tooling Requirements

### VS Code Extension

#### Mapping Editor
- [ ] Mode toggle: Unified / Split
- [ ] For Unified: File picker for CSX file
- [ ] For Split:
  - [ ] Input section: Code editor or file picker
  - [ ] Output section: Code editor or file picker
  - [ ] Allow null for either section
- [ ] Preview generated runtime code

#### Rule Editor
- [ ] Mode toggle: Simple / Composite
- [ ] For Simple: Code editor or file picker
- [ ] For Composite:
  - [ ] Operator selector: AND / OR
  - [ ] Condition list builder
  - [ ] Add/remove conditions
  - [ ] Per-condition: Code editor or file picker
  - [ ] Description field for each condition
- [ ] Preview generated runtime code
- [ ] Validation: boolean return type

#### Code Generator
- [ ] Watch design-time files for changes
- [ ] Generate runtime code on save
- [ ] Validate syntax
- [ ] Update `generatedAt` timestamp
- [ ] Show generation errors

### CLI Tool

#### Build Commands
```bash
wf build --generate-mappings   # Generate mapping runtime code
wf build --generate-rules      # Generate rule runtime code
wf build --generate-all        # Generate both
```

#### Validation Commands
```bash
wf validate --check-mappings   # Validate mappings
wf validate --check-rules      # Validate rules
wf validate --check-all        # Validate both
```

#### Features
- [ ] Scan workflow definitions
- [ ] Generate runtime code from design-time
- [ ] Validate all required fields present
- [ ] Check referenced files exist
- [ ] Verify boolean return for rules
- [ ] Report generation errors

## Examples

### Mapping Examples
See `sample-workflow-with-enhanced-mapping.flow.json`:
- Unified mapping
- Split with both inline
- Split with both file references
- Split with mixed (inline + file)
- Manual mapping (no design-time)

### Rule Examples
See `sample-workflow-with-enhanced-rules.flow.json`:
- Simple inline rule
- Simple file reference rule
- Composite OR rule (auto-rejection)
- Composite AND rule with mixed sources (approval)
- Shared transition with composite rule

## Benefits

### For Developers
- ✅ Flexible authoring (inline vs files)
- ✅ Code reusability across workflows
- ✅ Easier testing (test files independently)
- ✅ Better maintainability (separate concerns)
- ✅ Visual editing support

### For Runtime
- ✅ Simple execution model (one code block)
- ✅ No changes required
- ✅ Fast evaluation
- ✅ Clear error messages

### For Teams
- ✅ Collaborative development
- ✅ Shared mapping/rule libraries
- ✅ Clear documentation (descriptions)
- ✅ Better code reviews
- ✅ Version control friendly

## Validation Rules

### Mappings
- ✅ `code` and `location` always required
- ✅ If `designTime.mode: "unified"`, `unifiedRef` required
- ✅ If `designTime.mode: "split"`, at least one of `input` or `output` required
- ✅ `input` and `output` can be `{ code }`, `{ ref }`, or `null`

### Rules
- ✅ `code` and `location` always required
- ✅ `code` must evaluate to boolean
- ✅ If `designTime.mode: "simple"`, `rule` required
- ✅ If `designTime.mode: "composite"`:
  - ✅ `operator` required (AND or OR)
  - ✅ `conditions` array required
  - ✅ Minimum 2 conditions
  - ✅ Each condition must be `{ code }` or `{ ref }`
  - ⚠️ `description` optional but recommended

## Best Practices

### Mappings
1. Use **unified mode** for simple, cohesive mappings
2. Use **split mode** when input/output are independent
3. Extract reusable mappers to files
4. Use inline code for simple, one-off transformations
5. Document complex mapping logic

### Rules
1. Use **simple mode** for single conditions
2. Use **composite mode** to build complex logic from simple parts
3. Always add `description` to conditions
4. Choose AND vs OR carefully (stricter vs lenient)
5. Extract reusable conditions to files
6. Test each condition independently

### File Organization
```
project/
├── mappings/
│   ├── input/              # Input mapper files
│   ├── output/             # Output mapper files
│   └── unified/            # Unified mapper files
├── rules/
│   ├── conditions/         # Reusable condition files
│   └── composite/          # Complete rule files
└── generated/
    ├── mappings/           # Generated mapping runtime code
    └── rules/              # Generated rule runtime code
```

## Next Steps

### Phase 1: Schema (Completed ✅)
- [x] Update schema definitions
- [x] Create sample workflows
- [x] Write documentation

### Phase 2: Code Generation (Pending)
- [ ] Implement mapping code generator
- [ ] Implement rule code generator
- [ ] Add file watchers
- [ ] Validate generated code

### Phase 3: VS Code Extension (Pending)
- [ ] Build mapping editor UI
- [ ] Build rule editor UI
- [ ] Add code preview
- [ ] Integrate with file system

### Phase 4: CLI Tool (Pending)
- [ ] Add build commands
- [ ] Add validation commands
- [ ] Generate code from workflows
- [ ] Report generation status

### Phase 5: Testing & Migration (Pending)
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Migrate existing workflows
- [ ] Update user documentation

## Questions & Answers

### Q: Can I still write mappings/rules manually?
**A:** Yes! Set `designTime: null` and provide the `code` and `location` directly.

### Q: What happens to existing workflows?
**A:** They continue to work. The new structure is backward compatible. Just add `designTime: null` during migration.

### Q: Can I mix inline code and file references in split mode?
**A:** Yes! For mappings, `input` can be inline while `output` is a file reference (or vice versa).

### Q: What's the minimum number of conditions for composite rules?
**A:** 2 conditions. If you only have one condition, use simple mode.

### Q: Do I need to provide descriptions for conditions?
**A:** No, it's optional. But it's highly recommended for documentation and debugging.

### Q: Can composite rules have both AND and OR?
**A:** No, each composite rule uses one operator. To combine AND/OR logic, nest rules or use manual mode.

### Q: What file format for mapper/rule files?
**A:** CSX files (C# script files) with `.csx` extension.

### Q: How does the build process work?
**A:** The build tool reads design-time metadata, combines/generates runtime code, and updates the workflow definition with the generated code and timestamp.

## Support

For questions or issues:
- Review the guides: `ENHANCED-MAPPING-GUIDE.md` and `ENHANCED-RULES-GUIDE.md`
- Check the samples: `sample-workflow-with-enhanced-mapping.flow.json` and `sample-workflow-with-enhanced-rules.flow.json`
- Examine the proposals: `proposed-mapping-schema.json` and `proposed-rule-schema.json`
