import type { Workflow, Diagram, Label } from './types/index.js';

export const START_NODE_ID = '__start__';
export const TIMEOUT_NODE_ID = '__timeout__';

export interface ReactFlowNode {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: any;
  draggable?: boolean;
  selectable?: boolean;
  sourcePosition?: 'left' | 'right' | 'top' | 'bottom';
  targetPosition?: 'left' | 'right' | 'top' | 'bottom';
  style?: Record<string, any>;
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
  lang: string = 'en',
  designHints?: Record<string, any>
): { nodes: ReactFlowNode[]; edges: ReactFlowEdge[] } {
  const nodes: ReactFlowNode[] = [];
  const edges: ReactFlowEdge[] = [];

  // Add pseudo nodes
  if (workflow.attributes.startTransition) {
    const eventWidth = 180;
    const eventHeight = 80;
    nodes.push({
      id: START_NODE_ID,
      type: 'event',
      position: diagram.nodePos[START_NODE_ID] ?? { x: 0, y: 0 },
      data: { label: 'Start', variant: 'start' as const, width: eventWidth, height: eventHeight },
      draggable: true,
      selectable: false,
      sourcePosition: 'right',
      targetPosition: 'left',
      style: { width: eventWidth, height: eventHeight }
    });
  }

  if (workflow.attributes.timeout) {
    const eventWidth = 180;
    const eventHeight = 80;
    nodes.push({
      id: TIMEOUT_NODE_ID,
      type: 'event',
      position: diagram.nodePos[TIMEOUT_NODE_ID] ?? { x: -120, y: 0 },
      data: { label: 'Timeout', variant: 'timeout' as const, width: eventWidth, height: eventHeight },
      draggable: true,
      selectable: false,
      sourcePosition: 'right',
      targetPosition: 'left',
      style: { width: eventWidth, height: eventHeight }
    });
  }

  // Add state nodes
  for (const state of workflow.attributes.states) {
    const pos = diagram.nodePos[state.key] ?? { x: 100, y: 100 };
    const label = state.labels.find((l: Label) => l.language === lang)?.label ||
                  state.labels[0]?.label ||
                  state.key;

    // Calculate node width based on content (matching StateNode.tsx logic)
    const iconColumnWidth = 40;
    const contentPadding = 40;
    const approxCharWidth = 9;
    const minContentWidth = 130;
    const stateSubTypeIcon = state.stateSubType ? true : false;
    const badgeWidth = stateSubTypeIcon ? 30 : 0;

    const titleWidth = label.length * approxCharWidth;
    const stateKeyWidth = state.key.length * 7;
    const contentWidth = Math.max(minContentWidth, titleWidth, stateKeyWidth);
    const calculatedWidth = iconColumnWidth + contentPadding + contentWidth + badgeWidth;

    // Check if this is a plugin node based on xProfile
    const stateHints = designHints?.[state.key];
    const isPluginNode = state.xProfile && state.xProfile !== 'Default';

    nodes.push({
      id: state.key,
      position: pos,
      data: {
        title: label,
        state: state,
        stateType: state.stateType,
        stateSubType: state.stateSubType,
        xProfile: state.xProfile,
        width: calculatedWidth,
        height: 80,
        hints: stateHints,
        pluginId: state.xProfile // Use xProfile as plugin ID
      },
      type: isPluginNode ? 'plugin' : 'default',
      sourcePosition: 'right',
      targetPosition: 'left',
      style: { width: calculatedWidth, height: 80 }
    });

    // Add local transitions
    for (const transition of (state.transitions || [])) {
      const transitionLabel = transition.labels?.find((l: Label) => l.language === lang)?.label ||
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
    const startLabel = st.labels?.find((l: Label) => l.language === lang)?.label ||
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
      data: { triggerType: 2 }
    });
  }

  // Add shared transitions (expanded)
  for (const sharedTransition of (workflow.attributes.sharedTransitions || [])) {
    const sharedLabel = sharedTransition.labels?.find((l: Label) => l.language === lang)?.label ||
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
