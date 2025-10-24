# Validation

**Status:** Draft
**Last Updated:** 2025-10-22

## Overview

**Validation** ensures that mappers are correct, complete, and safe before deployment. This document describes the validation rules applied at different stages of the mapper lifecycle.

**Validation Stages:**
```
Design Time (Editor)  → Validation as you type
Build Time (CLI)      → Validation before code generation
Test Time             → Validation with test data
Deploy Time           → Validation before deployment
```

## Validation Levels

### Level 1: Schema Validation

Validate that the MapSpec file conforms to the JSON Schema:

```typescript
import Ajv from 'ajv';

function validateSchema(mapSpec: any): ValidationResult {
  const ajv = new Ajv({ allErrors: true });
  const schema = loadMapSpecSchema();  // From 04-mapspec-schema.md
  const validate = ajv.compile(schema);

  const valid = validate(mapSpec);

  if (!valid) {
    return {
      level: 'error',
      errors: validate.errors!.map(err => ({
        path: err.instancePath,
        message: err.message,
        params: err.params
      }))
    };
  }

  return { level: 'success', errors: [] };
}
```

**Example Errors:**
```json
{
  "level": "error",
  "errors": [
    {
      "path": "/nodes/0/kind",
      "message": "must be equal to one of the allowed values",
      "params": { "allowedValues": ["Binary.Add", "Binary.Multiply", ...] }
    }
  ]
}
```

### Level 2: Structural Validation

Validate graph structure and connectivity:

```typescript
function validateStructure(mapSpec: MapSpec): ValidationResult {
  const errors: ValidationError[] = [];

  // 1. All edge endpoints exist
  for (const edge of mapSpec.edges) {
    if (!nodeExists(mapSpec, edge.source) && !isSourceTerminal(edge.source)) {
      errors.push({
        level: 'error',
        code: 'EDGE_SOURCE_NOT_FOUND',
        message: `Edge source "${edge.source}" does not exist`,
        location: { edge: edge.id }
      });
    }

    if (!nodeExists(mapSpec, edge.target) && !isTargetTerminal(edge.target)) {
      errors.push({
        level: 'error',
        code: 'EDGE_TARGET_NOT_FOUND',
        message: `Edge target "${edge.target}" does not exist`,
        location: { edge: edge.id }
      });
    }
  }

  // 2. No duplicate edges
  const edgeSet = new Set<string>();
  for (const edge of mapSpec.edges) {
    const key = `${edge.source}:${edge.sourceHandle} → ${edge.target}:${edge.targetHandle}`;
    if (edgeSet.has(key)) {
      errors.push({
        level: 'warning',
        code: 'DUPLICATE_EDGE',
        message: `Duplicate edge: ${key}`,
        location: { edge: edge.id }
      });
    }
    edgeSet.add(key);
  }

  // 3. No self-loops
  for (const edge of mapSpec.edges) {
    if (edge.source === edge.target) {
      errors.push({
        level: 'error',
        code: 'SELF_LOOP',
        message: `Node "${edge.source}" connects to itself`,
        location: { edge: edge.id, node: edge.source }
      });
    }
  }

  // 4. No cycles
  try {
    topologicalSort(mapSpec);
  } catch (err) {
    errors.push({
      level: 'error',
      code: 'CIRCULAR_DEPENDENCY',
      message: `Circular dependency detected: ${err.message}`,
      location: { graph: true }
    });
  }

  return { level: errors.length > 0 ? 'error' : 'success', errors };
}
```

### Level 3: Type Validation

Validate type compatibility across edges:

