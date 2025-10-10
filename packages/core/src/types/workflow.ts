// TypeScript types for workflow-definition.schema.json

export type Lang = 'en' | 'tr' | 'en-US' | 'tr-TR';
export type VersionStrategy = 'Major' | 'Minor';
export type TriggerType = 0 | 1 | 2 | 3; // Manual, Auto, Timeout, Event
export type StateType = 1 | 2 | 3 | 4; // Initial, Intermediate, Final, SubFlow
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
}

export interface Rule {
  location: string;
  code: string;
}

export interface ExecutionTask {
  order: number;
  task: TaskRef;
  mapping: Mapping;
}

export interface TransitionBase {
  key: string;
  target: string;
  triggerType: TriggerType;
  versionStrategy: VersionStrategy;
  labels?: Label[];
  rule?: Rule;
  schema?: SchemaRef | null;
  onExecutionTasks?: ExecutionTask[];
}

// Regular transitions inherit all fields from TransitionBase
// The 'from' is implicit - it's the parent state containing the transition
export type Transition = TransitionBase;

export interface SharedTransition extends TransitionBase {
  availableIn: string[];
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
  subFlow?: {
    type: 'S' | 'P';
    process: {
      key: string;
      domain: string;
      version: string;
      flow: string;
    };
  } | null;
}

export interface TimerConfig {
  reset: 'N' | 'R';
  duration: string;
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

export interface SubFlow {
  key: string;
  domain: string;
  flow: string;
  version: string;
  type?: 'S' | 'P';
}

export interface Workflow {
  key: string;
  flow: string;
  domain: string;
  version: string;
  tags: string[];
  attributes: {
    type: 'C' | 'F' | 'S' | 'P';
    subFlowType?: 'S' | 'P';
    timeout?: TimeoutCfg | null;
    labels?: Label[];
    functions?: FunctionRef[];
    extensions?: ExtensionRef[];
    sharedTransitions?: SharedTransition[];
    startTransition?: TransitionBase & { triggerType: 0 };
    states: State[];
  };
}

export interface Diagram {
  nodePos: Record<string, { x: number; y: number }>;
  collapsed?: Record<string, boolean>;
}