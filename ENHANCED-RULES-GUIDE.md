# Enhanced Rule Structure - Implementation Guide

## Overview

Rules have been updated to support flexible design-time authoring while maintaining strict runtime requirements. Rules are **one-way boolean evaluations** used in automatic transitions.

## Key Principle

**Runtime always requires a single `code` block that returns boolean. Design-time can be inline code or file reference.**

## Schema Changes

### Location
- **File**: `schemas/schemas/workflow-definition.schema.json`
- **Definition**: `ruleCode` (lines 460-522)

### Structure

```json
{
  "code": "string (REQUIRED, must return boolean)",
  "location": "string (REQUIRED)",
  "designTime": {
    "source": {
      "code": "..."  // OR "ref": "..."
    }
  },
  "generatedAt": "ISO 8601 timestamp"
}
```

## Differences from Mappings

| Aspect | Mappings | Rules |
|--------|----------|-------|
| **Direction** | Two-way (input/output) or one-way (merge) | One-way (evaluation) |
| **Return Type** | Any | Boolean (true/false) |
| **Modes** | unified, split | inline or file reference |
| **Use Case** | Data transformation | Conditional logic |
| **Usage** | Tasks, transitions | Automatic transitions only (triggerType: 1) |

## Design-Time Options

### Option 1: Inline Code

```json
{
  "code": "return context.GetData<decimal>(\"amount\") > 1000;",
  "location": "generated/rules/amount-check.csx",
  "designTime": {
    "source": {
      "code": "return context.GetData<decimal>(\"amount\") > 1000;"
    }
  },
  "generatedAt": "2025-01-15T11:00:00Z"
}
```

**Use Case**: Simple threshold checks, quick validations.

---

### Option 2: File Reference

```json
{
  "code": "// Generated from rule file\nreturn ValidateUserEligibility(context);",
  "location": "generated/rules/eligibility-check.csx",
  "designTime": {
    "source": {
      "ref": "rules/user-eligibility.csx"
    }
  },
  "generatedAt": "2025-01-15T11:05:00Z"
}
```

**Use Case**: Reusable business rules, complex conditions, shared logic.

---

### Option 3: Manual (No Design-Time)

```json
{
  "code": "// Manual rule with complex logic\nvar user = context.GetData<User>(\"user\");\nif (user == null) return false;\nif (user.Role == \"Admin\") return true;\nreturn user.Permissions.Contains(\"approve\");",
  "location": "rules/manual/admin-approval-check.csx",
  "designTime": null
}
```

**Use Case**: Complex conditional logic, legacy rules, special cases.

---

## Build Process

### Design-Time → Runtime Code Generation

```
┌─────────────────────────────────────┐
│   Designer Creates Rule              │
│   (inline code or file reference)   │
└─────────────┬───────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│   Build/Compile Step                │
│   - Use inline code as-is, or       │
│   - Read referenced CSX file         │
│   - Generates boolean-returning code│
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
│   - Executes code                   │
│   - Expects boolean return value    │
│   - true: transition fires          │
│   - false: transition skipped       │
└─────────────────────────────────────┘
```

## Where Rules Are Used

Rules are used exclusively in **automatic transitions** (triggerType: 1):

1. **State Transitions**
   - `attributes.states[].transitions[].rule`
   - When triggerType = 1 (automatic)

2. **Shared Transitions**
   - `attributes.sharedTransitions[].rule`
   - When triggerType = 1 (automatic)

### Trigger Type Context

| Trigger Type | Value | Rule Required | Rule Usage |
|--------------|-------|---------------|------------|
| Manual | 0 | No | Not applicable |
| Automatic | 1 | **YES** | Rule evaluated to determine if transition fires |
| Scheduled | 2 | No | Timer-based, not rule-based |
| Event | 3 | No | Event-driven, not rule-based |

## Validation Rules

### Runtime Requirements (ALWAYS)
- ✅ `code` field must be present and non-empty
- ✅ `location` field must be present and non-empty
- ✅ Code must evaluate to boolean (true/false)

### Design-Time Requirements (OPTIONAL)
- ✅ If `designTime` is present, `source` is required
- ✅ `source` must be either `{ "code": "..." }` or `{ "ref": "..." }`

## Migration Path

### From Old Format
```json
{
  "code": "return x > 100;",
  "location": "rules/old.csx"
}
```

### To New Format (Manual)
```json
{
  "code": "return x > 100;",
  "location": "rules/old.csx",
  "designTime": null
}
```

### To New Format (Inline)
```json
{
  "code": "return x > 100;",
  "location": "generated/rules/threshold.csx",
  "designTime": {
    "source": {
      "code": "return x > 100;"
    }
  },
  "generatedAt": "2025-01-15T12:00:00Z"
}
```

### To New Format (File Reference)
```json
{
  "code": "return ValidateThreshold(context);",
  "location": "generated/rules/threshold.csx",
  "designTime": {
    "source": {
      "ref": "rules/threshold-validation.csx"
    }
  },
  "generatedAt": "2025-01-15T12:00:00Z"
}
```