```typescript
function validateTypes(mapSpec: MapSpec): ValidationResult {
  const errors: ValidationError[] = [];
  const types = inferTypes(mapSpec);  // From lowering phase

  for (const edge of mapSpec.edges) {
    const sourceType = types[edge.source]?.output;
    const targetNode = mapSpec.nodes.find(n => n.id === edge.target);

    if (!sourceType) {
      errors.push({
        level: 'error',
        code: 'TYPE_UNKNOWN',
        message: `Cannot determine type for "${edge.source}"`,
        location: { edge: edge.id }
      });
      continue;
    }

    // Get expected input type
    let expectedType: JSONSchemaType | undefined;

    if (targetNode) {
      // Target is a functoid node
      const handleIndex = getHandleIndex(edge.targetHandle);
      expectedType = getExpectedInputType(targetNode.kind, handleIndex);
    } else {
      // Target is a target terminal
      expectedType = getSchemaType(edge.targetHandle, targetSchema);
    }

    if (expectedType && !isTypeCompatible(sourceType, expectedType)) {
      errors.push({
        level: 'error',
        code: 'TYPE_MISMATCH',
        message: `Type mismatch: Cannot connect ${formatType(sourceType)} to ${formatType(expectedType)}`,
        location: { edge: edge.id },
        details: {
          sourceType: formatType(sourceType),
          expectedType: formatType(expectedType)
        }
      });
    }
  }

  return { level: errors.some(e => e.level === 'error') ? 'error' : 'success', errors };
}

function formatType(type: JSONSchemaType): string {
  if (type.type === 'array') {
    return `${formatType(type.items)}[]`;
  }
  return type.type || 'any';
}
```

**Example Type Error:**
```json
{
  "level": "error",
  "code": "TYPE_MISMATCH",
  "message": "Type mismatch: Cannot connect string to number",
  "location": { "edge": "edge-123" },
  "details": {
    "sourceType": "string",
    "expectedType": "number"
  }
}
```

### Level 4: Completeness Validation

Validate that all required mappings are present:

```typescript
function validateCompleteness(mapSpec: MapSpec): ValidationResult {
  const errors: ValidationError[] = [];

  // 1. All required target fields must have sources
  const targetFields = flattenSchema(targetSchema);

  for (const field of targetFields) {
    const isRequired = !field.optional;
    const hasSource = mapSpec.edges.some(e =>
      e.targetHandle === field.id || e.target === field.id
    );

    if (isRequired && !hasSource) {
      errors.push({
        level: 'error',
        code: 'MISSING_REQUIRED_MAPPING',
        message: `Required target field "${field.name}" has no source mapping`,
        location: { targetField: field.id }
      });
    } else if (!isRequired && !hasSource) {
      errors.push({
        level: 'info',
        code: 'MISSING_OPTIONAL_MAPPING',
        message: `Optional target field "${field.name}" has no source mapping`,
        location: { targetField: field.id }
      });
    }
  }

  // 2. All functoid inputs must be connected
  for (const node of mapSpec.nodes) {
    const expectedInputs = getExpectedInputCount(node.kind);
    const actualInputs = mapSpec.edges.filter(e =>
      e.target === node.id
    ).length;

    if (actualInputs < expectedInputs) {
      errors.push({
        level: 'error',
        code: 'MISSING_FUNCTOID_INPUT',
        message: `Node "${node.id}" expects ${expectedInputs} inputs but has ${actualInputs}`,
        location: { node: node.id },
        details: {
          expected: expectedInputs,
          actual: actualInputs
        }
      });
    }
  }

  // 3. All functoid outputs should be used
  for (const node of mapSpec.nodes) {
    const hasOutput = mapSpec.edges.some(e => e.source === node.id);

    if (!hasOutput) {
      errors.push({
        level: 'warning',
        code: 'UNUSED_FUNCTOID',
        message: `Node "${node.id}" output is not connected`,
        location: { node: node.id }
      });
    }
  }

  return {
    level: errors.some(e => e.level === 'error') ? 'error' : 'success',
    errors
  };
}
```

### Level 5: Semantic Validation

Validate logical correctness and best practices:

```typescript
function validateSemantics(mapSpec: MapSpec): ValidationResult {
  const errors: ValidationError[] = [];

  // 1. Detect potential null pointer issues
  for (const edge of mapSpec.edges) {
    const sourceType = inferType(mapSpec, edge.source);

    if (sourceType.nullable && !hasNullCheck(mapSpec, edge.source)) {
      errors.push({
        level: 'warning',
        code: 'POTENTIAL_NULL_VALUE',
        message: `Field "${edge.source}" may be null but has no null check`,
        location: { edge: edge.id },
        suggestion: 'Add a default value or conditional check'
      });
    }
  }

  // 2. Detect potential division by zero
  for (const node of mapSpec.nodes) {
    if (node.kind === 'Binary.Divide') {
      const divisorEdge = mapSpec.edges.find(e =>
        e.target === node.id && e.targetHandle === 'input-2'
      );

      if (divisorEdge) {
        const divisorValue = getConstantValue(mapSpec, divisorEdge.source);
        if (divisorValue === 0) {
          errors.push({
            level: 'error',
            code: 'DIVISION_BY_ZERO',
            message: `Division by zero detected in node "${node.id}"`,
            location: { node: node.id }
          });
        }
      }
    }
  }

  // 3. Detect potentially expensive operations
  for (const node of mapSpec.nodes) {
    if (isExpensiveOperation(node.kind)) {
      const isInArrayContext = isInsideArrayMapping(mapSpec, node.id);

      if (isInArrayContext) {
        errors.push({
          level: 'warning',
          code: 'EXPENSIVE_OPERATION_IN_LOOP',
          message: `Expensive operation "${node.kind}" inside array mapping`,
          location: { node: node.id },
          suggestion: 'Consider hoisting this operation outside the array mapping'
        });
      }
    }
  }

  // 4. Detect unreachable code
  const reachable = computeReachableNodes(mapSpec);
  for (const node of mapSpec.nodes) {
    if (!reachable.has(node.id)) {
      errors.push({
        level: 'warning',
        code: 'UNREACHABLE_NODE',
        message: `Node "${node.id}" is not reachable from any target field`,
        location: { node: node.id },
        suggestion: 'Remove this node or connect it to a target field'
      });
    }
  }

  return {
    level: errors.some(e => e.level === 'error') ? 'error' : 'success',
    errors
  };
}
```

## Validation Error Codes

### Schema Errors (1xxx)

- `1001`: `INVALID_JSON` - Malformed JSON
- `1002`: `SCHEMA_VERSION_MISMATCH` - Unsupported schema version
- `1003`: `MISSING_REQUIRED_FIELD` - Required field missing
- `1004`: `INVALID_FIELD_TYPE` - Field has wrong type

### Structural Errors (2xxx)

- `2001`: `EDGE_SOURCE_NOT_FOUND` - Edge source does not exist
- `2002`: `EDGE_TARGET_NOT_FOUND` - Edge target does not exist
- `2003`: `DUPLICATE_EDGE` - Multiple edges with same source/target
- `2004`: `SELF_LOOP` - Node connects to itself
- `2005`: `CIRCULAR_DEPENDENCY` - Cycle detected in graph
- `2006`: `DUPLICATE_NODE_ID` - Multiple nodes with same ID

### Type Errors (3xxx)

- `3001`: `TYPE_MISMATCH` - Incompatible types connected
- `3002`: `TYPE_UNKNOWN` - Cannot infer type
- `3003`: `ARRAY_DIMENSION_MISMATCH` - Array nesting level mismatch
- `3004`: `INVALID_ARRAY_OPERATION` - Operation not valid for arrays

### Completeness Errors (4xxx)

- `4001`: `MISSING_REQUIRED_MAPPING` - Required target field unmapped
- `4002`: `MISSING_FUNCTOID_INPUT` - Functoid missing input
- `4003`: `UNUSED_FUNCTOID` - Functoid output not used
- `4004`: `MISSING_SOURCE_SCHEMA` - Source schema not found
- `4005`: `MISSING_TARGET_SCHEMA` - Target schema not found

### Semantic Errors (5xxx)

- `5001`: `POTENTIAL_NULL_VALUE` - Possible null reference
- `5002`: `DIVISION_BY_ZERO` - Division by zero
- `5003`: `EXPENSIVE_OPERATION_IN_LOOP` - Performance concern
- `5004`: `UNREACHABLE_NODE` - Dead code detected
- `5005`: `INVALID_REGEX` - Invalid regular expression
- `5006`: `ARRAY_INDEX_OUT_OF_BOUNDS` - Array access may fail

