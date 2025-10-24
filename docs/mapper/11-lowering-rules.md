# Lowering Rules

**Status:** Draft
**Last Updated:** 2025-10-22

## Overview

**Lowering** is the process of transforming a high-level MapSpec representation into a lower-level intermediate representation (IR) suitable for code generation. This document describes the transformation rules applied during the lowering phase.

**Pipeline Position:**
```
MapSpec (.mapper.json)
  → Validation
  → **Lowering** ← You are here
  → JSONata Code Generation
  → JSONata Expression (.mapper.jsonata)
```

## Goals

1. **Simplification** - Break complex operations into simpler primitives
2. **Normalization** - Convert equivalent representations to canonical form
3. **Desugaring** - Expand syntactic sugar into explicit operations
4. **Optimization** - Apply algebraic simplifications and constant folding
5. **Type Resolution** - Infer and validate types throughout the graph

## Intermediate Representation (IR)

The IR is a simplified version of MapSpec with additional metadata:

```typescript
interface LoweredMapSpec {
  version: string;
  nodes: LoweredNode[];
  edges: Edge[];
  types: TypeMap;              // Inferred types for all nodes/handles
  constants: Map<string, any>; // Extracted constants
  metadata: LoweredMetadata;
}

interface LoweredNode {
  id: string;
  kind: NodeKind;
  config: NodeConfig;
  inputTypes: string[];        // Inferred input types
  outputType: string;          // Inferred output type
  simplified?: boolean;        // Flag if node was simplified
}

interface TypeMap {
  [nodeId: string]: {
    inputs: { [handleId: string]: JSONSchemaType };
    output: JSONSchemaType;
  };
}
```

## Lowering Phases

Lowering happens in multiple passes:

```typescript
function lowerMapSpec(mapSpec: MapSpec): LoweredMapSpec {
  let ir = initializeIR(mapSpec);

  // Phase 1: Type inference
  ir = inferTypes(ir);

  // Phase 2: Constant extraction
  ir = extractConstants(ir);

  // Phase 3: Desugaring
  ir = desugar(ir);

  // Phase 4: Simplification
  ir = simplify(ir);

  // Phase 5: Optimization
  ir = optimize(ir);

  // Phase 6: Validation
  validateIR(ir);

  return ir;
}
```

## Phase 1: Type Inference

Infer types for all nodes and edges:

```typescript
function inferTypes(ir: LoweredMapSpec): LoweredMapSpec {
  // 1. Start with source schema types (known)
  for (const terminal of sourceTerminals) {
    ir.types[terminal.id] = {
      output: getSchemaType(terminal.path, sourceSchema)
    };
  }

  // 2. Propagate types forward through graph
  const sorted = topologicalSort(ir);

  for (const node of sorted) {
    if (node.kind === 'source') continue;

    // Get input types from dependencies
    const inputTypes = node.dependencies.map(depId =>
      ir.types[depId].output
    );

    // Infer output type based on operation
    const outputType = inferOutputType(node.kind, inputTypes, node.config);

    ir.types[node.id] = {
      inputs: Object.fromEntries(
        node.dependencies.map((depId, i) => [`input-${i + 1}`, inputTypes[i]])
      ),
      output: outputType
    };
  }

  return ir;
}

function inferOutputType(
  kind: NodeKind,
  inputTypes: JSONSchemaType[],
  config: NodeConfig
): JSONSchemaType {
  switch (kind) {
    // Binary arithmetic: number + number → number
    case 'Binary.Add':
    case 'Binary.Subtract':
    case 'Binary.Multiply':
    case 'Binary.Divide':
      return { type: 'number' };

    // Binary comparison: any + any → boolean
    case 'Binary.Equal':
    case 'Binary.NotEqual':
    case 'Binary.LessThan':
    case 'Binary.GreaterThan':
      return { type: 'boolean' };

    // String operations: string + ... → string
    case 'String.Concat':
    case 'String.Uppercase':
    case 'String.Lowercase':
      return { type: 'string' };

    // Collection operations preserve array type
    case 'Collection.Map':
    case 'Collection.Filter':
      return {
        type: 'array',
        items: inputTypes[0].items  // Preserve item type
      };

    // Aggregate: array → scalar
    case 'Aggregate.Sum':
    case 'Aggregate.Average':
      return { type: 'number' };

    case 'Aggregate.Count':
      return { type: 'integer' };

    // Conditional: preserves then/else type (must match)
    case 'Conditional.If':
      return inputTypes[1];  // Then branch type

    // Const: use config value type
    case 'Const.Value':
      return inferTypeFromValue(config.value);

    default:
      throw new Error(`Cannot infer type for ${kind}`);
  }
}
```

