/**
 * Mapper Lowering Pass
 *
 * Converts MapSpec (graph-based) to MapperIR (expression-based)
 * This follows the same pattern as workflow lowering.
 */

import type { MapSpec, Edge, MapSpecNode, NodeKind, JSONSchema } from './types';
import type {
  MapperIR,
  Expression,
  FieldMapping,
  SharedExpression,
  BinaryOperator,
  UnaryOperator,
  FunctionName
} from './ir';
import { functoidRegistry } from './registry';
import { applyOverlaysToSchema, stripSyntheticSegment } from './adapter';
import { extractTemplateParams } from './urlTemplateUtils';

/**
 * Check if a JSONPath handle exists in a schema (with overlays already applied)
 * Handle format: "$.field" or "$.items[].field" or "$.nested.field"
 * Also handles synthetic notation like "[type=6] HTTP Task" which should be stripped
 */
function handleExistsInSchema(
  handle: string,
  schema: JSONSchema | null | undefined
): boolean {
  if (!handle) return false;
  if (!handle.startsWith('$.')) return false;
  if (!schema) return false;

  // Remove the "$." prefix
  const path = handle.substring(2);

  // Split by "." to get path segments
  const segments = path.split('.');

  // Strip synthetic notation segments (format: "[field=value] Display Name")
  // These are used for display but don't exist in the actual schema
  // stripSyntheticSegment returns empty string for synthetic segments
  const cleanedSegments = segments
    .map(seg => stripSyntheticSegment(seg))
    .filter(seg => seg !== '');

  let currentSchema: JSONSchema | undefined = schema;

  for (const segment of cleanedSegments) {
    // Remove array brackets if present (e.g., "items[]" -> "items")
    const fieldName = segment.replace('[]', '');

    // Check if this is an array access
    const isArray = segment.includes('[]');

    // Check if field exists in properties
    if (currentSchema?.properties && fieldName in currentSchema.properties) {
      currentSchema = currentSchema.properties[fieldName];

      // If this is an array access, navigate to items schema
      if (isArray && currentSchema?.items) {
        currentSchema = currentSchema.items as JSONSchema;
      }
    } else if (currentSchema?.allOf) {
      // Check in allOf branches (for conditional schemas with overlays)
      for (const branch of currentSchema.allOf) {
        const branchSchema = branch as JSONSchema;
        if (branchSchema.properties && fieldName in branchSchema.properties) {
          currentSchema = branchSchema.properties[fieldName];

          // If this is an array access, navigate to items schema
          if (isArray && currentSchema?.items) {
            currentSchema = currentSchema.items as JSONSchema;
          }

          // Found it in this branch, continue to next segment
          break;
        }
      }

      // If we still don't have a match, field doesn't exist
      if (!currentSchema?.properties && !currentSchema?.allOf && !currentSchema?.items) {
        return false;
      }
    } else {
      return false; // Field doesn't exist
    }
  }

  return true;
}

/**
 * Clean orphaned edges from MapSpec
 * Removes edges that reference non-existent nodes or handles
 */
