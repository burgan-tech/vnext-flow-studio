/**
 * Contract Code Generator
 * Generates complete C# classes implementing workflow scripting contracts
 * Wraps the existing IR-based C# generator with contract-specific scaffolding
 */

import type { ContractMapSpec, ContractType, HandlerMapSpec } from './contractTypes';
import type { MapSpec } from './types';
import {
  CONTRACT_DEFINITIONS,
  getContractDefinition,
  isMultiMethodContract
} from './contractTypes';
import { generateCSharp } from './csharpGenerator';
import {
  generateClassHeader,
  generateClassFooter,
  generateMethod,
  generateMethodSignature,
  generatePlaceholderMethodBody,
  generateClassName,
  generateVariableDeclaration,
  generateReturn,
  generateComment,
  DEFAULT_CSHARP_TEMPLATES,
  type CSharpMethodTemplate
} from './csharpTemplates';

/**
 * Code generation options
 */
export interface ContractCodeGenerationOptions {
  /** Custom namespace (default: BBT.Workflow.Generated) */
  namespace?: string;

  /** Custom class name (default: generated from mapper name) */
  className?: string;

  /** Include comments and documentation */
  includeComments?: boolean;

  /** Generate placeholder code for empty mappers */
  generatePlaceholders?: boolean;
}

/**
 * Code generation result
 */
export interface ContractCodeGenerationResult {
  /** Generated C# code */
  code: string;

  /** Class name */
  className: string;

  /** Namespace */
  namespace: string;

  /** Warnings encountered during generation */
  warnings: string[];

  /** Errors encountered during generation */
  errors: string[];
}

/**
 * Generate complete C# class from ContractMapSpec
 */
export function generateContractClass(
  mapSpec: ContractMapSpec,
  options: ContractCodeGenerationOptions = {}
): ContractCodeGenerationResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Validate contract type
  if (!mapSpec.contractType) {
    errors.push('ContractMapSpec must have a contractType');
    return {
      code: '',
      className: '',
      namespace: '',
      warnings,
      errors
    };
  }

  // Get contract definition and template
  const contractDef = getContractDefinition(mapSpec.contractType);
  const template = DEFAULT_CSHARP_TEMPLATES[mapSpec.contractType];

  // Determine namespace and class name
  const namespace = options.namespace || mapSpec.namespace || template.defaultNamespace;
  const className = options.className || mapSpec.className || generateClassName(mapSpec.metadata.name);

  // Generate usings
  const usings = contractDef.usings || template.defaultUsings;

  // Generate methods
  const methods: CSharpMethodTemplate[] = [];

  if (isMultiMethodContract(mapSpec.contractType)) {
    // Multi-handler contract (IMapping, ISubFlowMapping)
    for (const methodDef of contractDef.methods) {
      const handlerName = methodDef.methodName;
      const handler = mapSpec.handlers?.[handlerName];

      if (!handler) {
        warnings.push(`Handler ${handlerName} not found in mapper, generating placeholder`);
      }

      const methodCode = generateContractMethod(
        methodDef.methodName,
        methodDef.parameters,
        methodDef.returnType,
        methodDef.isAsync,
        handler,
        mapSpec,
        options
      );

      methods.push(methodCode);
    }
  } else {
    // Single-handler contract
    const methodDef = contractDef.methods[0];

    // Create a handler-like structure from base MapSpec
    const pseudoHandler: HandlerMapSpec = {
      methodName: methodDef.methodName,
      schemaParts: mapSpec.schemaParts || { source: {}, target: {} },
      nodes: mapSpec.nodes || [],
      edges: mapSpec.edges || []
    };

    const methodCode = generateContractMethod(
      methodDef.methodName,
      methodDef.parameters,
      methodDef.returnType,
      methodDef.isAsync,
      pseudoHandler,
      mapSpec,
      options
    );

    methods.push(methodCode);
  }

  // Generate complete class
  const classHeader = generateClassHeader(namespace, className, contractDef.interfaceName, usings);
  const classBody = methods.map(m => generateMethod(m)).join('\n\n');
  const classFooter = generateClassFooter();

  const code = `${classHeader}
${classBody}
${classFooter}`;

  return {
    code,
    className,
    namespace,
    warnings,
    errors
  };
}

/**
 * Generate method code for a contract handler
 */
function generateContractMethod(
  methodName: string,
  parameters: Array<{ name: string; type: string }>,
  returnType: string,
  isAsync: boolean,
  handler: HandlerMapSpec | undefined,
  fullMapSpec: ContractMapSpec,
  options: ContractCodeGenerationOptions
): CSharpMethodTemplate {
  const signature = generateMethodSignature(methodName, parameters, returnType, isAsync);

  // Generate method body
  let body: string;

  if (!handler || (handler.nodes.length === 0 && handler.edges.length === 0)) {
    // No mappings defined - generate placeholder
    if (options.generatePlaceholders !== false) {
      body = generatePlaceholderMethodBody(returnType);
    } else {
      body = generateComment('No mappings defined', '            ') + '\n' +
             generateReturn('Task.CompletedTask', '            ');
    }
  } else {
    // Generate actual mapping code using existing IR-based generator
    body = generateMethodBodyFromHandler(handler, returnType, fullMapSpec, options);
  }

  return {
    methodName,
    signature,
    body
  };
}

