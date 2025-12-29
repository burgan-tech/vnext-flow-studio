// TypeScript types for task-definition.schema.json

// Task type enum values (stored as strings in JSON)
export enum TaskType {
  DaprHttpEndpoint = '1',
  DaprBinding = '2',
  DaprService = '3',
  DaprPubSub = '4',
  HumanTask = '5',
  HttpTask = '6',
  ScriptTask = '7',
  ConditionTask = '8',
  TimerTask = '9',
  NotificationTask = '10',
  StartFlowTask = '11',
  TriggerTransitionTask = '12',
  GetInstanceDataTask = '13',
  SubProcessTask = '14'
}

// HTTP methods
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

// Task configuration types for each task type
export interface DaprHttpEndpointConfig {
  endpointName: string;
  path: string;
  method: HttpMethod;
  body?: Record<string, any>;
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
  body?: Record<string, any>;
  headers?: Record<string, any>;
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

// Script task has no specific config properties in the schema
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ScriptTaskConfig {}

// Condition Task (8) - No specific config
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ConditionTaskConfig {}

// Timer Task (9) - No specific config
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface TimerTaskConfig {}

// Notification Task (10)
export interface NotificationTaskConfig {
  metadata: Record<string, any>;
}

// Start Flow Task (11) - Creates a new workflow instance
export interface StartFlowTaskConfig {
  flow: string;
  domain: string;
  body?: Record<string, any>;
  sync?: boolean;
  version?: string;
  key?: string;
  tags?: string[];
}

// Trigger Transition Task (12) - Executes a transition on a target workflow instance
export interface TriggerTransitionTaskConfig {
  flow: string;
  domain: string;
  transitionName: string;
  body?: Record<string, any>;
  sync?: boolean;
  version?: string;
  key?: string;
  instanceId?: string;
  tags?: string[];
}

// Get Instance Data Task (13) - Retrieves instance data from a workflow instance
export interface GetInstanceDataTaskConfig {
  flow: string;
  domain: string;
  key?: string;
  instanceId?: string;
  extensions?: string[];
}

// SubProcess Task (14) - Starts a subprocess workflow
export interface SubProcessTaskConfig {
  flow: string;
  domain: string;
  body?: Record<string, any>;
  version?: string;
  key?: string;
  tags?: string[];
}

// Union type for all task configurations
export type TaskConfig =
  | DaprHttpEndpointConfig
  | DaprBindingConfig
  | DaprServiceConfig
  | DaprPubSubConfig
  | HumanTaskConfig
  | HttpTaskConfig
  | ScriptTaskConfig
  | ConditionTaskConfig
  | TimerTaskConfig
  | NotificationTaskConfig
  | StartFlowTaskConfig
  | TriggerTransitionTaskConfig
  | GetInstanceDataTaskConfig
  | SubProcessTaskConfig;

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

export interface ConditionTaskAttributes extends TaskAttributesBase {
  type: TaskType.ConditionTask;
  config: ConditionTaskConfig;
}

export interface TimerTaskAttributes extends TaskAttributesBase {
  type: TaskType.TimerTask;
  config: TimerTaskConfig;
}

export interface NotificationTaskAttributes extends TaskAttributesBase {
  type: TaskType.NotificationTask;
  config: NotificationTaskConfig;
}

export interface StartFlowTaskAttributes extends TaskAttributesBase {
  type: TaskType.StartFlowTask;
  config: StartFlowTaskConfig;
}

export interface TriggerTransitionTaskAttributes extends TaskAttributesBase {
  type: TaskType.TriggerTransitionTask;
  config: TriggerTransitionTaskConfig;
}

export interface GetInstanceDataTaskAttributes extends TaskAttributesBase {
  type: TaskType.GetInstanceDataTask;
  config: GetInstanceDataTaskConfig;
}

export interface SubProcessTaskAttributes extends TaskAttributesBase {
  type: TaskType.SubProcessTask;
  config: SubProcessTaskConfig;
}

// Union type for all task attributes
export type TaskAttributes =
  | DaprHttpEndpointTaskAttributes
  | DaprBindingTaskAttributes
  | DaprServiceTaskAttributes
  | DaprPubSubTaskAttributes
  | HumanTaskAttributes
  | HttpTaskAttributes
  | ScriptTaskAttributes
  | ConditionTaskAttributes
  | TimerTaskAttributes
  | NotificationTaskAttributes
  | StartFlowTaskAttributes
  | TriggerTransitionTaskAttributes
  | GetInstanceDataTaskAttributes
  | SubProcessTaskAttributes;

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