## Quick Fixes

Provide automatic fixes for common errors:

```typescript
interface QuickFix {
  code: string;              // Error code this fixes
  title: string;             // User-facing title
  description: string;       // Explanation
  apply: (mapSpec: MapSpec, error: ValidationError) => MapSpec;
}

const quickFixes: QuickFix[] = [
  {
    code: 'MISSING_REQUIRED_MAPPING',
    title: 'Add direct mapping from source',
    description: 'Create a 1:1 mapping from a source field with matching name',
    apply: (mapSpec, error) => {
      const targetField = error.location.targetField;
      const targetName = getFieldName(targetField);

      // Find source field with same name
      const sourceField = findSourceFieldByName(mapSpec, targetName);

      if (sourceField) {
        mapSpec.edges.push({
          id: generateEdgeId(),
          source: sourceField.id,
          sourceHandle: sourceField.id,
          target: targetField,
          targetHandle: targetField
        });
      }

      return mapSpec;
    }
  },

  {
    code: 'TYPE_MISMATCH',
    title: 'Insert type conversion',
    description: 'Add a functoid to convert between types',
    apply: (mapSpec, error) => {
      const edge = findEdge(mapSpec, error.location.edge);
      const conversion = inferTypeConversion(
        error.details.sourceType,
        error.details.expectedType
      );

      // Insert conversion node
      const conversionNode = {
        id: generateNodeId('convert'),
        kind: conversion.kind,
        config: conversion.config
      };

      mapSpec.nodes.push(conversionNode);

      // Update edge to go through conversion
      edge.target = conversionNode.id;
      edge.targetHandle = 'input';

      // Add edge from conversion to original target
      mapSpec.edges.push({
        id: generateEdgeId(),
        source: conversionNode.id,
        sourceHandle: 'output',
        target: error.location.edge.target,
        targetHandle: error.location.edge.targetHandle
      });

      return mapSpec;
    }
  },

  {
    code: 'UNUSED_FUNCTOID',
    title: 'Remove unused node',
    description: 'Delete this node and its incoming edges',
    apply: (mapSpec, error) => {
      const nodeId = error.location.node;

      // Remove node
      mapSpec.nodes = mapSpec.nodes.filter(n => n.id !== nodeId);

      // Remove edges to this node
      mapSpec.edges = mapSpec.edges.filter(e => e.target !== nodeId);

      return mapSpec;
    }
  }
];
```

## Test Data Validation

Validate mapper against test cases:

```typescript
function validateWithTests(
  mapSpec: MapSpec,
  generatedCode: string
): ValidationResult {
  const errors: ValidationError[] = [];

  if (!mapSpec.tests || mapSpec.tests.length === 0) {
    errors.push({
      level: 'info',
      code: 'NO_TESTS',
      message: 'No test cases defined',
      suggestion: 'Add test cases to validate mapper behavior'
    });
    return { level: 'info', errors };
  }

  const expression = jsonata(generatedCode);

  for (const test of mapSpec.tests) {
    try {
      const result = expression.evaluate(test.input);

      // Deep comparison
      if (!deepEqual(result, test.expected)) {
        errors.push({
          level: 'error',
          code: 'TEST_FAILED',
          message: `Test "${test.name}" failed`,
          location: { test: test.name },
          details: {
            expected: test.expected,
            actual: result,
            diff: generateDiff(test.expected, result)
          }
        });
      }
    } catch (err) {
      errors.push({
        level: 'error',
        code: 'TEST_EXECUTION_ERROR',
        message: `Test "${test.name}" threw error: ${err.message}`,
        location: { test: test.name }
      });
    }
  }

  return {
    level: errors.some(e => e.level === 'error') ? 'error' : 'success',
    errors
  };
}
```

## VS Code Integration

Integrate validation with VS Code diagnostics:

