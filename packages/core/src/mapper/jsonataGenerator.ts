/**
 * JSONata Code Generator (Backend)
 * Converts MapperIR to executable JSONata expressions
 *
 * This is a backend that consumes the lowered IR,
 * following the workflow architecture pattern.
 */

import type { MapSpec } from './types';
import type { MapperIR, Expression } from './ir';
import { lowerMapSpec } from './lower';

/**
 * Generate JSONata expression from MapSpec
 * (convenience function that lowers then generates)
 */
export function generateJSONata(mapSpec: MapSpec): string {
  const ir = lowerMapSpec(mapSpec);
  return generateJSONataFromIR(ir);
}

/**
 * Generate JSONata from MapperIR
 */
export function generateJSONataFromIR(ir: MapperIR): string {
  const generator = new JSONataGenerator(ir);
  return generator.generate();
}

/**
 * JSONata code generator (works with IR)
 */
class JSONataGenerator {
  private ir: MapperIR;

  constructor(ir: MapperIR) {
    this.ir = ir;
  }

  /**
   * Generate JSONata expression for entire mapper
   */
  generate(): string {
    if (this.ir.mappings.length === 0) {
      return '{}'; // Empty object if no mappings
    }

    // Separate array and non-array mappings
    const arrayMappings = new Map<string, { field: string; expr: Expression; sourceArray: string }[]>();
    const simpleMappings: { target: string; expr: string }[] = [];

    for (const mapping of this.ir.mappings) {
      const arrayMatch = mapping.target.match(/^(.+?)\[\]\.(.+)$/);

      if (arrayMatch) {
        // Array mapping: "lineItems[].lineTotal"
        const arrayBase = arrayMatch[1]; // "lineItems"
        const fieldName = arrayMatch[2]; // "lineTotal"

        // Extract source array from expression
        const sourceArray = this.extractSourceArray(mapping.expression);

        if (!arrayMappings.has(arrayBase)) {
          arrayMappings.set(arrayBase, []);
        }

        arrayMappings.get(arrayBase)!.push({
          field: fieldName,
          expr: mapping.expression,
          sourceArray
        });
      } else {
        // Simple mapping: "customerName"
        const expr = this.generateExpression(mapping.expression);
        simpleMappings.push({ target: mapping.target, expr });
      }
    }

    // Generate output
    const lines: string[] = [];

    // Add simple mappings
    for (const mapping of simpleMappings) {
      lines.push(`  "${mapping.target}": ${mapping.expr}`);
    }

    // Add array mappings
    for (const [arrayName, fields] of arrayMappings.entries()) {
      const sourceArray = fields[0].sourceArray;
      const fieldMappings = fields.map((f) => {
        const expr = this.generateExpressionForArrayContext(f.expr);
        return `    "${f.field}": ${expr}`;
      });

      lines.push(`  "${arrayName}": ${sourceArray}.{\n${fieldMappings.join(',\n')}\n  }`);
    }

    const output = `{\n${lines.join(',\n')}\n}`;

    // If we have shared expressions, wrap in a block expression with bindings
    if (this.ir.sharedExpressions && this.ir.sharedExpressions.length > 0) {
      const bindings = this.ir.sharedExpressions.map(shared => {
        const expr = this.generateExpression(shared.expression);
        return `  ${shared.varName} := ${expr};`;
      }).join('\n');

      return `(\n${bindings}\n  ${output}\n)`;
    }

    return output;
  }

  /**
   * Generate JSONata code from an IR expression
   */
  private generateExpression(expr: Expression): string {
    switch (expr.kind) {
      case 'literal':
        return this.generateLiteral(expr.value, expr.type);

      case 'field':
        return expr.path;

      case 'sharedRef':
        // Emit variable reference (already bound in shared expressions)
        return expr.varName;

      case 'binary':
        return this.generateBinary(expr);

      case 'unary':
        return this.generateUnary(expr);

      case 'call':
        return this.generateCall(expr);

      case 'conditional':
        return this.generateConditional(expr);

      case 'array':
        return this.generateArray(expr);

      case 'object':
        return this.generateObject(expr);

      default:
        return 'null';
    }
  }

