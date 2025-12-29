/**
 * Platform JSON Schemas
 * Embedded schemas for BBT.Workflow platform types
 * These schemas are shipped with the extension and define the structure
 * of ScriptContext, ScriptResponse, WorkflowTask, and other platform types
 */

import type { JSONSchema } from './types';

/**
 * ScriptContext schema
 * Main context object passed to all scripting handlers
 * Matches BBT.Workflow.Scripting.ScriptContext from Models.cs
 */
export const ScriptContextSchema: JSONSchema = {
  $id: 'platform://ScriptContext',
  title: 'ScriptContext',
  description: 'Script execution context containing workflow state and runtime information',
  type: 'object',
  properties: {
    Body: {
      type: 'object',
      description: 'Request payload data from transitions or StandardTaskResponse from completed tasks (camelCase). When containing task response: { data, statusCode, isSuccess, errorMessage, headers, metadata, executionDurationMs, taskType }',
      additionalProperties: true,
      properties: {
        data: {
          type: 'object',
          description: 'Actual response data from task execution',
          additionalProperties: true
        },
        statusCode: {
          type: 'integer',
          description: 'HTTP status code for HTTP-based tasks'
        },
        isSuccess: {
          type: 'boolean',
          description: 'Indicates whether task execution was successful'
        },
        errorMessage: {
          type: 'string',
          description: 'Error message if task execution failed'
        },
        headers: {
          type: 'object',
          description: 'Response headers for HTTP-based tasks',
          additionalProperties: {
            type: 'string'
          }
        },
        metadata: {
          type: 'object',
          description: 'Additional metadata about task execution',
          additionalProperties: true
        },
        executionDurationMs: {
          type: 'integer',
          description: 'Task execution duration in milliseconds'
        },
        taskType: {
          type: 'string',
          description: 'Task type identifier'
        }
      }
    },
    Headers: {
      type: 'object',
      description: 'HTTP headers from transition requests (lowercase keys)',
      additionalProperties: {
        type: 'string'
      }
    },
    RouteValues: {
      type: 'object',
      description: 'Route values and URL parameters from transition request',
      additionalProperties: true
    },
    Instance: {
      type: 'object',
      description: 'Workflow instance data and state',
      properties: {
        Data: {
          type: 'object',
          description: 'Workflow instance data (user-defined schema)',
          additionalProperties: true
        },
        Id: {
          type: 'string',
          description: 'Workflow instance GUID',
          format: 'uuid'
        },
        CurrentState: {
          type: 'string',
          description: 'Current workflow state key'
        },
        Status: {
          type: 'string',
          description: 'Workflow status',
          enum: ['Active', 'Busy', 'Completed', 'Faulted', 'Passive']
        },
        CreatedAt: {
          type: 'string',
          description: 'Instance creation timestamp',
          format: 'date-time'
        },
        ModifiedAt: {
          type: 'string',
          description: 'Last modification timestamp',
          format: 'date-time'
        }
      }
    },
    Workflow: {
      type: 'object',
      description: 'Workflow definition metadata',
      properties: {
        Key: { type: 'string', description: 'Workflow key' },
        Domain: { type: 'string', description: 'Workflow domain' },
        Flow: { type: 'string', description: 'Workflow flow' },
        Version: { type: 'string', description: 'Workflow version' }
      }
    },
    Runtime: {
      type: 'object',
      description: 'Runtime information and services for current execution context',
      additionalProperties: true
    },
    Transition: {
      type: 'object',
      description: 'Current transition being processed',
      properties: {
        Key: { type: 'string', description: 'Transition key' },
        FromState: { type: 'string', description: 'Source state' },
        ToState: { type: 'string', description: 'Target state' },
        Type: { type: 'string', description: 'Transition type' }
      },
      additionalProperties: true
    },
    Definitions: {
      type: 'object',
      description: 'Workflow and component definitions available in execution context',
      additionalProperties: true
    },
    TaskResponse: {
      type: 'object',
      description: 'Task execution results keyed by task name (camelCase keys)',
      additionalProperties: {
        type: 'object',
        description: 'ScriptResponse object containing task execution data',
        properties: {
          Key: { type: 'string' },
          Data: { type: 'object', additionalProperties: true },
          Headers: { type: 'object', additionalProperties: { type: 'string' } },
          RouteValues: { type: 'object', additionalProperties: true },
          Tags: { type: 'array', items: { type: 'string' } }
        }
      }
    },
    MetaData: {
      type: 'object',
      description: 'Execution metadata, performance metrics, and contextual information',
      additionalProperties: true
    }
  },
  required: ['Instance']
};

/**
 * ScriptResponse schema
 * Response object returned from scripting handlers
 * Matches BBT.Workflow.Scripting.ScriptResponse from Models.cs
 */
