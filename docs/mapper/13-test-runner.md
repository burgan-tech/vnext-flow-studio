# Test Runner

**Status:** Draft
**Last Updated:** 2025-10-22

## Overview

The **Test Runner** executes mapper tests to validate that generated JSONata code produces correct outputs. This document describes test execution, reporting, and debugging capabilities.

**Test Flow:**
```
MapSpec + Tests
  → Generate JSONata
  → Execute Tests
  → Compare Results
  → Generate Report
```

## Test Definition

Tests are defined in the MapSpec or separate test files:

### Inline Tests (MapSpec)

```json
{
  "version": "1.0",
  "metadata": {
    "name": "order-to-invoice"
  },
  "nodes": [...],
  "edges": [...],
  "tests": [
    {
      "name": "Simple order",
      "input": {
        "orderNumber": "ORD-001",
        "orderDate": "2024-01-15",
        "items": [
          { "product": "Widget", "quantity": 2, "price": 10.00 }
        ]
      },
      "expected": {
        "invoiceNumber": "ORD-001",
        "invoiceDate": "2024-01-15",
        "lineItems": [
          { "product": "Widget", "quantity": 2, "total": 20.00 }
        ]
      }
    }
  ]
}
```

### External Test File

**File:** `order-to-invoice.mapper.test.json`

```json
{
  "version": "1.0",
  "mapperFile": "./order-to-invoice.mapper.json",
  "tests": [
    {
      "name": "Simple order",
      "input": { /* ... */ },
      "expected": { /* ... */ }
    },
    {
      "name": "Multiple items",
      "input": { /* ... */ },
      "expected": { /* ... */ }
    },
    {
      "name": "Edge case: empty items",
      "input": { /* ... */ },
      "expected": { /* ... */ }
    }
  ]
}
```

## Test Execution

```typescript
import jsonata from 'jsonata';

interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'error';
  duration: number;          // Milliseconds
  error?: string;
  diff?: Diff;
  actual?: any;
  expected?: any;
}

async function runTests(
  mapperFile: string,
  testFile?: string
): Promise<TestResult[]> {
  // 1. Load mapper and generate code
  const mapSpec = await loadMapSpec(mapperFile);
  const code = generateJSONata(mapSpec);

  // 2. Load tests
  const tests = testFile
    ? await loadTestFile(testFile)
    : mapSpec.tests || [];

  if (tests.length === 0) {
    console.warn('No tests found');
    return [];
  }

  // 3. Compile JSONata
  let expression;
  try {
    expression = jsonata(code);
  } catch (err) {
    throw new Error(`JSONata compilation failed: ${err.message}`);
  }

  // 4. Execute tests
  const results: TestResult[] = [];

  for (const test of tests) {
    const result = await runSingleTest(expression, test);
    results.push(result);
  }

  return results;
}

async function runSingleTest(
  expression: any,
  test: TestCase
): Promise<TestResult> {
  const startTime = performance.now();

  try {
    // Execute transformation
    const actual = await expression.evaluate(test.input);
    const duration = performance.now() - startTime;

    // Compare results
    if (deepEqual(actual, test.expected)) {
      return {
        name: test.name,
        status: 'pass',
        duration
      };
    } else {
      return {
        name: test.name,
        status: 'fail',
        duration,
        actual,
        expected: test.expected,
        diff: generateDiff(test.expected, actual)
      };
    }
  } catch (err) {
    const duration = performance.now() - startTime;
    return {
      name: test.name,
      status: 'error',
      duration,
      error: err.message
    };
  }
}
```

## Deep Equality

Robust deep comparison handling various edge cases:

