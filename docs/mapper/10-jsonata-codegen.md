# JSONata Code Generation

**Status:** Draft
**Last Updated:** 2025-10-22

## Overview

**JSONata Code Generation** is the core transformation that converts a MapSpec (semantic mapping definition) into executable JSONata code. This document describes the algorithm, rules, and patterns for generating correct, optimized JSONata expressions.

**Pipeline:**
```
MapSpec (.mapper.json)
  → Validation & Lowering
  → JSONata Code Generation
  → JSONata Expression (.mapper.jsonata)
  → Runtime Execution
```

## Goals

1. **Correctness** - Generated JSONata must produce correct output
2. **Readability** - Generated code should be human-readable for debugging
3. **Optimization** - Avoid redundant computations and traversals
4. **Determinism** - Same MapSpec always generates identical JSONata
5. **Type Safety** - Respect source/target schema types

## High-Level Algorithm

```typescript
function generateJSONata(mapSpec: MapSpec): string {
  // 1. Build dependency graph from edges
  const graph = buildDependencyGraph(mapSpec);

  // 2. Topologically sort nodes (dependencies before dependents)
  const sortedNodes = topologicalSort(graph);

  // 3. Generate expressions for each node
  const expressions = sortedNodes.map(node =>
    generateNodeExpression(node, graph)
  );

  // 4. Compose final JSONata expression
  return composeTargetExpression(mapSpec, expressions);
}
```

## Dependency Graph

Build a directed graph where:
- **Nodes** = MapSpec nodes (functoids) + terminals (schema fields)
- **Edges** = MapSpec edges (data flow connections)

```typescript
interface DependencyGraph {
  nodes: Map<string, GraphNode>;
  edges: Edge[];
}

interface GraphNode {
  id: string;                    // Node or terminal ID
  kind: 'source' | 'target' | NodeKind;
  expression?: string;           // Generated expression
  dependencies: string[];        // IDs this node depends on
}

function buildDependencyGraph(mapSpec: MapSpec): DependencyGraph {
  const graph: DependencyGraph = {
    nodes: new Map(),
    edges: mapSpec.edges
  };

  // Add source terminals (leaf nodes)
  for (const terminal of sourceTerminals) {
    graph.nodes.set(terminal.id, {
      id: terminal.id,
      kind: 'source',
      expression: terminal.id,   // JSONPath from schema
      dependencies: []
    });
  }

  // Add target terminals (outputs)
  for (const terminal of targetTerminals) {
    graph.nodes.set(terminal.id, {
      id: terminal.id,
      kind: 'target',
      expression: undefined,     // Will be computed
      dependencies: []
    });
  }

  // Add functoid nodes
  for (const node of mapSpec.nodes) {
    graph.nodes.set(node.id, {
      id: node.id,
      kind: node.kind,
      expression: undefined,     // Will be computed
      dependencies: []
    });
  }

  // Build dependency edges
  for (const edge of mapSpec.edges) {
    const targetNode = graph.nodes.get(edge.target);
    if (targetNode) {
      targetNode.dependencies.push(edge.source);
    }
  }

  return graph;
}
```

## Topological Sort

Sort nodes so dependencies are processed first:

```typescript
function topologicalSort(graph: DependencyGraph): GraphNode[] {
  const sorted: GraphNode[] = [];
  const visited = new Set<string>();
  const temp = new Set<string>();

  function visit(nodeId: string) {
    if (temp.has(nodeId)) {
      throw new Error(`Circular dependency detected at ${nodeId}`);
    }
    if (visited.has(nodeId)) {
      return;
    }

    temp.add(nodeId);
    const node = graph.nodes.get(nodeId)!;

    // Visit dependencies first
    for (const depId of node.dependencies) {
      visit(depId);
    }

    temp.delete(nodeId);
    visited.add(nodeId);
    sorted.push(node);
  }

  // Visit all nodes
  for (const [nodeId, node] of graph.nodes) {
    if (!visited.has(nodeId)) {
      visit(nodeId);
    }
  }

  return sorted;
}
```

