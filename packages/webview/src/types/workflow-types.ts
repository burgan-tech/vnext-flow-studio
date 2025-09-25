/**
 * TypeScript interfaces generated from vnext workflow schemas
 * These provide proper IntelliSense and validation for the enhanced editors
 */

// Base types
export type VersionStrategy = 'Major' | 'Minor';
export type TriggerType = 0 | 1 | 2 | 3; // Manual | Automatic | Timeout | Event
export type StateType = 1 | 2 | 3 | 4; // Initial | Intermediate | Final | SubFlow
export type StateSubType = 1 | 2 | 3; // Success | Failed | Cancelled
export type ViewType = 1 | 2 | 3; // JSON | HTML | Markdown
export type ViewTarget = 1 | 2 | 3; // State | Transition | Task

// Task types from task-definition.schema.json
export type TaskType = '1' | '2' | '3' | '4' | '5' | '6' | '7';
export const TaskTypeDescriptions = {
  '1': 'Dapr HTTP Endpoint',
  '2': 'Dapr Binding',
  '3': 'Dapr Service',
  '4': 'Dapr PubSub',
  '5': 'Human Task',
  '6': 'HTTP Task',
  '7': 'Script Task'
} as const;

// Extension types
export type ExtensionType = 1 | 2 | 3 | 4;
export type ExtensionScope = 1 | 2 | 3;

// Function scope
export type FunctionScope = 1 | 2 | 3 | 4 | 5;

// Language code pattern
export interface Label {
  label: string;
  language: string; // Pattern: ^[a-z]{2}(-[A-Z]{2})?$
}

// Reference patterns
export interface Reference {
  key: string;
  domain: string;
  flow: string;
  version: string; // Pattern: ^\d+\.\d+\.\d+$
}

export interface RefOnly {
  ref: string;
}

// Union types for references
export type FunctionReference = Reference | RefOnly;
export type ExtensionReference = Reference | RefOnly;
export type TaskReference = Reference | RefOnly;
export type ViewReference = Reference | RefOnly;
export type SchemaReference = Reference | RefOnly;
export type TaskRef = Reference | RefOnly;

// Mapping and Rule structures
export interface Mapping {
  location: string; // Pattern: ^\.\/src\/.*\.csx$
  code: string; // Base64 encoded
}

export interface Rule {
  location: string; // Pattern: ^\.\/src\/.*\.csx$
  code: string; // Base64 encoded
}

// Execution Task structure
export interface ExecutionTask {
  order: number; // minimum: 1
  task: TaskRef;
  mapping: Mapping;
}

// Timer configuration
export interface Timer {
  reset: 'N' | 'R'; // Never | Reset
  duration: string; // ISO 8601 format (e.g., PT1H, PT30M)
}

// Timeout configuration
export interface TimeoutConfig {
  key: string;
  target: string;
  versionStrategy: VersionStrategy;
  timer: Timer;
}

// Transition base structure
export interface TransitionBase {
  key: string;
  target: string;
  triggerType: TriggerType;
  versionStrategy: VersionStrategy;
  labels?: Label[];
  rule?: Rule;
  schema?: SchemaReference | null;
  onExecutionTasks?: ExecutionTask[];
}

// Shared transition (extends TransitionBase)
export interface SharedTransition extends TransitionBase {
  availableIn: string[]; // States where this shared transition is available
}

// Start transition (extends TransitionBase with triggerType constraint)
export interface StartTransition extends TransitionBase {
  triggerType: 0; // Must be manual
}

// Regular transition
export type Transition = TransitionBase;

// State structure
export interface State {
  key: string;
  stateType: StateType;
  stateSubType?: StateSubType;
  versionStrategy: VersionStrategy;
  labels: Label[];
  onEntries?: ExecutionTask[];
  onExits?: ExecutionTask[];
  transitions?: Transition[];
  view?: ViewReference;
}

// Workflow attributes
export interface WorkflowAttributes {
  type: 'C' | 'F' | 'S' | 'P'; // Core | Flow | SubFlow | Sub Process
  subFlowType?: 'S' | 'P'; // SubFlow | Sub Process
  timeout?: TimeoutConfig | null;
  labels?: Label[];
  functions?: FunctionReference[];
  extensions?: ExtensionReference[];
  sharedTransitions?: SharedTransition[];
  startTransition: StartTransition;
  states?: State[];
}

// Main Workflow structure
export interface Workflow {
  key: string; // Pattern: ^[a-z0-9-]+$
  flow: string; // Pattern: ^[a-z0-9-]+$
  domain: string; // Pattern: ^[a-z0-9-]+$
  version: string; // Pattern: ^\d+\.\d+\.\d+$
  tags: string[];
  attributes: WorkflowAttributes;
}

// Task definition structures based on task-definition.schema.json
export interface TaskConfigBase {
  type: TaskType;
}

export interface DaprHttpEndpointConfig extends TaskConfigBase {
  type: '1';
  config: {
    endpointName: string;
    path: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    headers?: Record<string, any>;
  };
}

export interface DaprBindingConfig extends TaskConfigBase {
  type: '2';
  config: {
    bindingName: string;
    operation: string;
    metadata?: Record<string, any>;
    data?: Record<string, any>;
  };
}

export interface DaprServiceConfig extends TaskConfigBase {
  type: '3';
  config: {
    appId: string;
    methodName: string;
    httpVerb?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    data?: Record<string, any>;
    queryString?: string;
    timeoutSeconds?: number;
  };
}

export interface DaprPubSubConfig extends TaskConfigBase {
  type: '4';
  config: {
    pubSubName: string;
    topic: string;
    data?: Record<string, any>;
    metadata?: Record<string, any>;
  };
}

