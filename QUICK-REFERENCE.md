# Quick Reference: Mappings & Rules

## Mappings (scriptCode)

### Unified Mode
```json
{
  "code": "// runtime",
  "location": "generated/mapping.csx",
  "designTime": {
    "mode": "unified",
    "unifiedRef": "mappings/complete.csx"
  }
}
```

### Split Mode - Both Inline
```json
{
  "designTime": {
    "mode": "split",
    "input": { "code": "var x = context.GetData(\"x\");" },
    "output": { "code": "context.SetData(\"y\", result);" }
  }
}
```

### Split Mode - Both Files
```json
{
  "designTime": {
    "mode": "split",
    "input": { "ref": "mappings/input/extract.csx" },
    "output": { "ref": "mappings/output/format.csx" }
  }
}
```

### Split Mode - Mixed
```json
{
  "designTime": {
    "mode": "split",
    "input": { "code": "var x = context.GetData(\"x\");" },
    "output": { "ref": "mappings/output/standard.csx" }
  }
}
```

### Split Mode - Input Only
```json
{
  "designTime": {
    "mode": "split",
    "input": { "code": "var x = context.GetData(\"x\");" },
    "output": null
  }
}
```

## Rules (ruleCode)

### Inline Code
```json
{
  "code": "return x > 100;",
  "location": "generated/rule.csx",
  "designTime": {
    "source": {
      "code": "return context.GetData<decimal>(\"amount\") > 1000;"
    }
  }
}
```

### File Reference
```json
{
  "code": "return ValidateUser(context);",
  "location": "generated/rule.csx",
  "designTime": {
    "source": {
      "ref": "rules/user-validation.csx"
    }
  }
}
```

## Manual (Both)
```json
{
  "code": "// manual code",
  "location": "manual/custom.csx",
  "designTime": null
}
```

## When to Use What

| Scenario | Use This |
|----------|----------|
| Simple data transformation | Mapping - unified mode |
| Task input/output | Mapping - split mode |
| Transition data merge | Mapping - split mode |
| Simple threshold check | Rule - inline code |
| Complex business rule | Rule - file reference |
| Reusable across workflows | Files (mappings or rules) |
| One-off quick logic | Inline code |
| Legacy/manual code | `designTime: null` |

## Common Errors

### ❌ Wrong
```json
// Rule with split mode
{
  "designTime": {
    "mode": "split",  // ❌ Rules don't have modes
    "input": { ... }
  }
}
```

### ✅ Correct
```json
// Rule with inline code
{
  "designTime": {
    "source": {
      "code": "return x > 100;"  // ✅ Simple source
    }
  }
}
```

## File Paths

- **Mappings**: `mappings/**/*.csx`
- **Rules**: `rules/**/*.csx`
- **Generated**: `generated/{mappings,rules}/**/*.csx`

## Documentation

- Full details: `FINAL-SCHEMA-SUMMARY.md`
- Mapping guide: `ENHANCED-MAPPING-GUIDE.md`
- Rule guide: `ENHANCED-RULES-GUIDE.md`
- Samples: `sample-workflow-with-enhanced-*.flow.json`
