/**
 * Contract Schema Templates
 * Defines source/target schema structures for each contract type
 * Used to initialize new mappers with appropriate platform schemas
 */

import type { ContractType } from './contractTypes';
import type { PartDefinition } from './types';

/**
 * Handler schema template
 * Defines the source and target parts for a specific handler method
 */
export interface HandlerSchemaTemplate {
  methodName: string;
  source: Record<string, Omit<PartDefinition, 'schema'>>;  // Schema loaded at runtime
  target: Record<string, Omit<PartDefinition, 'schema'>>;
}

/**
 * Contract schema template
 * Complete schema structure for a contract type
 */
export interface ContractSchemaTemplate {
  contractType: ContractType;
  handlers: HandlerSchemaTemplate[];
  description?: string;
}

/**
 * Schema templates for all contract types
 * Maps contract types to their source/target schema structures
 */
export const CONTRACT_SCHEMA_TEMPLATES: Record<ContractType, ContractSchemaTemplate> = {
  /**
   * IMapping - Task input/output data binding
   * InputHandler: Prepares request before task execution
   * OutputHandler: Processes response after task execution
   */
  IMapping: {
    contractType: 'IMapping',
    description: 'Task input and output data binding operations',
    handlers: [
      {
        methodName: 'InputHandler',
        source: {
          context: {
            schemaRef: 'platform://ScriptContext',
            label: 'Context',
            schemaSourcePath: 'platform://ScriptContext'
          },
          task: {
            schemaRef: 'platform://WorkflowTask',
            label: 'Task Configuration',
            schemaSourcePath: 'platform://WorkflowTask'
          }
        },
        target: {
          response: {
            schemaRef: 'platform://ScriptResponse',
            label: 'Response',
            schemaSourcePath: 'platform://ScriptResponse'
          }
        }
      },
      {
        methodName: 'OutputHandler',
        source: {
          context: {
            schemaRef: 'platform://ScriptContext',
            label: 'Context',
            schemaSourcePath: 'platform://ScriptContext'
          }
        },
        target: {
          response: {
            schemaRef: 'platform://ScriptResponse',
            label: 'Response',
            schemaSourcePath: 'platform://ScriptResponse'
          }
        }
      }
    ]
  },

  /**
   * IConditionMapping - Boolean conditional logic
   * Handler: Evaluates condition and returns true/false
   */
  IConditionMapping: {
    contractType: 'IConditionMapping',
    description: 'Conditional logic for automatic workflow transitions',
    handlers: [
      {
        methodName: 'Handler',
        source: {
          context: {
            schemaRef: 'platform://ScriptContext',
            label: 'Context',
            schemaSourcePath: 'platform://ScriptContext'
          }
        },
        target: {
          result: {
            schemaRef: 'custom',
            label: 'Boolean Result',
            schemaSourcePath: 'custom',
            // Schema embedded inline (simple boolean)
          }
        }
      }
    ]
  },

  /**
   * ITransitionMapping - Transition data transformation
   * Handler: Transforms data for transition
   */
  ITransitionMapping: {
    contractType: 'ITransitionMapping',
    description: 'Transition-specific data transformations',
    handlers: [
      {
        methodName: 'Handler',
        source: {
          context: {
            schemaRef: 'platform://ScriptContext',
            label: 'Context',
            schemaSourcePath: 'platform://ScriptContext'
          }
        },
        target: {
          result: {
            schemaRef: 'custom',
            label: 'Dynamic Result',
            schemaSourcePath: 'custom',
            // Schema embedded inline (dynamic object)
          }
        }
      }
    ]
  },

  /**
   * ISubFlowMapping - Subflow input/output handlers
   * InputHandler: Prepares data for subflow creation
   * OutputHandler: Processes subflow completion results
   */
  ISubFlowMapping: {
    contractType: 'ISubFlowMapping',
    description: 'Data binding for subflow execution',
    handlers: [
      {
        methodName: 'InputHandler',
        source: {
          context: {
            schemaRef: 'platform://ScriptContext',
            label: 'Parent Context',
            schemaSourcePath: 'platform://ScriptContext'
          }
        },
        target: {
          response: {
            schemaRef: 'platform://ScriptResponse',
            label: 'Subflow Input',
            schemaSourcePath: 'platform://ScriptResponse'
          }
        }
      },
      {
        methodName: 'OutputHandler',
        source: {
          context: {
            schemaRef: 'platform://ScriptContext',
            label: 'Subflow Context',
            schemaSourcePath: 'platform://ScriptContext'
          }
        },
        target: {
          response: {
            schemaRef: 'platform://ScriptResponse',
            label: 'Parent Update',
            schemaSourcePath: 'platform://ScriptResponse'
          }
        }
      }
    ]
  },

  /**
   * ISubProcessMapping - Subprocess input preparation
   * InputHandler: Prepares data for subprocess creation (fire-and-forget)
   */
  ISubProcessMapping: {
    contractType: 'ISubProcessMapping',
    description: 'Data binding for subprocess initialization',
    handlers: [
      {
        methodName: 'InputHandler',
        source: {
          context: {
            schemaRef: 'platform://ScriptContext',
            label: 'Parent Context',
            schemaSourcePath: 'platform://ScriptContext'
          }
        },
        target: {
          response: {
            schemaRef: 'platform://ScriptResponse',
            label: 'Subprocess Input',
            schemaSourcePath: 'platform://ScriptResponse'
          }
        }
      }
    ]
  },

  /**
   * ITimerMapping - Timer schedule calculation
   * Handler: Calculates timer schedule based on context
   */
  ITimerMapping: {
    contractType: 'ITimerMapping',
    description: 'Timer schedule calculation based on workflow context',
    handlers: [
      {
        methodName: 'Handler',
        source: {
          context: {
            schemaRef: 'platform://ScriptContext',
            label: 'Context',
            schemaSourcePath: 'platform://ScriptContext'
          }
        },
        target: {
          schedule: {
            schemaRef: 'platform://TimerSchedule',
            label: 'Timer Schedule',
            schemaSourcePath: 'platform://TimerSchedule'
          }
        }
      }
    ]
  }
};

