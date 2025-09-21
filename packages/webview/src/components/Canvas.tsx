import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  MarkerType,
  XYPosition,
  ReactFlowInstance,
  OnSelectionChangeParams,
  Position
} from '@xyflow/react';
import { StateNode } from './nodes/StateNode';
import { EventNode } from './nodes/EventNode';
import { PropertyPanel, type PropertySelection } from './PropertyPanel';
import { useBridge } from '../hooks/useBridge';
import type {
  Workflow,
  Diagram,
  MsgToWebview,
  State,
  StateType,
  StateSubType,
  TaskDefinition
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
  const [selection, setSelection] = useState<PropertySelection>(null);
  const selectionRef = useRef<PropertySelection>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [taskCatalog, setTaskCatalog] = useState<TaskDefinition[]>([]);

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
      width: 22,
      height: 22,
      color: '#334155'
    },
    style: {
      stroke: '#334155',
      strokeWidth: 2.5
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
          setTaskCatalog(message.tasks);
          break;
        case 'workflow:update':
          setWorkflow(message.workflow);
          setNodes(message.derived.nodes);
          setEdges(decorateEdges(message.derived.edges));
          break;
        case 'diagram:update':
          setDiagram(message.diagram);
          setNodes((prevNodes) =>
            prevNodes.map((node) => {
              const position = message.diagram.nodePos[node.id];
              return position ? { ...node, position } : node;
            })
          );
          if (reactFlowInstance) {
            requestAnimationFrame(() => {
              reactFlowInstance.fitView({ padding: 0.2, duration: 200 });
            });
          }
          break;
        case 'catalog:update':
          setTaskCatalog(message.tasks);
          break;
      }
    });
  }, [onMessage, reactFlowInstance]);

  // Handle node position changes
  const onNodesChange: OnNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));

    // Update diagram when nodes are moved
    const positionChanges = changes.filter(
      (change): change is NodeChange & { type: 'position' } =>
        change.type === 'position' && change.position && change.dragging !== true
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

  const onSelectionChange = useCallback(
    ({ nodes: selectedNodes, edges: selectedEdges }: OnSelectionChangeParams) => {
      // Preserve last selection when ReactFlow reports an empty selection
      // (e.g., when the webview loses focus during file pickers).
      if (selectedNodes.length === 0 && selectedEdges.length === 0) {
        return;
      }
      if (!workflow) {
        setSelection(null);
        selectionRef.current = null;
        return;
      }

      const firstNode = selectedNodes[0];
      if (firstNode && workflow.attributes.states.some((state) => state.key === firstNode.id)) {
        const nextSel: PropertySelection = { kind: 'state', stateKey: firstNode.id };
        setSelection(nextSel);
        selectionRef.current = nextSel;
        return;
      }

      const firstEdge = selectedEdges[0];
      if (firstEdge) {
        const match = /^t:local:([^:]+):(.+)$/.exec(firstEdge.id);
        if (match) {
          const nextSel: PropertySelection = { kind: 'transition', from: match[1], transitionKey: match[2] };
          setSelection(nextSel);
          selectionRef.current = nextSel;
          return;
        }
      }

      setSelection(null);
      selectionRef.current = null;
    },
    [workflow]
  );

  useEffect(() => {
    if (!workflow) {
      setSelection(null);
      selectionRef.current = null;
      return;
    }

    const current = selectionRef.current;
    let next: PropertySelection = null;
    if (current) {
      if (current.kind === 'state') {
        next = workflow.attributes.states.some((state) => state.key === current.stateKey)
          ? current
          : null;
      } else if (current.kind === 'transition') {
        const fromState = workflow.attributes.states.find((state) => state.key === current.from);
        if (fromState && fromState.transitions) {
          next = fromState.transitions.some((t) => t.key === current.transitionKey) ? current : null;
        } else {
          next = null;
        }
      }
    }
    setSelection(next);
    selectionRef.current = next;
  }, [workflow]);

  // Validate connections
  const isValidConnection = useCallback((edge: Edge | Connection) => {
    const connection = 'sourceHandle' in edge ? edge as Connection : edge as Connection;
    if (!connection.source || !connection.target || !workflow) return true;

    // Prevent self-connections
    if (connection.source === connection.target) {
      return false;
    }

    // Find source node
    const sourceNode = nodes.find(n => n.id === connection.source);

    // Prevent connections from final states (stateType === 3)
    if (sourceNode?.data?.stateType === 3) {
      return false;
    }

    // Check for duplicate connections
    const isDuplicate = edges.some(existingEdge =>
      existingEdge.source === connection.source &&
      existingEdge.target === connection.target &&
      existingEdge.id !== (edge as Edge).id // Allow reconnecting existing edges
    );

    if (isDuplicate) {
      return false;
    }

    // Special handling for start node
    if (connection.source === 'start') {
      // Start node can only have one outgoing connection
      const hasExistingStartConnection = edges.some(e => e.source === 'start');
      if (hasExistingStartConnection && !(edge as Edge).id) {
        return false;
      }
    }

    return true;
  }, [nodes, edges, workflow]);

  const handleAddState = useCallback((template: StateTemplate, positionOverride?: XYPosition) => {
    if (!workflow) {
      return;
    }

    const existingKeys = new Set(workflow.attributes.states.map((state) => state.key));

    // Find the next available number for this prefix
    let suffix = 1;
    let stateKey = template.keyPrefix;

    // Always check for the base key first
    if (existingKeys.has(stateKey)) {
      // If base key exists, find next available number
      while (existingKeys.has(`${template.keyPrefix}-${suffix}`)) {
        suffix += 1;
      }
      stateKey = `${template.keyPrefix}-${suffix}`;
    } else {
      // Base key is available, no suffix needed
      suffix = 0;
    }

    // Use the same suffix for the label to keep them consistent
    const labelSuffix = suffix > 0 ? ` ${suffix}` : '';
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

    const stateIndex = workflow.attributes.states.length;
    const column = stateIndex % 4;
    const row = Math.floor(stateIndex / 4);
    const fallbackPosition: XYPosition = {
      x: 200 + column * 220,
      y: 120 + row * 160
    };
    const position = positionOverride ?? fallbackPosition;

    // Send to extension and let it update the state
    postMessage({
      type: 'domain:addState',
      state: newState,
      position
    });
  }, [postMessage, workflow]);

  const handleDragStart = useCallback((event: React.DragEvent, template: StateTemplate) => {
    event.dataTransfer.setData(
      'application/reactflow',
      JSON.stringify({ type: template.type, stateSubType: template.stateSubType ?? null })
    );
    event.dataTransfer.effectAllowed = 'copy';
  }, []);

  const onDragOverCanvas = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const onDropCanvas = useCallback((event: React.DragEvent) => {
    event.preventDefault();

    if (!reactFlowInstance) {
      return;
    }

    const raw = event.dataTransfer.getData('application/reactflow');
    if (!raw) {
      return;
    }

    try {
      const payload = JSON.parse(raw) as { type: StateType; stateSubType: StateSubType | null };
      const template = stateTemplates.find((candidate) =>
        candidate.type === payload.type && (candidate.stateSubType ?? null) === payload.stateSubType
      );

      if (!template) {
        return;
      }

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY
      });

      handleAddState(template, position);
    } catch (error) {
      console.warn('Failed to parse drag payload', error);
    }
  }, [handleAddState, reactFlowInstance, stateTemplates]);

  const handlePaneContextMenu = useCallback((event: MouseEvent | React.MouseEvent) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY });
  }, []);

  const handlePaneClick = useCallback((_event: MouseEvent | React.MouseEvent) => {
    setContextMenu(null);
    setSelection(null);
    selectionRef.current = null;
  }, []);

  const handleAutoLayoutRequest = useCallback(() => {
    postMessage({ type: 'request:autoLayout' });
    setContextMenu(null);
  }, [postMessage]);

  useEffect(() => {
    if (!contextMenu) {
      return undefined;
    }

    const handleDismiss = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('.flow-context-menu')) {
        return;
      }
      setContextMenu(null);
    };

    const handleResize = () => setContextMenu(null);

    window.addEventListener('mousedown', handleDismiss, true);
    window.addEventListener('wheel', handleDismiss, true);
    window.addEventListener('contextmenu', handleDismiss, true);
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('mousedown', handleDismiss, true);
      window.removeEventListener('wheel', handleDismiss, true);
      window.removeEventListener('contextmenu', handleDismiss, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [contextMenu]);

  const getToolbarStateClass = useCallback((type: StateType) => {
    switch (type) {
      case 1:
        return 'state-node--initial';
      case 2:
        return 'state-node--intermediate';
      case 3:
        return 'state-node--final';
      case 4:
        return 'state-node--subflow';
      default:
        return '';
    }
  }, []);

  if (!workflow) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div>Loading workflow...</div>
      </div>
    );
  }

  return (
    <div className="canvas-shell">
      <div className="canvas-shell__flow">
        <div className="flow-canvas" style={{ height: '100vh' }}>
          <div className="flow-canvas__toolbar" role="toolbar" aria-label="Add new state">
            {stateTemplates.map((template) => {
              const stateClass = getToolbarStateClass(template.type);
              const isEvent = template.type === 1 || template.type === 3;
              const isFinal = template.type === 3;
              const isSubflow = template.type === 4;

              return (
                <button
                  key={`${template.type}-${template.stateSubType ?? 'default'}`}
                  type="button"
                  className="flow-canvas__palette-item"
                  onClick={() => handleAddState(template)}
                  onDragStart={(event) => handleDragStart(event, template)}
                  draggable
                  title={template.description}
                >
                  <span
                    className={`flow-canvas__palette-preview ${stateClass} ${
                      isEvent ? 'flow-canvas__palette-preview--event' : 'flow-canvas__palette-preview--activity'
                    }`}
                  >
                    <span className="flow-canvas__palette-shape" aria-hidden="true" />
                    {isFinal && <span className="flow-canvas__palette-ring" aria-hidden="true" />}
                    {isSubflow && <span className="flow-canvas__palette-marker" aria-hidden="true" />}
                  </span>
                  <span className="flow-canvas__palette-label">{template.label}</span>
                </button>
              );
            })}
          </div>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onReconnect={onReconnect}
            onEdgesDelete={onEdgesDelete}
            onSelectionChange={onSelectionChange}
            nodeTypes={nodeTypes}
            isValidConnection={isValidConnection}
            edgesReconnectable
            defaultEdgeOptions={defaultEdgeOptions}
            defaultMarkerColor="#334155"
            fitView
            defaultViewport={{ x: 0, y: 0, zoom: 1 }}
            onInit={setReactFlowInstance}
            onDrop={onDropCanvas}
            onDragOver={onDragOverCanvas}
            onPaneContextMenu={handlePaneContextMenu}
            onPaneClick={handlePaneClick}
          >
            <Background />
            <Controls />
          </ReactFlow>
        </div>
      </div>
      {workflow ? (
        <PropertyPanel
          workflow={workflow}
          selection={selection}
          collapsed={!selection}
          availableTasks={taskCatalog}
        />
      ) : null}
      {contextMenu && (
        <div
          className="flow-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          role="menu"
          onClick={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          <button type="button" className="flow-context-menu__item" onClick={handleAutoLayoutRequest}>
            Auto layout
          </button>
        </div>
      )}
    </div>
  );
}