## Phase 2: Constant Extraction

Extract constant values into a separate map:

```typescript
function extractConstants(ir: LoweredMapSpec): LoweredMapSpec {
  const constants = new Map<string, any>();

  for (const node of ir.nodes) {
    if (node.kind === 'Const.Value') {
      constants.set(node.id, node.config.value);
      node.simplified = true;
    }
  }

  ir.constants = constants;
  return ir;
}
```

**Example:**
```json
// Before:
{
  "id": "const-vat-rate",
  "kind": "Const.Value",
  "config": { "value": 0.2 }
}

// After lowering:
constants.set("const-vat-rate", 0.2)
```

## Phase 3: Desugaring

Expand high-level operations into primitives:

### Variadic Operations

Convert variadic operations to binary trees:

```typescript
function desugarVariadic(node: LoweredNode, inputs: string[]): LoweredNode[] {
  if (inputs.length <= 2) {
    return [node];  // Already binary
  }

  // Create binary tree of operations
  const newNodes: LoweredNode[] = [];
  let currentId = inputs[0];

  for (let i = 1; i < inputs.length; i++) {
    const nodeId = i === inputs.length - 1
      ? node.id  // Last node keeps original ID
      : `${node.id}_desugar_${i}`;

    newNodes.push({
      id: nodeId,
      kind: node.kind,
      config: node.config,
      inputTypes: [ir.types[currentId].output, ir.types[inputs[i]].output],
      outputType: node.outputType
    });

    currentId = nodeId;
  }

  return newNodes;
}
```

**Example:**
```json
// Before: Concat with 4 inputs
{
  "id": "func-concat-1",
  "kind": "String.Concat",
  "inputs": ["a", "b", "c", "d"]
}

// After desugaring:
[
  { "id": "func-concat-1_desugar_1", "kind": "String.Concat", "inputs": ["a", "b"] },
  { "id": "func-concat-1_desugar_2", "kind": "String.Concat", "inputs": ["func-concat-1_desugar_1", "c"] },
  { "id": "func-concat-1", "kind": "String.Concat", "inputs": ["func-concat-1_desugar_2", "d"] }
]
```

### Array Comprehensions

Desugar collection operations into explicit map/filter:

```typescript
function desugarCollectionOp(node: LoweredNode): LoweredNode[] {
  switch (node.kind) {
    case 'Collection.Sum':
      // Desugar to Map + Aggregate.Sum
      return [
        {
          id: `${node.id}_map`,
          kind: 'Collection.Map',
          config: { lambda: node.config.selector },
          inputTypes: [node.inputTypes[0]],
          outputType: { type: 'array', items: { type: 'number' } }
        },
        {
          id: node.id,
          kind: 'Aggregate.Sum',
          config: {},
          inputTypes: [{ type: 'array', items: { type: 'number' } }],
          outputType: { type: 'number' }
        }
      ];

    case 'Collection.FilterMap':
      // Desugar to Filter + Map
      return [
        {
          id: `${node.id}_filter`,
          kind: 'Collection.Filter',
          config: { predicate: node.config.predicate },
          inputTypes: [node.inputTypes[0]],
          outputType: node.inputTypes[0]
        },
        {
          id: node.id,
          kind: 'Collection.Map',
          config: { lambda: node.config.mapper },
          inputTypes: [node.inputTypes[0]],
          outputType: node.outputType
        }
      ];

    default:
      return [node];
  }
}
```

### Default Values

Desugar default value operations:

```typescript
function desugarDefault(node: LoweredNode): LoweredNode[] {
  if (node.kind !== 'Conditional.DefaultValue') {
    return [node];
  }

  // DefaultValue(x, default) → If(x != null, x, default)
  return [
    {
      id: `${node.id}_check`,
      kind: 'Binary.NotEqual',
      config: {},
      inputTypes: [node.inputTypes[0], { type: 'null' }],
      outputType: { type: 'boolean' }
    },
    {
      id: node.id,
      kind: 'Conditional.If',
      config: {},
      inputTypes: [
        { type: 'boolean' },
        node.inputTypes[0],
        node.inputTypes[1]
      ],
      outputType: node.outputType
    }
  ];
}
```

## Phase 4: Simplification

Apply algebraic simplifications:

### Arithmetic Identities

```typescript
function simplifyArithmetic(node: LoweredNode, inputs: any[]): SimplifyResult {
  const [left, right] = inputs;

  switch (node.kind) {
    case 'Binary.Add':
      if (right === 0) return { simplified: true, value: left };  // x + 0 → x
      if (left === 0) return { simplified: true, value: right };  // 0 + x → x
      break;

    case 'Binary.Subtract':
      if (right === 0) return { simplified: true, value: left };  // x - 0 → x
      if (left === right) return { simplified: true, value: 0 }; // x - x → 0
      break;

    case 'Binary.Multiply':
      if (right === 0) return { simplified: true, value: 0 };     // x * 0 → 0
      if (left === 0) return { simplified: true, value: 0 };      // 0 * x → 0
      if (right === 1) return { simplified: true, value: left };  // x * 1 → x
      if (left === 1) return { simplified: true, value: right };  // 1 * x → x
      break;

    case 'Binary.Divide':
      if (right === 1) return { simplified: true, value: left };  // x / 1 → x
      if (left === right) return { simplified: true, value: 1 };  // x / x → 1
      break;

    case 'Binary.Power':
      if (right === 0) return { simplified: true, value: 1 };     // x ^ 0 → 1
      if (right === 1) return { simplified: true, value: left };  // x ^ 1 → x
      break;
  }

  return { simplified: false };
}
```

### Boolean Logic

```typescript
function simplifyBoolean(node: LoweredNode, inputs: any[]): SimplifyResult {
  const [left, right] = inputs;

  switch (node.kind) {
    case 'Binary.And':
      if (left === true) return { simplified: true, value: right };  // true and x → x
      if (right === true) return { simplified: true, value: left };  // x and true → x
      if (left === false) return { simplified: true, value: false }; // false and x → false
      if (right === false) return { simplified: true, value: false };// x and false → false
      break;

    case 'Binary.Or':
      if (left === true) return { simplified: true, value: true };   // true or x → true
      if (right === true) return { simplified: true, value: true };  // x or true → true
      if (left === false) return { simplified: true, value: right }; // false or x → x
      if (right === false) return { simplified: true, value: left }; // x or false → x
      break;

    case 'Unary.Not':
      if (left === true) return { simplified: true, value: false };  // not true → false
      if (left === false) return { simplified: true, value: true };  // not false → true
      break;
  }

  return { simplified: false };
}
```

### String Operations

```typescript
function simplifyString(node: LoweredNode, inputs: any[]): SimplifyResult {
  switch (node.kind) {
    case 'String.Concat':
      // Concat with empty strings
      const nonEmpty = inputs.filter(s => s !== '');
      if (nonEmpty.length < inputs.length) {
        return { simplified: true, value: nonEmpty };
      }
      break;

    case 'String.Substring':
      const [str, start, length] = inputs;
      if (start === 0 && length === undefined) {
        return { simplified: true, value: str };  // substring(x, 0) → x
      }
      break;
  }

  return { simplified: false };
}
```

### Conditional Simplification

