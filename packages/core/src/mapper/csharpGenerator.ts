/**
 * C# Code Generator (Backend)
 * Converts MapperIR to executable C# code using System.Text.Json
 *
 * Generates expression body code that can be inserted into C# methods.
 * Uses System.Text.Json.Nodes (JsonObject, JsonArray) for dynamic JSON manipulation.
 */

import type { MapSpec } from './types';
import type { ContractMapSpec } from './contractTypes';
import type { MapperIR, Expression } from './ir';
import { lowerMapSpec } from './lower';

/**
 * Generate C# code from MapSpec
 * (convenience function that lowers then generates)
 */
export function generateCSharp(mapSpec: MapSpec): string {
  // Check if this is a contract-based mapper
  const contractMapSpec = mapSpec as unknown as ContractMapSpec;
  if (contractMapSpec.contractType && contractMapSpec.handlers) {
    // Generate code for contract mapper with all handlers
    return generateContractMapperCode(contractMapSpec);
  }

  // Non-contract mapper: use top-level nodes/edges
  const ir = lowerMapSpec(mapSpec);
  const targetOrder = mapSpec.schemaParts?.targetOrder;
  return generateCSharpFromIR(ir, targetOrder);
}

/**
 * Generate code for contract mapper with all handlers
 */
function generateContractMapperCode(contractMapSpec: ContractMapSpec): string {
  const lines: string[] = [];

  // Add usings
  lines.push('using System.Threading.Tasks;');
  lines.push('using System.Text.Json.Nodes;');
  lines.push('using BBT.Workflow.Scripting;');
  lines.push('using BBT.Workflow.Definitions;');
  lines.push('');

  // Add class header
  lines.push(`public class ${contractMapSpec.className || 'GeneratedMapper'} : ${contractMapSpec.contractType}`);
  lines.push('{');

  // Generate code for each handler
  if (contractMapSpec.contractType === 'IMapping') {
    // IMapping has InputHandler and OutputHandler
    const inputHandler = contractMapSpec.handlers?.InputHandler;
    const outputHandler = contractMapSpec.handlers?.OutputHandler;

    // Generate InputHandler
    lines.push('    public async Task<ScriptResponse> InputHandler(ScriptContext context, WorkflowTask task)');
    lines.push('    {');
    if (inputHandler && (inputHandler.nodes?.length || inputHandler.edges?.length)) {
      const handlerMapSpec = {
        ...contractMapSpec,
        nodes: inputHandler.nodes || [],
        edges: inputHandler.edges || [],
        schemaParts: inputHandler.schemaParts,
        schemaOverlays: inputHandler.schemaOverlays
      };
      const ir = lowerMapSpec(handlerMapSpec as any);
      const targetOrder = inputHandler.schemaParts?.targetOrder;
      const body = generateCSharpFromIR(ir, targetOrder);
      const indentedBody = body.split('\n').map(line => '        ' + line).join('\n');
      lines.push(indentedBody);
      lines.push('');
      lines.push('        return new ScriptResponse { Data = target_audit };');
    } else {
      lines.push('        // TODO: Implement InputHandler mapping');
      lines.push('        return new ScriptResponse();');
    }
    lines.push('    }');
    lines.push('');

    // Generate OutputHandler
    lines.push('    public async Task<ScriptResponse> OutputHandler(ScriptContext context)');
    lines.push('    {');
    if (outputHandler && (outputHandler.nodes?.length || outputHandler.edges?.length)) {
      const handlerMapSpec = {
        ...contractMapSpec,
        nodes: outputHandler.nodes || [],
        edges: outputHandler.edges || [],
        schemaParts: outputHandler.schemaParts,
        schemaOverlays: outputHandler.schemaOverlays
      };
      const ir = lowerMapSpec(handlerMapSpec as any);
      const targetOrder = outputHandler.schemaParts?.targetOrder;
      const body = generateCSharpFromIR(ir, targetOrder);
      const indentedBody = body.split('\n').map(line => '        ' + line).join('\n');
      lines.push(indentedBody);
    } else {
      lines.push('        // TODO: Implement OutputHandler mapping');
      lines.push('        return new ScriptResponse();');
    }
    lines.push('    }');
  } else {
    // Other contract types - use first handler found
    const handlerName = Object.keys(contractMapSpec.handlers || {})[0];
    const handler = contractMapSpec.handlers?.[handlerName];

    lines.push('    public async Task<dynamic> Handler(ScriptContext context)');
    lines.push('    {');
    if (handler && (handler.nodes?.length || handler.edges?.length)) {
      const handlerMapSpec = {
        ...contractMapSpec,
        nodes: handler.nodes || [],
        edges: handler.edges || [],
        schemaParts: handler.schemaParts,
        schemaOverlays: handler.schemaOverlays
      };
      const ir = lowerMapSpec(handlerMapSpec as any);
      const targetOrder = handler.schemaParts?.targetOrder;
      const body = generateCSharpFromIR(ir, targetOrder);
      const indentedBody = body.split('\n').map(line => '        ' + line).join('\n');
      lines.push(indentedBody);
      lines.push('');
      lines.push('        return target_result;');
    } else {
      lines.push('        // TODO: Implement handler mapping');
      lines.push('        return null;');
    }
    lines.push('    }');
  }

  lines.push('}');
  return lines.join('\n');
}

/**
 * Generate contract method wrapper (DEPRECATED - use generateContractMapperCode instead)
 */