## Tooling Requirements

### VS Code Extension Updates

1. **Rule Editor UI**
   - Toggle between "Inline Code" and "File Reference"
   - For inline: Code editor with boolean return validation
   - For file reference: File picker for CSX files
   - Preview of generated runtime code
   - Syntax highlighting and IntelliSense

2. **Code Generator**
   - Generate boolean-returning code
   - Validate boolean return type
   - Update `generatedAt` timestamp
   - Watch design-time files for changes

3. **Validation**
   - Ensure `code` and `location` are always present
   - Verify code returns boolean
   - Check referenced CSX files exist
   - Check for syntax errors in generated code

### CLI Tool Updates

1. **Build Command**
   ```bash
   wf build --generate-rules
   ```
   - Scans all workflow definitions
   - Generates runtime code from design-time metadata
   - Validates boolean return type

2. **Validation Command**
   ```bash
   wf validate --check-rules
   ```
   - Verifies all rules have runtime code
   - Checks rules return boolean
   - Validates referenced files exist

## Sample Implementation

See `sample-workflow-with-enhanced-rules.flow.json` for a complete example demonstrating:
- Inline rule (amount threshold check)
- File reference rule (credit score validation)
- File reference rule (final approval criteria)
- Shared transition with inline rule (auto-rejection)

## Benefits

1. **Runtime Simplicity**: Always one `code` block returning boolean
2. **Design Flexibility**: Choose inline code or file reference
3. **Reusability**: Share rule files across workflows
4. **Maintainability**: Clear, simple structure
5. **Testability**: Rule files can be tested independently
6. **Backward Compatible**: Old rules can set `designTime: null`
7. **Auditable**: `generatedAt` timestamp tracks generation

## Comparison: Rules vs Mappings

### When to Use Rules
- ✅ Automatic transition logic (triggerType: 1)
- ✅ Boolean decision-making
- ✅ Conditional workflow routing
- ✅ Validation gates
- ✅ Approval criteria

### When to Use Mappings
- ✅ Data transformation (task mappings: input/output)
- ✅ Incoming data merge (transition mappings)
- ✅ Task parameter preparation
- ✅ State data manipulation
- ✅ Complex data processing

## Best Practices

1. **Use Inline for Simple Conditions**
   - Single comparisons
   - Basic threshold checks
   - Quick validations

2. **Use File References for Complex Logic**
   - Reusable business rules
   - Multi-step validation
   - Shared across workflows
   - Team collaboration

3. **Reuse Common Rules**
   - Extract frequently-used checks to files
   - Create a library of reusable rules
   - Example: `rules/age-verification.csx`, `rules/amount-threshold.csx`

4. **Document Your Rules**
   - Add comments in rule files
   - Explain business logic intent
   - Document edge cases

5. **Test Independently**
   - Write unit tests for rule files
   - Test with various context data
   - Verify boolean return values

## File Organization

```
project/
├── rules/
│   ├── credit-score-validation.csx
│   ├── age-verification.csx
│   ├── amount-threshold.csx
│   └── eligibility-check.csx
└── generated/
    └── rules/
        ├── auto-credit-check.csx
        ├── final-approval.csx
        └── auto-reject.csx
```

## Next Steps

### Phase 1: Schema (Completed ✅)
- [x] Update schema definition
- [x] Simplify to inline/file reference only
- [x] Create sample workflow
- [x] Write documentation

### Phase 2: Code Generation (Pending)
- [ ] Implement rule code generator
- [ ] Add file watchers
- [ ] Validate boolean return type
- [ ] Generate code from inline or file

### Phase 3: VS Code Extension (Pending)
- [ ] Build rule editor UI
- [ ] Add inline/file reference toggle
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

### Q: Can I still write rules manually?
**A:** Yes! Set `designTime: null` and provide the `code` and `location` directly.

### Q: What happens to existing workflows?
**A:** They continue to work. The new structure is backward compatible. Just add `designTime: null` during migration.

### Q: When should I use inline vs file reference?
**A:** Use inline for simple, one-off conditions. Use file references for reusable, complex logic that's shared across workflows.

### Q: Can rules have complex logic with multiple conditions?
**A:** Yes! Write the complex logic in the inline code or in a CSX file. Just ensure it returns boolean.

### Q: What file format for rule files?
**A:** CSX files (C# script files) with `.csx` extension.

### Q: How does the build process work?
**A:** The build tool reads design-time metadata (inline code or file reference), generates runtime code, and updates the workflow definition with the generated code and timestamp.

### Q: Why no composite mode for rules?
**A:** Composite mode adds complexity without significant benefit. Complex conditions can be written directly in code (inline or file), giving you full control over the logic (AND, OR, nested conditions, etc.).

## Support

For questions or issues:
- Review this guide: `ENHANCED-RULES-GUIDE.md`
- Check the mapping guide: `ENHANCED-MAPPING-GUIDE.md`
- Check the sample: `sample-workflow-with-enhanced-rules.flow.json`
- Examine the proposal: `proposed-rule-schema.json`