  /**
   * Generate literal value
   */
  private generateLiteral(value: any, type: string): string {
    if (type === 'null') return 'null';
    if (type === 'boolean') return String(value);
    if (type === 'number' || type === 'integer') return String(value);
    if (type === 'string') return JSON.stringify(value);
    return JSON.stringify(value);
  }

  /**
   * Generate binary operation
   */
  private generateBinary(expr: any): string {
    const left = this.generateExpression(expr.left);
    const right = this.generateExpression(expr.right);

    switch (expr.operator) {
      // Arithmetic
      case 'add': return `(${left} + ${right})`;
      case 'subtract': return `(${left} - ${right})`;
      case 'multiply': return `(${left} * ${right})`;
      case 'divide': return `(${left} / ${right})`;
      case 'modulo': return `(${left} % ${right})`;
      case 'power': return `$power(${left}, ${right})`;

      // Comparison
      case 'equal': return `(${left} = ${right})`;
      case 'notEqual': return `(${left} != ${right})`;
      case 'lessThan': return `(${left} < ${right})`;
      case 'lessEqual': return `(${left} <= ${right})`;
      case 'greaterThan': return `(${left} > ${right})`;
      case 'greaterEqual': return `(${left} >= ${right})`;

      // Logical
      case 'and': return `(${left} and ${right})`;
      case 'or': return `(${left} or ${right})`;

      // String
      case 'concat': return `(${left} & ${right})`;

      default: return `(${left} ${expr.operator} ${right})`;
    }
  }

  /**
   * Generate unary operation
   */
  private generateUnary(expr: any): string {
    const operand = this.generateExpression(expr.operand);

    switch (expr.operator) {
      case 'negate': return `(-${operand})`;
      case 'not': return `$not(${operand})`;
      case 'abs': return `$abs(${operand})`;
      case 'ceil': return `$ceil(${operand})`;
      case 'floor': return `$floor(${operand})`;
      case 'round': return `$round(${operand})`;
      case 'sqrt': return `$sqrt(${operand})`;
      default: return operand;
    }
  }

  /**
   * Generate function call
   */
  private generateCall(expr: any): string {
    const args = expr.args.map((arg: Expression) => this.generateExpression(arg));
    const config = expr.config || {};

    switch (expr.function) {
      // String functions
      case 'uppercase': return `$uppercase(${args[0]})`;
      case 'lowercase': return `$lowercase(${args[0]})`;
      case 'trim': return `$trim(${args[0]})`;
      case 'length': return `$length(${args[0]})`;
      case 'substring': return `$substring(${args[0]}, ${args[1]}, ${args[2]})`;
      case 'replace': return `$replace(${args[0]}, "${config.search || ''}", "${config.replace || ''}")`;
      case 'split': return `$split(${args[0]}, "${config.delimiter || ','}")`;
      case 'join': return `$join(${args[0]}, "${config.delimiter || ','}")`;

      // Array functions
      case 'map': return `${args[0]}.(${args[1]})`;
      case 'filter': return `${args[0]}[${args[1]}]`;
      case 'count': return `$count(${args[0]})`;
      case 'distinct': return `$distinct(${args[0]})`;
      case 'sort': return `$sort(${args[0]})`;
      case 'reverse': return `$reverse(${args[0]})`;
      case 'flatten': return `$reduce(${args[0]}, function($i, $j) { $append($i, $j) })`;

      // Aggregate functions - handle array operations
      case 'sum':
      case 'average':
      case 'min':
      case 'max': {
        const arrayContext = this.extractArrayContext(expr.args[0]);
        if (arrayContext) {
          // Generate array map syntax: items.(expression)
          const innerExpr = this.generateExpressionForArrayContext(expr.args[0]);
          return `$${expr.function}(${arrayContext}.${innerExpr})`;
        }
        return `$${expr.function}(${args[0]})`;
      }

      // Conversion functions
      case 'toString': return `$string(${args[0]})`;
      case 'toNumber': return `$number(${args[0]})`;
      case 'toBoolean': return `$boolean(${args[0]})`;
      case 'toInteger': return `$floor($number(${args[0]}))`;
      case 'toArray': return `[${args[0]}]`;
      case 'toDate': return `$toMillis(${args[0]})`;
      case 'parseJSON': return `$eval(${args[0]})`;
      case 'stringifyJSON': return `$string(${args[0]})`;

      // DateTime functions
      case 'now': return '$now()';
      case 'formatDate': return `$fromMillis($toMillis(${args[0]}), "${config.format || 'YYYY-MM-DD'}")`;
      case 'parseDate': return `$toMillis(${args[0]})`;
      case 'addDays': return `$toMillis(${args[0]}) + (${args[1]} * 86400000)`;
      case 'addMonths': return `$fromMillis($toMillis(${args[0]}) + (${args[1]} * 2592000000), "[Y0001]-[M01]-[D01]")`;
      case 'dateDiff': return `($toMillis(${args[1]}) - $toMillis(${args[0]})) / 86400000`;

      // Custom function
      case 'custom': return config.code || 'null';

      default: return `$${expr.function}(${args.join(', ')})`;
    }
  }

