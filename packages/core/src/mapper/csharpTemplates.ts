/**
 * C# Code Templates
 * Templates for generating C# classes that implement workflow scripting contracts
 */

import type { ContractType } from './contractTypes';

/**
 * C# class template structure
 */
export interface CSharpClassTemplate {
  usings: string[];
  namespace: string;
  className: string;
  interfaceName: string;
  methods: CSharpMethodTemplate[];
}

/**
 * C# method template
 */
export interface CSharpMethodTemplate {
  methodName: string;
  signature: string;
  body: string;
}

/**
 * Generate using statements
 */
export function generateUsings(usings: string[]): string {
  return usings.map(u => `using ${u};`).join('\n');
}

/**
 * Generate namespace and class declaration
 */
export function generateClassHeader(
  namespace: string,
  className: string,
  interfaceName: string,
  usings: string[]
): string {
  return `${generateUsings(usings)}

namespace ${namespace}
{
    /// <summary>
    /// Generated mapper class implementing ${interfaceName}
    /// Auto-generated from visual mapping specification
    /// </summary>
    public class ${className} : ${interfaceName}
    {`;
}

/**
 * Generate class footer
 */
export function generateClassFooter(): string {
  return `    }
}`;
}

/**
 * Generate a complete method
 */
export function generateMethod(method: CSharpMethodTemplate, indent: string = '        '): string {
  return `${indent}${method.signature}
${indent}{
${method.body}
${indent}}`;
}

/**
 * Default C# code generation templates by contract type
 */
export const DEFAULT_CSHARP_TEMPLATES: Record<ContractType, {
  defaultUsings: string[];
  defaultNamespace: string;
}> = {
  IMapping: {
    defaultUsings: [
      'System',
      'System.Threading.Tasks',
      'System.Text.Json.Nodes',
      'BBT.Workflow.Scripting',
      'BBT.Workflow.Definitions'
    ],
    defaultNamespace: 'BBT.Workflow.Generated'
  },

  IConditionMapping: {
    defaultUsings: [
      'System',
      'System.Threading.Tasks',
      'BBT.Workflow.Scripting'
    ],
    defaultNamespace: 'BBT.Workflow.Generated'
  },

  ITransitionMapping: {
    defaultUsings: [
      'System',
      'System.Threading.Tasks',
      'System.Dynamic',
      'BBT.Workflow.Scripting'
    ],
    defaultNamespace: 'BBT.Workflow.Generated'
  },

  ISubFlowMapping: {
    defaultUsings: [
      'System',
      'System.Threading.Tasks',
      'System.Text.Json.Nodes',
      'BBT.Workflow.Scripting'
    ],
    defaultNamespace: 'BBT.Workflow.Generated'
  },

  ISubProcessMapping: {
    defaultUsings: [
      'System',
      'System.Threading.Tasks',
      'System.Text.Json.Nodes',
      'BBT.Workflow.Scripting'
    ],
    defaultNamespace: 'BBT.Workflow.Generated'
  },

  ITimerMapping: {
    defaultUsings: [
      'System',
      'System.Threading.Tasks',
      'BBT.Workflow.Scripting',
      'BBT.Workflow.Definitions.Timer'
    ],
    defaultNamespace: 'BBT.Workflow.Generated'
  }
};

/**
 * Generate method signature from contract definition
 */
export function generateMethodSignature(
  methodName: string,
  parameters: Array<{ name: string; type: string }>,
  returnType: string,
  isAsync: boolean
): string {
  const params = parameters.map(p => `${p.type} ${p.name}`).join(', ');
  const asyncKeyword = isAsync ? 'async ' : '';
  return `public ${asyncKeyword}${returnType} ${methodName}(${params})`;
}

/**
 * Helper: Generate JsonObject property assignment
 * Example: data["userId"] = context.Instance?.Data?["user"]?["id"];
 */
export function generateJsonPropertyAssignment(
  targetVar: string,
  targetPath: string,
  sourceExpression: string,
  indent: string = '            '
): string {
  return `${indent}${targetVar}["${targetPath}"] = ${sourceExpression};`;
}

/**
 * Helper: Generate null-safe navigation
 * Example: context?.Instance?.Data?["applicant"]?["id"]
 */
