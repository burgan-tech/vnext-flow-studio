// Model types for the workflow abstraction layer

import type {
  Workflow,
  State,
  Transition,
  SharedTransition,
  ExecutionTask,
  Mapping,
  Rule,
  FunctionDefinition,
  ExtensionDefinition,
  ViewDefinition,
  SchemaDefinition,
  TaskComponentDefinition,
  Diagram
} from '../types/index.js';

/**
 * Represents a resolved script file (.csx)
 */
export interface ResolvedScript {
  /** Relative path from workflow file (e.g., "./src/mappings/task1.csx") */
  location: string;
  /** Full file system path */
  absolutePath: string;
  /** Decoded script content */
  content: string;
  /** Base64 encoded content */
  base64: string;
  /** Whether file exists on disk */
  exists: boolean;
  /** File modification time */
  lastModified?: Date;
  /** File size in bytes */
  size?: number;
}

/**
 * Mapping with resolved script file
 */
export interface ResolvedMapping extends Mapping {
  script?: ResolvedScript;
}

/**
 * Rule with resolved script file
 */
export interface ResolvedRule extends Rule {
  script?: ResolvedScript;
}

/**
 * Execution task with resolved references
 */
export interface ResolvedExecutionTask extends ExecutionTask {
  /** Resolved task definition */
  resolvedTask?: TaskComponentDefinition;
  /** Resolved mapping with script */
  resolvedMapping?: ResolvedMapping;
}

/**
 * Transition with resolved references
 */
export interface ResolvedTransition extends Omit<Transition, 'onExecutionTasks' | 'rule'> {
  /** Resolved rule with script */
  resolvedRule?: ResolvedRule;
  /** Resolved schema definition */
  resolvedSchema?: SchemaDefinition;
  /** Resolved execution tasks */
  resolvedTasks?: ResolvedExecutionTask[];
  /** Original execution tasks (for reference) */
  onExecutionTasks?: ExecutionTask[];
  /** Original rule (for reference) */
  rule?: Rule | null;
}

/**
 * Shared transition with resolved references
 */
export interface ResolvedSharedTransition extends Omit<SharedTransition, 'onExecutionTasks' | 'rule'> {
  /** Resolved rule with script */
  resolvedRule?: ResolvedRule;
  /** Resolved schema definition */
  resolvedSchema?: SchemaDefinition;
  /** Resolved execution tasks */
  resolvedTasks?: ResolvedExecutionTask[];
  /** Original execution tasks (for reference) */
  onExecutionTasks?: ExecutionTask[];
  /** Original rule (for reference) */
  rule?: Rule | null;
}

/**
 * State with resolved references
 */
export interface ResolvedState extends Omit<State, 'onEntries' | 'onExits' | 'transitions'> {
  /** Resolved view definition */
  resolvedView?: ViewDefinition;
  /** Resolved onEntry tasks */
  resolvedOnEntries?: ResolvedExecutionTask[];
  /** Resolved onExit tasks */
  resolvedOnExits?: ResolvedExecutionTask[];
  /** Resolved transitions */
  resolvedTransitions?: ResolvedTransition[];
  /** Original onEntries (for reference) */
  onEntries?: ExecutionTask[];
  /** Original onExits (for reference) */
  onExits?: ExecutionTask[];
  /** Original transitions (for reference) */
  transitions?: Transition[];
}

/**
 * Component reference identifier
 */
export interface ComponentRef {
  key: string;
  domain: string;
  version: string;
  flow: string;
}

/**
 * Script usage location
 */
export interface ScriptUsage {
  /** State key where script is used */
  stateKey?: string;
  /** Transition key if used in transition */
  transitionKey?: string;
  /** Shared transition key if used in shared transition */
  sharedTransitionKey?: string;
  /** Usage type */
  type: 'mapping' | 'rule';
  /** Task index if used in task mapping */
  taskIndex?: number;
  /** List name if used in state tasks */
  list?: 'onEntries' | 'onExits' | 'onExecutionTasks';
}

/**
 * Model change event
 */
export interface ModelChangeEvent {
  type: 'state' | 'transition' | 'script' | 'component' | 'workflow';
  action: 'add' | 'update' | 'delete';
  target?: string; // Key or path of the changed item
  oldValue?: any;
  newValue?: any;
}