## Node Expression Generation

Generate JSONata expressions for each node type:

### Source Terminals

Source terminals are **JSONPath references** from the source schema:

```typescript
// Source terminal: $.orderNumber
expression: "orderNumber"

// Source terminal: $.items[].quantity
expression: "items.quantity"

// Source terminal: $.customer.addresses[].city
expression: "customer.addresses.city"
```

**Rule:** Strip the leading `$` and convert `[]` to implicit array iteration.

### Direct Mapping

When a source terminal connects directly to a target terminal:

```json
{
  "edges": [
    {
      "source": "$.orderNumber",
      "sourceHandle": "$.orderNumber",
      "target": "$.invoiceNumber",
      "targetHandle": "$.invoiceNumber"
    }
  ]
}
```

**Generated JSONata:**
```jsonata
{
  "invoiceNumber": orderNumber
}
```

### Binary Functoids

Binary operations have two inputs and one output:

```typescript
function generateBinaryExpression(
  node: MapSpecNode,
  inputs: [string, string]
): string {
  const [left, right] = inputs;

  switch (node.kind) {
    case 'Binary.Add':
      return `(${left} + ${right})`;

    case 'Binary.Subtract':
      return `(${left} - ${right})`;

    case 'Binary.Multiply':
      return `(${left} * ${right})`;

    case 'Binary.Divide':
      return `(${left} / ${right})`;

    case 'Binary.Modulo':
      return `(${left} % ${right})`;

    case 'Binary.Power':
      return `$power(${left}, ${right})`;

    case 'Binary.Equal':
      return `(${left} = ${right})`;

    case 'Binary.NotEqual':
      return `(${left} != ${right})`;

    case 'Binary.LessThan':
      return `(${left} < ${right})`;

    case 'Binary.GreaterThan':
      return `(${left} > ${right})`;

    case 'Binary.And':
      return `(${left} and ${right})`;

    case 'Binary.Or':
      return `(${left} or ${right})`;

    default:
      throw new Error(`Unknown binary operation: ${node.kind}`);
  }
}
```

**Example:**
```json
{
  "id": "func-multiply-1",
  "kind": "Binary.Multiply",
  "config": {}
}
```

With edges:
```json
[
  { "source": "$.quantity", "target": "func-multiply-1", "targetHandle": "input-1" },
  { "source": "$.price", "target": "func-multiply-1", "targetHandle": "input-2" },
  { "source": "func-multiply-1", "sourceHandle": "output", "target": "$.total" }
]
```

**Generated:**
```jsonata
(quantity * price)
```

### Unary Functoids

Unary operations have one input and one output:

```typescript
function generateUnaryExpression(
  node: MapSpecNode,
  input: string
): string {
  switch (node.kind) {
    case 'Unary.Negate':
      return `(-${input})`;

    case 'Unary.Not':
      return `($not(${input}))`;

    case 'Unary.Abs':
      return `$abs(${input})`;

    case 'Unary.Ceil':
      return `$ceil(${input})`;

    case 'Unary.Floor':
      return `$floor(${input})`;

    case 'Unary.Round':
      return `$round(${input})`;

    case 'Unary.Sqrt':
      return `$sqrt(${input})`;

    default:
      throw new Error(`Unknown unary operation: ${node.kind}`);
  }
}
```

### String Functoids

String operations:

```typescript
function generateStringExpression(
  node: MapSpecNode,
  inputs: string[]
): string {
  switch (node.kind) {
    case 'String.Concat':
      // Variadic: concat all inputs
      return inputs.join(' & ');

    case 'String.Uppercase':
      return `$uppercase(${inputs[0]})`;

    case 'String.Lowercase':
      return `$lowercase(${inputs[0]})`;

    case 'String.Trim':
      return `$trim(${inputs[0]})`;

    case 'String.Length':
      return `$length(${inputs[0]})`;

    case 'String.Substring':
      const [str, start, length] = inputs;
      return length
        ? `$substring(${str}, ${start}, ${length})`
        : `$substring(${str}, ${start})`;

    case 'String.Replace':
      const [text, pattern, replacement] = inputs;
      return `$replace(${text}, ${pattern}, ${replacement})`;

    case 'String.Split':
      const [string, separator] = inputs;
      return `$split(${string}, ${separator})`;

    case 'String.Join':
      const [array, sep] = inputs;
      return `$join(${array}, ${sep})`;

    default:
      throw new Error(`Unknown string operation: ${node.kind}`);
  }
}
```

