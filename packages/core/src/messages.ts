import type { Workflow, Diagram, State, Transition } from './types.js';

export type MsgToWebview =
  | { type: 'init'; workflow: Workflow; diagram: Diagram; derived: { nodes: any[]; edges: any[] }; problemsById: Record<string, any> }
  | { type: 'workflow:update'; workflow: Workflow; derived: { nodes: any[]; edges: any[] } }
  | { type: 'diagram:update'; diagram: Diagram }
  | { type: 'lint:update'; problemsById: Record<string, any> };

export type MsgFromWebview =
  | { type: 'persist:diagram'; diagram: Diagram }
  | { type: 'domain:setStart'; target: string }
  | { type: 'domain:addTransition'; from: string; target: string; triggerType?: 1 | 3 }
  | { type: 'domain:moveTransition'; oldFrom: string; tKey: string; newFrom: string; newTarget: string }
  | { type: 'domain:removeTransition'; from: string; tKey: string }
  | { type: 'domain:updateState'; stateKey: string; state: State }
  | { type: 'domain:updateTransition'; from: string; transitionKey: string; transition: Transition }
  | { type: 'request:lint' };