```typescript
import * as vscode from 'vscode';

function publishDiagnostics(
  document: vscode.TextDocument,
  validationResult: ValidationResult
) {
  const diagnostics: vscode.Diagnostic[] = [];

  for (const error of validationResult.errors) {
    const range = getErrorRange(document, error.location);

    const diagnostic = new vscode.Diagnostic(
      range,
      error.message,
      mapSeverity(error.level)
    );

    diagnostic.code = error.code;
    diagnostic.source = 'amorphie-mapper';

    // Add related information
    if (error.details) {
      diagnostic.relatedInformation = [
        new vscode.DiagnosticRelatedInformation(
          new vscode.Location(document.uri, range),
          JSON.stringify(error.details, null, 2)
        )
      ];
    }

    diagnostics.push(diagnostic);
  }

  vscode.languages.createDiagnosticCollection('amorphie-mapper')
    .set(document.uri, diagnostics);
}

function mapSeverity(level: string): vscode.DiagnosticSeverity {
  switch (level) {
    case 'error':
      return vscode.DiagnosticSeverity.Error;
    case 'warning':
      return vscode.DiagnosticSeverity.Warning;
    case 'info':
      return vscode.DiagnosticSeverity.Information;
    default:
      return vscode.DiagnosticSeverity.Hint;
  }
}
```

## CLI Validation

```bash
# Validate mapper
mapper validate order-to-invoice.mapper.json

# Output:
# ✓ Schema validation passed
# ✓ Structural validation passed
# ✓ Type validation passed
# ✗ Completeness validation failed (2 errors)
#   - Error: Required target field "invoiceDate" has no source mapping
#   - Error: Required target field "customerName" has no source mapping
# ✓ Semantic validation passed
#
# 2 errors, 0 warnings

# Validate with tests
mapper validate order-to-invoice.mapper.json --test

# Validate and show quick fixes
mapper validate order-to-invoice.mapper.json --fix

# Strict mode (treat warnings as errors)
mapper validate order-to-invoice.mapper.json --strict

# JSON output for CI
mapper validate order-to-invoice.mapper.json --json
```

## CI/CD Integration

Example GitHub Actions workflow:

```yaml
name: Validate Mappers

on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Validate mappers
        run: |
          for file in mappers/*.mapper.json; do
            echo "Validating $file..."
            mapper validate "$file" --strict --json > "${file}.validation.json"
          done

      - name: Check validation results
        run: |
          if grep -q '"level": "error"' mappers/*.validation.json; then
            echo "Validation failed"
            exit 1
          fi
```

## Validation Report

Generate comprehensive validation report:

```typescript
function generateValidationReport(
  mapSpec: MapSpec,
  allResults: ValidationResult[]
): string {
  const totalErrors = allResults.flatMap(r => r.errors).filter(e => e.level === 'error').length;
  const totalWarnings = allResults.flatMap(r => r.errors).filter(e => e.level === 'warning').length;

  return `
# Validation Report: ${mapSpec.metadata.name}

**Status:** ${totalErrors === 0 ? '✓ PASS' : '✗ FAIL'}
**Errors:** ${totalErrors}
**Warnings:** ${totalWarnings}

## Summary

| Check | Status | Errors | Warnings |
|-------|--------|--------|----------|
| Schema | ${getStatusIcon(allResults[0])} | ${countErrors(allResults[0])} | ${countWarnings(allResults[0])} |
| Structure | ${getStatusIcon(allResults[1])} | ${countErrors(allResults[1])} | ${countWarnings(allResults[1])} |
| Types | ${getStatusIcon(allResults[2])} | ${countErrors(allResults[2])} | ${countWarnings(allResults[2])} |
| Completeness | ${getStatusIcon(allResults[3])} | ${countErrors(allResults[3])} | ${countWarnings(allResults[3])} |
| Semantics | ${getStatusIcon(allResults[4])} | ${countErrors(allResults[4])} | ${countWarnings(allResults[4])} |

## Issues

${formatIssues(allResults)}

---
Generated: ${new Date().toISOString()}
  `.trim();
}
```

## See Also

- [MapSpec Schema](./04-mapspec-schema.md) - Schema definition
- [Lowering Rules](./11-lowering-rules.md) - Type inference
- [Test Runner](./13-test-runner.md) - Test execution
- [VS Code Extension](./16-integration.md) - Editor integration