```typescript
function simplifyConditional(node: LoweredNode, inputs: any[]): SimplifyResult {
  if (node.kind !== 'Conditional.If') {
    return { simplified: false };
  }

  const [condition, thenValue, elseValue] = inputs;

  // Constant condition
  if (condition === true) {
    return { simplified: true, value: thenValue };
  }
  if (condition === false) {
    return { simplified: true, value: elseValue };
  }

  // Same then/else branches
  if (thenValue === elseValue) {
    return { simplified: true, value: thenValue };
  }

  return { simplified: false };
}
```

## Phase 5: Optimization

Apply graph-level optimizations:

### Constant Folding

Evaluate constant expressions at compile time:

```typescript
function foldConstants(ir: LoweredMapSpec): LoweredMapSpec {
  for (const node of ir.nodes) {
    // Check if all inputs are constants
    const inputValues = node.dependencies.map(depId =>
      ir.constants.get(depId)
    );

    if (inputValues.every(v => v !== undefined)) {
      // All inputs are constants, evaluate
      const result = evaluateNode(node.kind, inputValues, node.config);

      // Replace node with constant
      ir.constants.set(node.id, result);
      node.kind = 'Const.Value';
      node.config = { value: result };
      node.simplified = true;
    }
  }

  return ir;
}

function evaluateNode(
  kind: NodeKind,
  inputs: any[],
  config: NodeConfig
): any {
  switch (kind) {
    case 'Binary.Add':
      return inputs[0] + inputs[1];

    case 'Binary.Multiply':
      return inputs[0] * inputs[1];

    case 'String.Concat':
      return inputs.join('');

    case 'String.Uppercase':
      return inputs[0].toUpperCase();

    // ... etc for all operations
  }
}
```

**Example:**
```json
// Before:
{ "kind": "Binary.Multiply", "inputs": [10, 2] }

// After constant folding:
{ "kind": "Const.Value", "config": { "value": 20 } }
```

### Dead Code Elimination

Remove nodes with no downstream consumers:

```typescript
function eliminateDeadCode(ir: LoweredMapSpec): LoweredMapSpec {
  const reachable = new Set<string>();

  // Mark all target terminals as reachable
  for (const terminal of targetTerminals) {
    markReachable(terminal.id, ir, reachable);
  }

  // Remove unreachable nodes
  ir.nodes = ir.nodes.filter(node => reachable.has(node.id));

  return ir;
}

function markReachable(
  nodeId: string,
  ir: LoweredMapSpec,
  reachable: Set<string>
) {
  if (reachable.has(nodeId)) return;

  reachable.add(nodeId);

  const node = ir.nodes.find(n => n.id === nodeId);
  if (node) {
    for (const depId of node.dependencies) {
      markReachable(depId, ir, reachable);
    }
  }
}
```

### Common Subexpression Elimination (CSE)

**CSE eliminates redundant computations when functoid outputs are reused multiple times.**

The actual implementation uses a **multi-phase approach** integrated into the lowering pipeline:

#### Phase 1: Build Node Expressions
Build expression trees for each functoid node using placeholders for references:

```typescript
class MapSpecLowerer {
  private nodeExpressions: Map<string, Expression> = new Map();

  private buildNodeExpressions(): void {
    for (const node of this.mapSpec.nodes) {
      const inputEdges = this.mapSpec.edges.filter(e => e.target === node.id);
      const inputs = inputEdges.map(edge => this.getSourceExpression(edge));

      const expr = this.buildExpressionForNode(node, inputs);
      this.nodeExpressions.set(node.id, expr);
    }
  }

  private getSourceExpression(edge: Edge): Expression {
    if (edge.source === 'source-schema') {
      return this.field(this.cleanPath(edge.sourceHandle));
    }
    // Create placeholder that preserves node identity
    return {
      kind: 'sharedRef' as const,
      nodeId: edge.source,
      varName: ''  // Will be filled in if shareable
    };
  }
}
```

#### Phase 2: Compute Reference Counts
Count how many times each functoid output is referenced:

```typescript
private computeRefCounts(): void {
  for (const edge of this.mapSpec.edges) {
    if (edge.source === 'source-schema' || edge.source === 'target-schema') {
      continue;
    }
    const count = this.nodeRefCounts.get(edge.source) || 0;
    this.nodeRefCounts.set(edge.source, count + 1);
  }
}
```