function _generateContractMethod(mapSpec: MapSpec, body: string): string {
  const contractMapSpec = mapSpec as unknown as ContractMapSpec;
  const contractType = contractMapSpec.contractType;
  const lines: string[] = [];

  // Add class header
  lines.push(`public class ${contractMapSpec.className || 'GeneratedMapper'} : ${contractType}`);
  lines.push('{');

  // Generate methods based on contract type
  if (contractType === 'IMapping') {
    // IMapping has InputHandler and OutputHandler
    // For now, we're generating OutputHandler (the active handler)
    lines.push('    public async Task<ScriptResponse> InputHandler(ScriptContext context, WorkflowTask task)');
    lines.push('    {');
    lines.push('        // TODO: Implement InputHandler mapping');
    lines.push('        return new ScriptResponse();');
    lines.push('    }');
    lines.push('');
    lines.push('    public async Task<ScriptResponse> OutputHandler(ScriptContext context)');
    lines.push('    {');

    // Indent the body
    const indentedBody = body.split('\n').map(line => '        ' + line).join('\n');
    lines.push(indentedBody);
    lines.push('');
    lines.push('        return new ScriptResponse { Data = target_data };');
    lines.push('    }');
  } else if (contractType === 'IConditionMapping') {
    lines.push('    public async Task<bool> Handler(ScriptContext context)');
    lines.push('    {');
    const indentedBody = body.split('\n').map(line => '        ' + line).join('\n');
    lines.push(indentedBody);
    lines.push('');
    lines.push('        return target_result;');
    lines.push('    }');
  } else if (contractType === 'ITransitionMapping') {
    lines.push('    public async Task<dynamic> Handler(ScriptContext context)');
    lines.push('    {');
    const indentedBody = body.split('\n').map(line => '        ' + line).join('\n');
    lines.push(indentedBody);
    lines.push('');
    lines.push('        return target_result;');
    lines.push('    }');
  } else {
    // Generic contract - just wrap the body
    lines.push('    public async Task<dynamic> Handler(ScriptContext context)');
    lines.push('    {');
    const indentedBody = body.split('\n').map(line => '        ' + line).join('\n');
    lines.push(indentedBody);
    lines.push('');
    lines.push('        return target_data;');
    lines.push('    }');
  }

  lines.push('}');

  return lines.join('\n');
}

/**
 * Generate C# from MapperIR
 */
export function generateCSharpFromIR(ir: MapperIR, targetOrder?: string[]): string {
  const generator = new CSharpGenerator(ir, targetOrder);
  return generator.generateDeclarative();
}

/**
 * C# code generator (works with IR)
 */
class CSharpGenerator {
  private ir: MapperIR;
  private targetOrder?: string[];
  private indentLevel: number = 0;
  private usesLinq: boolean = false;

  constructor(ir: MapperIR, targetOrder?: string[]) {
    this.ir = ir;
    this.targetOrder = targetOrder;
  }

  /**
   * Generate declarative C# code with anonymous objects
   */
  generateDeclarative(): string {
    if (this.ir.mappings.length === 0) {
      return 'return new ScriptResponse();';
    }

    const lines: string[] = [];

    // Generate shared expressions first
    if (this.ir.sharedExpressions && this.ir.sharedExpressions.length > 0) {
      for (const shared of this.ir.sharedExpressions) {
        const expr = this.generateExpression(shared.expression);
        const varName = shared.varName.replace('$', 'var_');
        lines.push(`var ${varName} = ${expr};`);
      }
      lines.push('');
    }

    // Build a tree structure from mappings
    interface TreeNode {
      [key: string]: TreeNode | string; // string represents the expression value
    }

    const tree: TreeNode = {};
    const arrayMappings = new Map<string, { field: string; expr: Expression }[]>();

    // Organize mappings into tree structure
    for (const mapping of this.ir.mappings) {
      const arrayMatch = mapping.target.match(/^(.+?)\[\]\.(.+)$/);

      if (arrayMatch) {
        // Array mapping
        const arrayBase = arrayMatch[1];
        const fieldName = arrayMatch[2];

        if (!arrayMappings.has(arrayBase)) {
          arrayMappings.set(arrayBase, []);
        }

        arrayMappings.get(arrayBase)!.push({
          field: fieldName,
          expr: mapping.expression
        });
      } else {
        // Simple mapping - build tree
        const parts = mapping.target.split('.');
        let current: any = tree;

        for (let i = 0; i < parts.length - 1; i++) {
          const part = parts[i];
          if (!current[part] || typeof current[part] === 'string') {
            current[part] = {};
          }
          current = current[part];
        }

        const lastPart = parts[parts.length - 1];
        current[lastPart] = this.generateExpressionDeclarative(mapping.expression);
      }
    }

    // Handle array mappings - add them to the tree
    for (const [arrayPath, fields] of arrayMappings.entries()) {
      const parts = arrayPath.split('.');
      let current: any = tree;

      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!current[part] || typeof current[part] === 'string') {
          current[part] = {};
        }
        current = current[part];
      }

      const lastPart = parts[parts.length - 1];
      const sourceArray = this.extractSourceArray(fields[0].expr);
      const sourceArrayAccess = this.generateFieldAccessDeclarative(sourceArray);

      // Generate LINQ Select expression
      const selectBody = this.generateAnonymousObject(
        fields.reduce((acc, f) => {
          acc[f.field] = this.generateExpressionForArrayContext(f.expr);
          return acc;
        }, {} as Record<string, string>),
        4
      );

