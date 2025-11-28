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
 */
export const ScriptContextSchema: JSONSchema = {
  $id: 'platform://ScriptContext',
  title: 'ScriptContext',
  description: 'Script execution context containing workflow state and runtime information',
  type: 'object',
  properties: {
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
        State: {
          type: 'string',
          description: 'Current workflow state key'
        },
        Status: {
          type: 'string',
          description: 'Workflow status (Active, Completed, Failed, etc.)',
          enum: ['Active', 'Completed', 'Failed', 'Cancelled', 'Suspended']
        },
        CreatedAt: {
          type: 'string',
          description: 'Instance creation timestamp',
          format: 'date-time'
        },
        UpdatedAt: {
          type: 'string',
          description: 'Last update timestamp',
          format: 'date-time'
        }
      }
    },
    Headers: {
      type: 'object',
      description: 'HTTP headers from current request',
      additionalProperties: {
        type: 'string'
      }
    },
    RouteValues: {
      type: 'object',
      description: 'Route parameters from URL',
      additionalProperties: true
    },
    Body: {
      type: 'object',
      description: 'HTTP response body (available in OutputHandler)',
      additionalProperties: true
    },
    TaskResponse: {
      type: 'array',
      description: 'Collection of task execution responses',
      items: {
        type: 'object',
        properties: {
          TaskName: { type: 'string' },
          Status: { type: 'string' },
          Data: { type: 'object', additionalProperties: true },
          Error: { type: 'string' }
        }
      }
    },
    Workflow: {
      type: 'object',
      description: 'Workflow definition metadata',
      properties: {
        Key: { type: 'string' },
        Domain: { type: 'string' },
        Flow: { type: 'string' },
        Version: { type: 'string' }
      }
    },
    User: {
      type: 'object',
      description: 'Current user information',
      properties: {
        Id: { type: 'string' },
        UserName: { type: 'string' },
        Email: { type: 'string', format: 'email' },
        Roles: {
          type: 'array',
          items: { type: 'string' }
        }
      }
    },
    TraceId: {
      type: 'string',
      description: 'Distributed tracing correlation ID',
      format: 'uuid'
    }
  },
  required: ['Instance']
};

/**
 * ScriptResponse schema
 * Response object returned from scripting handlers
 */
export const ScriptResponseSchema: JSONSchema = {
  $id: 'platform://ScriptResponse',
  title: 'ScriptResponse',
  description: 'Response object returned from mapping handlers',
  type: 'object',
  properties: {
    Data: {
      type: 'object',
      description: 'Transformed data to merge into workflow instance or send to external system',
      additionalProperties: true
    },
    Key: {
      type: 'string',
      description: 'Optional identifier for tracking this operation'
    },
    Headers: {
      type: 'object',
      description: 'HTTP headers to include in request',
      additionalProperties: {
        type: 'string'
      }
    },
    RouteValues: {
      type: 'object',
      description: 'Route parameters for request',
      additionalProperties: true
    },
    Tags: {
      type: 'array',
      description: 'Categorization tags for audit and tracking',
      items: {
        type: 'string'
      }
    },
    Metadata: {
      type: 'object',
      description: 'Additional metadata for logging and audit',
      additionalProperties: true
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
 * Platform schema registry
 * Lookup table for all platform schemas
 */
export const PLATFORM_SCHEMAS: Record<string, JSONSchema> = {
  ScriptContext: ScriptContextSchema,
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