#### Phase 3: Mark Shareable Nodes
Determine which nodes should be hoisted based on **purity**, **refcount**, and **cost**:

```typescript
private markShareableNodes(): void {
  for (const node of this.mapSpec.nodes) {
    const refCount = this.nodeRefCounts.get(node.id) || 0;
    if (refCount <= 1) continue;  // Not reused

    if (!this.isPureNodeKind(node.kind)) continue;  // Has side effects

    const expr = this.nodeExpressions.get(node.id);
    if (!expr) continue;

    const cost = this.estimateCost(expr);
    if (cost < 2) continue;  // Too trivial to hoist

    this.shareableNodes.add(node.id);
  }
}

private isPureNodeKind(kind: NodeKind): boolean {
  // Impure operations that should never be hoisted
  const impure = new Set<NodeKind>([
    'DateTime.Now',      // Non-deterministic
    'Custom.Function'    // Unknown side effects
  ]);
  return !impure.has(kind);
}

private estimateCost(expr: Expression): number {
  switch (expr.kind) {
    case 'literal':
    case 'field':
      return 1;  // Trivial
    case 'binary':
      return 2 + this.estimateCost(expr.left) + this.estimateCost(expr.right);
    case 'call':
      const argCost = expr.args.reduce((sum, arg) => sum + this.estimateCost(arg), 0);
      return 3 + argCost;
    // ... other cases
  }
}
```

**Purity Rules:**
- **Pure**: String operations, arithmetic, comparisons, aggregations
- **Impure**: DateTime.Now (non-deterministic), Custom.Function (unknown side effects)

**Cost Heuristic:**
- Threshold: `cost >= 2`
- Field references and literals have cost 1 (too trivial)
- Binary operations have cost 2+ (worth hoisting if reused)
- Function calls have cost 3+ (definitely worth hoisting)

#### Phase 4: Replace with Shared References
Recursively replace all references to shareable nodes throughout the expression tree:

```typescript
private replaceWithSharedRefs(): void {
  // Recursively replace SharedRefExpr placeholders
  for (const [nodeId, expr] of this.nodeExpressions) {
    this.nodeExpressions.set(nodeId, this.replaceSharedRefsInExpr(expr));
  }
}

private replaceSharedRefsInExpr(expr: Expression): Expression {
  switch (expr.kind) {
    case 'sharedRef':
      if (this.shareableNodes.has(expr.nodeId)) {
        // Keep as SharedRefExpr with varName filled in
        const varName = '$functoid_' + expr.nodeId.replace(/-/g, '_');
        return { kind: 'sharedRef', nodeId: expr.nodeId, varName };
      } else {
        // Inline the full expression recursively
        const fullExpr = this.nodeExpressions.get(expr.nodeId);
        if (!fullExpr) return this.literal(null, 'null');
        return this.replaceSharedRefsInExpr(fullExpr);
      }

    case 'binary':
      return {
        ...expr,
        left: this.replaceSharedRefsInExpr(expr.left),
        right: this.replaceSharedRefsInExpr(expr.right)
      };

    case 'call':
      return {
        ...expr,
        args: expr.args.map(arg => this.replaceSharedRefsInExpr(arg))
      };

    case 'conditional':
      return {
        ...expr,
        condition: this.replaceSharedRefsInExpr(expr.condition),
        then: this.replaceSharedRefsInExpr(expr.then),
        else: this.replaceSharedRefsInExpr(expr.else)
      };

    // ... other expression types

    default:
      return expr;  // Literals, fields, etc.
  }
}
```

#### Phase 5: Build Shared Expressions (Dead Code Elimination)
Only emit variable bindings for actually-referenced shared expressions:

