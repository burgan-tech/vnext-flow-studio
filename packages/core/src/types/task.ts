// TypeScript types for task-definition.schema.json

// Task type enum values (stored as strings in JSON)
export enum TaskType {
  DaprHttpEndpoint = '1',
  DaprBinding = '2',
  DaprService = '3',
  DaprPubSub = '4',
  HumanTask = '5',
  HttpTask = '6',
  ScriptTask = '7'
}

// HTTP methods
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

// Task configuration types for each task type
export interface DaprHttpEndpointConfig {
  endpointName: string;
  path: string;
  method: HttpMethod;
  headers?: Record<string, any>;
}

export interface DaprBindingConfig {
  bindingName: string;
  operation: string;
  metadata?: Record<string, any>;
  data?: Record<string, any>;
}

export interface DaprServiceConfig {
  appId: string;
  methodName: string;
  httpVerb?: HttpMethod;
  data?: Record<string, any>;
  queryString?: string;
  timeoutSeconds?: number;
}

export interface DaprPubSubConfig {
  pubSubName: string;
  topic: string;
  data?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface HumanTaskConfig {
  title: string;
  instructions: string;
  assignedTo: string;
  dueDate?: string | null;
  form?: any;
  reminderIntervalMinutes?: number;
  escalationTimeoutMinutes?: number;
  escalationAssignee?: string;
}

export interface HttpTaskConfig {
  url: string;
  method: HttpMethod;
  headers?: Record<string, any>;
  body?: Record<string, any>;
  timeoutSeconds?: number;
  validateSsl?: boolean;
}

export interface ScriptTaskConfig {
  // Script task has no specific config properties in the schema
}

// Union type for all task configurations
export type TaskConfig =
  | DaprHttpEndpointConfig
  | DaprBindingConfig
  | DaprServiceConfig
  | DaprPubSubConfig
  | HumanTaskConfig
  | HttpTaskConfig
  | ScriptTaskConfig;

// Base task attributes interface
interface TaskAttributesBase {
  type: TaskType;
}

// Specific task attributes for each type
export interface DaprHttpEndpointTaskAttributes extends TaskAttributesBase {
  type: TaskType.DaprHttpEndpoint;
  config: DaprHttpEndpointConfig;
}

export interface DaprBindingTaskAttributes extends TaskAttributesBase {
  type: TaskType.DaprBinding;
  config: DaprBindingConfig;
}

export interface DaprServiceTaskAttributes extends TaskAttributesBase {
  type: TaskType.DaprService;
  config: DaprServiceConfig;
}

export interface DaprPubSubTaskAttributes extends TaskAttributesBase {
  type: TaskType.DaprPubSub;
  config: DaprPubSubConfig;
}

export interface HumanTaskAttributes extends TaskAttributesBase {
  type: TaskType.HumanTask;
  config: HumanTaskConfig;
}

export interface HttpTaskAttributes extends TaskAttributesBase {
  type: TaskType.HttpTask;
  config: HttpTaskConfig;
}

export interface ScriptTaskAttributes extends TaskAttributesBase {
  type: TaskType.ScriptTask;
  config: ScriptTaskConfig;
}

// Union type for all task attributes
export type TaskAttributes =
  | DaprHttpEndpointTaskAttributes
  | DaprBindingTaskAttributes
  | DaprServiceTaskAttributes
  | DaprPubSubTaskAttributes
  | HumanTaskAttributes
  | HttpTaskAttributes
  | ScriptTaskAttributes;

// Main task definition interface
export interface TaskComponentDefinition {
  $schema?: string;
  key: string;
  version: string;
  domain: string;
  flow: 'sys-tasks';
  flowVersion: string;
  tags: string[];
  attributes: TaskAttributes;
}