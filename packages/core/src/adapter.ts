import type { Workflow, Diagram } from './types.js';

export const START_NODE_ID = '__start__';
export const TIMEOUT_NODE_ID = '__timeout__';

// Color scheme for different trigger types
const TRIGGER_TYPE_COLORS = {
  0: '#3b82f6', // Manual - Blue
  1: '#10b981', // Auto - Green
  2: '#f59e0b', // Timeout - Orange
  3: '#8b5cf6', // Event - Purple
} as const;

function getEdgeStyle(triggerType: number): Record<string, any> {
  const color = TRIGGER_TYPE_COLORS[triggerType as keyof typeof TRIGGER_TYPE_COLORS] || '#6b7280';
  return {
    stroke: color,
    strokeWidth: 2,
  };
}

export interface ReactFlowNode {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: any;
  draggable?: boolean;
  selectable?: boolean;
  sourcePosition?: 'left' | 'right' | 'top' | 'bottom';
  targetPosition?: 'left' | 'right' | 'top' | 'bottom';
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
      type: 'event',
      position: diagram.nodePos[START_NODE_ID] ?? { x: 0, y: 0 },
      data: { label: 'Start', variant: 'start' as const },
      draggable: true,
      selectable: false,
      sourcePosition: 'right',
      targetPosition: 'left'
    });
  }

  if (workflow.attributes.timeout) {
    nodes.push({
      id: TIMEOUT_NODE_ID,
      type: 'event',
      position: diagram.nodePos[TIMEOUT_NODE_ID] ?? { x: -120, y: 0 },
      data: { label: 'Timeout', variant: 'timeout' as const },
      draggable: true,
      selectable: false,
      sourcePosition: 'right',
      targetPosition: 'left'
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
      type: 'default',
      sourcePosition: 'right',
      targetPosition: 'left'
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
        style: getEdgeStyle(transition.triggerType),
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
      style: getEdgeStyle(st.triggerType),
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
      style: { ...getEdgeStyle(2), strokeDasharray: '6 4' }
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
        style: { ...getEdgeStyle(sharedTransition.triggerType), strokeDasharray: '4 4' },
        data: {
          sharedKey: sharedTransition.key,
          triggerType: sharedTransition.triggerType
        }
      });
    }
  }

  return { nodes, edges };
}
