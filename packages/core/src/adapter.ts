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

  // Add pseudo nodes (using plugin type for consistency)
  if (workflow.attributes.startTransition) {
    const eventWidth = 180;
    const eventHeight = 80;
    nodes.push({
      id: START_NODE_ID,
      type: 'plugin',
      position: diagram.nodePos[START_NODE_ID] ?? { x: 0, y: 0 },
      data: {
        title: 'Start',
        variant: 'start' as const,
        width: eventWidth,
        height: eventHeight,
        // No state or stateType for event nodes
        pluginId: undefined
      },
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
      type: 'plugin',
      position: diagram.nodePos[TIMEOUT_NODE_ID] ?? { x: -120, y: 0 },
      data: {
        title: 'Timeout',
        variant: 'timeout' as const,
        width: eventWidth,
        height: eventHeight,
        // No state or stateType for event nodes
        pluginId: undefined
      },
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

    // All states now use the plugin system
    const stateHints = designHints?.[state.key];

    // Determine plugin ID - either from xProfile or based on state type for backward compatibility
    let pluginId = state.xProfile;
    if (!pluginId || pluginId === 'Default') {
      // Auto-detect plugin for legacy states without xProfile
      switch (state.stateType) {
        case 1: pluginId = 'Initial'; break;
        case 3: pluginId = 'Final'; break;
        case 4: pluginId = 'SubFlow'; break;
        case 2:
        default:
          // Regular intermediate state - ServiceTask should only be detected via xProfile
          pluginId = 'Intermediate';
          break;
      }
    }

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
        pluginId: pluginId
      },
      type: 'plugin', // Always use plugin node type now
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
      id: 't:start:' + st.key,  // Use transition format for proper selection handling
      source: START_NODE_ID,
      target: st.target,
      label: startLabel,
      data: {
        triggerType: st.triggerType,
        isStartTransition: true,  // Mark this as the start transition
        transition: st  // Include full transition data for editing
      }
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
      // Resolve "$self" target to the actual source state
      const resolvedTarget = sharedTransition.target === '$self' ? from : sharedTransition.target;

      edges.push({
        id: `t:shared:${sharedTransition.key}:${from}`,
        source: from,
        target: resolvedTarget,
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
