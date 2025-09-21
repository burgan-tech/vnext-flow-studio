import ELK from 'elkjs/lib/elk.bundled.js';
import type { Diagram, Workflow, State } from './types.js';
import { START_NODE_ID, TIMEOUT_NODE_ID } from './adapter.js';

export interface AutoLayoutOptions {
  startX?: number;
  startY?: number;
  columnSpacing?: number;
  rowSpacing?: number;
}

const DEFAULT_START_X = 220;
const DEFAULT_START_Y = 140;
const DEFAULT_COLUMN_SPACING = 260; // Increased for better horizontal spacing
const DEFAULT_ROW_SPACING = 170;

const ACTIVITY_NODE_SIZE = { width: 260, height: 160 };
const EVENT_NODE_SIZE = { width: 96, height: 96 };
const PORT_SIZE = 8;

const elk = new ELK({
  // Consider wiring a worker when the host environment supports it to avoid blocking the UI thread.
});

const BASE_LAYOUT_OPTIONS: Record<string, string> = {
  'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT',
  'elk.edgeRouting': 'ORTHOGONAL',
  'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
  'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
  'elk.layered.spacing.baseValue': '100', // Base spacing value
  'elk.layered.spacing.edgeNodeBetweenLayers': '50', // Space between edges and nodes
  'elk.layered.compaction.connectedComponents': 'false' // Prevent compaction
};

interface ElkPort {
  id: string;
  width: number;
  height: number;
  properties?: Record<string, string>;
}

interface ElkChild {
  id: string;
  width: number;
  height: number;
  ports?: ElkPort[];
  properties?: Record<string, string>;
}

function createPorts(ownerId: string, state: State | 'event'): ElkPort[] {
  const ports: ElkPort[] = [];
  ports.push({
    id: `${ownerId}.in`,
    width: PORT_SIZE,
    height: PORT_SIZE,
    properties: {
      'org.eclipse.elk.port.side': 'WEST'
    }
  });

  // Final states typically do not have outgoing transitions but we keep the port available in case
  // the workflow is mid-edit and still references an edge.
  if (state === 'event' || (state as State).stateType !== 3) {
    ports.push({
      id: `${ownerId}.out`,
      width: PORT_SIZE,
      height: PORT_SIZE,
      properties: {
        'org.eclipse.elk.port.side': 'EAST'
      }
    });
  }

  return ports;
}

function createChildFromState(state: State): ElkChild {
  const isEventLike = state.stateType === 1 || state.stateType === 3;
  const size = isEventLike ? EVENT_NODE_SIZE : ACTIVITY_NODE_SIZE;

  return {
    id: state.key,
    width: size.width,
    height: size.height,
    ports: createPorts(state.key, state),
    properties: {
      'org.eclipse.elk.portConstraints': 'FIXED_ORDER'
    }
  };
}

function createEventChild(id: string): ElkChild {
  return {
    id,
    width: EVENT_NODE_SIZE.width,
    height: EVENT_NODE_SIZE.height,
    ports: createPorts(id, 'event'),
    properties: {
      'org.eclipse.elk.portConstraints': 'FIXED_ORDER',
      'org.eclipse.elk.portAlignment.default': 'CENTER'
    }
  };
}