```typescript
function deepEqual(a: any, b: any): boolean {
  // Same reference
  if (a === b) return true;

  // Type mismatch
  if (typeof a !== typeof b) return false;

  // Null comparison
  if (a === null || b === null) return a === b;

  // Date comparison
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }

  // Array comparison
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }

  // Object comparison
  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a).sort();
    const keysB = Object.keys(b).sort();

    if (keysA.length !== keysB.length) return false;
    if (!deepEqual(keysA, keysB)) return false;

    return keysA.every(key => deepEqual(a[key], b[key]));
  }

  // Primitive comparison
  return a === b;
}
```

## Diff Generation

Generate human-readable diffs:

```typescript
interface Diff {
  type: 'added' | 'removed' | 'changed' | 'unchanged';
  path: string;
  oldValue?: any;
  newValue?: any;
}

function generateDiff(expected: any, actual: any, path = ''): Diff[] {
  const diffs: Diff[] = [];

  // Both are primitives or null
  if (!isObject(expected) && !isObject(actual)) {
    if (expected !== actual) {
      diffs.push({
        type: 'changed',
        path,
        oldValue: expected,
        newValue: actual
      });
    }
    return diffs;
  }

  // Type mismatch
  if (typeof expected !== typeof actual) {
    diffs.push({
      type: 'changed',
      path,
      oldValue: expected,
      newValue: actual
    });
    return diffs;
  }

  // Array diff
  if (Array.isArray(expected) && Array.isArray(actual)) {
    const maxLen = Math.max(expected.length, actual.length);

    for (let i = 0; i < maxLen; i++) {
      const itemPath = `${path}[${i}]`;

      if (i >= expected.length) {
        diffs.push({ type: 'added', path: itemPath, newValue: actual[i] });
      } else if (i >= actual.length) {
        diffs.push({ type: 'removed', path: itemPath, oldValue: expected[i] });
      } else {
        diffs.push(...generateDiff(expected[i], actual[i], itemPath));
      }
    }

    return diffs;
  }

  // Object diff
  const allKeys = new Set([
    ...Object.keys(expected),
    ...Object.keys(actual)
  ]);

  for (const key of allKeys) {
    const fieldPath = path ? `${path}.${key}` : key;

    if (!(key in expected)) {
      diffs.push({ type: 'added', path: fieldPath, newValue: actual[key] });
    } else if (!(key in actual)) {
      diffs.push({ type: 'removed', path: fieldPath, oldValue: expected[key] });
    } else {
      diffs.push(...generateDiff(expected[key], actual[key], fieldPath));
    }
  }

  return diffs;
}

function formatDiff(diff: Diff): string {
  switch (diff.type) {
    case 'added':
      return `+ ${diff.path}: ${JSON.stringify(diff.newValue)}`;
    case 'removed':
      return `- ${diff.path}: ${JSON.stringify(diff.oldValue)}`;
    case 'changed':
      return `~ ${diff.path}: ${JSON.stringify(diff.oldValue)} → ${JSON.stringify(diff.newValue)}`;
    default:
      return '';
  }
}
```

## Test Report

### Console Output

```typescript
function printTestReport(results: TestResult[]): void {
  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const errors = results.filter(r => r.status === 'error').length;
  const total = results.length;

  console.log('\n' + '='.repeat(70));
  console.log('Test Results');
  console.log('='.repeat(70));

  for (const result of results) {
    const icon = result.status === 'pass' ? '✓' : '✗';
    const color = result.status === 'pass' ? '\x1b[32m' : '\x1b[31m';
    const reset = '\x1b[0m';

    console.log(`\n${color}${icon}${reset} ${result.name} (${result.duration.toFixed(2)}ms)`);

    if (result.status === 'fail') {
      console.log('\n  Differences:');
      for (const diff of result.diff || []) {
        console.log(`    ${formatDiff(diff)}`);
      }
    }

    if (result.status === 'error') {
      console.log(`\n  Error: ${result.error}`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log(`Total: ${total} | Passed: ${passed} | Failed: ${failed} | Errors: ${errors}`);
  console.log('='.repeat(70) + '\n');

  process.exit(failed + errors > 0 ? 1 : 0);
}
```