  /**
   * Generate conditional (ternary)
   */
  private generateConditional(expr: any): string {
    const condition = this.generateExpression(expr.condition);
    const thenExpr = this.generateExpression(expr.then);
    const elseExpr = this.generateExpression(expr.else);
    return `(${condition} ? ${thenExpr} : ${elseExpr})`;
  }

  /**
   * Extract source array name from expression
   * e.g., "items[].price" → "items"
   */
  private extractSourceArray(expr: Expression): string {
    if (expr.kind === 'field') {
      const match = expr.path.match(/^([^[]+)\[\]/);
      return match ? match[1] : expr.path;
    }

    // For binary/unary/call, recursively find field references
    if (expr.kind === 'binary') {
      return this.extractSourceArray(expr.left);
    }

    if (expr.kind === 'unary') {
      return this.extractSourceArray(expr.operand);
    }

    if (expr.kind === 'call' && expr.args.length > 0) {
      return this.extractSourceArray(expr.args[0]);
    }

    return 'data'; // Fallback
  }

  /**
   * Extract array context from expression (for aggregate operations)
   * Returns the array name if expression contains array field references, null otherwise
   * e.g., Binary(items[].quantity * items[].price) → "items"
   */
  private extractArrayContext(expr: Expression): string | null {
    if (expr.kind === 'field') {
      const match = expr.path.match(/^([^[]+)\[\]/);
      return match ? match[1] : null;
    }

    if (expr.kind === 'binary') {
      // Check both sides, return if either has array context
      const left = this.extractArrayContext(expr.left);
      const right = this.extractArrayContext(expr.right);
      return left || right;
    }

    if (expr.kind === 'unary') {
      return this.extractArrayContext(expr.operand);
    }

    if (expr.kind === 'call' && expr.args.length > 0) {
      return this.extractArrayContext(expr.args[0]);
    }

    return null;
  }

  /**
   * Generate expression for array context (strip array indices)
   * e.g., "items[].price" → "price"
   */
  private generateExpressionForArrayContext(expr: Expression): string {
    if (expr.kind === 'field') {
      // Strip array prefix: "items[].price" → "price"
      const path = expr.path.replace(/^[^[]+\[\]\./, '');
      return path;
    }

    if (expr.kind === 'binary') {
      const left = this.generateExpressionForArrayContext(expr.left);
      const right = this.generateExpressionForArrayContext(expr.right);
      return this.generateBinaryOperator(expr.operator, left, right);
    }

    if (expr.kind === 'unary') {
      const operand = this.generateExpressionForArrayContext(expr.operand);
      return this.generateUnaryOperator(expr.operator, operand);
    }

    if (expr.kind === 'call') {
      const args = expr.args.map((arg) => this.generateExpressionForArrayContext(arg));
      return this.generateCallWithArgs(expr, args);
    }

    // For literals, conditionals, etc., use regular generation
    return this.generateExpression(expr);
  }

  /**
   * Generate binary operator
   */
  private generateBinaryOperator(operator: string, left: string, right: string): string {
    switch (operator) {
      case 'add': return `(${left} + ${right})`;
      case 'subtract': return `(${left} - ${right})`;
      case 'multiply': return `(${left} * ${right})`;
      case 'divide': return `(${left} / ${right})`;
      case 'modulo': return `(${left} % ${right})`;
      case 'power': return `$power(${left}, ${right})`;
      case 'equal': return `(${left} = ${right})`;
      case 'notEqual': return `(${left} != ${right})`;
      case 'lessThan': return `(${left} < ${right})`;
      case 'lessEqual': return `(${left} <= ${right})`;
      case 'greaterThan': return `(${left} > ${right})`;
      case 'greaterEqual': return `(${left} >= ${right})`;
      case 'and': return `(${left} and ${right})`;
      case 'or': return `(${left} or ${right})`;
      case 'concat': return `(${left} & ${right})`;
      default: return `(${left} ${operator} ${right})`;
    }
  }

  /**
   * Generate unary operator
   */
  private generateUnaryOperator(operator: string, operand: string): string {
    switch (operator) {
      case 'not': return `$not(${operand})`;
      case 'negate': return `(-${operand})`;
      default: return `${operator}(${operand})`;
    }
  }

  /**
   * Generate call with custom args
   */
  private generateCallWithArgs(expr: any, args: string[]): string {
    const config = expr.config || {};

    switch (expr.function) {
      // String functions
      case 'uppercase': return `$uppercase(${args[0]})`;
      case 'lowercase': return `$lowercase(${args[0]})`;
      case 'trim': return `$trim(${args[0]})`;
      case 'substring': return `$substring(${args[0]}, ${config.start || 0}, ${config.length || ''})`;
      case 'replace': return `$replace(${args[0]}, "${config.search || ''}", "${config.replace || ''}")`;
      case 'concat': return args.join(' & ');
      case 'split': return `$split(${args[0]}, "${config.delimiter || ','}")`;
      case 'join': return `$join(${args[0]}, "${config.delimiter || ','}")`;

      // Aggregate functions
      case 'sum': return `$sum(${args[0]})`;
      case 'average': return `$average(${args[0]})`;
      case 'min': return `$min(${args[0]})`;
      case 'max': return `$max(${args[0]})`;

      // Conversion functions
      case 'toString': return `$string(${args[0]})`;
      case 'toNumber': return `$number(${args[0]})`;
      case 'toInteger': return `$floor($number(${args[0]}))`;
      case 'toDate': return `$toMillis(${args[0]})`;
      case 'stringifyJSON': return `$string(${args[0]})`;

      // DateTime functions
      case 'formatDate': return `$fromMillis($toMillis(${args[0]}), "${config.format || 'YYYY-MM-DD'}")`;
      case 'parseDate': return `$toMillis(${args[0]})`;
      case 'addDays': return `$toMillis(${args[0]}) + (${args[1]} * 86400000)`;
      case 'addMonths': return `$fromMillis($toMillis(${args[0]}) + (${args[1]} * 2592000000), "[Y0001]-[M01]-[D01]")`;
      case 'dateDiff': return `($toMillis(${args[1]}) - $toMillis(${args[0]})) / 86400000`;

      default: return `$${expr.function}(${args.join(', ')})`;
    }
  }

  /**
   * Generate array literal
   */
  private generateArray(expr: any): string {
    const elements = expr.elements.map((el: Expression) => this.generateExpression(el));
    return `[${elements.join(', ')}]`;
  }

  /**
   * Generate object literal
   */
  private generateObject(expr: any): string {
    const props = expr.properties.map((prop: any) => {
      const key = prop.key;
      const value = this.generateExpression(prop.value);
      return `"${key}": ${value}`;
    });
    return `{${props.join(', ')}}`;
  }
}

/**
 * Execute JSONata expression with test data
 */
export async function executeJSONata(expression: string, sourceData: any): Promise<any> {
  // Dynamic import to support both Node.js and browser
  const jsonata = (await import('jsonata')).default;
  const expr = jsonata(expression);
  return expr.evaluate(sourceData);
}