### Conditional Functoids

If-then-else logic:

```typescript
function generateConditionalExpression(
  node: MapSpecNode,
  inputs: [string, string, string]
): string {
  const [condition, thenValue, elseValue] = inputs;

  switch (node.kind) {
    case 'Conditional.If':
      return `(${condition} ? ${thenValue} : ${elseValue})`;

    default:
      throw new Error(`Unknown conditional: ${node.kind}`);
  }
}
```

**Example:**
```json
{
  "id": "func-if-1",
  "kind": "Conditional.If"
}
```

With edges for `(quantity > 10 ? price * 0.9 : price)`:
```jsonata
(quantity > 10 ? (price * 0.9) : price)
```

### Collection Functoids

Array operations:

```typescript
function generateCollectionExpression(
  node: MapSpecNode,
  inputs: string[]
): string {
  switch (node.kind) {
    case 'Collection.Map':
      // Map transformation: array.(expression)
      const [array, lambda] = inputs;
      return `${array}.(${lambda})`;

    case 'Collection.Filter':
      // Filter: array[predicate]
      const [arr, predicate] = inputs;
      return `${arr}[${predicate}]`;

    case 'Collection.Count':
      return `$count(${inputs[0]})`;

    case 'Collection.Distinct':
      return `$distinct(${inputs[0]})`;

    case 'Collection.Sort':
      const [arrayToSort, keyExpr] = inputs;
      return keyExpr
        ? `$sort(${arrayToSort}, function($a, $b) { $a.${keyExpr} < $b.${keyExpr} })`
        : `$sort(${arrayToSort})`;

    case 'Collection.Reverse':
      return `$reverse(${inputs[0]})`;

    case 'Collection.Flatten':
      return `$$.${inputs[0]}`;

    default:
      throw new Error(`Unknown collection operation: ${node.kind}`);
  }
}
```

### Aggregate Functoids

Aggregation over arrays:

```typescript
function generateAggregateExpression(
  node: MapSpecNode,
  input: string
): string {
  switch (node.kind) {
    case 'Aggregate.Sum':
      return `$sum(${input})`;

    case 'Aggregate.Average':
      return `$average(${input})`;

    case 'Aggregate.Min':
      return `$min(${input})`;

    case 'Aggregate.Max':
      return `$max(${input})`;

    case 'Aggregate.Count':
      return `$count(${input})`;

    default:
      throw new Error(`Unknown aggregate: ${node.kind}`);
  }
}
```

### Const Functoids

Constant values:

```typescript
function generateConstExpression(node: MapSpecNode): string {
  const value = node.config.value;

  if (typeof value === 'string') {
    // Escape quotes in string literals
    return `"${value.replace(/"/g, '\\"')}"`;
  } else if (typeof value === 'number') {
    return value.toString();
  } else if (typeof value === 'boolean') {
    return value.toString();
  } else if (value === null) {
    return 'null';
  } else {
    // Complex objects/arrays
    return JSON.stringify(value);
  }
}
```

**Example:**
```json
{
  "id": "const-vat-rate",
  "kind": "Const.Value",
  "config": { "value": 0.2 }
}
```

**Generated:**
```jsonata
0.2
```

### Custom Functoids

User-defined functions:

```typescript
function generateCustomExpression(
  node: MapSpecNode,
  inputs: string[]
): string {
  const funcName = node.config.functionName;
  const args = inputs.join(', ');

  return `${funcName}(${args})`;
}
```

**Example:**
```json
{
  "id": "custom-validate-email",
  "kind": "Custom.Function",
  "config": {
    "functionName": "$validateEmail",
    "implementation": "(function($email) { $email ~> /^[^@]+@[^@]+$/ })"
  }
}
```

**Generated:**
```jsonata
$validateEmail(email)
```

## Target Expression Composition

Compose the final JSONata expression for the target schema:

```typescript
function composeTargetExpression(
  mapSpec: MapSpec,
  expressions: Map<string, string>
): string {
  const targetSchema = mapSpec.schemas.target;

  // Build target object recursively
  return buildTargetObject(targetSchema, expressions);
}