**Example Output:**
```
======================================================================
Test Results
======================================================================

✓ Simple order (12.34ms)

✗ Multiple items (8.56ms)

  Differences:
    ~ lineItems[1].total: 30.00 → 30
    + lineItems[2].discount: 5.00

✗ Edge case: empty items (3.21ms)

  Error: Cannot read property 'length' of undefined

======================================================================
Total: 3 | Passed: 1 | Failed: 1 | Errors: 1
======================================================================
```

### JSON Output

```typescript
function generateJSONReport(results: TestResult[]): string {
  return JSON.stringify({
    summary: {
      total: results.length,
      passed: results.filter(r => r.status === 'pass').length,
      failed: results.filter(r => r.status === 'fail').length,
      errors: results.filter(r => r.status === 'error').length,
      duration: results.reduce((sum, r) => sum + r.duration, 0)
    },
    tests: results.map(r => ({
      name: r.name,
      status: r.status,
      duration: r.duration,
      ...(r.error && { error: r.error }),
      ...(r.diff && { diff: r.diff }),
      ...(r.actual && { actual: r.actual }),
      ...(r.expected && { expected: r.expected })
    }))
  }, null, 2);
}
```

### HTML Report

```typescript
function generateHTMLReport(results: TestResult[]): string {
  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const errors = results.filter(r => r.status === 'error').length;

  return `
