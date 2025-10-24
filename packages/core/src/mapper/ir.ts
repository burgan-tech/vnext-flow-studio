/**
 * Mapper IR (Intermediate Representation)
 *
 * Normalized, type-safe representation of mapper transformations.
 * Similar to workflow IR, this provides a clean abstraction layer between
 * MapSpec and code generation backends.
 */

/**
 * Complete mapper in IR form
 */
export interface MapperIR {
  /** Version of IR format */
  version: string;

  /** Source and target schema metadata */
  schemas: {
    source: string;
    target: string;
  };

  /** Field mappings from source to target */
  mappings: FieldMapping[];

  /** Shared expressions (hoisted for reuse) */
  sharedExpressions?: SharedExpression[];

  /** Metadata from original MapSpec */
  metadata: {
    name: string;
    description?: string;
    author?: string;
    version?: string;
    createdAt?: string;
    updatedAt?: string;
  };
}

/**
 * Shared expression (computed once, reused multiple times)
 */
export interface SharedExpression {
  /** Node ID from MapSpec */
  nodeId: string;

  /** Variable name to use in codegen */
  varName: string;

  /** The expression to compute */
  expression: Expression;

  /** Hint name from node label (for better variable names) */
  hintName?: string;

  /** Reference count (how many times this is used) */
  refCount: number;
}

/**
 * A single field mapping
 */
export interface FieldMapping {
  /** Target field path (JSONPath) */
  target: string;

  /** Expression that produces the value */
  expression: Expression;

  /** Optional type annotation */
  type?: string;
}

/**
 * Expression types - building blocks for transformations
 */
export type Expression =
  | LiteralExpr
  | FieldRefExpr
  | SharedRefExpr
  | BinaryOpExpr
  | UnaryOpExpr
  | CallExpr
  | ConditionalExpr
  | ArrayExpr
  | ObjectExpr;

/**
 * Literal value (string, number, boolean, null)
 */
export interface LiteralExpr {
  kind: 'literal';
  value: string | number | boolean | null;
  type: 'string' | 'number' | 'integer' | 'boolean' | 'null';
}

/**
 * Field reference (e.g., $.customer.name)
 */
export interface FieldRefExpr {
  kind: 'field';
  path: string;
  type?: string;
}

/**
 * Reference to a shared expression (will be emitted as variable reference)
 */
export interface SharedRefExpr {
  kind: 'sharedRef';
  nodeId: string;
  varName: string;
  type?: string;
}

/**
 * Binary operation (e.g., a + b, a > b)
 */
export interface BinaryOpExpr {
  kind: 'binary';
  operator: BinaryOperator;
  left: Expression;
  right: Expression;
  type?: string;
}

export type BinaryOperator =
  // Arithmetic
  | 'add' | 'subtract' | 'multiply' | 'divide' | 'modulo' | 'power'
  // Comparison
  | 'equal' | 'notEqual' | 'lessThan' | 'lessEqual' | 'greaterThan' | 'greaterEqual'
  // Logical
  | 'and' | 'or'
  // String
  | 'concat';

/**
 * Unary operation (e.g., -x, !x)
 */
export interface UnaryOpExpr {
  kind: 'unary';
  operator: UnaryOperator;
  operand: Expression;
  type?: string;
}

export type UnaryOperator =
  | 'negate' | 'not' | 'abs' | 'ceil' | 'floor' | 'round' | 'sqrt';

/**
 * Function call (e.g., uppercase(x), sum(array))
 */
export interface CallExpr {
  kind: 'call';
  function: FunctionName;
  args: Expression[];
  config?: Record<string, any>;
  type?: string;
}

export type FunctionName =
  // String functions
  | 'uppercase' | 'lowercase' | 'trim' | 'length' | 'substring' | 'replace' | 'split' | 'join'
  // Array functions
  | 'map' | 'filter' | 'count' | 'distinct' | 'sort' | 'reverse' | 'flatten'
  // Aggregate functions
  | 'sum' | 'average' | 'min' | 'max'
  // Conversion functions
  | 'toString' | 'toNumber' | 'toBoolean' | 'toInteger' | 'toArray' | 'toDate' | 'parseJSON' | 'stringifyJSON'
  // DateTime functions
  | 'now' | 'formatDate' | 'parseDate' | 'addDays' | 'addMonths' | 'dateDiff'
  // Custom
  | 'custom';

/**
 * Conditional expression (ternary)
 */
export interface ConditionalExpr {
  kind: 'conditional';
  condition: Expression;
  then: Expression;
  else: Expression;
  type?: string;
}

/**
 * Array literal [1, 2, 3]
 */
export interface ArrayExpr {
  kind: 'array';
  elements: Expression[];
  type?: string;
}

/**
 * Object literal {a: 1, b: 2}
 */
export interface ObjectExpr {
  kind: 'object';
  properties: Array<{
    key: string;
    value: Expression;
  }>;
  type?: string;
}

/**
 * Type guard helpers
 */
export function isLiteralExpr(expr: Expression): expr is LiteralExpr {
  return expr.kind === 'literal';
}

export function isFieldRefExpr(expr: Expression): expr is FieldRefExpr {
  return expr.kind === 'field';
}

export function isSharedRefExpr(expr: Expression): expr is SharedRefExpr {
  return expr.kind === 'sharedRef';
}

export function isBinaryOpExpr(expr: Expression): expr is BinaryOpExpr {
  return expr.kind === 'binary';
}

export function isUnaryOpExpr(expr: Expression): expr is UnaryOpExpr {
  return expr.kind === 'unary';
}

export function isCallExpr(expr: Expression): expr is CallExpr {
  return expr.kind === 'call';
}

export function isConditionalExpr(expr: Expression): expr is ConditionalExpr {
  return expr.kind === 'conditional';
}

export function isArrayExpr(expr: Expression): expr is ArrayExpr {
  return expr.kind === 'array';
}

export function isObjectExpr(expr: Expression): expr is ObjectExpr {
  return expr.kind === 'object';
}