/**
 * Helper: Get schema template for a contract type
 */
export function getContractSchemaTemplate(contractType: ContractType): ContractSchemaTemplate {
  return CONTRACT_SCHEMA_TEMPLATES[contractType];
}

/**
 * Helper: Get handler schema template
 */
export function getHandlerSchemaTemplate(
  contractType: ContractType,
  handlerName: string
): HandlerSchemaTemplate | undefined {
  const template = CONTRACT_SCHEMA_TEMPLATES[contractType];
  return template.handlers.find(h => h.methodName === handlerName);
}

/**
 * Helper: Get all handler names for a contract type
 */
export function getHandlerNames(contractType: ContractType): string[] {
  const template = CONTRACT_SCHEMA_TEMPLATES[contractType];
  return template.handlers.map(h => h.methodName);
}

/**
 * Helper: Create initial SchemaParts for a handler
 * Loads platform schemas and sets up part definitions
 */
export function createInitialSchemaParts(
  contractType: ContractType,
  handlerName: string
): { source: Record<string, PartDefinition>; target: Record<string, PartDefinition> } | undefined {
  const handlerTemplate = getHandlerSchemaTemplate(contractType, handlerName);
  if (!handlerTemplate) {
    return undefined;
  }

  // Import platform schemas dynamically
  const { resolvePlatformSchema } = require('./platformSchemas');

  // Build source parts with loaded schemas
  const source: Record<string, PartDefinition> = {};
  for (const [partName, partDef] of Object.entries(handlerTemplate.source)) {
    const schema = resolvePlatformSchema(partDef.schemaRef);
    source[partName] = {
      ...partDef,
      schema: schema || { type: 'object', additionalProperties: true }
    };
  }

  // Build target parts with loaded schemas
  const target: Record<string, PartDefinition> = {};
  for (const [partName, partDef] of Object.entries(handlerTemplate.target)) {
    const schema = resolvePlatformSchema(partDef.schemaRef);
    target[partName] = {
      ...partDef,
      schema: schema || { type: 'object', additionalProperties: true }
    };
  }

  return { source, target };
}

/**
 * Helper: Get default return type schema for single-method contracts
 */
export function getDefaultReturnTypeSchema(contractType: ContractType): any {
  switch (contractType) {
    case 'IConditionMapping':
      return {
        type: 'boolean',
        description: 'Boolean result for condition evaluation'
      };

    case 'ITransitionMapping':
      return {
        type: 'object',
        additionalProperties: true,
        description: 'Dynamic object for transition data'
      };

    case 'ITimerMapping':
      // Use platform schema
      const { resolvePlatformSchema } = require('./platformSchemas');
      return resolvePlatformSchema('TimerSchedule') || {
        type: 'object',
        additionalProperties: true
      };

    default:
      return {
        type: 'object',
        additionalProperties: true
      };
  }
}