/**
 * Model validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  type: string;
  message: string;
  path?: string;
  location?: string;
}

export interface ValidationWarning {
  type: string;
  message: string;
  path?: string;
  location?: string;
}

/**
 * Model save result
 */
export interface SaveResult {
  success: boolean;
  modified: string[]; // Paths of modified files
  created: string[]; // Paths of created files
  deleted: string[]; // Paths of deleted files
  errors?: Error[];
}

/**
 * Complete workflow model state
 */
export interface WorkflowModelState {
  /** The workflow definition */
  workflow: Workflow;
  /** The diagram (layout) data */
  diagram?: Diagram;
  /** Resolved states by key */
  resolvedStates: Map<string, ResolvedState>;
  /** Resolved functions by reference key */
  resolvedFunctions: Map<string, FunctionDefinition>;
  /** Resolved extensions by reference key */
  resolvedExtensions: Map<string, ExtensionDefinition>;
  /** Resolved shared transitions by key */
  resolvedSharedTransitions: Map<string, ResolvedSharedTransition>;
  /** All script files used in the workflow */
  scripts: Map<string, ResolvedScript>;
  /** Available mapper scripts from filesystem */
  mappers: Map<string, ResolvedScript>;
  /** Available rule scripts from filesystem */
  rules: Map<string, ResolvedScript>;
  /** All referenced components */
  components: {
    tasks: Map<string, TaskComponentDefinition>;
    schemas: Map<string, SchemaDefinition>;
    views: Map<string, ViewDefinition>;
    workflows: Map<string, Workflow>;
  };
  /** Metadata about the model */
  metadata: {
    workflowPath: string;
    diagramPath?: string;
    basePath: string; // Base directory for relative paths
    lastLoaded: Date;
    isDirty: boolean;
  };
}

/**
 * Options for loading a workflow model
 */
export interface ModelLoadOptions {
  /** Whether to resolve all references immediately */
  resolveReferences?: boolean;
  /** Whether to load script file contents */
  loadScripts?: boolean;
  /** Whether to validate after loading */
  validate?: boolean;
  /** Custom base path for resolving relative paths */
  basePath?: string;
  /** Whether to preload all components from the filesystem */
  preloadComponents?: boolean;
  /** Pre-loaded workflow content from VS Code TextDocument (for git virtual URIs) */
  content?: string;
  /** Pre-loaded diagram content from VS Code TextDocument (for git virtual URIs) */
  diagramContent?: string;
}

/**
 * Options for saving a workflow model
 */
export interface ModelSaveOptions {
  /** Whether to create backup files */
  backup?: boolean;
  /** Whether to format JSON output */
  format?: boolean;
  /** Number of spaces for JSON indentation */
  indent?: number;
  /** Whether to update Base64 encoding of scripts */
  updateScriptEncoding?: boolean;
}

/**
 * Component resolver interface
 */
export interface IComponentResolver {
  resolveTask(ref: ComponentRef | { ref: string }): Promise<TaskComponentDefinition | null>;
  resolveSchema(ref: ComponentRef | { ref: string }): Promise<SchemaDefinition | null>;
  resolveView(ref: ComponentRef | { ref: string }): Promise<ViewDefinition | null>;
  resolveFunction(ref: ComponentRef | { ref: string }): Promise<FunctionDefinition | null>;
  resolveExtension(ref: ComponentRef | { ref: string }): Promise<ExtensionDefinition | null>;
  resolveScript(location: string, basePath: string): Promise<ResolvedScript | null>;
}

/**
 * Script manager interface
 */
export interface IScriptManager {
  loadScript(location: string, basePath: string): Promise<ResolvedScript | null>;
  saveScript(location: string, content: string, basePath: string): Promise<void>;
  createScript(location: string, template: string, basePath: string): Promise<ResolvedScript>;
  getTemplate(taskType?: string): string;
  encodeBase64(content: string): string;
  decodeBase64(base64: string): string;
  validateScriptPath(location: string): boolean;
}

/**
 * Model event emitter interface
 */
export interface IModelEventEmitter {
  on(event: 'change', listener: (event: ModelChangeEvent) => void): void;
  on(event: 'save', listener: (result: SaveResult) => void): void;
  on(event: 'validate', listener: (result: ValidationResult) => void): void;
  off(event: string, listener: (...args: any[]) => void): void;
  emit(event: string, ...args: any[]): void;
}