export async function autoLayout(
  workflow: Workflow,
  previousDiagram?: Diagram,
  options: AutoLayoutOptions = {}
): Promise<Diagram> {
  const states = workflow.attributes.states;

  if (states.length === 0) {
    return previousDiagram?.collapsed
      ? { nodePos: {}, collapsed: { ...previousDiagram.collapsed } }
      : { nodePos: {} };
  }

  const stateKeys = new Set(states.map((state) => state.key));

  const children: ElkChild[] = states.map(createChildFromState);
  const edges: Array<{
    id: string;
    source: string;
    target: string;
    sourcePort?: string;
    targetPort?: string;
  }> = [];

  for (const state of states) {
    for (const transition of state.transitions ?? []) {
      if (!stateKeys.has(transition.target)) {
        continue;
      }

      edges.push({
        id: `transition:${state.key}:${transition.key}`,
        source: state.key,
        target: transition.target,
        sourcePort: `${state.key}.out`,
        targetPort: `${transition.target}.in`
      });
    }
  }

  for (const sharedTransition of workflow.attributes.sharedTransitions ?? []) {
    if (!stateKeys.has(sharedTransition.target)) {
      continue;
    }

    const targetNode = sharedTransition.target;
    for (const from of sharedTransition.availableIn) {
      if (!stateKeys.has(from)) {
        continue;
      }

      edges.push({
        id: `shared:${sharedTransition.key}:${from}`,
        source: from,
        target: targetNode,
        sourcePort: `${from}.out`,
        targetPort: `${targetNode}.in`
      });
    }
  }

  if (workflow.attributes.startTransition && stateKeys.has(workflow.attributes.startTransition.target)) {
    children.push(createEventChild(START_NODE_ID));
    edges.push({
      id: 'start',
      source: START_NODE_ID,
      target: workflow.attributes.startTransition.target,
      sourcePort: `${START_NODE_ID}.out`,
      targetPort: `${workflow.attributes.startTransition.target}.in`
    });
  }

  if (workflow.attributes.timeout && stateKeys.has(workflow.attributes.timeout.target)) {
    children.push(createEventChild(TIMEOUT_NODE_ID));
    edges.push({
      id: `timeout:${workflow.attributes.timeout.key}`,
      source: TIMEOUT_NODE_ID,
      target: workflow.attributes.timeout.target,
      sourcePort: `${TIMEOUT_NODE_ID}.out`,
      targetPort: `${workflow.attributes.timeout.target}.in`
    });
  }

  const layoutOptions: Record<string, string> = {
    ...BASE_LAYOUT_OPTIONS,
    // Correct ELK property names for layered algorithm spacing
    'elk.layered.spacing.nodeNodeBetweenLayers': String(options.columnSpacing ?? DEFAULT_COLUMN_SPACING),
    'elk.spacing.nodeNode': String(options.rowSpacing ?? DEFAULT_ROW_SPACING),
    // Additional spacing controls for better horizontal layout
    'elk.spacing.edgeNode': '50',
    'elk.spacing.edgeEdge': '30',
    'elk.spacing.portPort': '20',
    'elk.layered.thoroughness': '100' // Maximum thoroughness for better layout
  };

  const graph: any = {
    id: 'root',
    layoutOptions,
    children,
    edges
  };

  const layout = await elk.layout(graph as any);
  const positionedChildren = layout.children ?? [];

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;

  for (const child of positionedChildren) {
    if (!stateKeys.has(child.id)) {
      continue;
    }
    minX = Math.min(minX, child.x ?? 0);
    minY = Math.min(minY, child.y ?? 0);
  }

  if (!Number.isFinite(minX)) {
    minX = 0;
  }
  if (!Number.isFinite(minY)) {
    minY = 0;
  }

  const offsetX = options.startX ?? DEFAULT_START_X;
  const offsetY = options.startY ?? DEFAULT_START_Y;

  const nodePos: Record<string, { x: number; y: number }> = {};

  for (const child of positionedChildren) {
    // Include special nodes (START_NODE_ID and TIMEOUT_NODE_ID) as well as state nodes
    if (!stateKeys.has(child.id) && child.id !== START_NODE_ID && child.id !== TIMEOUT_NODE_ID) {
      continue;
    }

    const x = child.x ?? 0;
    const y = child.y ?? 0;

    nodePos[child.id] = {
      x: offsetX + (x - minX),
      y: offsetY + (y - minY)
    };
  }

  if (previousDiagram?.collapsed) {
    return { nodePos, collapsed: { ...previousDiagram.collapsed } };
  }

  return { nodePos };
}
