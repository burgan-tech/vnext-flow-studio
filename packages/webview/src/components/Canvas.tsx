import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Node,
  Edge,
  Connection,
  EdgeChange,
  NodeChange,
  applyNodeChanges,
  applyEdgeChanges,
  OnConnect,
  OnEdgesDelete,
  OnReconnect,
  OnNodesChange,
  OnEdgesChange,
  MarkerType
} from '@xyflow/react';
import { StateNode } from './nodes/StateNode';
import { EventNode } from './nodes/EventNode';
import { useBridge } from '../hooks/useBridge';
import type {
  Workflow,
  Diagram,
  MsgToWebview,
  State,
  StateType,
  StateSubType
} from '@nextcredit/core';

const nodeTypes = {
  default: StateNode,
  event: EventNode
};

interface StateTemplate {
  type: StateType;
  label: string;
  description: string;
  keyPrefix: string;
  defaultLabel: string;
  stateSubType?: StateSubType;
}

const triggerClassMap: Record<number, string> = {
  0: 'trigger-manual',
  1: 'trigger-auto',
  2: 'trigger-timeout',
  3: 'trigger-event'
};

const decorateEdges = (edges: Edge[]): Edge[] =>
  edges.map((edge) => {
    const triggerType = typeof edge.data?.triggerType === 'number'
      ? edge.data?.triggerType as number
      : undefined;
    const triggerClass = triggerType !== undefined ? triggerClassMap[triggerType] : undefined;
    const dash = edge.style?.strokeDasharray;
    const sharedClass = dash === '4 4' ? 'shared-transition' : undefined;
    const className = [edge.className, triggerClass, sharedClass].filter(Boolean).join(' ');

    return className ? { ...edge, className } : edge;
  });

interface CanvasProps {
  initialWorkflow?: Workflow;
  initialDiagram?: Diagram;
}