export function cleanOrphanedEdges(
  mapSpec: MapSpec,
  sourceSchema?: JSONSchema | null,
  targetSchema?: JSONSchema | null
): MapSpec {
  // Build set of valid node IDs (filter out undefined/null nodes)
  const nodeIds = new Set<string>();
  if (mapSpec.nodes && Array.isArray(mapSpec.nodes)) {
    for (const node of mapSpec.nodes) {
      if (node && node.id) {
        nodeIds.add(node.id);
      }
    }
  }
  nodeIds.add('source-schema');
  nodeIds.add('target-schema');

  // Apply overlays to schemas at their specified paths for validation
  const enhancedSourceSchema = sourceSchema ? applyOverlaysToSchema(sourceSchema, mapSpec.schemaOverlays?.source) : null;
  const enhancedTargetSchema = targetSchema ? applyOverlaysToSchema(targetSchema, mapSpec.schemaOverlays?.target) : null;

  const validEdges = mapSpec.edges.filter(edge => {
    // Check if source/target nodes exist
    const sourceExists = nodeIds.has(edge.source);
    const targetExists = nodeIds.has(edge.target);

    if (!sourceExists || !targetExists) {
      console.warn(`Removing orphaned edge: ${edge.id} (node not found: source=${edge.source}, target=${edge.target})`);
      return false;
    }

    // Check if handles exist on schema nodes (with overlays applied)
    if (edge.source === 'source-schema' && edge.sourceHandle) {
      if (enhancedSourceSchema && !handleExistsInSchema(edge.sourceHandle, enhancedSourceSchema)) {
        console.warn(`Removing orphaned edge: ${edge.id} (source handle not found: ${edge.sourceHandle})`);
        return false;
      }
    }

    if (edge.target === 'target-schema' && edge.targetHandle) {
      if (enhancedTargetSchema && !handleExistsInSchema(edge.targetHandle, enhancedTargetSchema)) {
        console.warn(`Removing orphaned edge: ${edge.id} (target handle not found: ${edge.targetHandle})`);
        return false;
      }
    }

    return true;
  });

  if (validEdges.length !== mapSpec.edges.length) {
    return { ...mapSpec, edges: validEdges };
  }

  return mapSpec;
}

/**
 * Lower MapSpec to MapperIR
 */
export function lowerMapSpec(mapSpec: MapSpec): MapperIR {
  // Clean up orphaned edges before processing
  // Use embedded schemas if available
  const sourceSchema = mapSpec.schemas.sourceSchema;
  const targetSchema = mapSpec.schemas.targetSchema;
  const cleanedMapSpec = cleanOrphanedEdges(mapSpec, sourceSchema, targetSchema);
  const lowerer = new MapSpecLowerer(cleanedMapSpec);
  return lowerer.lower();
}

/**
 * MapSpec lowering implementation
 */
class MapSpecLowerer {
  private mapSpec: MapSpec;
  private nodeExpressions: Map<string, Expression> = new Map();
  private nodeRefCounts: Map<string, number> = new Map();
  private shareableNodes: Set<string> = new Set();

  constructor(mapSpec: MapSpec) {
    this.mapSpec = mapSpec;
  }

  /**
   * Lower entire MapSpec to IR
   */
  lower(): MapperIR {
    // Ensure nodes and edges arrays exist
    if (!this.mapSpec.nodes) {
      this.mapSpec.nodes = [];
    }
    if (!this.mapSpec.edges) {
      this.mapSpec.edges = [];
    }

    // Step 1: Build expression for each functoid node
    this.buildNodeExpressions();

    // Step 2: Compute refcounts (how many times each node is referenced)
    this.computeRefCounts();

    // Step 3: Mark shareable nodes (refcount > 1, pure, non-trivial)
    this.markShareableNodes();

    // Step 4: Replace all references to shareable nodes with SharedRefExpr
    // This walks the expression tree and replaces nested references
    this.replaceWithSharedRefs();

    // Step 5: Build shared expressions list (only for actually used shared nodes)
    const sharedExpressions = this.buildSharedExpressions();

    // Step 6: Find all target schema connections and build mappings
    const targetEdges = this.mapSpec.edges.filter(
      (edge) => edge.target === 'target-schema'
    );

    const mappings: FieldMapping[] = targetEdges.map((edge) => ({
      target: this.cleanPath(edge.targetHandle),
      expression: this.getSourceExpressionWithSharing(edge),
      type: undefined
    }));

    return {
      version: '1.0',
      schemas: this.mapSpec.schemas,
      mappings,
      sharedExpressions: sharedExpressions.length > 0 ? sharedExpressions : undefined,
      metadata: {
        name: this.mapSpec.metadata.name,
        description: this.mapSpec.metadata.description,
        author: this.mapSpec.metadata.author,
        version: this.mapSpec.metadata.version,
        createdAt: this.mapSpec.metadata.createdAt,
        updatedAt: this.mapSpec.metadata.updatedAt
      }
    };
  }