<!DOCTYPE html>
<html>
<head>
  <title>Test Report</title>
  <style>
    body { font-family: system-ui; margin: 2rem; }
    .summary { background: #f5f5f5; padding: 1rem; border-radius: 4px; }
    .test { margin: 1rem 0; padding: 1rem; border: 1px solid #ddd; border-radius: 4px; }
    .pass { border-color: #4caf50; background: #e8f5e9; }
    .fail { border-color: #f44336; background: #ffebee; }
    .error { border-color: #ff9800; background: #fff3e0; }
    .diff { background: #fff; padding: 0.5rem; font-family: monospace; font-size: 0.9em; }
    .added { color: #4caf50; }
    .removed { color: #f44336; }
    .changed { color: #ff9800; }
  </style>
</head>
<body>
  <h1>Test Report</h1>

  <div class="summary">
    <strong>Summary:</strong>
    Total: ${results.length} |
    Passed: <span style="color: #4caf50">${passed}</span> |
    Failed: <span style="color: #f44336">${failed}</span> |
    Errors: <span style="color: #ff9800">${errors}</span>
  </div>

  ${results.map(result => `
    <div class="test ${result.status}">
      <h3>${result.status === 'pass' ? '✓' : '✗'} ${result.name}</h3>
      <p>Duration: ${result.duration.toFixed(2)}ms</p>

      ${result.diff ? `
        <h4>Differences:</h4>
        <div class="diff">
          ${result.diff.map(d => `<div class="${d.type}">${formatDiff(d)}</div>`).join('\n')}
        </div>
      ` : ''}

      ${result.error ? `
        <h4>Error:</h4>
        <pre>${result.error}</pre>
      ` : ''}
    </div>
  `).join('\n')}
</body>
</html>
  `.trim();
}
```

## Watch Mode

Run tests continuously during development:

```typescript
async function watchTests(mapperFile: string, testFile?: string) {
  const chokidar = await import('chokidar');

  const files = [mapperFile];
  if (testFile) files.push(testFile);

  console.log('Watching for changes...\n');

  const watcher = chokidar.watch(files, {
    persistent: true,
    ignoreInitial: false
  });

  watcher.on('change', async (path) => {
    console.clear();
    console.log(`File changed: ${path}\n`);

    try {
      const results = await runTests(mapperFile, testFile);
      printTestReport(results);
    } catch (err) {
      console.error(`Error: ${err.message}`);
    }
  });
}
```

## Coverage Tracking

Track which parts of the mapper are tested:

```typescript
interface Coverage {
  nodes: Map<string, number>;    // Node ID → times executed
  edges: Map<string, number>;    // Edge ID → times executed
  terminals: Map<string, number>; // Terminal ID → times accessed
}

function trackCoverage(
  mapSpec: MapSpec,
  tests: TestCase[]
): CoverageReport {
  const coverage: Coverage = {
    nodes: new Map(),
    edges: new Map(),
    terminals: new Map()
  };

  // Initialize counts
  for (const node of mapSpec.nodes) {
    coverage.nodes.set(node.id, 0);
  }
  for (const edge of mapSpec.edges) {
    coverage.edges.set(edge.id, 0);
  }

  // Track execution for each test
  for (const test of tests) {
    const executionTrace = traceExecution(mapSpec, test.input);

    for (const nodeId of executionTrace.nodes) {
      coverage.nodes.set(nodeId, (coverage.nodes.get(nodeId) || 0) + 1);
    }
    for (const edgeId of executionTrace.edges) {
      coverage.edges.set(edgeId, (coverage.edges.get(edgeId) || 0) + 1);
    }
  }

  // Calculate percentages
  const totalNodes = mapSpec.nodes.length;
  const coveredNodes = Array.from(coverage.nodes.values()).filter(c => c > 0).length;
  const nodesCoverage = (coveredNodes / totalNodes) * 100;

  const totalEdges = mapSpec.edges.length;
  const coveredEdges = Array.from(coverage.edges.values()).filter(c => c > 0).length;
  const edgesCoverage = (coveredEdges / totalEdges) * 100;

  return {
    nodesCoverage,
    edgesCoverage,
    uncoveredNodes: Array.from(coverage.nodes.entries())
      .filter(([_, count]) => count === 0)
      .map(([id]) => id),
    uncoveredEdges: Array.from(coverage.edges.entries())
      .filter(([_, count]) => count === 0)
      .map(([id]) => id)
  };
}
```

## Snapshot Testing

Store expected outputs as snapshots:

```typescript
async function updateSnapshots(mapperFile: string, testFile: string) {
  const mapSpec = await loadMapSpec(mapperFile);
  const code = generateJSONata(mapSpec);
  const expression = jsonata(code);

  const tests = await loadTestFile(testFile);

  for (const test of tests) {
    const actual = await expression.evaluate(test.input);
    test.expected = actual;  // Update expected to actual
  }

  await saveTestFile(testFile, tests);
  console.log(`✓ Updated ${tests.length} snapshots`);
}
```

## Performance Testing

Measure mapper performance:

```typescript
interface PerformanceResult {
  name: string;
  samples: number;
  mean: number;      // Mean execution time (ms)
  median: number;    // Median execution time (ms)
  stdDev: number;    // Standard deviation
  min: number;       // Minimum time
  max: number;       // Maximum time
  opsPerSecond: number;
}

async function runPerformanceTest(
  expression: any,
  test: TestCase,
  samples: number = 100
): Promise<PerformanceResult> {
  const times: number[] = [];

  // Warmup
  for (let i = 0; i < 10; i++) {
    await expression.evaluate(test.input);
  }

  // Measure
  for (let i = 0; i < samples; i++) {
    const start = performance.now();
    await expression.evaluate(test.input);
    const duration = performance.now() - start;
    times.push(duration);
  }

  times.sort((a, b) => a - b);

  const mean = times.reduce((sum, t) => sum + t, 0) / times.length;
  const median = times[Math.floor(times.length / 2)];
  const variance = times.reduce((sum, t) => sum + Math.pow(t - mean, 2), 0) / times.length;
  const stdDev = Math.sqrt(variance);

  return {
    name: test.name,
    samples,
    mean,
    median,
    stdDev,
    min: times[0],
    max: times[times.length - 1],
    opsPerSecond: 1000 / mean
  };
}
```

## CLI Usage

```bash
# Run tests
mapper test order-to-invoice.mapper.json

# Run with external test file
mapper test order-to-invoice.mapper.json --test-file order-to-invoice.mapper.test.json

# Watch mode
mapper test order-to-invoice.mapper.json --watch

# JSON output
mapper test order-to-invoice.mapper.json --json

# HTML report
mapper test order-to-invoice.mapper.json --html report.html

# Update snapshots
mapper test order-to-invoice.mapper.json --update-snapshots

# Coverage report
mapper test order-to-invoice.mapper.json --coverage

# Performance test
mapper test order-to-invoice.mapper.json --perf --samples 1000

# Specific test
mapper test order-to-invoice.mapper.json --grep "Simple order"

# Verbose output
mapper test order-to-invoice.mapper.json --verbose
```

## VS Code Integration

Integrate with VS Code Test Explorer:

```typescript
import * as vscode from 'vscode';

export class MapperTestController {
  private controller: vscode.TestController;

  constructor() {
    this.controller = vscode.tests.createTestController(
      'amorphie-mapper-tests',
      'Amorphie Mapper Tests'
    );

    this.controller.resolveHandler = async (item) => {
      if (!item) {
        // Discover all test files
        await this.discoverTests();
      }
    };

    this.controller.createRunProfile(
      'Run',
      vscode.TestRunProfileKind.Run,
      async (request, token) => {
        await this.runTests(request, token);
      }
    );
  }

  private async discoverTests() {
    const files = await vscode.workspace.findFiles('**/*.mapper.json');

    for (const file of files) {
      const mapSpec = await loadMapSpec(file.fsPath);

      if (mapSpec.tests && mapSpec.tests.length > 0) {
        const mapperTest = this.controller.createTestItem(
          file.fsPath,
          path.basename(file.fsPath)
        );

        for (const test of mapSpec.tests) {
          const testItem = this.controller.createTestItem(
            `${file.fsPath}:${test.name}`,
            test.name,
            file
          );

          mapperTest.children.add(testItem);
        }

        this.controller.items.add(mapperTest);
      }
    }
  }

  private async runTests(
    request: vscode.TestRunRequest,
    token: vscode.CancellationToken
  ) {
    const run = this.controller.createTestRun(request);

    // Run each test
    for (const test of request.include || []) {
      if (token.isCancellationRequested) break;

      run.started(test);

      try {
        const result = await this.executeTest(test);

        if (result.status === 'pass') {
          run.passed(test, result.duration);
        } else if (result.status === 'fail') {
          const message = new vscode.TestMessage(
            `Expected: ${JSON.stringify(result.expected)}\nActual: ${JSON.stringify(result.actual)}`
          );
          run.failed(test, message, result.duration);
        } else {
          const message = new vscode.TestMessage(result.error || 'Unknown error');
          run.errored(test, message, result.duration);
        }
      } catch (err) {
        run.errored(test, new vscode.TestMessage(err.message));
      }
    }

    run.end();
  }
}
```

## CI/CD Integration

Example GitHub Actions:

```yaml
name: Test Mappers

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Run mapper tests
        run: |
          for file in mappers/*.mapper.json; do
            echo "Testing $file..."
            mapper test "$file" --json > "${file}.test-results.json"
          done

      - name: Generate coverage report
        run: mapper test mappers/*.mapper.json --coverage --json > coverage.json

      - name: Upload test results
        uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: '**/*.test-results.json'

      - name: Check test results
        run: |
          if grep -q '"status": "fail"' **/*.test-results.json; then
            echo "Tests failed"
            exit 1
          fi
```

## See Also

- [MapSpec Schema](./04-mapspec-schema.md) - Test definition format
- [Validation](./12-validation.md) - Static validation
- [JSONata Code Generation](./10-jsonata-codegen.md) - Code generation
- [JSONata Docs](https://docs.jsonata.org/) - JSONata reference