export interface HumanTaskConfig extends TaskConfigBase {
  type: '5';
  config: {
    title: string;
    instructions: string;
    assignedTo: string;
    dueDate?: string | null; // ISO 8601 date-time
    form?: any; // JSON format
    reminderIntervalMinutes?: number;
    escalationTimeoutMinutes?: number;
    escalationAssignee?: string;
  };
}

export interface HttpTaskConfig extends TaskConfigBase {
  type: '6';
  config: {
    url: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    headers?: Record<string, any>;
    body?: Record<string, any>;
    timeoutSeconds?: number;
    validateSsl?: boolean;
  };
}

export interface ScriptTaskConfig extends TaskConfigBase {
  type: '7';
  config: Record<string, never>; // Empty object
}

export type TaskConfig =
  | DaprHttpEndpointConfig
  | DaprBindingConfig
  | DaprServiceConfig
  | DaprPubSubConfig
  | HumanTaskConfig
  | HttpTaskConfig
  | ScriptTaskConfig;

export interface TaskDefinition {
  $schema?: string;
  key: string; // Pattern: ^[a-z0-9-]+$
  version: string; // Pattern: ^\d+\.\d+\.\d+$
  domain: string; // Pattern: ^[a-z0-9-]+$
  flow: 'sys-tasks';
  flowVersion: string; // Pattern: ^\d+\.\d+\.\d+$
  tags: string[];
  attributes: TaskConfig;
}

// Extension definition structures
export interface ExtensionTask {
  order: number;
  task: TaskRef;
  mapping: Mapping;
}

export interface ExtensionAttributes {
  type: ExtensionType;
  scope: ExtensionScope;
  task: ExtensionTask;
  labels?: Label[];
}

export interface ExtensionDefinition {
  $schema?: string;
  key: string;
  version: string;
  domain: string;
  flow: 'sys-extensions';
  flowVersion: string;
  tags: string[];
  attributes: ExtensionAttributes;
}

// View definition structures
export interface ViewAttributes {
  type: ViewType;
  target: ViewTarget;
  content: string;
  labels?: Label[];
  display?: 'full-page' | 'popup' | 'bottom-sheet' | 'top-sheet' | 'drawer' | 'inline';
  metadata?: {
    dismissible?: boolean;
    backdrop?: boolean;
    animation?: 'slide' | 'fade' | 'scale' | 'none';
  };
}

export interface ViewDefinition {
  $schema?: string;
  key: string;
  version: string;
  domain: string;
  flow: 'sys-views';
  flowVersion: string;
  tags: string[];
  attributes: ViewAttributes;
}

// Function definition structures
export interface FunctionTask {
  order: number;
  task: TaskRef;
  mapping: Mapping;
}

export interface FunctionAttributes {
  scope: FunctionScope;
  task: FunctionTask;
  mapping: Mapping;
  labels?: Label[];
}

export interface FunctionDefinition {
  $schema?: string;
  key: string;
  version: string;
  domain: string;
  flow: 'sys-functions';
  flowVersion: string;
  tags: string[];
  attributes: FunctionAttributes;
}

// Helper types for enhanced editors
export interface MappingConfiguration {
  location: string;
  code: string;
  enabled?: boolean;
  type?: string;
  description?: string;
}

// Context information for IntelliSense
export interface WorkflowContext {
  workflow?: Workflow;
  currentState?: State;
  currentTask?: TaskDefinition;
  availableTasks?: TaskDefinition[];
  availableStates?: State[];
  workflowVariables?: Record<string, any>;
}

// Enhanced IntelliSense suggestions
export interface IntelliSenseItem {
  label: string;
  kind: 'Variable' | 'Property' | 'Method' | 'Class' | 'Interface' | 'Enum' | 'Keyword';
  insertText: string;
  documentation?: string;
  detail?: string;
  sortText?: string;
}

// Validation results
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  line: number;
  column: number;
  message: string;
  severity: 'error';
}

export interface ValidationWarning {
  line: number;
  column: number;
  message: string;
  severity: 'warning';
}

// Trigger type information with descriptions
export const TriggerTypeInfo = {
  0: { label: 'Manual', icon: '👤', description: 'Triggered manually by user action', supportsTimeout: false },
  1: { label: 'Automatic', icon: '⚡', description: 'Triggered automatically by system', supportsTimeout: false },
  2: { label: 'Timeout', icon: '⏰', description: 'Triggered after a specified duration', supportsTimeout: true },
  3: { label: 'Event', icon: '📥', description: 'Triggered by system events', supportsTimeout: false }
} as const;

// State type information
export const StateTypeInfo = {
  1: { label: 'Initial', icon: '🚀', description: 'Starting state of the workflow' },
  2: { label: 'Intermediate', icon: '⚙️', description: 'Processing state' },
  3: { label: 'Final', icon: '🏁', description: 'End state of the workflow' },
  4: { label: 'SubFlow', icon: '🔗', description: 'State that triggers a sub-workflow' }
} as const;

// Task type information with better descriptions
export const TaskTypeInfo = {
  '1': { label: 'Dapr HTTP', icon: '🌐', description: 'Call external HTTP endpoints via Dapr' },
  '2': { label: 'Dapr Binding', icon: '🔗', description: 'Execute Dapr binding operations' },
  '3': { label: 'Dapr Service', icon: '🎯', description: 'Call other Dapr services' },
  '4': { label: 'Dapr PubSub', icon: '📢', description: 'Publish/subscribe to topics' },
  '5': { label: 'Human Task', icon: '👥', description: 'Assign task to human operators' },
  '6': { label: 'HTTP Task', icon: '📡', description: 'Direct HTTP calls without Dapr' },
  '7': { label: 'Script Task', icon: '📜', description: 'Execute custom C# scripts' }
} as const;
