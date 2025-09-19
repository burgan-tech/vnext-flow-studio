import type { Workflow, Diagram } from './types.js';

export const START_NODE_ID = '__start__';
export const TIMEOUT_NODE_ID = '__timeout__';

export interface ReactFlowNode {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: any;
  draggable?: boolean;
  selectable?: boolean;
}

export interface ReactFlowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  data?: any;
  style?: Record<string, any>;
}

export function toReactFlow(
  workflow: Workflow,
  diagram: Diagram,
  lang: string = 'en'
): { nodes: ReactFlowNode[]; edges: ReactFlowEdge[] } {
  const nodes: ReactFlowNode[] = [];
  const edges: ReactFlowEdge[] = [];

  // Add pseudo nodes
  if (workflow.attributes.startTransition) {
    nodes.push({
      id: START_NODE_ID,
      type: 'input',
      position: { x: 0, y: 0 },
      data: { label: 'Start' },
      draggable: false,
      selectable: false
    });
  }

  if (workflow.attributes.timeout) {
    nodes.push({
      id: TIMEOUT_NODE_ID,
      type: 'input',
      position: { x: -120, y: 0 },
      data: { label: 'Timeout' },
      draggable: false,
      selectable: false
    });
  }

  // Add state nodes
  for (const state of workflow.attributes.states) {
    const pos = diagram.nodePos[state.key] ?? { x: 100, y: 100 };
    const label = state.labels.find(l => l.language === lang)?.label ||
                  state.labels[0]?.label ||
                  state.key;

    nodes.push({
      id: state.key,
      position: pos,
      data: {
        title: label,
        state: state,
        stateType: state.stateType,
        stateSubType: state.stateSubType
      },
      type: 'default'
    });

    // Add local transitions
    for (const transition of (state.transitions || [])) {
      const transitionLabel = transition.labels?.find(l => l.language === lang)?.label ||
                              transition.labels?.[0]?.label ||
                              transition.key;

      edges.push({
        id: `t:local:${state.key}:${transition.key}`,
        source: state.key,
        target: transition.target,
        label: transitionLabel,
        data: {
          from: state.key,
          tKey: transition.key,
          triggerType: transition.triggerType
        }
      });
    }
  }

  // Add start edge
  if (workflow.attributes.startTransition) {
    const st = workflow.attributes.startTransition;
    const startLabel = st.labels?.find(l => l.language === lang)?.label ||
                       st.labels?.[0]?.label ||
                       'Start';

    edges.push({
      id: 'e:start',
      source: START_NODE_ID,
      target: st.target,
      label: startLabel,
      data: { triggerType: st.triggerType }
    });
  }

  // Add timeout edge
  if (workflow.attributes.timeout) {
    const tt = workflow.attributes.timeout;
    edges.push({
      id: `e:timeout:${tt.key}`,
      source: TIMEOUT_NODE_ID,
      target: tt.target,
      label: `⏱ ${tt.timer.duration}`,
      data: { triggerType: 2 },
      style: { strokeDasharray: '6 4' }
    });
  }

  // Add shared transitions (expanded)
  for (const sharedTransition of (workflow.attributes.sharedTransitions || [])) {
    const sharedLabel = sharedTransition.labels?.find(l => l.language === lang)?.label ||
                        sharedTransition.labels?.[0]?.label ||
                        sharedTransition.key;

    for (const from of sharedTransition.availableIn) {
      edges.push({
        id: `t:shared:${sharedTransition.key}:${from}`,
        source: from,
        target: sharedTransition.target,
        label: sharedLabel,
        style: { strokeDasharray: '4 4' },
        data: {
          sharedKey: sharedTransition.key,
          triggerType: sharedTransition.triggerType
        }
      });
    }
  }

  return { nodes, edges };
}