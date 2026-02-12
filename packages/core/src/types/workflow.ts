// TypeScript types for workflow-definition.schema.json

export type Lang = 'en' | 'tr' | 'en-US' | 'tr-TR';
export type VersionStrategy = 'Major' | 'Minor';
export type TriggerType = 0 | 1 | 2 | 3; // Manual, Auto, Timeout, Event
export type TriggerKind = 0 | 10; // 0=Not applicable, 10=Default auto transition
export type StateType = 1 | 2 | 3 | 4 | 5; // Initial, Intermediate, Final, SubFlow, Wizard
// StateSubType values:
// 0 = No specific subtype (default)
// 1 = Successful completion
// 2 = Error condition
// 3 = Manually terminated (Cancelled)
// 4 = Temporarily suspended
// 5 = Busy (processing in progress)
// 6 = Human (waiting for human interaction)
export type StateSubType = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface Label {
  label: string;
  language: string;
}

export type TaskRef =
  | { ref: string }
  | { key: string; domain: string; flow: string; version: string };

export interface TaskDefinition {
  key: string;
  domain: string;
  flow: string;
  version: string;
  flowVersion?: string;
  title?: string;
  tags?: string[];
  path?: string;
}

export type FunctionRef =
  | { ref: string }
  | { key: string; domain: string; flow: string; version: string };

export type ExtensionRef =
  | { ref: string }
  | { key: string; domain: string; flow: string; version: string };

export type ViewRef =
  | { ref: string }
  | { key: string; domain: string; flow: string; version: string };

/**
 * ViewConfig wraps a view reference with optional extensions and data loading config.
 * Used in states and transitions to specify view configuration.
 */
export interface ViewConfig {
  /** Reference to the view component */
  view: ViewRef;
  /** List of extension keys to load with this view */
  extensions?: string[];
  /** Whether to load instance data when showing this view */
  loadData?: boolean;
}

export type SchemaRef =
  | { ref: string }
  | { key: string; domain: string; flow: string; version: string };

// Script type - Global or Local
export type ScriptType = 'G' | 'L';

// Code encoding format - Base64 or Native
export type ScriptEncoding = 'B64' | 'NAT';

/**
 * ScriptCode represents executable script content.
 * Used for mappings, rules, and timer scripts.
 *
 * For Local scripts (type='L' or undefined), code is required.
 * For Global scripts (type='G'), code is optional.
 */
export interface ScriptCode {
  /** Script type - 'G' (Global) or 'L' (Local). Defaults to 'L' */
  type?: ScriptType;
  /** Script code content (usually Base64 encoded). Required for Local scripts. */
  code?: string;
  /** Location of the script file (e.g., "./src/mappings/task1.csx") */
  location?: string;
  /** Code encoding format - 'B64' (Base64) or 'NAT' (Native). Defaults to 'B64' */
  encoding?: ScriptEncoding;
  /** Optional comment */
  _comment?: string;
}

// Mapping is a ScriptCode used for data transformation
export type Mapping = ScriptCode;

// Rule is a ScriptCode used for conditional logic
export type Rule = ScriptCode;

export interface ExecutionTask {
  order: number;
  task: TaskRef;
  mapping: Mapping;
  _comment?: string;
}

export interface TransitionBase {
  key: string;
  target: string; // Can be a state key or special value "$self"
  triggerType: TriggerType;
  triggerKind?: TriggerKind; // 0=Not applicable, 10=Default auto (only for triggerType=1)
  versionStrategy: VersionStrategy;
  labels?: Label[];
  rule?: Rule | null;
  schema?: SchemaRef | null;
  timer?: ScriptCode | null; // Timer script for scheduled transitions (triggerType: 2)
  view?: ViewConfig | null;
  onExecutionTasks?: ExecutionTask[];
  mapping?: Mapping | null;
  _comment?: string;
}

// Type guard to check if target is the special "$self" marker
export function isSelfTarget(target: string): boolean {
  return target === '$self';
}

// Regular transitions inherit all fields from TransitionBase
// The 'from' is implicit - it's the parent state containing the transition
export type Transition = TransitionBase;

export interface SharedTransition extends TransitionBase {
  availableIn: string[];
  _comment?: string;
}

export interface CancelTransition {
  key: string;
  target: string;
  from?: string; // Source state key (optional)
  versionStrategy: VersionStrategy;
  triggerType: 0; // Cancel transition must be manual trigger only
  labels: Label[];
  availableIn?: string[]; // States where this cancel transition can be used
  schema?: SchemaRef | null;
  view?: ViewConfig | null;
  onExecutionTasks?: ExecutionTask[];
  mapping?: Mapping | null;
  _comment?: string;
}

// ViewItem is deprecated - states now have single view reference

export interface State {
  key: string;
  stateType: StateType;
  stateSubType?: StateSubType;
  versionStrategy: VersionStrategy;
  labels: Label[];
  onEntries?: ExecutionTask[];
  onExits?: ExecutionTask[];
  transitions?: Transition[];
  view?: ViewConfig | null;
  subFlow?: SubFlowConfig | null;
  _comment?: string;
}

export interface TimerConfig {
  reset: string; // Timer reset strategy (e.g., 'N' for no reset, 'R' for reset)
  duration: string; // ISO 8601 duration format
}

export interface TimeoutCfg {
  key: string;
  target: string;
  versionStrategy: VersionStrategy;
  timer: TimerConfig;
}

export interface Reference {
  key: string;
  domain: string;
  flow: string;
  version: string;
}

export type ProcessRef =
  | { ref: string }
  | { key: string; domain: string; flow: string; version: string };

/**
 * SubFlow configuration for workflow states
 *
 * Type behaviors:
 * - 'S' (SubFlow): Creates a separate instance and blocks the parent workflow until completion
 * - 'P' (SubProcess): Creates a separate instance and runs in parallel without blocking parent
 * - 'C' (Core): Core workflow type
 * - 'F' (Flow): Standard flow type
 */
export interface SubFlowConfig {
  type: 'C' | 'F' | 'S' | 'P';
  process: ProcessRef;
  mapping: Mapping;
  /** Override views for specific subflow states (key: state name, value: view config) */
  viewOverrides?: Record<string, ViewConfig>;
  _comment?: string;
}

export interface Workflow {
  key: string;
  flow: string;
  domain: string;
  version: string;
  flowVersion?: string;
  tags: string[];
  _comment?: string;
  attributes: {
    type: 'C' | 'F' | 'S' | 'P';
    subFlowType?: 'S' | 'P';
    timeout?: TimeoutCfg | null;
    labels?: Label[];
    functions?: FunctionRef[];
    features?: ExtensionRef[]; // Alternative name for extensions
    extensions?: ExtensionRef[];
    sharedTransitions?: SharedTransition[];
    startTransition: TransitionBase & { triggerType: 0 };
    cancel?: CancelTransition | null;
    states: State[];
  };
}

export interface Diagram {
  nodePos: Record<string, { x: number; y: number }>;
  collapsed?: Record<string, boolean>;
  layerVisibility?: {
    regularTransitions?: boolean;
    sharedTransitions?: boolean;
  };
}