function buildTargetObject(
  schema: JSONSchema,
  expressions: Map<string, string>,
  path: string = '$'
): string {
  if (schema.type === 'object' && schema.properties) {
    // Object: build properties
    const props = Object.entries(schema.properties)
      .map(([key, propSchema]) => {
        const propPath = `${path}.${key}`;
        const expr = expressions.get(propPath);

        if (expr) {
          // Has mapping
          return `"${key}": ${expr}`;
        } else if (propSchema.type === 'object' || propSchema.type === 'array') {
          // Recurse into nested structure
          return `"${key}": ${buildTargetObject(propSchema, expressions, propPath)}`;
        } else {
          // No mapping, omit field
          return null;
        }
      })
      .filter(Boolean)
      .join(',\n  ');

    return `{\n  ${props}\n}`;

  } else if (schema.type === 'array' && schema.items) {
    // Array: map over source array
    const itemPath = `${path}[]`;
    const itemExpr = expressions.get(itemPath);

    if (itemExpr) {
      return `${itemExpr}`;
    } else {
      // Recurse into array items
      return buildTargetObject(schema.items, expressions, itemPath);
    }

  } else {
    // Primitive: use expression directly
    return expressions.get(path) || 'null';
  }
}
```

## Complete Example

**MapSpec:**
```json
{
  "version": "1.0",
  "nodes": [
    {
      "id": "func-multiply-1",
      "kind": "Binary.Multiply",
      "config": {}
    }
  ],
  "edges": [
    {
      "source": "$.orderNumber",
      "sourceHandle": "$.orderNumber",
      "target": "$.invoiceNumber",
      "targetHandle": "$.invoiceNumber"
    },
    {
      "source": "$.items[].quantity",
      "sourceHandle": "$.items[].quantity",
      "target": "func-multiply-1",
      "targetHandle": "input-1"
    },
    {
      "source": "$.items[].price",
      "sourceHandle": "$.items[].price",
      "target": "func-multiply-1",
      "targetHandle": "input-2"
    },
    {
      "source": "func-multiply-1",
      "sourceHandle": "output",
      "target": "$.lineItems[].total",
      "targetHandle": "$.lineItems[].total"
    }
  ]
}
```

**Generated JSONata:**
```jsonata
{
  "invoiceNumber": orderNumber,
  "lineItems": items.{
    "total": (quantity * price)
  }
}
```

**Explanation:**
1. Direct mapping: `orderNumber` → `invoiceNumber`
2. Array transformation: `items` → `lineItems`
3. Functoid: `quantity * price` → `total`
4. Array context preserved with `.{}` notation

## Array Handling

Arrays require special handling to preserve context:

### Implicit Iteration

JSONata naturally iterates over arrays:

```jsonata
// Source: items[].quantity
// Target: lineItems[].qty
{
  "lineItems": items.{
    "qty": quantity
  }
}
```

### Nested Arrays

Nested arrays use multiple levels:

```jsonata
// Source: orders[].items[].quantity
// Target: allItems[].qty
{
  "allItems": orders.items.{
    "qty": quantity
  }
}
```

### Array Aggregation

Aggregating array values:

```jsonata
// Source: items[].price
// Target: totalPrice (scalar)
{
  "totalPrice": $sum(items.price)
}
```

## Optimization

### Common Subexpression Elimination (CSE)

The JSONata code generator implements CSE through an **IR-based architecture**:

1. **Reuse Analysis (Lowering Phase)**: The lowering phase identifies shared computations and annotates them in the MapperIR as `SharedExpression` entries
2. **Code Emission (Codegen Phase)**: The codegen phase emits JSONata block expressions with variable bindings based on IR annotations

**Architecture:**

```text
MapSpec → Lowering (marks reuse) → MapperIR (with SharedExpression[]) → Codegen (emits bindings) → JSONata
```

**How it works:**

- During lowering, nodes are analyzed for:
  - **Refcount > 1**: Used by multiple downstream nodes
  - **Purity**: No side effects (impure: DateTime.Now, Custom.Function)
  - **Cost ≥ 2**: Non-trivial computation worth hoisting
- Shareable nodes are marked and added to `ir.sharedExpressions`
- References to shared nodes are replaced with `SharedRefExpr` throughout the expression tree (recursively)
- Dead code elimination ensures only actually-used shared expressions are emitted
- Codegen emits JSONata block expressions with `$let`-style variable bindings

**Example:**

Before optimization:

```jsonata
{
  "subtotal": (quantity * price),
  "tax": (quantity * price) * 0.2,
  "total": (quantity * price) * 1.2
}
```

After CSE (with IR-guided optimization):

```jsonata
(
  $functoid_123 := quantity * price;
  {
    "subtotal": $functoid_123,
    "tax": $functoid_123 * 0.2,
    "total": $functoid_123 * 1.2
  }
)
```

**IR Structure:**

```typescript
{
  sharedExpressions: [
    {
      nodeId: "functoid-123",
      varName: "$functoid_123",
      expression: { kind: 'binary', operator: 'multiply', ... },
      hintName: "lineTotal",
      refCount: 3
    }
  ],
  mappings: [
    { target: "subtotal", expression: { kind: 'sharedRef', nodeId: "functoid-123", varName: "$functoid_123" } },
    { target: "tax", expression: { kind: 'binary', operator: 'multiply', left: { kind: 'sharedRef', ... }, right: { kind: 'literal', value: 0.2 } } },
    // ...
  ]
}
```

See [Lowering Rules](./11-lowering-rules.md) for details on the CSE analysis algorithm.

### Dead Code Elimination

Remove functoids with no downstream consumers:

```json
// MapSpec has func-multiply-1 but no edges from its output
// → Do not generate expression for func-multiply-1
```

### Constant Folding

Evaluate constant expressions at compile time:

```jsonata
// Before:
(10 * 2)