/**
 * Generate method body from handler using IR-based code generator
 */
function generateMethodBodyFromHandler(
  handler: HandlerMapSpec,
  returnType: string,
  fullMapSpec: ContractMapSpec,
  options: ContractCodeGenerationOptions
): string {
  const lines: string[] = [];
  const indent = '            ';

  // Add comment
  if (options.includeComments !== false) {
    lines.push(generateComment('Generated from visual mapping specification', indent));
  }

  // Convert handler to MapSpec for IR generation
  const tempMapSpec: MapSpec = {
    version: fullMapSpec.version,
    metadata: {
      name: fullMapSpec.metadata.name,
      description: fullMapSpec.metadata.description,
      source: fullMapSpec.metadata.key,
      target: handler.methodName
    },
    schemaParts: handler.schemaParts,
    schemaOverlays: fullMapSpec.schemaOverlays,
    nodes: handler.nodes,
    edges: handler.edges,
    tests: fullMapSpec.tests
  };

  // Generate based on return type
  if (returnType.includes('Task<ScriptResponse>')) {
    lines.push(generateVariableDeclaration('response', 'var', 'new ScriptResponse()', indent));
    lines.push('');

    // Generate mapping code using IR system
    try {
      const mappingCode = generateCSharp(tempMapSpec);
      lines.push(generateVariableDeclaration('data', 'var', mappingCode, indent));
    } catch (error) {
      lines.push(generateComment(`Error generating mapping code: ${error}`, indent));
      lines.push(generateVariableDeclaration('data', 'var', 'new JsonObject()', indent));
    }

    lines.push('');
    lines.push(`${indent}response.Data = data;`);
    lines.push(generateReturn('response', indent));

  } else if (returnType.includes('Task<bool>')) {
    // Boolean condition - check if there are any mappings
    lines.push(generateComment('Evaluate condition based on workflow context', indent));

    try {
      const conditionCode = generateCSharp(tempMapSpec);
      lines.push(generateVariableDeclaration('data', 'var', conditionCode, indent));
      lines.push('');
      lines.push(generateComment('Check if required fields are present and valid', indent));
      lines.push(generateVariableDeclaration('result', 'var', 'data.Count > 0', indent));
      lines.push(generateReturn('Task.FromResult(result)', indent));
    } catch (error) {
      lines.push(generateComment(`Error generating condition code: ${error}`, indent));
      lines.push(generateReturn('Task.FromResult(true)', indent));
    }

  } else if (returnType.includes('Task<dynamic>')) {
    // Dynamic result
    try {
      const dynamicCode = generateCSharp(tempMapSpec);
      lines.push(generateVariableDeclaration('result', 'var', dynamicCode, indent));
      lines.push(generateReturn('Task.FromResult<dynamic>(result)', indent));
    } catch (error) {
      lines.push(generateComment(`Error generating dynamic code: ${error}`, indent));
      lines.push(generateVariableDeclaration('result', 'var', 'new JsonObject()', indent));
      lines.push(generateReturn('Task.FromResult<dynamic>(result)', indent));
    }

  } else if (returnType.includes('Task<TimerSchedule>')) {
    // Timer schedule - for now generate placeholder
    lines.push(generateComment('Calculate timer schedule from workflow context', indent));
    lines.push(generateComment('TODO: Implement timer calculation logic from mappings', indent));
    lines.push('');
    lines.push(generateVariableDeclaration('schedule', 'var', 'TimerSchedule.Immediate()', indent));
    lines.push(generateReturn('Task.FromResult(schedule)', indent));

  } else {
    lines.push(generateComment('Unsupported return type', indent));
    lines.push(generateReturn('Task.CompletedTask', indent));
  }

  return lines.join('\n');
}

/**
 * Validate generated C# code (basic syntax check)
 */
export function validateContractCode(code: string): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Basic syntax checks
  const openBraces = (code.match(/{/g) || []).length;
  const closeBraces = (code.match(/}/g) || []).length;

  if (openBraces !== closeBraces) {
    errors.push(`Brace mismatch: ${openBraces} opening braces, ${closeBraces} closing braces`);
  }

  // Check for async methods without await (warning)
  const asyncMethods = code.match(/async\s+Task/g);
  const awaitKeywords = code.match(/await\s+/g);

  if (asyncMethods && !awaitKeywords) {
    warnings.push('Async methods found but no await keywords - consider using Task.FromResult()');
  }

  // Check for required usings
  const requiredUsings = [
    'System.Threading.Tasks',
    'BBT.Workflow.Scripting'
  ];

  for (const using of requiredUsings) {
    if (!code.includes(`using ${using};`)) {
      warnings.push(`Missing required using: ${using}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}