export function generateNullSafeNavigation(path: string): string {
  // path like: context.Instance.Data.applicant.id
  // output: context?.Instance?.Data?["applicant"]?["id"]

  const parts = path.split('.');
  if (parts.length === 0) return path;

  let result = parts[0]; // Start with root (e.g., "context")

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];

    // Check if this is an array indexer like [0] or []
    if (part.includes('[')) {
      result += `?${part}`;
    } else {
      // Regular property access
      result += `?["${part}"]`;
    }
  }

  return result;
}

/**
 * Helper: Generate variable declaration
 */
export function generateVariableDeclaration(
  varName: string,
  type: string,
  initializer?: string,
  indent: string = '            '
): string {
  if (initializer) {
    return `${indent}var ${varName} = ${initializer};`;
  }
  return `${indent}${type} ${varName};`;
}

/**
 * Helper: Generate return statement
 */
export function generateReturn(expression: string, indent: string = '            '): string {
  return `${indent}return ${expression};`;
}

/**
 * Helper: Generate comment
 */
export function generateComment(comment: string, indent: string = '            '): string {
  return `${indent}// ${comment}`;
}

/**
 * Helper: Generate TODO comment
 */
export function generateTodo(message: string, indent: string = '            '): string {
  return `${indent}// TODO: ${message}`;
}

/**
 * Helper: Generate try-catch block
 */
export function generateTryCatch(
  tryBody: string,
  catchBody: string,
  indent: string = '            '
): string {
  return `${indent}try
${indent}{
${tryBody}
${indent}}
${indent}catch (Exception ex)
${indent}{
${catchBody}
${indent}}`;
}

/**
 * Generate placeholder method body
 * Used when mapper has no actual mappings yet
 */
export function generatePlaceholderMethodBody(
  returnType: string,
  indent: string = '            '
): string {
  const lines: string[] = [];

  if (returnType.includes('Task<ScriptResponse>')) {
    lines.push(generateComment('Generated placeholder - add mappings in visual editor', indent));
    lines.push(generateVariableDeclaration('response', 'var', 'new ScriptResponse()', indent));
    lines.push(generateVariableDeclaration('data', 'var', 'new JsonObject()', indent));
    lines.push('');
    lines.push(generateTodo('Add your mappings here', indent));
    lines.push('');
    lines.push(`${indent}response.Data = data;`);
    lines.push(generateReturn('response', indent));
  } else if (returnType.includes('Task<bool>')) {
    lines.push(generateComment('Generated placeholder - add condition logic in visual editor', indent));
    lines.push(generateTodo('Add your condition logic here', indent));
    lines.push(generateReturn('Task.FromResult(true)', indent));
  } else if (returnType.includes('Task<dynamic>')) {
    lines.push(generateComment('Generated placeholder - add transformation logic', indent));
    lines.push(generateVariableDeclaration('result', 'var', 'new ExpandoObject()', indent));
    lines.push(generateTodo('Add your transformation logic here', indent));
    lines.push(generateReturn('Task.FromResult<dynamic>(result)', indent));
  } else if (returnType.includes('Task<TimerSchedule>')) {
    lines.push(generateComment('Generated placeholder - add timer calculation logic', indent));
    lines.push(generateTodo('Add your timer calculation logic here', indent));
    lines.push(generateReturn('Task.FromResult(TimerSchedule.Immediate())', indent));
  } else {
    lines.push(generateTodo('Implement this method', indent));
    lines.push(generateReturn('Task.CompletedTask', indent));
  }

  return lines.join('\n');
}

/**
 * Convert Pascal case string to snake_case
 */
export function toSnakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '');
}

/**
 * Convert string to PascalCase
 */
export function toPascalCase(str: string): string {
  return str
    .split(/[-_\s]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

/**
 * Sanitize identifier name for C#
 * Removes invalid characters and ensures valid C# identifier
 */
export function sanitizeIdentifier(name: string): string {
  // Remove invalid characters
  let sanitized = name.replace(/[^a-zA-Z0-9_]/g, '');

  // Ensure doesn't start with number
  if (/^[0-9]/.test(sanitized)) {
    sanitized = '_' + sanitized;
  }

  // Ensure not empty
  if (sanitized.length === 0) {
    sanitized = 'Generated';
  }

  return sanitized;
}

/**
 * Generate class name from mapper metadata
 */
export function generateClassName(mapperName: string): string {
  const sanitized = sanitizeIdentifier(mapperName);
  return toPascalCase(sanitized);
}