export function Canvas({ initialWorkflow, initialDiagram }: CanvasProps) {
  const { postMessage, onMessage } = useBridge();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [workflow, setWorkflow] = useState<Workflow | null>(initialWorkflow || null);
  const [diagram, setDiagram] = useState<Diagram>(initialDiagram || { nodePos: {} });

  const stateTemplates = useMemo<StateTemplate[]>(() => ([
    {
      type: 1,
      label: 'Initial state',
      description: 'Entry point for the flow',
      keyPrefix: 'initial-state',
      defaultLabel: 'Initial State'
    },
    {
      type: 2,
      label: 'Intermediate state',
      description: 'Progress step within the journey',
      keyPrefix: 'state',
      defaultLabel: 'New State'
    },
    {
      type: 3,
      label: 'Final state',
      description: 'Marks a successful completion',
      keyPrefix: 'final-state',
      defaultLabel: 'Final State',
      stateSubType: 1
    },
    {
      type: 4,
      label: 'Subflow state',
      description: 'Delegates to another flow',
      keyPrefix: 'subflow-state',
      defaultLabel: 'Subflow State'
    }
  ]), []);

  const defaultEdgeOptions = useMemo(() => ({
    type: 'smoothstep' as const,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 18,
      height: 18,
      color: '#334155'
    },
    style: {
      stroke: '#334155',
      strokeWidth: 1.6
    }
  }), []);

  // Handle messages from host
  useEffect(() => {
    return onMessage((message: MsgToWebview) => {
      switch (message.type) {
        case 'init':
          setWorkflow(message.workflow);
          setDiagram(message.diagram);
          setNodes(message.derived.nodes);
          setEdges(decorateEdges(message.derived.edges));
          break;
        case 'workflow:update':
          setWorkflow(message.workflow);
          setNodes(message.derived.nodes);
          setEdges(decorateEdges(message.derived.edges));
          break;
        case 'diagram:update':
          setDiagram(message.diagram);
          break;
      }
    });
  }, [onMessage]);

  // Handle node position changes
  const onNodesChange: OnNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));

    // Update diagram when nodes are moved
    const positionChanges = changes.filter(
      (change): change is NodeChange & { type: 'position' } =>
        change.type === 'position' && change.position && !change.dragging
    );

    if (positionChanges.length > 0) {
      const newDiagram = { ...diagram };
      positionChanges.forEach((change) => {
        if (change.position) {
          newDiagram.nodePos[change.id] = change.position;
        }
      });
      setDiagram(newDiagram);
      postMessage({ type: 'persist:diagram', diagram: newDiagram });
    }
  }, [diagram, postMessage]);

  // Handle edge changes
  const onEdgesChange: OnEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, []);

  // Handle new connections
  const onConnect: OnConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return;

    if (connection.source === '__start__') {
      postMessage({
        type: 'domain:setStart',
        target: connection.target
      });
    } else {
      postMessage({
        type: 'domain:addTransition',
        from: connection.source,
        target: connection.target,
        triggerType: 1 // Default to auto trigger
      });
    }
  }, [postMessage]);

  // Handle edge reconnection
  const onReconnect: OnReconnect = useCallback((oldEdge: Edge, newConnection: Connection) => {
    if (!newConnection.source || !newConnection.target) return;

    if (oldEdge.id === 'e:start') {
      postMessage({
        type: 'domain:setStart',
        target: newConnection.target
      });
    } else {
      const match = /^t:local:([^:]+):(.+)$/.exec(oldEdge.id);
      if (match) {
        postMessage({
          type: 'domain:moveTransition',
          oldFrom: match[1],
          tKey: match[2],
          newFrom: newConnection.source,
          newTarget: newConnection.target
        });
      }
    }
  }, [postMessage]);

  // Handle edge deletion
  const onEdgesDelete: OnEdgesDelete = useCallback((edgesToDelete: Edge[]) => {
    edgesToDelete.forEach((edge) => {
      const match = /^t:local:([^:]+):(.+)$/.exec(edge.id);
      if (match) {
        postMessage({
          type: 'domain:removeTransition',
          from: match[1],
          tKey: match[2]
        });
      }
    });
  }, [postMessage]);

  // Prevent connections from final states
  const isValidConnection = useCallback((connection: Connection) => {
    if (!connection.source || !workflow) return true;

    // Find source node
    const sourceNode = nodes.find(n => n.id === connection.source);
    if (sourceNode?.data?.stateType === 3) { // Final state
      return false;
    }

    return true;
  }, [nodes, workflow]);

  const handleAddState = useCallback((template: StateTemplate) => {
    if (!workflow) {
      return;
    }

    const existingKeys = new Set(workflow.attributes.states.map((state) => state.key));

    let stateKey = template.keyPrefix;
    if (existingKeys.has(stateKey)) {
      let suffix = 1;
      while (existingKeys.has(`${template.keyPrefix}-${suffix}`)) {
        suffix += 1;
      }
      stateKey = `${template.keyPrefix}-${suffix}`;
    }

    const sameTypeCount = workflow.attributes.states.filter((state) => state.stateType === template.type).length;
    const labelSuffix = sameTypeCount > 0 ? ` ${sameTypeCount + 1}` : '';
    const defaultLanguage =
      workflow.attributes.states.find((state) => state.labels && state.labels.length > 0)?.labels?.[0]?.language ||
      workflow.attributes.labels?.[0]?.language ||
      'en';

    const stateLabel = `${template.defaultLabel}${labelSuffix}`.trim();

    const newState: State = {
      key: stateKey,
      stateType: template.type,
      versionStrategy: 'Minor',
      labels: [
        {
          label: stateLabel,
          language: defaultLanguage
        }
      ],
      transitions: []
    };

    if (template.stateSubType) {
      newState.stateSubType = template.stateSubType;
    }

    const newWorkflow: Workflow = {
      ...workflow,
      attributes: {
        ...workflow.attributes,
        states: [...workflow.attributes.states, newState]
      }
    };
    setWorkflow(newWorkflow);

    const stateIndex = workflow.attributes.states.length;
    const column = stateIndex % 4;
    const row = Math.floor(stateIndex / 4);
    const position = {
      x: 200 + column * 220,
      y: 120 + row * 160
    };

    const newDiagram = {
      ...diagram,
      nodePos: {
        ...diagram.nodePos,
        [stateKey]: position
      }
    };
    setDiagram(newDiagram);

    const newNode: Node = {
      id: stateKey,
      position,
      data: {
        title: stateLabel,
        state: newState,
        stateType: newState.stateType,
        stateSubType: newState.stateSubType
      },
      type: 'default',
      sourcePosition: 'right',
      targetPosition: 'left',
      selected: true
    };

    setNodes((prevNodes) => [
      ...prevNodes.map((node) => ({ ...node, selected: false })),
      newNode
    ]);

    postMessage({
      type: 'domain:addState',
      state: newState,
      position
    });
  }, [diagram, postMessage, workflow]);

  if (!workflow) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div>Loading workflow...</div>
      </div>
    );
  }

  return (
    <div className="flow-canvas" style={{ height: '100vh' }}>
      <div className="flow-canvas__toolbar" role="toolbar" aria-label="Add new state">
        <div className="flow-canvas__toolbar-heading">New state</div>
        <div className="flow-canvas__toolbar-buttons">
          {stateTemplates.map((template) => (
            <button
              key={`${template.type}-${template.stateSubType ?? 'default'}`}
              type="button"
              className="flow-canvas__toolbar-button"
              onClick={() => handleAddState(template)}
            >
              <span className="flow-canvas__toolbar-button-label">{template.label}</span>
              <span className="flow-canvas__toolbar-button-desc">{template.description}</span>
            </button>
          ))}
        </div>
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onReconnect={onReconnect}
        onEdgesDelete={onEdgesDelete}
        nodeTypes={nodeTypes}
        isValidConnection={isValidConnection}
        edgesReconnectable
        defaultEdgeOptions={defaultEdgeOptions}
        defaultMarkerColor="#334155"
        fitView
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