```typescript
private buildSharedExpressions(): SharedExpression[] {
  const shared: SharedExpression[] = [];
  const referencedShared = new Set<string>();

  // Collect all SharedRefExpr references from final expressions
  const collectRefs = (expr: Expression) => {
    if (expr.kind === 'sharedRef' && expr.varName) {
      referencedShared.add(expr.nodeId);
    }
    // Recursively scan nested expressions...
  };

  for (const expr of this.nodeExpressions.values()) {
    collectRefs(expr);
  }

  // Only emit bindings for referenced nodes
  for (const nodeId of this.shareableNodes) {
    if (!referencedShared.has(nodeId)) continue;  // Dead code

    const node = this.mapSpec.nodes.find(n => n.id === nodeId);
    const expr = this.nodeExpressions.get(nodeId);
    const refCount = this.nodeRefCounts.get(nodeId) || 0;
    const varName = '$functoid_' + nodeId.replace(/-/g, '_');
    const hintName = this.camelCase(node?.label || '');

    shared.push({ nodeId, varName, expression: expr, hintName, refCount });
  }

  return shared;
}
```

#### Complete Example

**MapSpec:**
```json
{
  "nodes": [
    { "id": "mult-1", "kind": "Binary.Multiply", "label": "Line Total" }
  ],
  "edges": [
    { "source": "source-schema", "sourceHandle": "$.quantity", "target": "mult-1", "targetHandle": "input-1" },
    { "source": "source-schema", "sourceHandle": "$.price", "target": "mult-1", "targetHandle": "input-2" },
    { "source": "mult-1", "target": "target-schema", "targetHandle": "$.subtotal" },
    { "source": "mult-1", "target": "tax-calc", "targetHandle": "input-1" },
    { "source": "mult-1", "target": "total-calc", "targetHandle": "input-1" }
  ]
}
```

**After CSE Analysis:**
- `mult-1` has refCount = 3 (used by subtotal, tax-calc, total-calc)
- `mult-1` is pure (Binary.Multiply)
- `mult-1` has cost = 2 (threshold met)
- `mult-1` marked as shareable

**Generated MapperIR:**
```typescript
{
  sharedExpressions: [
    {
      nodeId: "mult-1",
      varName: "$functoid_mult_1",
      expression: { kind: 'binary', operator: 'multiply', left: {...}, right: {...} },
      hintName: "lineTotal",
      refCount: 3
    }
  ],
  mappings: [
    {
      target: "subtotal",
      expression: { kind: 'sharedRef', nodeId: "mult-1", varName: "$functoid_mult_1" }
    },
    // Other mappings reference $functoid_mult_1 instead of recomputing
  ]
}
```

**Generated JSONata:**
```jsonata
(
  $functoid_mult_1 := quantity * price;
  {
    "subtotal": $functoid_mult_1,
    "tax": $functoid_mult_1 * 0.2,
    "total": $functoid_mult_1 * 1.2
  }
)
```

## Phase 6: Validation

Validate the lowered IR:

```typescript
function validateIR(ir: LoweredMapSpec): void {
  // 1. Type consistency
  for (const node of ir.nodes) {
    for (let i = 0; i < node.dependencies.length; i++) {
      const depId = node.dependencies[i];
      const actualType = ir.types[depId].output;
      const expectedType = node.inputTypes[i];

      if (!isTypeCompatible(actualType, expectedType)) {
        throw new Error(
          `Type error at ${node.id}: input ${i + 1} expects ${JSON.stringify(expectedType)} but got ${JSON.stringify(actualType)}`
        );
      }
    }
  }

  // 2. No cycles
  try {
    topologicalSort(ir);
  } catch (err) {
    throw new Error(`Circular dependency detected: ${err.message}`);
  }

  // 3. All dependencies exist
  for (const node of ir.nodes) {
    for (const depId of node.dependencies) {
      if (!ir.nodes.find(n => n.id === depId) && !ir.constants.has(depId)) {
        throw new Error(`Missing dependency: ${node.id} depends on ${depId}`);
      }
    }
  }

  // 4. All target terminals have sources
  for (const terminal of targetTerminals) {
    const hasSource = ir.edges.some(e => e.target === terminal.id);
    if (!hasSource && !terminal.optional) {
      console.warn(`Warning: Target field ${terminal.id} has no source mapping`);
    }
  }
}
```

## Type Compatibility

Define type compatibility rules:

```typescript
function isTypeCompatible(
  actual: JSONSchemaType,
  expected: JSONSchemaType
): boolean {
  // Exact match
  if (actual.type === expected.type) {
    // For arrays, check item types recursively
    if (actual.type === 'array' && expected.type === 'array') {
      return isTypeCompatible(actual.items, expected.items);
    }
    return true;
  }

  // Number subtypes
  if (actual.type === 'integer' && expected.type === 'number') {
    return true;  // integer is subtype of number
  }

  // Any type accepts anything
  if (expected.type === 'any' || actual.type === 'any') {
    return true;
  }

  // Union types
  if (expected.anyOf) {
    return expected.anyOf.some(t => isTypeCompatible(actual, t));
  }

  return false;
}
```

## Complete Lowering Example

**Input MapSpec:**
```json
{
  "nodes": [
    {
      "id": "const-10",
      "kind": "Const.Value",
      "config": { "value": 10 }
    },
    {
      "id": "const-2",
      "kind": "Const.Value",
      "config": { "value": 2 }
    },
    {
      "id": "mult-1",
      "kind": "Binary.Multiply",
      "config": {}
    },
    {
      "id": "mult-2",
      "kind": "Binary.Multiply",
      "config": {}
    }
  ],
  "edges": [
    { "source": "const-10", "target": "mult-1", "targetHandle": "input-1" },
    { "source": "const-2", "target": "mult-1", "targetHandle": "input-2" },
    { "source": "const-10", "target": "mult-2", "targetHandle": "input-1" },
    { "source": "const-2", "target": "mult-2", "targetHandle": "input-2" },
    { "source": "mult-1", "target": "$.result1" },
    { "source": "mult-2", "target": "$.result2" }
  ]
}
```

**After Lowering:**

1. **Type Inference:** All nodes typed as `number`
2. **Constant Extraction:** `const-10 → 10`, `const-2 → 2`
3. **Constant Folding:** `mult-1` and `mult-2` evaluated to `20`
4. **CSE:** `mult-1` and `mult-2` are identical, merge into one
5. **Final IR:**

```json
{
  "nodes": [
    {
      "id": "const-20",
      "kind": "Const.Value",
      "config": { "value": 20 },
      "outputType": { "type": "number" }
    }
  ],
  "edges": [
    { "source": "const-20", "target": "$.result1" },
    { "source": "const-20", "target": "$.result2" }
  ],
  "constants": {
    "const-20": 20
  }
}
```

**Generated JSONata:**
```jsonata
{
  "result1": 20,
  "result2": 20
}
```

## CLI Integration

```bash
# Show lowering steps
mapper lower order-to-invoice.mapper.json --verbose

# Output:
# ✓ Phase 1: Type inference (42 types inferred)
# ✓ Phase 2: Constant extraction (3 constants)
# ✓ Phase 3: Desugaring (1 variadic operation expanded)
# ✓ Phase 4: Simplification (5 nodes simplified)
# ✓ Phase 5: Optimization (2 constants folded, 1 CSE)
# ✓ Phase 6: Validation (no errors)

# Output lowered IR to file
mapper lower order-to-invoice.mapper.json --output order-to-invoice.ir.json
```

## Debug Visualization

Visualize lowering transformations:

```typescript
function visualizeLowering(before: MapSpec, after: LoweredMapSpec): string {
  return `
Lowering Report:
================

Original nodes: ${before.nodes.length}
Lowered nodes: ${after.nodes.length}
Eliminated: ${before.nodes.length - after.nodes.length}

Simplified nodes:
${after.nodes.filter(n => n.simplified).map(n => `  - ${n.id}`).join('\n')}

Constant values:
${Array.from(after.constants.entries()).map(([k, v]) => `  - ${k} = ${v}`).join('\n')}

Type errors: 0
Warnings: 0
  `;
}
```

## See Also

- [MapSpec Schema](./04-mapspec-schema.md) - Input format
- [JSONata Code Generation](./10-jsonata-codegen.md) - Next pipeline stage
- [Validation](./12-validation.md) - Validation rules
- [Compiler Design Patterns](https://en.wikipedia.org/wiki/Compiler) - Background on lowering
