import type { Workflow, Diagram, State, Transition, SharedTransition, TaskDefinition } from './types.js';

export type MsgToWebview =
  | {
      type: 'init';
      workflow: Workflow;
      diagram: Diagram;
      derived: { nodes: any[]; edges: any[] };
      problemsById: Record<string, any>;
      tasks: TaskDefinition[];
      catalogs?: Record<string, any[]>;
    }
  | { type: 'workflow:update'; workflow: Workflow; derived: { nodes: any[]; edges: any[] } }
  | { type: 'diagram:update'; diagram: Diagram }
  | { type: 'lint:update'; problemsById: Record<string, any> }
  | { type: 'catalog:update'; tasks: TaskDefinition[]; catalogs?: Record<string, any[]> }
  | { type: 'select:node'; nodeId: string };

export type MsgFromWebview =
  | { type: 'persist:diagram'; diagram: Diagram }
  | { type: 'domain:setStart'; target: string }
  | { type: 'domain:addTransition'; from: string; target: string; triggerType?: 1 | 3 }
  | { type: 'domain:moveTransition'; oldFrom: string; tKey: string; newFrom: string; newTarget: string }
  | { type: 'domain:removeTransition'; from: string; tKey: string }
  | { type: 'domain:removeState'; stateKey: string }
  | { type: 'domain:updateState'; stateKey: string; state: State }
  | { type: 'domain:updateTransition'; from: string; transitionKey: string; transition: Transition }
  | { type: 'domain:makeTransitionShared'; from: string; transitionKey: string }
  | { type: 'domain:updateSharedTransition'; transitionKey: string; sharedTransition: SharedTransition }
  | { type: 'domain:convertSharedToRegular'; transitionKey: string; targetState: string }
  | { type: 'domain:removeFromSharedTransition'; transitionKey: string; stateKey: string }
  | { type: 'domain:addState'; state: State; position: { x: number; y: number } }
  | { type: 'request:lint' }
  | { type: 'request:autoLayout' }
  | {
      type: 'mapping:loadFromFile';
      stateKey?: string;
      list?: 'onEntries' | 'onExits';
      from?: string;
      transitionKey?: string;
      sharedTransitionKey?: string;
      transition?: Transition;
      index: number;
    }
  | {
      type: 'mapping:createFile';
      stateKey?: string;
      list?: 'onEntries' | 'onExits';
      from?: string;
      transitionKey?: string;
      sharedTransitionKey?: string;
      index: number;
      location: string;
      code?: string;
    }
  | {
      type: 'rule:loadFromFile';
      from: string;
      transitionKey: string;
    };