      current[lastPart] = `${sourceArrayAccess}?.Select(item => ${selectBody}).ToList()`;
    }

    // Generate ScriptResponse
    // If tree has a single 'data' key (ScriptResponse wrapper), unwrap it
    let responseTree = tree;
    if (Object.keys(tree).length === 1 && tree['data'] && typeof tree['data'] === 'object') {
      responseTree = tree['data'] as TreeNode;
    }

    // Generate properties for ScriptResponse
    const props: string[] = [];
    for (const [key, value] of Object.entries(responseTree)) {
      if (typeof value === 'string') {
        props.push(`    ${key} = ${value}`);
      } else if (typeof value === 'object') {
        const nestedObj = this.generateAnonymousObject(value, 2);
        props.push(`    ${key} = ${nestedObj}`);
      }
    }

    lines.push('return new ScriptResponse');
    lines.push('{');
    lines.push(props.join(',\n'));
    lines.push('};');

    return lines.join('\n');
  }

  /**
   * Generate anonymous object from tree structure
   */
  private generateAnonymousObject(obj: any, indent: number): string {
    const indentStr = ' '.repeat(indent);
    const propIndentStr = ' '.repeat(indent + 4);

    const props: string[] = [];

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        // Leaf node - direct value
        props.push(`${propIndentStr}${key} = ${value}`);
      } else if (typeof value === 'object') {
        // Nested object
        const nestedObj = this.generateAnonymousObject(value, indent + 4);
        props.push(`${propIndentStr}${key} = ${nestedObj}`);
      }
    }

    if (props.length === 0) {
      return 'new { }';
    }

    return `new\n${indentStr}{\n${props.join(',\n')}\n${indentStr}}`;
  }

  /**
   * Generate expression for declarative code (with better field access)
   */
  private generateExpressionDeclarative(expr: Expression): string {
    switch (expr.kind) {
      case 'literal':
        return this.generateLiteral(expr.value, expr.type);

      case 'field':
        return this.generateFieldAccessDeclarative(expr.path);

      case 'sharedRef':
        return expr.varName.replace('$', 'var_');

      case 'binary':
        return this.generateBinaryDeclarative(expr);

      case 'unary':
        return this.generateUnaryDeclarative(expr);

      case 'call':
        return this.generateCallDeclarative(expr);

      case 'conditional':
        return this.generateConditionalDeclarative(expr);

      case 'array':
        return this.generateArrayDeclarative(expr);

      case 'object':
        return this.generateObjectDeclarative(expr);

      default:
        return 'null';
    }
  }

  /**
   * Generate field access for declarative code
   * Converts paths like "Body.headers.user_reference" to "context.Headers?["user_reference"]"
   */
  private generateFieldAccessDeclarative(path: string): string {
    // Remove array indices and synthetic conditionals
    let cleanPath = path.replace(/\[\]/g, '');
    cleanPath = cleanPath.replace(/__SYNTH__\[[^\]]+\]\s+[^.]+/g, '');

    const parts = cleanPath.split('.').filter(p => p.length > 0);

    if (parts.length === 0) {
      return 'context';
    }

    // Special handling for common ScriptContext patterns
    const firstPart = parts[0];

    // If the first part is 'context', skip it and use the next part
    // This handles paths like "context.Body.headers.x"
    if (firstPart === 'context' && parts.length > 1) {
      const secondPart = parts[1];

      // Handle context.Body.headers -> context.Headers
      if (secondPart === 'Body' && parts.length > 2 && parts[2] === 'headers') {
        if (parts.length === 3) {
          return 'context.Headers';
        }
        // context.Body.headers.x -> context.Headers?["x"]
        const headerKeys = parts.slice(3).map(p => `["${p}"]`).join('');
        return `context.Headers?${headerKeys}`;
      }

      // Handle other context properties
      if (parts.length === 2) {
        return `context.${secondPart}`;
      }

      // context.Instance.something -> context.Instance?["something"]
      let result = `context.${secondPart}`;
      for (let i = 2; i < parts.length; i++) {
        result += `?["${parts[i]}"]`;
      }
      return result;
    }

    // Handle Body.headers -> Headers (when no 'context' prefix)
    if (firstPart === 'Body' && parts.length > 1 && parts[1] === 'headers') {
      if (parts.length === 2) {
        return 'context.Headers';
      }
      // Body.headers.x -> context.Headers?["x"]
      const headerKeys = parts.slice(2).map(p => `["${p}"]`).join('');
      return `context.Headers?${headerKeys}`;
    }

    // Handle Instance, Body, etc. as property access
    if (parts.length === 1) {
      return `context.${firstPart}`;
    }

    // Handle nested property access with null-conditional operator
    let result = `context.${firstPart}`;
    for (let i = 1; i < parts.length; i++) {
      // Use indexer syntax for nested properties
      result += `?["${parts[i]}"]`;
    }

    return result;
  }

  /**
   * Generate binary operation for declarative code
   */
  private generateBinaryDeclarative(expr: any): string {
    const left = this.generateExpressionDeclarative(expr.left);
    const right = this.generateExpressionDeclarative(expr.right);

    switch (expr.operator) {
      // Arithmetic
      case 'add': return `(${left} + ${right})`;
      case 'subtract': return `(${left} - ${right})`;
      case 'multiply': return `(${left} * ${right})`;
      case 'divide': return `(${left} / ${right})`;
      case 'modulo': return `(${left} % ${right})`;
      case 'power': return `Math.Pow(${left}, ${right})`;

      // Comparison
      case 'equal': return `(${left} == ${right})`;
      case 'notEqual': return `(${left} != ${right})`;
      case 'lessThan': return `(${left} < ${right})`;
      case 'lessEqual': return `(${left} <= ${right})`;
      case 'greaterThan': return `(${left} > ${right})`;
      case 'greaterEqual': return `(${left} >= ${right})`;

      // Logical
      case 'and': return `(${left} && ${right})`;
      case 'or': return `(${left} || ${right})`;

      // String
      case 'concat': return `(${left} + ${right})`;

      default: return `(${left} ${expr.operator} ${right})`;
    }
  }

  /**
   * Generate unary operation for declarative code
   */
  private generateUnaryDeclarative(expr: any): string {
    const operand = this.generateExpressionDeclarative(expr.operand);

    switch (expr.operator) {
      case 'negate': return `(-${operand})`;
      case 'not': return `(!${operand})`;
      case 'abs': return `Math.Abs(${operand})`;
      case 'ceil': return `Math.Ceiling(${operand})`;
      case 'floor': return `Math.Floor(${operand})`;
      case 'round': return `Math.Round(${operand})`;
      case 'sqrt': return `Math.Sqrt(${operand})`;
      default: return operand;
    }
  }

  /**
   * Generate function call for declarative code
   */
  private generateCallDeclarative(expr: any): string {
    const args = expr.args.map((arg: Expression) => this.generateExpressionDeclarative(arg));
    const config = expr.config || {};

    switch (expr.function) {
      // String functions
      case 'uppercase': return `${args[0]}?.ToUpper()`;
      case 'lowercase': return `${args[0]}?.ToLower()`;
      case 'trim': return `${args[0]}?.Trim()`;
      case 'length': return `${args[0]}?.Length`;
      case 'substring':
        return `${args[0]}?.Substring(${args[1] || 0}, ${args[2] || ''})`;
      case 'replace':
        return `${args[0]}?.Replace("${config.search || ''}", "${config.replace || ''}")`;
      case 'split':
        return `${args[0]}?.Split("${config.delimiter || ','}")`;
      case 'join':
        return `string.Join("${config.delimiter || ','}", ${args[0]})`;

      // Conversion functions
      case 'toString': return `${args[0]}?.ToString()`;
      case 'toNumber': return `Convert.ToDecimal(${args[0]})`;
      case 'toBoolean': return `Convert.ToBoolean(${args[0]})`;
      case 'toInteger': return `Convert.ToInt32(${args[0]})`;

      // DateTime functions
      case 'now': return 'DateTime.Now';
      case 'formatDate':
        return `${args[0]}?.ToString("${config.format || 'yyyy-MM-dd'}")`;

      // Null coalescing
      case 'coalesce':
        if (args.length === 2) {
          return `(${args[0]} ?? ${args[1]})`;
        }
        return args.join(' ?? ');

      default: return this.generateCall(expr); // Fall back to original implementation
    }
  }

  /**
   * Generate conditional for declarative code
   */
  private generateConditionalDeclarative(expr: any): string {
    const condition = this.generateExpressionDeclarative(expr.condition);
    const thenExpr = this.generateExpressionDeclarative(expr.then);
    const elseExpr = this.generateExpressionDeclarative(expr.else);

    // Detect null coalescing pattern: (x != null ? x : y) -> (x ?? y)
    // Check if condition is "x != null" and then is the same as x
    if (expr.condition.kind === 'binary' &&
        expr.condition.operator === 'notEqual' &&
        expr.condition.right.kind === 'literal' &&
        expr.condition.right.value === null) {
      // Get the left side expression
      const leftExpr = this.generateExpressionDeclarative(expr.condition.left);
      // If then expression matches the condition's left side, use ??
      if (leftExpr === thenExpr) {
        return `(${leftExpr} ?? ${elseExpr})`;
      }
    }

    return `(${condition} ? ${thenExpr} : ${elseExpr})`;
  }

  /**
   * Generate array for declarative code
   */
  private generateArrayDeclarative(expr: any): string {
    const elements = expr.elements.map((el: Expression) => this.generateExpressionDeclarative(el));
    return `new[] { ${elements.join(', ')} }`;
  }

  /**
   * Generate object for declarative code
   */
  private generateObjectDeclarative(expr: any): string {
    const props = expr.properties.map((prop: any) => {
      const key = prop.key;
      const value = this.generateExpressionDeclarative(prop.value);
      return `${key} = ${value}`;
    });
    return `new { ${props.join(', ')} }`;
  }

  /**
   * Generate C# code for entire mapper (old imperative style - kept for compatibility)
   */
  generate(): string {
    if (this.ir.mappings.length === 0) {
      return 'new JsonObject()'; // Empty object if no mappings
    }

    // Reset LINQ usage tracking
    this.usesLinq = false;

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

    // Add comment with required usings if LINQ is used
    const comments: string[] = [];
    comments.push('// Required usings:');
    comments.push('// using System.Text.Json.Nodes;');
    if (this.usesLinq) {
      comments.push('// using System.Linq;');
    }
    comments.push('');

    // If we have shared expressions, declare them first
    if (this.ir.sharedExpressions && this.ir.sharedExpressions.length > 0) {
      for (const shared of this.ir.sharedExpressions) {
        const expr = this.generateExpression(shared.expression);
        const varName = shared.varName.replace('$', 'var_'); // C# variable name
        lines.push(`var ${varName} = ${expr};`);
      }
      lines.push('');
    }

    // Collect unique target parts from mappings
    const targetParts = new Set<string>();
    for (const mapping of simpleMappings) {
      const parts = mapping.target.split('.').filter(p => p.length > 0);
      if (parts.length > 0) {
        targetParts.add(parts[0].replace(/\[\]$/, '')); // Remove array suffix
      }
    }
    for (const [arrayName] of arrayMappings.entries()) {
      const parts = arrayName.split('.').filter(p => p.length > 0);
      if (parts.length > 0) {
        targetParts.add(parts[0].replace(/\[\]$/, '')); // Remove array suffix
      }
    }

    // Initialize target part variables with prefix to avoid naming conflicts
    // Use targetOrder if available, otherwise sort alphabetically
    const orderedParts = this.getOrderedParts(Array.from(targetParts));
    for (const part of orderedParts) {
      lines.push(`var target_${part} = new JsonObject();`);
    }
    lines.push('');

    // Add simple mappings with proper nesting
    // Sort by depth to ensure parent objects are created before children
    const sortedMappings = simpleMappings.sort((a, b) => {
      const depthA = a.target.split('.').length;
      const depthB = b.target.split('.').length;
      return depthA - depthB;
    });

    const createdPaths = new Set<string>();

    for (const mapping of sortedMappings) {
      const parts = mapping.target.split('.').filter(p => p.length > 0);

      if (parts.length > 2) {
        // Need to ensure intermediate objects exist
        // e.g., "body.address.city" needs to ensure "body.address" exists as JsonObject
        const targetVar = `target_${parts[0].replace(/\[\]$/, '')}`; // Remove array suffix

        // Create intermediate objects
        for (let i = 1; i < parts.length - 1; i++) {
          const pathSoFar = parts.slice(1, i + 1).map(p => `["${p.replace(/\[\]$/, '')}"]`).join(''); // Remove array suffix
          const fullPath = `${targetVar}${pathSoFar}`;

          if (!createdPaths.has(fullPath)) {
            lines.push(`${fullPath} ??= new JsonObject();`);
            createdPaths.add(fullPath);
          }
        }
      }

      const assignment = this.generateNestedAssignment('', mapping.target, mapping.expr, true);
      lines.push(`${assignment};`);
    }

    // Add array mappings
    for (const [arrayName, fields] of arrayMappings.entries()) {
      const sourceArray = fields[0].sourceArray;

      // Ensure intermediate objects exist for nested array paths
      const parts = arrayName.split('.').filter(p => p.length > 0);
      if (parts.length > 2) {
        const targetVar = `target_${parts[0].replace(/\[\]$/, '')}`; // Remove array suffix

        // Create intermediate objects
        for (let i = 1; i < parts.length - 1; i++) {
          const pathSoFar = parts.slice(1, i + 1).map(p => `["${p.replace(/\[\]$/, '')}"]`).join(''); // Remove array suffix
          const fullPath = `${targetVar}${pathSoFar}`;

          if (!createdPaths.has(fullPath)) {
            lines.push(`${fullPath} ??= new JsonObject();`);
            createdPaths.add(fullPath);
          }
        }
      }

      // Generate LINQ Select for array transformation
      const sourceArrayAccess = this.generateFieldAccess(sourceArray);
      const arrayValue = `new JsonArray(((JsonArray)${sourceArrayAccess}).Select(item => new JsonObject\n{\n${fields.map((f) => {
        const expr = this.generateExpressionForArrayContext(f.expr);
        const cleanFieldName = f.field.replace(/\[\]$/, ''); // Remove array suffix from field name
        return `    ["${cleanFieldName}"] = ${expr}`;
      }).join(',\n')}\n}))`;

      const assignment = this.generateNestedAssignment('', arrayName, arrayValue, true);
      lines.push(assignment.replace('; ', ';\n'));
    }

    lines.push('');

    // Return target parts
    if (targetParts.size === 1) {
      // Single target part - return it directly
      const singlePart = Array.from(targetParts)[0];
      lines.push(`return target_${singlePart};`);
    } else if (targetParts.size > 1) {
      // Multiple target parts - return as JsonObject with part properties
      lines.push('return new JsonObject');
      lines.push('{');
      const partReturns = orderedParts.map(part => `    ["${part}"] = target_${part}`);
      lines.push(partReturns.join(',\n'));
      lines.push('};');
    } else {
      // No mappings - return empty object
      lines.push('return new JsonObject();');
    }

    return comments.join('\n') + lines.join('\n');
  }

  /**
   * Get target parts in the correct order
   * Uses targetOrder if available, otherwise sorts alphabetically
   */
  private getOrderedParts(parts: string[]): string[] {
    if (this.targetOrder && this.targetOrder.length > 0) {
      // Use targetOrder, filtering to only include parts that exist
      const orderedParts = this.targetOrder.filter(part => parts.includes(part));
      // Add any remaining parts not in the order array
      const remainingParts = parts.filter(part => !this.targetOrder!.includes(part));
      return [...orderedParts, ...remainingParts];
    }
    // Fall back to alphabetical sorting
    return parts.sort();
  }

  /**
   * Generate C# code from an IR expression
   */
  private generateExpression(expr: Expression): string {
    switch (expr.kind) {
      case 'literal':
        return this.generateLiteral(expr.value, expr.type);

      case 'field':
        return this.generateFieldAccess(expr.path);

      case 'sharedRef':
        // Emit variable reference (C# variable)
        return expr.varName.replace('$', 'var_');

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
    if (type === 'boolean') return value ? 'true' : 'false';
    if (type === 'number' || type === 'integer') return String(value);
    if (type === 'string') return JSON.stringify(value); // Uses double quotes
    return JSON.stringify(value);
  }

  /**
   * Generate nested assignment for target paths
   * For multi-part documents: "body.loginURI" -> target_body["loginURI"] = value
   * Where "target_body" is the target part variable name (prefixed to avoid conflicts)
   */
  private generateNestedAssignment(rootVar: string, path: string, value: string, isTarget: boolean = false): string {
    const parts = path.split('.').filter(p => p.length > 0);

    if (parts.length === 0) {
      return `${rootVar} = ${value}`;
    }

    if (parts.length === 1) {
      // Top-level part: target_body = value
      const cleanPart = parts[0].replace(/\[\]$/, ''); // Remove array suffix
      const varName = isTarget ? `target_${cleanPart}` : cleanPart;
      return `${varName} = ${value}`;
    }

    // For multi-part: first part is the variable (with prefix for targets), rest are property path
    // "body.loginURI" -> target_body["loginURI"] = value
    const firstPart = parts[0].replace(/\[\]$/, ''); // Remove array suffix
    const varName = isTarget ? `target_${firstPart}` : firstPart;
    const propertyPath = parts.slice(1).map(p => `["${p.replace(/\[\]$/, '')}"]`).join(''); // Remove array suffix from each part

    return `${varName}${propertyPath} = ${value}`;
  }

  /**
   * Generate field access (JObject property access)
   * For multi-part documents: "body.name" -> body["name"]
   * For simple paths: "customer.name" -> source["customer"]["name"]
   */
  private generateFieldAccess(path: string): string {
    // Remove array indices
    let cleanPath = path.replace(/\[\]/g, '');

    // Remove synthetic conditional notation (e.g., __SYNTH__[type=6] HTTP Task)
    cleanPath = cleanPath.replace(/__SYNTH__\[[^\]]+\]\s+[^.]+/g, '');

    // Split into parts and filter out empty segments
    const parts = cleanPath.split('.').filter(p => p.length > 0);

    if (parts.length === 0) {
      return 'source';
    }

    // For multi-part documents, first part is the variable name (e.g., "body", "header")
    // Use it directly as a variable instead of source["part"]
    const varName = parts[0];

    if (parts.length === 1) {
      // Just the part name: "body" -> body
      return varName;
    }

    // Nested access: "body.name" -> body["name"]
    let result = varName;
    for (let i = 1; i < parts.length; i++) {
      result += `["${parts[i]}"]`;
    }

    return result;
  }

  /**
   * Generate binary operation
   */
  private generateBinary(expr: any): string {
    const left = this.generateExpression(expr.left);
    const right = this.generateExpression(expr.right);

    // Add type conversion helpers
    const leftVal = this.wrapWithValueAccess(left, expr.left);
    const rightVal = this.wrapWithValueAccess(right, expr.right);

    switch (expr.operator) {
      // Arithmetic
      case 'add': return `(${leftVal} + ${rightVal})`;
      case 'subtract': return `(${leftVal} - ${rightVal})`;
      case 'multiply': return `(${leftVal} * ${rightVal})`;
      case 'divide': return `(${leftVal} / ${rightVal})`;
      case 'modulo': return `(${leftVal} % ${rightVal})`;
      case 'power': return `Math.Pow(${leftVal}, ${rightVal})`;

      // Comparison - use string comparison for equality checks
      case 'equal': return `(${left}?.ToString() == ${right}?.ToString())`;
      case 'notEqual': return `(${left}?.ToString() != ${right}?.ToString())`;
      case 'lessThan': return `(${leftVal} < ${rightVal})`;
      case 'lessEqual': return `(${leftVal} <= ${rightVal})`;
      case 'greaterThan': return `(${leftVal} > ${rightVal})`;
      case 'greaterEqual': return `(${leftVal} >= ${rightVal})`;

      // Logical
      case 'and': return `(${leftVal} && ${rightVal})`;
      case 'or': return `(${leftVal} || ${rightVal})`;

      // String
      case 'concat': return `(${left}?.ToString() + ${right}?.ToString())`;

      default: return `(${leftVal} ${expr.operator} ${rightVal})`;
    }
  }

  /**
   * Wrap expression with appropriate GetValue<T>() access if needed
   */
  private wrapWithValueAccess(expr: string, irExpr: Expression): string {
    // If it's already a literal or variable, don't wrap
    if (irExpr.kind === 'literal' || irExpr.kind === 'sharedRef') {
      return expr;
    }

    // If it's a binary/unary/call, it's already evaluated
    if (irExpr.kind === 'binary' || irExpr.kind === 'unary' || irExpr.kind === 'call') {
      return expr;
    }

    // For field access, add GetValue<decimal>() for numeric operations
    if (irExpr.kind === 'field') {
      return `${expr}?.GetValue<decimal>()`;
    }

    return expr;
  }

  /**
   * Generate unary operation
   */
  private generateUnary(expr: any): string {
    const operand = this.generateExpression(expr.operand);
    const operandVal = this.wrapWithValueAccess(operand, expr.operand);

    switch (expr.operator) {
      case 'negate': return `(-${operandVal})`;
      case 'not': return `(!${operandVal})`;
      case 'abs': return `Math.Abs(${operandVal})`;
      case 'ceil': return `Math.Ceiling(${operandVal})`;
      case 'floor': return `Math.Floor(${operandVal})`;
      case 'round': return `Math.Round(${operandVal})`;
      case 'sqrt': return `Math.Sqrt(${operandVal})`;
      default: return operandVal;
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
      case 'uppercase': return `${args[0]}?.ToString().ToUpper()`;
      case 'lowercase': return `${args[0]}?.ToString().ToLower()`;
      case 'trim': return `${args[0]}?.ToString().Trim()`;
      case 'length': return `${args[0]}?.ToString().Length`;
      case 'substring':
        return `${args[0]}?.ToString().Substring(${args[1] || 0}, ${args[2] || ''})`;
      case 'replace':
        return `${args[0]}?.ToString().Replace("${config.search || ''}", "${config.replace || ''}")`;
      case 'split':
        this.usesLinq = true;
        return `${args[0]}?.ToString().Split("${config.delimiter || ','}")`;
      case 'join':
        return `string.Join("${config.delimiter || ','}", ${args[0]})`;
      case 'randomString': {
        this.usesLinq = true;
        const length = config.length || 10;
        const alphanumeric = config.alphanumeric !== false; // default true
        const numeric = config.numeric || false;
        const symbols = config.symbols || false;

        // Build character set based on config
        let charset = '';
        if (alphanumeric) {
          charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        } else if (numeric) {
          charset += '0123456789';
        }
        if (symbols) {
          charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';
        }

        if (!charset) {
          charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'; // fallback
        }

        // C# code to generate random string
        const charsetStr = charset.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        return `new string(Enumerable.Range(0, ${length}).Select(_ => "${charsetStr}"[new Random().Next(${charset.length})]).ToArray())`;
      }

      // Array functions
      case 'count':
        this.usesLinq = true;
        return `((JsonArray)${args[0]}).Count`;
      case 'distinct':
        this.usesLinq = true;
        return `new JsonArray(((JsonArray)${args[0]}).Distinct().ToArray())`;
      case 'sort':
        this.usesLinq = true;
        return `new JsonArray(((JsonArray)${args[0]}).OrderBy(x => x).ToArray())`;
      case 'reverse':
        this.usesLinq = true;
        return `new JsonArray(((JsonArray)${args[0]}).Reverse().ToArray())`;
      case 'flatten':
        this.usesLinq = true;
        return `new JsonArray(((JsonArray)${args[0]}).SelectMany(x => (JsonArray)x).ToArray())`;

      // Aggregate functions
      case 'sum': {
        this.usesLinq = true;
        const arrayContext = this.extractArrayContext(expr.args[0]);
        if (arrayContext) {
          const innerExpr = this.generateExpressionForArrayContext(expr.args[0]);
          return `((JsonArray)${this.generateFieldAccess(arrayContext)}).Sum(item => ${innerExpr})`;
        }
        return `((JsonArray)${args[0]}).Sum(x => x.GetValue<decimal>())`;
      }
      case 'average': {
        this.usesLinq = true;
        const arrayContext = this.extractArrayContext(expr.args[0]);
        if (arrayContext) {
          const innerExpr = this.generateExpressionForArrayContext(expr.args[0]);
          return `((JsonArray)${this.generateFieldAccess(arrayContext)}).Average(item => ${innerExpr})`;
        }
        return `((JsonArray)${args[0]}).Average(x => x.GetValue<decimal>())`;
      }
      case 'min': {
        this.usesLinq = true;
        const arrayContext = this.extractArrayContext(expr.args[0]);
        if (arrayContext) {
          const innerExpr = this.generateExpressionForArrayContext(expr.args[0]);
          return `((JsonArray)${this.generateFieldAccess(arrayContext)}).Min(item => ${innerExpr})`;
        }
        return `((JsonArray)${args[0]}).Min(x => x.GetValue<decimal>())`;
      }
      case 'max': {
        this.usesLinq = true;
        const arrayContext = this.extractArrayContext(expr.args[0]);
        if (arrayContext) {
          const innerExpr = this.generateExpressionForArrayContext(expr.args[0]);
          return `((JsonArray)${this.generateFieldAccess(arrayContext)}).Max(item => ${innerExpr})`;
        }
        return `((JsonArray)${args[0]}).Max(x => x.GetValue<decimal>())`;
      }

      // Conversion functions
      case 'toString': return `${args[0]}?.ToString()`;
      case 'toNumber': return `Convert.ToDecimal(${args[0]})`;
      case 'toBoolean': return `Convert.ToBoolean(${args[0]})`;
      case 'toInteger': return `Convert.ToInt32(${args[0]})`;
      case 'toArray': return `new JsonArray(${args[0]})`;
      case 'toDate': return `DateTime.Parse(${args[0]}?.ToString())`;
      case 'parseJSON': return `JsonNode.Parse(${args[0]}?.ToString())`;
      case 'stringifyJSON': return `${args[0]}?.ToJsonString()`;

      // DateTime functions
      case 'now': return 'DateTime.Now';
      case 'formatDate':
        return `DateTime.Parse(${args[0]}?.ToString()).ToString("${config.format || 'yyyy-MM-dd'}")`;
      case 'parseDate':
        return `DateTime.Parse(${args[0]}?.ToString())`;
      case 'addDays':
        return `DateTime.Parse(${args[0]}?.ToString()).AddDays(${args[1]})`;
      case 'addMonths':
        return `DateTime.Parse(${args[0]}?.ToString()).AddMonths(${args[1]})`;
      case 'dateDiff':
        return `(DateTime.Parse(${args[1]}?.ToString()) - DateTime.Parse(${args[0]}?.ToString())).TotalDays`;

      // Custom function
      case 'custom': return config.code || 'null';

      default: return `/* Unknown function: ${expr.function} */ null`;
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
   * Generate expression for array context (use 'item' variable)
   * e.g., "items[].price" → "item["price"]" (type conversion added by operator context)
   */
  private generateExpressionForArrayContext(expr: Expression): string {
    if (expr.kind === 'field') {
      // Strip array prefix: "items[].price" → "price"
      const path = expr.path.replace(/^[^[]+\[\]\./, '');
      const parts = path.split('.');

      let result = 'item';
      for (const part of parts) {
        result += `["${part}"]`;
      }

      // Don't add type conversion here - let context determine it
      return result;
    }

    if (expr.kind === 'binary') {
      const left = this.generateExpressionForArrayContext(expr.left);
      const right = this.generateExpressionForArrayContext(expr.right);
      return this.generateBinaryOperatorForArray(expr.operator, left, right);
    }

    if (expr.kind === 'unary') {
      const operand = this.generateExpressionForArrayContext(expr.operand);
      return this.generateUnaryOperatorForArray(expr.operator, operand);
    }

    if (expr.kind === 'call') {
      const args = expr.args.map((arg) => this.generateExpressionForArrayContext(arg));
      return this.generateCallWithArgsForArray(expr, args);
    }

    // For literals, conditionals, etc., use regular generation
    return this.generateExpression(expr);
  }

  /**
   * Generate binary operator for array context
   */
  private generateBinaryOperatorForArray(operator: string, left: string, right: string): string {
    switch (operator) {
      // Arithmetic operations need numeric conversion
      case 'add': return `(${left}?.GetValue<decimal>() + ${right}?.GetValue<decimal>())`;
      case 'subtract': return `(${left}?.GetValue<decimal>() - ${right}?.GetValue<decimal>())`;
      case 'multiply': return `(${left}?.GetValue<decimal>() * ${right}?.GetValue<decimal>())`;
      case 'divide': return `(${left}?.GetValue<decimal>() / ${right}?.GetValue<decimal>())`;
      case 'modulo': return `(${left}?.GetValue<decimal>() % ${right}?.GetValue<decimal>())`;
      case 'power': return `Math.Pow(${left}?.GetValue<decimal>() ?? 0, ${right}?.GetValue<decimal>() ?? 0)`;

      // String comparison - convert to string
      case 'equal': return `(${left}?.ToString() == ${right}?.ToString())`;
      case 'notEqual': return `(${left}?.ToString() != ${right}?.ToString())`;

      // Numeric comparison
      case 'lessThan': return `(${left}?.GetValue<decimal>() < ${right}?.GetValue<decimal>())`;
      case 'lessEqual': return `(${left}?.GetValue<decimal>() <= ${right}?.GetValue<decimal>())`;
      case 'greaterThan': return `(${left}?.GetValue<decimal>() > ${right}?.GetValue<decimal>())`;
      case 'greaterEqual': return `(${left}?.GetValue<decimal>() >= ${right}?.GetValue<decimal>())`;

      // Logical
      case 'and': return `(${left}?.GetValue<bool>() == true && ${right}?.GetValue<bool>() == true)`;
      case 'or': return `(${left}?.GetValue<bool>() == true || ${right}?.GetValue<bool>() == true)`;

      // String concat
      case 'concat': return `(${left}?.ToString() + ${right}?.ToString())`;

      default: return `(${left} ${operator} ${right})`;
    }
  }

  /**
   * Generate unary operator for array context
   */
  private generateUnaryOperatorForArray(operator: string, operand: string): string {
    switch (operator) {
      case 'not': return `(!${operand})`;
      case 'negate': return `(-${operand})`;
      case 'abs': return `Math.Abs(${operand})`;
      case 'ceil': return `Math.Ceiling(${operand})`;
      case 'floor': return `Math.Floor(${operand})`;
      case 'round': return `Math.Round(${operand})`;
      case 'sqrt': return `Math.Sqrt(${operand})`;
      default: return `${operator}(${operand})`;
    }
  }

  /**
   * Generate call with custom args for array context
   */
  private generateCallWithArgsForArray(expr: any, args: string[]): string {
    const config = expr.config || {};

    switch (expr.function) {
      // String functions
      case 'uppercase': return `${args[0]}?.ToString().ToUpper()`;
      case 'lowercase': return `${args[0]}?.ToString().ToLower()`;
      case 'trim': return `${args[0]}?.ToString().Trim()`;
      case 'substring': return `${args[0]}?.ToString().Substring(${config.start || 0}, ${config.length || ''})`;
      case 'replace': return `${args[0]}?.ToString().Replace("${config.search || ''}", "${config.replace || ''}")`;
      case 'concat': return args.map(a => `${a}?.ToString()`).join(' + ');
      case 'split': return `${args[0]}?.ToString().Split("${config.delimiter || ','}")`;
      case 'join': return `string.Join("${config.delimiter || ','}", ${args[0]})`;

      // Aggregate functions
      case 'sum': return `${args[0]}`;
      case 'average': return `${args[0]}`;
      case 'min': return `${args[0]}`;
      case 'max': return `${args[0]}`;

      // Conversion functions
      case 'toString': return `${args[0]}?.ToString()`;
      case 'toNumber': return `Convert.ToDecimal(${args[0]})`;
      case 'toInteger': return `Convert.ToInt32(${args[0]})`;
      case 'toDate': return `DateTime.Parse(${args[0]}?.ToString())`;
      case 'stringifyJSON': return `${args[0]}?.ToString()`;

      // DateTime functions
      case 'formatDate': return `DateTime.Parse(${args[0]}?.ToString()).ToString("${config.format || 'yyyy-MM-dd'}")`;
      case 'parseDate': return `DateTime.Parse(${args[0]}?.ToString())`;
      case 'addDays': return `DateTime.Parse(${args[0]}?.ToString()).AddDays(${args[1]})`;
      case 'addMonths': return `DateTime.Parse(${args[0]}?.ToString()).AddMonths(${args[1]})`;
      case 'dateDiff': return `(DateTime.Parse(${args[1]}?.ToString()) - DateTime.Parse(${args[0]}?.ToString())).TotalDays`;

      default: return `/* Unknown function: ${expr.function} */ null`;
    }
  }

  /**
   * Generate array literal
   */
  private generateArray(expr: any): string {
    const elements = expr.elements.map((el: Expression) => this.generateExpression(el));
    return `new JsonArray(${elements.join(', ')})`;
  }

  /**
   * Generate object literal
   */
  private generateObject(expr: any): string {
    const props = expr.properties.map((prop: any) => {
      const key = prop.key;
      const value = this.generateExpression(prop.value);
      return `["${key}"] = ${value}`;
    });
    return `new JsonObject { ${props.join(', ')} }`;
  }
}