  /**
   * Build expressions for all functoid nodes
   */
  private buildNodeExpressions(): void {
    // Process nodes in dependency order
    const processed = new Set<string>();
    let changed = true;

    while (changed) {
      changed = false;

      for (const node of this.mapSpec.nodes) {
        // Skip invalid nodes
        if (!node || !node.kind) {
          console.warn('[Mapper Lower] Skipping invalid node:', node);
          continue;
        }

        if (processed.has(node.id)) continue;

        // Get input edges
        const inputs = this.mapSpec.edges.filter((e) => e.target === node.id);

        // Check if all dependencies resolved
        const canProcess = inputs.every((edge) =>
          edge.source === 'source-schema' || processed.has(edge.source)
        );

        if (canProcess) {
          const expr = this.lowerNode(node, inputs);
          this.nodeExpressions.set(node.id, expr);
          processed.add(node.id);
          changed = true;
        }
      }
    }
  }

  /**
   * Lower a single functoid node to expression
   */
  private lowerNode(node: MapSpecNode, inputs: Edge[]): Expression {
    const kind = node.kind;
    const config = node.config || {};

    // Get ordered input expressions
    const inputExprs = this.getOrderedInputs(node.id, inputs);

    // Helper to get input with fallback to null
    const getInput = (index: number): Expression => {
      return inputExprs[index] || this.literal(null, 'null');
    };

    // Map functoid kind to expression
    switch (kind) {
      // Binary arithmetic
      case 'Binary.Add':
        return this.binary('add', getInput(0), getInput(1));
      case 'Binary.Subtract':
        return this.binary('subtract', getInput(0), getInput(1));
      case 'Binary.Multiply':
        return this.binary('multiply', getInput(0), getInput(1));
      case 'Binary.Divide':
        return this.binary('divide', getInput(0), getInput(1));
      case 'Binary.Modulo':
        return this.binary('modulo', getInput(0), getInput(1));
      case 'Binary.Power':
        return this.binary('power', getInput(0), getInput(1));

      // Binary comparison
      case 'Binary.Equal':
        return this.binary('equal', getInput(0), getInput(1));
      case 'Binary.NotEqual':
        return this.binary('notEqual', getInput(0), getInput(1));
      case 'Binary.LessThan':
        return this.binary('lessThan', getInput(0), getInput(1));
      case 'Binary.LessThanOrEqual':
        return this.binary('lessEqual', getInput(0), getInput(1));
      case 'Binary.GreaterThan':
        return this.binary('greaterThan', getInput(0), getInput(1));
      case 'Binary.GreaterThanOrEqual':
        return this.binary('greaterEqual', getInput(0), getInput(1));

      // Binary logical
      case 'Binary.And':
        return this.binary('and', getInput(0), getInput(1));
      case 'Binary.Or':
        return this.binary('or', getInput(0), getInput(1));

      // Unary operations
      case 'Unary.Not':
        return this.unary('not', getInput(0));
      case 'Unary.Negate':
        return this.unary('negate', getInput(0));
      case 'Unary.Abs':
        return this.unary('abs', getInput(0));
      case 'Unary.Ceil':
        return this.unary('ceil', getInput(0));
      case 'Unary.Floor':
        return this.unary('floor', getInput(0));
      case 'Unary.Round':
        return this.unary('round', getInput(0));
      case 'Unary.Sqrt':
        return this.unary('sqrt', getInput(0));

      // String operations
      case 'String.Concat':
        return this.concat(inputExprs);
      case 'String.Uppercase':
        return this.call('uppercase', inputExprs);
      case 'String.Lowercase':
        return this.call('lowercase', inputExprs);
      case 'String.Trim':
        return this.call('trim', inputExprs);
      case 'String.Length':
        return this.call('length', inputExprs);
      case 'String.Substring':
        return this.call('substring', inputExprs);
      case 'String.Replace':
        return this.call('replace', inputExprs, config);
      case 'String.Split':
        return this.call('split', inputExprs, config);
      case 'String.Join':
        return this.call('join', inputExprs, config);
      case 'String.UrlTemplate':
        return this.urlTemplate(inputExprs, config);

      // Conditional
      case 'Conditional.If':
        return this.conditional(getInput(0), getInput(1), getInput(2));
      case 'Conditional.DefaultValue':
        return this.conditional(
          this.binary('notEqual', getInput(0), this.literal(null, 'null')),
          getInput(0),
          getInput(1)
        );
      case 'Conditional.Switch':
        return this.switchExpr(getInput(0), config);

      // Collection operations
      case 'Collection.Map':
        return this.call('map', inputExprs);
      case 'Collection.Filter':
        return this.call('filter', inputExprs);
      case 'Collection.Count':
        return this.call('count', inputExprs);
      case 'Collection.Distinct':
        return this.call('distinct', inputExprs);
      case 'Collection.Sort':
        return this.call('sort', inputExprs);
      case 'Collection.Reverse':
        return this.call('reverse', inputExprs);
      case 'Collection.Flatten':
        return this.call('flatten', inputExprs);

      // Aggregate operations
      case 'Aggregate.Sum':
        return this.call('sum', inputExprs);
      case 'Aggregate.Average':
        return this.call('average', inputExprs);
      case 'Aggregate.Min':
        return this.call('min', inputExprs);
      case 'Aggregate.Max':
        return this.call('max', inputExprs);
      case 'Aggregate.Count':
        return this.call('count', inputExprs);

      // Conversion operations
      case 'Convert.ToString':
        return this.call('toString', inputExprs);
      case 'Convert.ToNumber':
        return this.call('toNumber', inputExprs);
      case 'Convert.ToBoolean':
        return this.call('toBoolean', inputExprs);
      case 'Convert.ToInteger':
        return this.call('toInteger', inputExprs);
      case 'Convert.ToArray':
        return this.call('toArray', inputExprs);
      case 'Convert.ToDate':
        return this.call('toDate', inputExprs);
      case 'Convert.ParseJSON':
        return this.call('parseJSON', inputExprs);
      case 'Convert.StringifyJSON':
        return this.call('stringifyJSON', inputExprs);

      // DateTime operations
      case 'DateTime.Now':
        return this.call('now', []);
      case 'DateTime.Format':
        return this.call('formatDate', inputExprs, config);
      case 'DateTime.Parse':
        return this.call('parseDate', inputExprs);
      case 'DateTime.AddDays':
        return this.call('addDays', inputExprs);
      case 'DateTime.AddMonths':
        return this.call('addMonths', inputExprs);
      case 'DateTime.Diff':
        return this.call('dateDiff', inputExprs);

      // Const value
      case 'Const.Value':
        return this.constValue(config);

      // Custom function
      case 'Custom.Function':
        return this.call('custom', inputExprs, config);

      default:
        // Unknown functoid - return null literal
        return this.literal(null, 'null');
    }
  }

