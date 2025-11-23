// TypeScript types for workflow-definition.schema.json

export type Lang = 'en' | 'tr' | 'en-US' | 'tr-TR';
export type VersionStrategy = 'Major' | 'Minor';
export type TriggerType = 0 | 1 | 2 | 3; // Manual, Auto, Timeout, Event
export type StateType = 1 | 2 | 3 | 4 | 5; // Initial, Intermediate, Final, SubFlow, Wizard
export type StateSubType = 1 | 2 | 3; // Success, Failed, Cancelled

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

export type SchemaRef =
  | { ref: string }
  | { key: string; domain: string; flow: string; version: string };

export interface Mapping {
  location: string;
  code: string;
  _comment?: string;
}

export interface Rule {
  location: string;
  code: string;
  _comment?: string;
}

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
  versionStrategy: VersionStrategy;
  labels?: Label[];
  rule?: Rule | null;
  schema?: SchemaRef | null;
  timer?: TimerConfig | null;
  view?: ViewRef | null;
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
  view?: ViewRef;
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

export interface ScriptCode {
  location: string;
  code: string;
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