export const ScriptResponseSchema: JSONSchema = {
  $id: 'platform://ScriptResponse',
  title: 'ScriptResponse',
  description: 'Response object returned from mapping handlers',
  type: 'object',
  properties: {
    Key: {
      type: 'string',
      description: 'Unique identifier or key for correlation, caching, or referencing'
    },
    Data: {
      type: 'object',
      description: 'Primary data payload - usage varies by mapping context (audit, instance merge, subflow input)',
      additionalProperties: true
    },
    Headers: {
      type: 'object',
      description: 'HTTP headers or metadata headers for additional context',
      additionalProperties: true
    },
    RouteValues: {
      type: 'object',
      description: 'Route values or routing parameters for workflow routing decisions',
      additionalProperties: true
    },
    Tags: {
      type: 'array',
      description: 'Collection of tags for categorizing, filtering, or marking the response',
      items: {
        type: 'string'
      }
    }
  }
};

/**
 * WorkflowTask schema
 * Task configuration object that can be modified in InputHandler
 */
export const WorkflowTaskSchema: JSONSchema = {
  $id: 'platform://WorkflowTask',
  title: 'WorkflowTask',
  description: 'Workflow task configuration (modifiable in InputHandler)',
  type: 'object',
  properties: {
    Name: {
      type: 'string',
      description: 'Task name/identifier'
    },
    Type: {
      type: 'integer',
      description: 'Task type (6=HTTP, 7=AMQP, etc.)'
    },
    Endpoint: {
      type: 'string',
      description: 'API endpoint URL (can be modified dynamically)',
      format: 'uri'
    },
    Method: {
      type: 'string',
      description: 'HTTP method',
      enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
    },
    Headers: {
      type: 'object',
      description: 'HTTP headers (can be modified)',
      additionalProperties: {
        type: 'string'
      }
    },
    Body: {
      type: 'object',
      description: 'Request body',
      additionalProperties: true
    },
    Timeout: {
      type: 'integer',
      description: 'Timeout in milliseconds'
    },
    RetryPolicy: {
      type: 'object',
      description: 'Retry configuration',
      properties: {
        MaxAttempts: { type: 'integer' },
        BackoffMs: { type: 'integer' },
        BackoffMultiplier: { type: 'number' }
      }
    }
  },
  required: ['Name', 'Type']
};

/**
 * TimerSchedule schema
 * Timer schedule configuration for ITimerMapping
 */
export const TimerScheduleSchema: JSONSchema = {
  $id: 'platform://TimerSchedule',
  title: 'TimerSchedule',
  description: 'Timer schedule configuration (DateTime, Cron, Duration, or Immediate)',
  type: 'object',
  properties: {
    ScheduleType: {
      type: 'string',
      description: 'Type of schedule',
      enum: ['DateTime', 'Cron', 'Duration', 'Immediate']
    },
    DateTime: {
      type: 'string',
      description: 'Absolute date/time (ISO 8601)',
      format: 'date-time'
    },
    CronExpression: {
      type: 'string',
      description: 'Cron expression for recurring schedules',
      pattern: '^(@(annually|yearly|monthly|weekly|daily|hourly|reboot))|(@every (\\d+(ns|us|µs|ms|s|m|h))+)|((((\\d+,)+\\d+|(\\d+([/-])\\d+)|\\d+|\\*) ?){5,7})$'
    },
    Duration: {
      type: 'string',
      description: 'Time duration (ISO 8601 duration format)',
      pattern: '^P(?:\\d+Y)?(?:\\d+M)?(?:\\d+D)?(?:T(?:\\d+H)?(?:\\d+M)?(?:\\d+(?:\\.\\d+)?S)?)?$'
    },
    DurationMs: {
      type: 'integer',
      description: 'Duration in milliseconds (alternative to Duration)'
    }
  }
};

/**
 * ScriptContext for InputHandler
 * Available in: IMapping.InputHandler, ISubFlowMapping.InputHandler, ISubProcessMapping.InputHandler
 * Minimal context - only workflow state
 */
export const ScriptContext_InputHandlerSchema: JSONSchema = {
  $id: 'platform://ScriptContext_InputHandler',
  title: 'ScriptContext (InputHandler)',
  description: 'Script context for input preparation - access workflow state to prepare task inputs',
  type: 'object',
  properties: {
    Instance: ScriptContextSchema.properties!.Instance
    // Workflow/Runtime/Definitions/MetaData NOT included - execution engine only
    // Body/Headers/RouteValues NOT included - not relevant for task preparation
    // Transition NOT included - tasks don't directly handle transitions
    // TaskResponse NOT included - empty in InputHandler
  },
  required: ['Instance']
};

/**
 * ScriptContext for OutputHandler
 * Available in: IMapping.OutputHandler, ISubFlowMapping.OutputHandler
 * Access workflow state and task execution results
 */