  /**
   * Helper: Create binary operation
   */
  private binary(op: BinaryOperator, left: Expression, right: Expression): Expression {
    return { kind: 'binary', operator: op, left, right };
  }

  /**
   * Helper: Create unary operation
   */
  private unary(op: UnaryOperator, operand: Expression): Expression {
    return { kind: 'unary', operator: op, operand };
  }

  /**
   * Helper: Create function call
   */
  private call(fn: FunctionName, args: Expression[], config?: Record<string, any>): Expression {
    return { kind: 'call', function: fn, args, config };
  }

  /**
   * Helper: Create conditional
   */
  private conditional(condition: Expression, thenExpr: Expression, elseExpr: Expression): Expression {
    return { kind: 'conditional', condition, then: thenExpr, else: elseExpr };
  }

  /**
   * Helper: Create literal
   */
  private literal(value: any, type: 'string' | 'number' | 'integer' | 'boolean' | 'null'): Expression {
    return { kind: 'literal', value, type };
  }

  /**
   * Helper: Create field reference
   */
  private field(path: string): Expression {
    return { kind: 'field', path };
  }

  /**
   * Helper: String concatenation
   */
  private concat(exprs: Expression[]): Expression {
    if (exprs.length === 0) return this.literal('', 'string');
    if (exprs.length === 1) return exprs[0];

    // Chain binary concat operations
    let result = exprs[0];
    for (let i = 1; i < exprs.length; i++) {
      result = this.binary('concat', result, exprs[i]);
    }
    return result;
  }