// After:
20
```

## Type Coercion

Handle type mismatches between source and target:

```typescript
function coerceType(
  expr: string,
  sourceType: string,
  targetType: string
): string {
  if (sourceType === targetType) {
    return expr;
  }

  // Number → String
  if (sourceType === 'number' && targetType === 'string') {
    return `$string(${expr})`;
  }

  // String → Number
  if (sourceType === 'string' && targetType === 'number') {
    return `$number(${expr})`;
  }

  // Boolean → String
  if (sourceType === 'boolean' && targetType === 'string') {
    return `$string(${expr})`;
  }

  // Array → String (JSON)
  if (sourceType === 'array' && targetType === 'string') {
    return `$string(${expr})`;
  }

  // Default: no coercion
  return expr;
}
```

## Error Handling

### Missing Dependencies

If a node has missing inputs:

```typescript
function validateDependencies(node: GraphNode, graph: DependencyGraph) {
  const expectedInputs = getExpectedInputCount(node.kind);

  if (node.dependencies.length < expectedInputs) {
    throw new Error(
      `Node ${node.id} expects ${expectedInputs} inputs but has ${node.dependencies.length}`
    );
  }
}
```

### Circular Dependencies

Detect cycles during topological sort:

```typescript
// In topologicalSort:
if (temp.has(nodeId)) {
  throw new Error(`Circular dependency detected at ${nodeId}`);
}
```

### Type Errors

Validate type compatibility:

```typescript
function validateTypes(
  edge: Edge,
  sourceType: string,
  targetType: string
) {
  if (!isCompatible(sourceType, targetType)) {
    throw new Error(
      `Type error: Cannot connect ${sourceType} to ${targetType} (edge: ${edge.source} → ${edge.target})`
    );
  }
}
```

## Testing Generated Code

After generation, validate the JSONata:

```typescript
import jsonata from 'jsonata';