export const ScriptContext_OutputHandlerSchema: JSONSchema = {
  $id: 'platform://ScriptContext_OutputHandler',
  title: 'ScriptContext (OutputHandler)',
  description: 'Script context for output processing - access task results and workflow state',
  type: 'object',
  properties: {
    Body: ScriptContextSchema.properties!.Body, // StandardTaskResponse from executed task
    Instance: ScriptContextSchema.properties!.Instance,
    TaskResponse: ScriptContextSchema.properties!.TaskResponse // Task execution results
    // Workflow/Runtime/Definitions/MetaData NOT included - execution engine only
    // Headers/RouteValues NOT included - not needed for output processing
    // Transition NOT included - tasks don't directly handle transitions
  },
  required: ['Instance']
};

/**
 * ScriptContext for ConditionHandler
 * Available in: IConditionMapping.Handler
 * Automatic transitions - evaluate workflow state only
 */
export const ScriptContext_ConditionHandlerSchema: JSONSchema = {
  $id: 'platform://ScriptContext_ConditionHandler',
  title: 'ScriptContext (ConditionHandler)',
  description: 'Script context for automatic transition conditions - evaluate workflow state to determine if transition should execute',
  type: 'object',
  properties: {
    Instance: ScriptContextSchema.properties!.Instance
    // Workflow/Runtime/Definitions/MetaData NOT included - execution engine only
    // Body/Headers/RouteValues NOT included - automatic transitions have no request data
    // Transition NOT included - condition evaluated before transition executes
    // TaskResponse NOT included
  },
  required: ['Instance']
};

/**
 * ScriptContext for TransitionHandler
 * Available in: ITransitionMapping.Handler
 * API-triggered transitions - access request payload and workflow state
 */
export const ScriptContext_TransitionHandlerSchema: JSONSchema = {
  $id: 'platform://ScriptContext_TransitionHandler',
  title: 'ScriptContext (TransitionHandler)',
  description: 'Script context for transition data transformation - process API request payload',
  type: 'object',
  properties: {
    Body: ScriptContextSchema.properties!.Body,
    Headers: ScriptContextSchema.properties!.Headers,
    RouteValues: ScriptContextSchema.properties!.RouteValues,
    Instance: ScriptContextSchema.properties!.Instance,
    Transition: ScriptContextSchema.properties!.Transition
    // Workflow/Runtime/Definitions/MetaData NOT included - execution engine only
    // TaskResponse NOT included - transitions execute before tasks
  },
  required: ['Instance']
};

/**
 * ScriptContext for TimerHandler
 * Available in: ITimerMapping.TimerHandler
 * Minimal context - only workflow state for timer calculations
 */
export const ScriptContext_TimerHandlerSchema: JSONSchema = {
  $id: 'platform://ScriptContext_TimerHandler',
  title: 'ScriptContext (TimerHandler)',
  description: 'Script context for timer scheduling - calculate timer schedule based on workflow state',
  type: 'object',
  properties: {
    Instance: ScriptContextSchema.properties!.Instance
    // Workflow/Runtime/Definitions/MetaData NOT included - execution engine only
    // Body/Headers/RouteValues/Transition/TaskResponse NOT included
  },
  required: ['Instance']
};

/**
 * Platform schema registry
 * Lookup table for all platform schemas
 */
export const PLATFORM_SCHEMAS: Record<string, JSONSchema> = {
  ScriptContext: ScriptContextSchema,
  ScriptContext_InputHandler: ScriptContext_InputHandlerSchema,
  ScriptContext_OutputHandler: ScriptContext_OutputHandlerSchema,
  ScriptContext_ConditionHandler: ScriptContext_ConditionHandlerSchema,
  ScriptContext_TransitionHandler: ScriptContext_TransitionHandlerSchema,
  ScriptContext_TimerHandler: ScriptContext_TimerHandlerSchema,
  ScriptResponse: ScriptResponseSchema,
  WorkflowTask: WorkflowTaskSchema,
  TimerSchedule: TimerScheduleSchema
};

/**
 * Helper: Get platform schema by name
 */
export function getPlatformSchema(name: string): JSONSchema | undefined {
  return PLATFORM_SCHEMAS[name];
}

/**
 * Helper: Check if schema reference is a platform schema
 */
export function isPlatformSchema(schemaRef: string): boolean {
  return schemaRef.startsWith('platform://') || schemaRef in PLATFORM_SCHEMAS;
}

/**
 * Helper: Resolve platform schema reference
 * Converts 'platform://ScriptContext' or 'ScriptContext' to actual schema
 */
export function resolvePlatformSchema(schemaRef: string): JSONSchema | undefined {
  // Handle platform:// URI format
  if (schemaRef.startsWith('platform://')) {
    const name = schemaRef.replace('platform://', '');
    return PLATFORM_SCHEMAS[name];
  }

  // Handle direct name reference
  return PLATFORM_SCHEMAS[schemaRef];
}