  /**
   * Helper: Switch expression
   */
  private switchExpr(input: Expression, config: Record<string, any>): Expression {
    const cases = config.cases || [];
    const defaultValue = config.default;

    // Build nested conditionals
    let result: Expression = defaultValue
      ? this.literal(defaultValue, 'string')
      : this.literal(null, 'null');

    // Build from right to left
    for (let i = cases.length - 1; i >= 0; i--) {
      const caseItem = cases[i];
      const condition = this.binary('equal', input, this.literal(caseItem.when, 'string'));
      const thenExpr = this.literal(caseItem.then, 'string');
      result = this.conditional(condition, thenExpr, result);
    }

    return result;
  }

  /**
   * Helper: Const value
   */
  private constValue(config: Record<string, any>): Expression {
    const value = config.value;
    const type = config.type || 'string';

    if (type === 'string') return this.literal(value, 'string');
    if (type === 'boolean') return this.literal(value === 'true', 'boolean');
    if (type === 'integer') return this.literal(parseInt(value, 10), 'integer');
    if (type === 'number') return this.literal(parseFloat(value), 'number');
    if (type === 'null') return this.literal(null, 'null');

    // object/array: parse JSON
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return {
          kind: 'array',
          elements: parsed.map((v) => this.literal(v, typeof v as any))
        };
      }
      return this.literal(value, 'string'); // Treat as string for now
    } catch {
      return this.literal(value, 'string');
    }
  }

  /**
   * Helper: URL Template
   * Builds a string by replacing template parameters with input values
   *
   * Example: template = "http://{hostname}/api/{version}"
   *          inputs = [hostnameExpr, versionExpr]
   *          Result: concat("http://", hostnameExpr, "/api/", versionExpr)
   */
  private urlTemplate(inputExprs: Expression[], config: Record<string, any>): Expression {
    const template = config.template || '';

    if (!template) {
      return this.literal('', 'string');
    }

    // Extract parameter names from template
    const params = extractTemplateParams(template);

    // Build parts by splitting the template on parameter placeholders
    const parts: Expression[] = [];
    let remainingTemplate = template;
    let currentPos = 0;

    params.forEach((param, index) => {
      const placeholder = `{${param}}`;
      const placeholderPos = remainingTemplate.indexOf(placeholder, currentPos);

      if (placeholderPos !== -1) {
        // Add the literal string before this parameter
        const literalPart = remainingTemplate.substring(currentPos, placeholderPos);
        if (literalPart) {
          parts.push(this.literal(literalPart, 'string'));
        }

        // Add the parameter value (from inputs)
        if (inputExprs[index]) {
          parts.push(inputExprs[index]);
        } else {
          // No input provided, use empty string
          parts.push(this.literal('', 'string'));
        }

        currentPos = placeholderPos + placeholder.length;
      }
    });

    // Add any remaining literal text after the last parameter
    const finalPart = remainingTemplate.substring(currentPos);
    if (finalPart) {
      parts.push(this.literal(finalPart, 'string'));
    }

    // If no parts, return empty string
    if (parts.length === 0) {
      return this.literal(template, 'string');
    }

    // If only one part, return it directly
    if (parts.length === 1) {
      return parts[0];
    }

    // Chain concatenations
    return this.concat(parts);
  }

  /**
   * Get ordered input expressions
   */
  private getOrderedInputs(nodeId: string, inputs: Edge[]): Expression[] {
    const sorted = inputs.sort((a, b) => {
      const aIdx = this.getInputIndex(a.targetHandle);
      const bIdx = this.getInputIndex(b.targetHandle);
      return aIdx - bIdx;
    });

    return sorted.map((edge) => this.getSourceExpression(edge));
  }

  /**
   * Get source expression for an edge
   * During initial build, we create placeholders for functoid refs
   */
  private getSourceExpression(edge: Edge): Expression {
    if (edge.source === 'source-schema') {
      // Field reference
      return this.field(this.cleanPath(edge.sourceHandle));
    }

    // Create a temporary placeholder that tracks which node this came from
    // This will be replaced later with either full expression or SharedRefExpr
    return {
      kind: 'sharedRef' as const,
      nodeId: edge.source,
      varName: '' // Will be filled in later if this becomes a real shared ref
    };
  }

  /**
   * Clean JSONPath - removes $ prefix and synthetic conditional notation
   * E.g., "$.config.__SYNTH__[type=6] HTTP Task.headers" -> "config.headers"
   */
  private cleanPath(path: string): string {
    // Strip $ prefix
    let cleaned = path.replace(/^\$\.?/, '');

    // Strip synthetic conditional notation like ".__SYNTH__[type=6] HTTP Task"
    cleaned = cleaned.replace(/\.__SYNTH__\[[^\]]+\]\s+[^.]+/g, '');

    return cleaned;
  }

  /**
   * Extract input index from handle ID
   */
  private getInputIndex(handleId: string): number {
    const match = handleId.match(/input-(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  /**
   * Compute reference counts for each functoid node
   */
  private computeRefCounts(): void {
    for (const edge of this.mapSpec.edges) {
      // Skip edges from schema nodes
      if (edge.source === 'source-schema' || edge.source === 'target-schema') {
        continue;
      }

      // Count outgoing edges from each functoid
      const count = this.nodeRefCounts.get(edge.source) || 0;
      this.nodeRefCounts.set(edge.source, count + 1);
    }
  }

  /**
   * Mark nodes as shareable (refcount > 1, pure, non-trivial, not array-scoped)
   */
  private markShareableNodes(): void {
    for (const node of this.mapSpec.nodes) {
      // Skip invalid nodes
      if (!node || !node.kind) {
        console.warn('[Mapper Lower] Skipping invalid node in markShareableNodes:', node);
        continue;
      }

      const refCount = this.nodeRefCounts.get(node.id) || 0;

      // Only consider nodes with multiple references
      if (refCount <= 1) continue;

      // Check if node is pure (no side effects)
      if (!this.isPureNodeKind(node.kind)) continue;

      // Estimate expression cost (don't hoist trivial expressions)
      const expr = this.nodeExpressions.get(node.id);
      if (!expr) continue;

      const cost = this.estimateCost(expr);
      if (cost < 2) continue; // Don't hoist simple field refs or literals

      // Don't hoist if ANY usage is in an array context (per-item evaluation)
      if (this.isUsedInArrayContext(node.id)) continue;

      // Mark as shareable
      this.shareableNodes.add(node.id);
    }
  }

  /**
   * Replace all references to shareable nodes with SharedRefExpr
   * Walks expression trees recursively
   */
  private replaceWithSharedRefs(): void {
    // Replace in all node expressions
    for (const [nodeId, expr] of this.nodeExpressions.entries()) {
      this.nodeExpressions.set(nodeId, this.replaceSharedRefsInExpr(expr));
    }
  }

  /**
   * Recursively replace placeholder references
   * - If node is shareable: keep as SharedRefExpr with varName filled in
   * - If node is not shareable: inline the full expression
   */
  private replaceSharedRefsInExpr(expr: Expression): Expression {
    // Guard against undefined expressions
    if (!expr) {
      console.warn('[Mapper Lower] replaceSharedRefsInExpr called with undefined expression');
      return this.literal(null, 'null');
    }

    switch (expr.kind) {
      case 'literal':
      case 'field':
        return expr; // No nested expressions

      case 'sharedRef':
        // This is a placeholder from getSourceExpression()
        // Check if this node is shareable
        if (this.shareableNodes.has(expr.nodeId)) {
          // Keep as SharedRefExpr but fill in varName
          const varName = '$' + expr.nodeId.replace(/-/g, '_');
          return {
            kind: 'sharedRef',
            nodeId: expr.nodeId,
            varName
          };
        } else {
          // Not shareable - inline the full expression
          const fullExpr = this.nodeExpressions.get(expr.nodeId);
          if (!fullExpr) {
            return this.literal(null, 'null');
          }
          // Recursively replace within the inlined expression too
          return this.replaceSharedRefsInExpr(fullExpr);
        }

      case 'binary':
        return {
          ...expr,
          left: this.replaceSharedRefsInExpr(expr.left),
          right: this.replaceSharedRefsInExpr(expr.right)
        };

      case 'unary':
        return {
          ...expr,
          operand: this.replaceSharedRefsInExpr(expr.operand)
        };

      case 'call':
        return {
          ...expr,
          args: (expr.args || []).map(arg => this.replaceSharedRefsInExpr(arg))
        };

      case 'conditional':
        return {
          ...expr,
          condition: this.replaceSharedRefsInExpr(expr.condition),
          then: this.replaceSharedRefsInExpr(expr.then),
          else: this.replaceSharedRefsInExpr(expr.else)
        };

      case 'array':
        return {
          ...expr,
          elements: (expr.elements || []).map(el => this.replaceSharedRefsInExpr(el))
        };

      case 'object':
        return {
          ...expr,
          properties: (expr.properties || []).map(prop => ({
            key: prop.key,
            value: this.replaceSharedRefsInExpr(prop.value)
          }))
        };

      default:
        return expr;
    }
  }

  /**
   * Build shared expressions list for IR
   * Only includes nodes that are actually referenced (no dead code)
   */
  private buildSharedExpressions(): SharedExpression[] {
    const shared: SharedExpression[] = [];
    const referencedShared = new Set<string>();

    // Collect all SharedRefExpr references from final expressions
    const collectRefs = (expr: Expression) => {
      if (expr.kind === 'sharedRef' && expr.varName) {
        referencedShared.add(expr.nodeId);
      } else if (expr.kind === 'binary') {
        collectRefs(expr.left);
        collectRefs(expr.right);
      } else if (expr.kind === 'unary') {
        collectRefs(expr.operand);
      } else if (expr.kind === 'call') {
        expr.args.forEach(collectRefs);
      } else if (expr.kind === 'conditional') {
        collectRefs(expr.condition);
        collectRefs(expr.then);
        collectRefs(expr.else);
      } else if (expr.kind === 'array') {
        expr.elements.forEach(collectRefs);
      } else if (expr.kind === 'object') {
        expr.properties.forEach(p => collectRefs(p.value));
      }
    };

    // Scan all node expressions to find which shared refs are actually used
    for (const expr of this.nodeExpressions.values()) {
      collectRefs(expr);
    }

    // IMPORTANT: Also scan target mapping expressions
    // If a shared functoid is only used directly by target fields, we need to detect it
    const targetEdges = this.mapSpec.edges.filter(
      (edge) => edge.target === 'target-schema'
    );
    for (const edge of targetEdges) {
      const targetExpr = this.getSourceExpressionWithSharing(edge);
      collectRefs(targetExpr);
    }

    // Build shared expressions only for referenced nodes
    for (const nodeId of this.shareableNodes) {
      if (!referencedShared.has(nodeId)) {
        continue; // Skip dead code
      }

      const expr = this.nodeExpressions.get(nodeId);
      if (!expr) continue;

      const refCount = this.nodeRefCounts.get(nodeId) || 0;
      const node = this.mapSpec.nodes.find(n => n.id === nodeId);

      // Generate variable name from node ID
      const varName = '$' + nodeId.replace(/-/g, '_');

      // Try to get a better name from functoid label
      let hintName: string | undefined;
      if (node) {
        const functoid = functoidRegistry[node.kind];
        if (functoid) {
          // Convert label to camelCase variable name
          hintName = functoid.label
            .replace(/[^a-zA-Z0-9]+(.)/g, (_, chr) => chr.toUpperCase())
            .replace(/^[A-Z]/, chr => chr.toLowerCase());
        }
      }

      shared.push({
        nodeId,
        varName,
        expression: expr,
        hintName,
        refCount
      });
    }

    return shared;
  }

  /**
   * Get source expression with sharing support
   * Returns SharedRefExpr for shareable nodes
   */
  private getSourceExpressionWithSharing(edge: Edge): Expression {
    if (edge.source === 'source-schema') {
      // Field reference
      return this.field(this.cleanPath(edge.sourceHandle));
    }

    // Check if this is a shareable node
    if (this.shareableNodes.has(edge.source)) {
      const varName = '$' + edge.source.replace(/-/g, '_');
      return {
        kind: 'sharedRef',
        nodeId: edge.source,
        varName
      };
    }

    // Regular functoid output (not shared)
    const expr = this.nodeExpressions.get(edge.source);
    return expr || this.literal(null, 'null');
  }

  /**
   * Check if a node kind is pure (no side effects)
   */
  private isPureNodeKind(kind: NodeKind): boolean {
    // Impure operations (have side effects or non-deterministic)
    const impure = new Set<NodeKind>([
      'DateTime.Now', // Non-deterministic (returns current time)
      'Custom.Function' // Unknown purity
    ]);

    return !impure.has(kind);
  }

  /**
   * Estimate expression cost (rough heuristic for hoisting decisions)
   * Returns: depth + node count
   */
  private estimateCost(expr: Expression): number {
    switch (expr.kind) {
      case 'literal':
      case 'field':
        return 1; // Trivial

      case 'sharedRef':
        return 1; // Reference is cheap

      case 'binary':
        return 2 + this.estimateCost(expr.left) + this.estimateCost(expr.right);

      case 'unary':
        return 2 + this.estimateCost(expr.operand);

      case 'call': {
        const argCost = expr.args.reduce((sum, arg) => sum + this.estimateCost(arg), 0);
        return 3 + argCost; // Function calls are more expensive
      }

      case 'conditional':
        return 3 + this.estimateCost(expr.condition) +
                   Math.max(this.estimateCost(expr.then), this.estimateCost(expr.else));

      case 'array':
        return 2 + expr.elements.reduce((sum, el) => sum + this.estimateCost(el), 0);

      case 'object':
        return 2 + expr.properties.reduce((sum, prop) => sum + this.estimateCost(prop.value), 0);

      default:
        return 1;
    }
  }

  /**
   * Check if a functoid is used in an array context (per-item evaluation)
   *
   * A functoid is array-scoped if ANY of its usages are in array target paths.
   * For example:
   * - Used in "lines[].lineAmount" → array context (don't hoist)
   * - Used in "subtotal" and "total" → scalar context (can hoist)
   * - Used in both "lines[].amount" and "subtotal" → has array usage (don't hoist)
   */
  private isUsedInArrayContext(nodeId: string): boolean {
    // Find all edges where this node is the source
    const outgoingEdges = this.mapSpec.edges.filter(e => e.source === nodeId);

    for (const edge of outgoingEdges) {
      // Check if target is another functoid (intermediate)
      if (edge.target !== 'target-schema' && edge.target !== 'source-schema') {
        // Recursively check if downstream functoid is used in array context
        if (this.isUsedInArrayContext(edge.target)) {
          return true;
        }
      } else if (edge.target === 'target-schema') {
        // Check if target handle contains array selector
        if (/\[\]/.test(edge.targetHandle)) {
          return true; // Used in array mapping like "lines[].lineAmount"
        }
      }
    }

    return false; // No array usages found
  }
}