function validateGeneratedCode(
  code: string,
  testCases: TestCase[]
): ValidationResult {
  let expression;

  try {
    expression = jsonata(code);
  } catch (err) {
    return {
      valid: false,
      error: `Syntax error: ${err.message}`
    };
  }

  // Run test cases
  for (const testCase of testCases) {
    const result = expression.evaluate(testCase.input);

    if (!deepEqual(result, testCase.expected)) {
      return {
        valid: false,
        error: `Test failed: ${testCase.name}`,
        actual: result,
        expected: testCase.expected
      };
    }
  }

  return { valid: true };
}
```

## Output Format

### Formatted Output

Generated JSONata should be formatted for readability:

```jsonata
{
  "invoiceNumber": orderNumber,
  "invoiceDate": $now(),
  "lineItems": items.{
    "product": productName,
    "quantity": quantity,
    "price": price,
    "total": (quantity * price)
  },
  "totalAmount": $sum(items.(quantity * price)),
  "vat": $sum(items.(quantity * price)) * 0.2,
  "grandTotal": $sum(items.(quantity * price)) * 1.2
}
```

### Minified Output

For production, optionally minify:

```jsonata
{"invoiceNumber":orderNumber,"invoiceDate":$now(),"lineItems":items.{"product":productName,"quantity":quantity,"price":price,"total":(quantity*price)},"totalAmount":$sum(items.(quantity*price)),"vat":$sum(items.(quantity*price))*0.2,"grandTotal":$sum(items.(quantity*price))*1.2}
```

## Code Generation Pipeline

```typescript
async function generateMapper(mapperFile: string): Promise<void> {
  // 1. Load and validate MapSpec
  const mapSpec = await loadMapSpec(mapperFile);
  await validateMapSpec(mapSpec);

  // 2. Build dependency graph
  const graph = buildDependencyGraph(mapSpec);

  // 3. Topological sort
  const sorted = topologicalSort(graph);

  // 4. Generate expressions for each node
  const expressions = new Map<string, string>();
  for (const node of sorted) {
    if (node.kind === 'source') {
      expressions.set(node.id, convertToJSONataPath(node.id));
    } else if (node.kind !== 'target') {
      const inputs = node.dependencies.map(depId => expressions.get(depId)!);
      const expr = generateNodeExpression(node, inputs);
      expressions.set(node.id, expr);
    }
  }

  // 5. Compose final expression
  const finalExpr = composeTargetExpression(mapSpec, expressions);

  // 6. Optimize
  const optimized = optimizeExpression(finalExpr);

  // 7. Format
  const formatted = formatJSONata(optimized);

  // 8. Validate
  if (mapSpec.tests && mapSpec.tests.length > 0) {
    const validation = validateGeneratedCode(formatted, mapSpec.tests);
    if (!validation.valid) {
      throw new Error(`Generated code failed validation: ${validation.error}`);
    }
  }

  // 9. Write output
  const outputFile = mapperFile.replace('.mapper.json', '.mapper.jsonata');
  await fs.writeFile(outputFile, formatted);

  console.log(`✓ Generated ${outputFile}`);
}
```

## CLI Usage

```bash
# Generate JSONata from MapSpec
mapper codegen order-to-invoice.mapper.json

# Output: order-to-invoice.mapper.jsonata

# With optimization
mapper codegen order-to-invoice.mapper.json --optimize

# Minified output
mapper codegen order-to-invoice.mapper.json --minify

# With test validation
mapper codegen order-to-invoice.mapper.json --test
```

## See Also

- [MapSpec Schema](./04-mapspec-schema.md) - Input format
- [Lowering Rules](./11-lowering-rules.md) - AST transformations
- [Test Runner](./13-test-runner.md) - Validation
- [JSONata Docs](https://docs.jsonata.org/) - JSONata language reference
