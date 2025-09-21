export type Lang = 'en' | 'tr' | 'en-US' | 'tr-TR';
export type VersionStrategy = 'Major' | 'Minor' | 'Patch';
export type TriggerType = 0 | 1 | 2 | 3; // Manual, Auto, Timeout, Event
export type StateType = 1 | 2 | 3 | 4; // Initial, Intermediate, Final, SubFlow
export type StateSubType = 1 | 2 | 3; // Success, Failed, Cancelled

export interface Label {
  label: string;
  language: string;
}

export interface TaskRef {
  key: string;
  domain: string;
  flow: 'sys-tasks';
  version: string;
}

export interface TaskDefinition extends Omit<TaskRef, 'flow'> {
  flow: string;
  flowVersion?: string;
  title?: string;
  tags?: string[];
  path?: string;
}

export interface FunctionRef {
  key: string;
  domain: string;
  flow: 'sys-functions';
  version: string;
}

export interface ExtensionRef {
  key: string;
  domain: string;
  flow: 'sys-extensions';
  version: string;
}

export interface ViewRef {
  key: string;
  domain: string;
  flow: 'sys-views';
  version: string;
}

export interface SchemaRef {
  key: string;
  domain: string;
  flow: 'sys-schemas';
  version: string;
}

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
  mapping?: Mapping;
}

export interface TransitionBase {
  key: string;
  target: string;
  triggerType: TriggerType;
  versionStrategy: VersionStrategy;
  labels?: Label[];
  rule?: Rule;
  schema?: SchemaRef | Record<string, unknown> | null;
}

export interface Transition extends TransitionBase {
  from: string;
  availableIn?: string[];
}

export interface SharedTransition extends TransitionBase {
  availableIn: string[];
}

export interface ViewItem {
  viewType: 1 | 2 | 3;
  viewTarget: 1 | 2 | 3;
  content?: string;
  reference?: ViewRef;
}

export interface State {
  key: string;
  stateType: StateType;
  stateSubType?: StateSubType;
  versionStrategy: VersionStrategy;
  labels: Label[];
  onEntries?: ExecutionTask[];
  onExit?: ExecutionTask[];
  onExecutionTasks?: ExecutionTask[];
  transitions?: Transition[];
  views?: ViewItem[];
}

export interface TimeoutCfg {
  key: string;
  target: string;
  versionStrategy: VersionStrategy;
  timer: {
    reset: 'N' | 'R';
    duration: string;
  };
}

export interface Workflow {
  key: string;
  tags?: string[];
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