import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Panel,
  Node,
  Edge,
  Connection,
  EdgeChange,
  NodeChange,
  applyNodeChanges,
  applyEdgeChanges,
  OnConnect,
  OnEdgesDelete,
  OnNodesDelete,
  OnReconnect,
  OnNodesChange,
  OnEdgesChange,
  MarkerType,
  XYPosition,
  ReactFlowInstance,
  OnSelectionChangeParams,
  getNodesBounds
} from '@xyflow/react';
import { toSvg } from 'html-to-image';
import { Boxes, Rocket, BookOpen } from 'lucide-react';
import { PluggableStateNode } from './nodes/PluggableStateNode';
import { PropertyPanel, type PropertySelection } from './PropertyPanel';
import { LayerControlButton } from './LayerControlButton';
import { DocumentationViewer } from './DocumentationViewer';
import { ToolbarIconButton } from './ToolbarIconButton';
import { FlyoutPanel } from './FlyoutPanel';
import { useBridge } from '../hooks/useBridge';
import { FloatingEdge } from '../edges/FloatingEdge';
import type {
  Workflow,
  Diagram,
  MsgToWebview,
  State,
  StateType,
  StateSubType,
  TaskComponentDefinition,
  DesignHints,
  StatePlugin,
  StateVariant
} from '@amorphie-flow-studio/core';

const nodeTypes = {
  default: PluggableStateNode,
  event: PluggableStateNode,
  plugin: PluggableStateNode
};

const edgeTypes = {
  floating: FloatingEdge
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
    const isShared = dash === '4 4';
    const className = [edge.className, triggerClass, sharedClass].filter(Boolean).join(' ');

    // Force our floating edge renderer for consistent visuals
    const type = 'floating' as const;

    // Add edge type to data for filtering
    return className ? { ...edge, className, type, data: { ...edge.data, isShared } } : { ...edge, type, data: { ...edge.data, isShared } };
  });

interface CanvasProps {
  initialWorkflow?: Workflow;
  initialDiagram?: Diagram;
}

export function Canvas({ initialWorkflow, initialDiagram }: CanvasProps) {
  const { postMessage, onMessage } = useBridge();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [allEdges, setAllEdges] = useState<Edge[]>([]); // Store all edges, unfiltered
  const [edges, setEdges] = useState<Edge[]>([]); // Displayed edges after filtering
  const [workflow, setWorkflow] = useState<Workflow | null>(initialWorkflow || null);
  const [diagram, setDiagram] = useState<Diagram>(initialDiagram || { nodePos: {} });
  const [selection, setSelection] = useState<PropertySelection>(null);
  const selectionRef = useRef<PropertySelection>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId?: string; edgeId?: string } | null>(null);
  const [taskCatalog, setTaskCatalog] = useState<TaskComponentDefinition[]>([]);
  const [catalogs, setCatalogs] = useState<Record<string, any[]>>({});
  const [plugins, setPlugins] = useState<StatePlugin[]>([]);
  const [pluginVariants, setPluginVariants] = useState<Map<string, StateVariant[]>>(new Map());
  const [_designHints, setDesignHints] = useState<Map<string, DesignHints>>(new Map());
  const pendingMeasuredAutoLayout = useRef(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showDocumentation, setShowDocumentation] = useState(false);
  const [activePanel, setActivePanel] = useState<'states' | 'deploy' | null>(null);
  const [cliStatus, setCliStatus] = useState<{ installed: boolean; configured: boolean; version?: string; apiReachable?: boolean; dbReachable?: boolean } | null>(null);

  // Layer visibility state - use diagram settings if available, otherwise localStorage
  const [showRegularTransitions, setShowRegularTransitions] = useState(() => {
    if (initialDiagram?.layerVisibility?.regularTransitions !== undefined) {
      return initialDiagram.layerVisibility.regularTransitions;
    }
    const stored = localStorage.getItem('flow-layer-regular');
    return stored === null ? true : stored === 'true';
  });
  const [showSharedTransitions, setShowSharedTransitions] = useState(() => {
    if (initialDiagram?.layerVisibility?.sharedTransitions !== undefined) {
      return initialDiagram.layerVisibility.sharedTransitions;
    }
    const stored = localStorage.getItem('flow-layer-shared');
    return stored === null ? true : stored === 'true';
  });

  // Filter edges based on layer visibility
  const filterEdgesByVisibility = useCallback((edges: Edge[]) => {
    return edges.filter((edge) => {
      const isShared = edge.data?.isShared === true;
      if (isShared) {
        return showSharedTransitions;
      } else {
        return showRegularTransitions;
      }
    });
  }, [showRegularTransitions, showSharedTransitions]);

  // Toggle handlers
  const toggleRegularTransitions = useCallback(() => {
    const newValue = !showRegularTransitions;
    setShowRegularTransitions(newValue);
    localStorage.setItem('flow-layer-regular', String(newValue));
  }, [showRegularTransitions]);

  const toggleSharedTransitions = useCallback(() => {
    const newValue = !showSharedTransitions;
    setShowSharedTransitions(newValue);
    localStorage.setItem('flow-layer-shared', String(newValue));
  }, [showSharedTransitions]);

  // Export documentation with diagram
  const handleExportWithDiagram = useCallback(async (documentation: string, filename: string) => {
    try {
      // Use reactFlowInstance instead of useReactFlow hook
      if (!reactFlowInstance) {
        throw new Error('React Flow instance not ready');
      }

      const flowNodes = reactFlowInstance.getNodes();

      if (flowNodes.length === 0) {
        throw new Error('No nodes to export');
      }

      const nodesBounds = getNodesBounds(flowNodes);

      // Add padding around the content
      const padding = 50;
      const imageWidth = nodesBounds.width + padding * 2;
      const imageHeight = nodesBounds.height + padding * 2;

      // Get the React Flow wrapper element
      const canvasElement = document.querySelector('.react-flow');
      if (!canvasElement) {
        throw new Error('Canvas element not found');
      }

      // Temporarily set the viewport to fit the content
      const currentViewport = reactFlowInstance.getViewport();
      await reactFlowInstance.setViewport({
        x: -nodesBounds.x + padding,
        y: -nodesBounds.y + padding,
        zoom: 1
      });

      // Wait for the viewport to update
      await new Promise(resolve => setTimeout(resolve, 100));

      // Generate SVG with white background
      const svgDataUrl = await toSvg(canvasElement as HTMLElement, {
        backgroundColor: '#ffffff',
        width: imageWidth,
        height: imageHeight,
        pixelRatio: 2,
        filter: (node) => {
          // Exclude controls and other UI elements
          if (node.classList) {
            return !node.classList.contains('react-flow__controls') &&
                   !node.classList.contains('react-flow__panel') &&
                   !node.classList.contains('flow-canvas__toolbar');
          }
          return true;
        }
      });

      // Restore the original viewport
      await reactFlowInstance.setViewport(currentViewport);

      // Extract SVG content from data URL
      let svgContent: string;
      if (svgDataUrl.includes('base64,')) {
        // Base64-encoded SVG
        const base64Data = svgDataUrl.split(',')[1];
        svgContent = atob(base64Data);
      } else if (svgDataUrl.includes('charset=utf-8,')) {
        // URL-encoded SVG
        const encodedSvg = svgDataUrl.split(',')[1];
        svgContent = decodeURIComponent(encodedSvg);
      } else {
        throw new Error('Unexpected SVG data URL format');
      }

      // Add necessary CSS styles to the SVG to ensure edges are visible
      const edgeStyles = `<style>
.react-flow__edge-path {
  stroke: #94a3b8;
  stroke-width: 2;
  fill: none;
}
.react-flow__edge.trigger-auto .react-flow__edge-path {
  stroke: #3b82f6;
}
.react-flow__edge.trigger-manual .react-flow__edge-path {
  stroke: #94a3b8;
}
.react-flow__edge.trigger-timeout .react-flow__edge-path {
  stroke: #f59e0b;
}
.react-flow__edge.trigger-event .react-flow__edge-path {
  stroke: #8b5cf6;
}
.react-flow__edge.shared-transition .react-flow__edge-path {
  stroke-dasharray: 4 4;
}
.react-flow__edge .react-flow__edge-text {
  font-size: 12px;
  fill: #1e293b;
}
</style>`;

      // Inject styles into SVG (insert after the opening <svg> tag)
      svgContent = svgContent.replace(/(<svg[^>]*>)/, `$1${edgeStyles}`);

      // Create SVG filename (replace .md with .svg)
      const svgFilename = filename.replace(/\.md$/, '.svg');

      // Reference SVG as image in markdown
      const documentationWithImage = `${documentation.split('\n')[0]}

![Workflow Diagram](./${svgFilename})

---

${documentation.split('\n').slice(1).join('\n')}`;

      // Send export request with both markdown and SVG
      postMessage({
        type: 'request:exportDocumentation',
        content: documentationWithImage,
        filename,
        svgContent,
        svgFilename
      });
    } catch (error) {
      console.error('Failed to export with diagram:', error);
      // Fallback to export without image
      postMessage({
        type: 'request:exportDocumentation',
        content: documentation,
        filename
      });
    }
  }, [reactFlowInstance, postMessage]);

  // Apply edge filtering whenever visibility settings or allEdges change
  useEffect(() => {
    setEdges(filterEdgesByVisibility(allEdges));
  }, [allEdges, filterEdgesByVisibility]);

  // Update diagram with layer visibility settings when they change
  useEffect(() => {
    setDiagram(prev => ({
      ...prev,
      layerVisibility: {
        regularTransitions: showRegularTransitions,
        sharedTransitions: showSharedTransitions
      }
    }));
  }, [showRegularTransitions, showSharedTransitions]);

  // Keyboard shortcuts for layer toggling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Ctrl+Shift key combination
      if (e.ctrlKey && e.shiftKey) {
        switch (e.key.toUpperCase()) {
          case 'R':
            e.preventDefault();
            toggleRegularTransitions();
            break;
          case 'S':
            e.preventDefault();
            toggleSharedTransitions();
            break;
          case 'A':
            e.preventDefault();
            // Show all transitions
            if (!showRegularTransitions || !showSharedTransitions) {
              setShowRegularTransitions(true);
              setShowSharedTransitions(true);
              localStorage.setItem('flow-layer-regular', 'true');
              localStorage.setItem('flow-layer-shared', 'true');
            } else {
              // If all are visible, hide all (toggle behavior)
              setShowRegularTransitions(false);
              setShowSharedTransitions(false);
              localStorage.setItem('flow-layer-regular', 'false');
              localStorage.setItem('flow-layer-shared', 'false');
            }
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [toggleRegularTransitions, toggleSharedTransitions, showRegularTransitions, showSharedTransitions]);

  // Legacy state templates are no longer used - all states come from plugins
  const stateTemplates = useMemo<StateTemplate[]>(() => [], []);

  const defaultEdgeOptions = useMemo(() => ({
    type: 'floating' as const,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 18,
      height: 18,
      color: '#64748b'
    },
    style: {
      strokeWidth: 2.5
    },
    labelStyle: {
      fill: '#0f172a',
      fontSize: 13,
      fontWeight: 700
    },
    labelBgStyle: {
      fill: '#ffffff',
      fillOpacity: 1,
      stroke: '#e2e8f0',
      strokeWidth: 1
    },
    labelBgPadding: [10, 8] as [number, number],
    labelBgBorderRadius: 6,
    interactionWidth: 20 // Larger area for edge interaction
  }), []);

  // Send ready signal to extension when component mounts
  useEffect(() => {
    console.log('[Canvas] Sending ready signal to extension');
    postMessage({ type: 'ready' });
  }, [postMessage]);

  // Handle messages from host
  useEffect(() => {
    return onMessage((message: MsgToWebview) => {
      switch (message.type) {
        case 'init':
          setWorkflow(message.workflow);
          setDiagram(message.diagram);
          setNodes(message.derived.nodes);
          setAllEdges(decorateEdges(message.derived.edges));
          setTaskCatalog(message.tasks);
          // Update layer visibility from diagram if available
          if (message.diagram.layerVisibility) {
            if (message.diagram.layerVisibility.regularTransitions !== undefined) {
              setShowRegularTransitions(message.diagram.layerVisibility.regularTransitions);
            }
            if (message.diagram.layerVisibility.sharedTransitions !== undefined) {
              setShowSharedTransitions(message.diagram.layerVisibility.sharedTransitions);
            }
          }
          if (message.catalogs) {
            setCatalogs(message.catalogs);
          }
          if (message.plugins) {
            setPlugins(message.plugins);
          }
          if (message.pluginVariants) {
            const variantsMap = new Map<string, StateVariant[]>();
            Object.entries(message.pluginVariants).forEach(([pluginId, variants]) => {
              variantsMap.set(pluginId, variants);
            });
            setPluginVariants(variantsMap);
          }
          if (message.designHints) {
            const hintsMap = new Map<string, DesignHints>();
            Object.entries(message.designHints).forEach(([stateKey, hints]) => {
              hintsMap.set(stateKey, hints as DesignHints);
            });
            setDesignHints(hintsMap);
          }
          // If the diagram was generated on the host (no saved diagram),
          // trigger a measured-size auto layout once the canvas mounts.
          if ((message as any).generatedDiagram) {
            pendingMeasuredAutoLayout.current = true;
          }
          break;
        case 'workflow:update':
          setWorkflow(message.workflow);
          setNodes(message.derived.nodes);
          setAllEdges(decorateEdges(message.derived.edges));
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
          if (message.catalogs) {
            setCatalogs(message.catalogs);
          }
          break;
        case 'select:node': {
          // Find the node and select it
          const nodeToSelect = nodes.find(n => n.id === message.nodeId);
          if (nodeToSelect) {
            // Clear existing selection
            setNodes(nds => nds.map(n => ({ ...n, selected: n.id === message.nodeId })));
            setAllEdges(eds => eds.map(e => ({ ...e, selected: false })));

            // Set the selection for property panel
            if (workflow) {
              const state = workflow.attributes.states.find(s => s.key === message.nodeId);
              if (state) {
                setSelection({ kind: 'state', stateKey: message.nodeId });
              }
            }

            // Focus on the selected node
            if (reactFlowInstance) {
              reactFlowInstance.setCenter(nodeToSelect.position.x, nodeToSelect.position.y, {
                duration: 500,
                zoom: 1.5
              });
            }
          }
          break;
        }
        case 'deploy:status':
          console.log('[Canvas] Received deploy:status:', message);
          setCliStatus({
            installed: message.installed,
            configured: message.configured,
            version: message.version,
            projectRoot: message.projectRoot,
            apiReachable: message.apiReachable,
            dbReachable: message.dbReachable
          });
          break;
        case 'deploy:result':
          // Result is handled via notifications from the extension
          // Just update status after deployment
          if (message.success) {
            postMessage({ type: 'deploy:checkStatus' });
          }
          break;
      }
    });
  }, [onMessage, reactFlowInstance, nodes, workflow, postMessage]);

  // Check CLI status when deploy panel is opened
  useEffect(() => {
    if (activePanel === 'deploy') {
      postMessage({ type: 'deploy:checkStatus' });
    }
  }, [activePanel, postMessage]);

  // (moved) measured auto layout effect declared after handleAutoLayoutRequest

  // Handle node position changes
  const onNodesChange: OnNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));

    // Update diagram when nodes are moved
    const positionChanges = changes.filter(
      (change): change is NodeChange & { type: 'position'; position: XYPosition; dragging?: boolean } =>
        change.type === 'position' && !!change.position && change.dragging !== true
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
    setAllEdges((eds) => applyEdgeChanges(changes, eds));
  }, []);

  // Handle connection start
  const onConnectStart = useCallback(() => {
    setIsConnecting(true);
  }, []);

  // Handle connection end
  const onConnectEnd = useCallback(() => {
    setIsConnecting(false);
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
    setIsConnecting(false);
  }, [postMessage]);

  // Validate connections
  const isValidConnection = useCallback((edge: Edge | Connection) => {
    const connection = 'sourceHandle' in edge ? edge as Connection : edge as Connection;
    if (!connection.source || !connection.target || !workflow) return true;

    // Prevent connections TO the start node (start node can only have outgoing connections)
    if (connection.target === '__start__') {
      return false;
    }

    // Allow self-connections (self-loops)
    // if (connection.source === connection.target) {
    //   return false;
    // }

    // Find source node
    const sourceNode = nodes.find(n => n.id === connection.source);

    // Prevent connections from final states (stateType === 3)
    if (sourceNode?.data?.stateType === 3) {
      return false;
    }

    // Check for duplicate connections
    // For self-loops, allow multiple (they can have different conditions/rules)
    // For regular edges, prevent exact duplicates
    const isSelfLoop = connection.source === connection.target;

    if (!isSelfLoop) {
      const isDuplicate = edges.some(existingEdge =>
        existingEdge.source === connection.source &&
        existingEdge.target === connection.target &&
        existingEdge.id !== (edge as Edge)?.id // Allow reconnecting existing edges
      );

      if (isDuplicate) {
        return false;
      }
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

  // Handle edge reconnection
  const onReconnect: OnReconnect = useCallback((oldEdge: Edge, newConnection: Connection) => {
    if (!newConnection.source || !newConnection.target) return;

    // Validate the new connection
    if (!isValidConnection(newConnection)) {
      return false; // Prevent invalid reconnection
    }

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
  }, [postMessage, isValidConnection]);

  // Handle edge deletion
  const onEdgesDelete: OnEdgesDelete = useCallback((edgesToDelete: Edge[]) => {
    edgesToDelete.forEach((edge) => {
      // Handle local transition deletion
      const localMatch = /^t:local:([^:]+):(.+)$/.exec(edge.id);
      if (localMatch) {
        postMessage({
          type: 'domain:removeTransition',
          from: localMatch[1],
          tKey: localMatch[2]
        });
        return;
      }

      // Handle shared transition edge deletion
      const sharedMatch = /^t:shared:([^:]+):(.+)$/.exec(edge.id);
      if (sharedMatch) {
        const [, transitionKey, stateKey] = sharedMatch;
        // Always send the message - let the backend handle the logic
        postMessage({
          type: 'domain:removeFromSharedTransition',
          transitionKey,
          stateKey
        });
      }
    });
  }, [postMessage]);

  // Handle node deletion
  const onNodesDelete: OnNodesDelete = useCallback((nodesToDelete: Node[]) => {
    nodesToDelete.forEach((node) => {
      // Don't delete special nodes
      if (node.id === '__start__' || node.id === '__timeout__') {
        return;
      }

      postMessage({
        type: 'domain:removeState',
        stateKey: node.id
      });
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
        // Check for start transition
        const startMatch = /^t:start:(.+)$/.exec(firstEdge.id);
        if (startMatch) {
          const nextSel: PropertySelection = { kind: 'startTransition', transitionKey: startMatch[1] };
          setSelection(nextSel);
          selectionRef.current = nextSel;
          return;
        }

        // Check for local transition
        const localMatch = /^t:local:([^:]+):(.+)$/.exec(firstEdge.id);
        if (localMatch) {
          const nextSel: PropertySelection = { kind: 'transition', from: localMatch[1], transitionKey: localMatch[2] };
          setSelection(nextSel);
          selectionRef.current = nextSel;
          return;
        }

        // Check for shared transition
        const sharedMatch = /^t:shared:([^:]+):/.exec(firstEdge.id);
        if (sharedMatch) {
          const nextSel: PropertySelection = { kind: 'sharedTransition', transitionKey: sharedMatch[1] };
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

  const handleAddPluginState = useCallback((
    plugin: any,
    variant?: StateVariant,
    positionOverride?: XYPosition
  ) => {
    if (!workflow) {
      return;
    }

    const existingKeys = new Set(workflow.attributes.states.map((state) => state.key));

    // Find the next available number for this prefix
    let suffix = 1;
    let stateKey = plugin.keyPrefix;

    if (existingKeys.has(stateKey)) {
      while (existingKeys.has(`${plugin.keyPrefix}-${suffix}`)) {
        suffix += 1;
      }
      stateKey = `${plugin.keyPrefix}-${suffix}`;
    } else {
      suffix = 0;
    }

    const labelSuffix = suffix > 0 ? ` ${suffix}` : '';
    const defaultLanguage =
      workflow.attributes.states.find((state) => state.labels && state.labels.length > 0)?.labels?.[0]?.language ||
      workflow.attributes.labels?.[0]?.language ||
      'en';

    const stateLabel = variant ? variant.label : `${plugin.defaultLabel}${labelSuffix}`.trim();

    // Create state based on variant or plugin
    let newState: State;
    if (variant?.stateTemplate) {
      // Use variant template (should already have xProfile set)
      // Ensure all required properties are defined
      newState = {
        key: stateKey, // Default key, will be overridden below
        stateType: 2 as StateType, // Default to Intermediate if not provided
        labels: [],
        versionStrategy: 'Major' as const, // Default to Major if not provided
        ...variant.stateTemplate
      };
    } else {
      // Use the plugin's createState method if available, otherwise create manually
      if (plugin.createState && typeof plugin.createState === 'function') {
        // Use plugin's createState method
        newState = plugin.createState();
        // Override the key to ensure uniqueness
        newState.key = stateKey;
        // Set xProfile to plugin ID to ensure proper plugin detection
        newState.xProfile = plugin.id;
      } else {
        // Fallback for plugins without createState
        newState = {
          key: stateKey,
          stateType: plugin.stateType,
          xProfile: plugin.id, // Set xProfile to plugin ID
          versionStrategy: 'Minor',
          labels: [
            {
              label: stateLabel,
              language: defaultLanguage
            }
          ],
          transitions: []
        };

        // Add stateSubType for Final states
        if (plugin.id === 'Final' && plugin.stateType === 3) {
          newState.stateSubType = 1; // Default to Success
        }
      }
    }

    // Override key to ensure uniqueness and update labels
    newState.key = stateKey;
    if (newState.labels && newState.labels.length > 0) {
      newState.labels[0].label = stateLabel;
      newState.labels[0].language = defaultLanguage;
    } else {
      // Add labels if missing
      newState.labels = [
        {
          label: stateLabel,
          language: defaultLanguage
        }
      ];
    }

    // Create design hints for this plugin state
    const hints: DesignHints = {
      kind: plugin.id,
      terminals: plugin.terminals.map((t: any) => ({
        id: t.id,
        role: t.id,
        visible: t.required || false
      })),
      terminalBindings: {},
      variantId: variant?.id
    };

    const stateIndex = workflow.attributes.states.length;
    const column = stateIndex % 4;
    const row = Math.floor(stateIndex / 4);
    const fallbackPosition: XYPosition = {
      x: 200 + column * 220,
      y: 120 + row * 160
    };
    const position = positionOverride ?? fallbackPosition;

    // Send to extension with plugin info
    postMessage({
      type: 'domain:addState',
      state: newState,
      position,
      pluginId: plugin.id,
      hints
    });
  }, [postMessage, workflow]);

  const onDragOverCanvas = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const onDropCanvas = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    console.log('🔍 Drop event triggered');

    if (!reactFlowInstance) {
      console.log('❌ No reactFlowInstance available');
      return;
    }

    const raw = event.dataTransfer.getData('application/reactflow');
    console.log('🔍 Raw drag data:', raw);
    if (!raw) {
      console.log('❌ No drag data available');
      return;
    }

    try {
      const payload = JSON.parse(raw) as any;
      console.log('🔍 Parsed payload:', payload);

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY
      });

      // Check if it's a plugin drop
      if (payload.type === 'plugin') {
        const plugin = plugins.find(p => p.id === payload.pluginId);
        if (plugin) {
          let variant = undefined;
          if (payload.variantId) {
            const variants = pluginVariants.get(plugin.id);
            variant = variants?.find((v: any) => v.id === payload.variantId);
          }
          handleAddPluginState(plugin, variant, position);
        }
        return;
      }

      // Handle regular state template drop
      const template = stateTemplates.find((candidate) =>
        candidate.type === payload.type && (candidate.stateSubType ?? null) === payload.stateSubType
      );

      if (!template) {
        console.log('❌ No matching template found');
        return;
      }

      console.log('✅ Template found:', template.label);
      console.log('✅ Position calculated:', position);
      handleAddState(template, position);
    } catch (error) {
      console.warn('Failed to parse drag payload', error);
    }
  }, [handleAddState, handleAddPluginState, reactFlowInstance, stateTemplates, plugins, pluginVariants]);

  const handlePaneContextMenu = useCallback((event: MouseEvent | React.MouseEvent) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY });
  }, []);

  const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    // Only show context menu for state nodes, not for start/timeout nodes
    if (node.id !== '__start__' && node.id !== '__timeout__') {
      setContextMenu({ x: event.clientX, y: event.clientY, nodeId: node.id });
    }
  }, []);

  const handlePaneClick = useCallback((_event: MouseEvent | React.MouseEvent) => {
    setContextMenu(null);
    setSelection(null);
    selectionRef.current = null;
  }, []);

  const handleEdgeContextMenu = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.preventDefault();
    // Show context menu for local and shared transitions (not start/timeout)
    if (edge.id.startsWith('t:local:') || edge.id.startsWith('t:shared:')) {
      setContextMenu({ x: event.clientX, y: event.clientY, edgeId: edge.id });
    }
  }, []);

  const handleMakeTransitionShared = useCallback((edgeId: string) => {
    // Parse the edge ID to get state and transition keys
    // Format: t:local:{stateKey}:{transitionKey}
    const match = edgeId.match(/^t:local:([^:]+):(.+)$/);
    if (match) {
      const [, from, transitionKey] = match;
      postMessage({
        type: 'domain:makeTransitionShared',
        from,
        transitionKey
      });
    }
    setContextMenu(null);
  }, [postMessage]);

  const handleConvertToRegular = useCallback((edgeId: string) => {
    // Parse the shared edge ID to get transition key and state
    // Format: t:shared:{transitionKey}:{stateKey}
    const match = edgeId.match(/^t:shared:([^:]+):(.+)$/);
    if (match) {
      const [, transitionKey, targetState] = match;
      postMessage({
        type: 'domain:convertSharedToRegular',
        transitionKey,
        targetState
      });
    }
    setContextMenu(null);
  }, [postMessage]);

  const handleAutoLayoutRequest = useCallback(() => {
    // Collect measured node sizes from React Flow v12
    const sizeMap: Record<string, { width: number; height: number }> = {};
    for (const n of nodes) {
      // All nodes now use the same rectangular size - natural sizing with minimum
      const fallback = { width: 180, height: 80 };
      const width = n.measured?.width ?? fallback.width;
      const height = n.measured?.height ?? fallback.height;
      if (Number.isFinite(width) && Number.isFinite(height)) {
        sizeMap[n.id] = { width, height };
      }
    }

    postMessage({ type: 'request:autoLayout', nodeSizes: sizeMap });
    setContextMenu(null);
  }, [postMessage, nodes]);

  // After mount and once nodes are measured, run a one-time measured auto layout
  useEffect(() => {
    if (pendingMeasuredAutoLayout.current && reactFlowInstance && nodes.length > 0) {
      // Prevent duplicate triggers
      pendingMeasuredAutoLayout.current = false;
      // Defer to ensure measurements are populated by React Flow
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          handleAutoLayoutRequest();
        });
      });
    }
  }, [reactFlowInstance, nodes, handleAutoLayoutRequest]);

  const handleSetStartNode = useCallback((nodeId: string) => {
    postMessage({ type: 'domain:setStart', target: nodeId });
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
          {/* Vertical Icon Bar */}
          <div className="toolbar-icon-bar" role="toolbar" aria-label="Toolbar">
            <ToolbarIconButton
              icon={Boxes}
              label="States"
              isActive={activePanel === 'states'}
              onClick={() => setActivePanel(activePanel === 'states' ? null : 'states')}
            />
            <ToolbarIconButton
              icon={Rocket}
              label="Deploy & Run"
              isActive={activePanel === 'deploy'}
              onClick={() => setActivePanel(activePanel === 'deploy' ? null : 'deploy')}
            />
            <ToolbarIconButton
              icon={BookOpen}
              label="Documentation"
              onClick={() => setShowDocumentation(true)}
            />
          </div>

          {/* Flyout Panel for States */}
          <FlyoutPanel
            title="States"
            isOpen={activePanel === 'states'}
            onClose={() => setActivePanel(null)}
          >
            <div className="flyout-panel__palette">
              {plugins.map((plugin) => {
                const pluginClassMap: Record<string, string> = {
                  'Initial': 'state-node--initial',
                  'Intermediate': 'state-node--intermediate',
                  'Final': 'state-node--final',
                  'SubFlow': 'state-node--subflow',
                  'ServiceTask': 'state-node--service-task'
                };
                const pluginStateClass = pluginClassMap[plugin.id] || 'state-node--intermediate';
                const hasVariants = pluginVariants.get(plugin.id) && pluginVariants.get(plugin.id)!.length > 0;

                if (hasVariants) {
                  return (
                    <div key={plugin.id} className="flow-canvas__plugin-group">
                      <button
                        type="button"
                        className="flow-canvas__palette-item"
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData(
                            'application/reactflow',
                            JSON.stringify({
                              type: 'plugin',
                              pluginId: plugin.id
                            })
                          );
                          e.dataTransfer.effectAllowed = 'copy';
                        }}
                        onClick={() => handleAddPluginState(plugin)}
                        title={plugin.description}
                      >
                        <span className={`flow-canvas__palette-preview ${pluginStateClass}`}>
                          <span className="flow-canvas__palette-icon-column">
                            <span className="flow-canvas__palette-type-icon">{plugin.icon || '⚙'}</span>
                          </span>
                          <span className="flow-canvas__palette-content">
                            {plugin.label}
                          </span>
                        </span>
                      </button>
                      <div className="flow-canvas__variants">
                        {pluginVariants.get(plugin.id)!.map((variant: any) => (
                          <button
                            key={variant.id}
                            type="button"
                            className="flow-canvas__variant-item"
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData(
                                'application/reactflow',
                                JSON.stringify({
                                  type: 'plugin',
                                  pluginId: plugin.id,
                                  variantId: variant.id
                                })
                              );
                              e.dataTransfer.effectAllowed = 'copy';
                            }}
                            onClick={() => handleAddPluginState(plugin, variant)}
                            title={variant.description}
                          >
                            <span className="flow-canvas__variant-icon">{'⚙'}</span>
                            <span className="flow-canvas__variant-label">{variant.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                } else {
                  return (
                    <button
                      key={plugin.id}
                      type="button"
                      className="flow-canvas__palette-item"
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData(
                          'application/reactflow',
                          JSON.stringify({
                            type: 'plugin',
                            pluginId: plugin.id
                          })
                        );
                        e.dataTransfer.effectAllowed = 'copy';
                      }}
                      onClick={() => handleAddPluginState(plugin)}
                      title={plugin.description}
                    >
                      <span className={`flow-canvas__palette-preview ${pluginStateClass}`}>
                        <span className="flow-canvas__palette-icon-column">
                          <span className="flow-canvas__palette-type-icon">{plugin.icon || '⚙'}</span>
                        </span>
                        <span className="flow-canvas__palette-content">
                          {plugin.label}
                        </span>
                      </span>
                    </button>
                  );
                }
              })}
            </div>
          </FlyoutPanel>

          {/* Flyout Panel for Deploy */}
          <FlyoutPanel
            title="Deploy & Run"
            isOpen={activePanel === 'deploy'}
            onClose={() => setActivePanel(null)}
          >
            <div className="flyout-panel__deploy">
              {!cliStatus ? (
                <div className="deploy-loading">
                  <p>Checking CLI status...</p>
                </div>
              ) : !cliStatus.installed ? (
                <div className="deploy-setup">
                  <div className="deploy-setup__header">
                    <h3>CLI Not Installed</h3>
                    <p>The vnext-workflow-cli is required to deploy workflows.</p>
                  </div>
                  <button
                    type="button"
                    className="deploy-btn deploy-btn--primary"
                    onClick={() => postMessage({ type: 'deploy:install' })}
                  >
                    Install CLI Now
                  </button>
                  <div className="deploy-info">
                    <p className="deploy-info__note">
                      This will run: <code>npm install -g @burgan-tech/vnext-workflow-cli</code>
                    </p>
                  </div>
                </div>
              ) : !cliStatus.configured ? (
                <div className="deploy-setup">
                  <div className="deploy-setup__header">
                    <h3>CLI Not Configured</h3>
                    <p>The CLI needs to be configured with your project root.</p>
                  </div>
                  <button
                    type="button"
                    className="deploy-btn deploy-btn--primary"
                    onClick={() => postMessage({ type: 'deploy:configure' })}
                  >
                    Configure CLI Now
                  </button>
                  <div className="deploy-info">
                    <p className="deploy-info__note">
                      ℹ️ Version: <code>{cliStatus.version || 'Unknown'}</code>
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="deploy-status">
                    <div className="deploy-status__item">
                      <span className="deploy-status__label">CLI:</span>
                      <span className="deploy-status__value deploy-status__value--success">Installed ({cliStatus.version})</span>
                    </div>
                    <div className="deploy-status__item">
                      <span className="deploy-status__label">API:</span>
                      <span className={`deploy-status__value ${cliStatus.apiReachable ? 'deploy-status__value--success' : 'deploy-status__value--error'}`}>
                        {cliStatus.apiReachable ? 'Connected' : 'Not reachable'}
                      </span>
                    </div>
                    <div className="deploy-status__item">
                      <span className="deploy-status__label">Database:</span>
                      <span className={`deploy-status__value ${cliStatus.dbReachable ? 'deploy-status__value--success' : 'deploy-status__value--error'}`}>
                        {cliStatus.dbReachable ? 'Connected' : 'Not reachable'}
                      </span>
                    </div>
                    <div className="deploy-status__item">
                      <span className="deploy-status__label">Project Root:</span>
                      <span className="deploy-status__value">{cliStatus.projectRoot || 'Not set'}</span>
                    </div>
                  </div>

                  <div className="deploy-section">
                    <button
                      type="button"
                      className="deploy-btn deploy-btn--secondary"
                      onClick={() => postMessage({ type: 'deploy:changeProjectRoot' })}
                    >
                      Change Project Root
                    </button>
                  </div>

                  <div className="deploy-section">
                    <h3 className="deploy-section__title">Current File</h3>
                    <p className="deploy-section__desc">Deploy the currently open workflow file to the vNext API</p>
                    <button
                      type="button"
                      className="deploy-btn deploy-btn--primary"
                      onClick={() => postMessage({ type: 'deploy:current' })}
                    >
                      Deploy Current File
                    </button>
                  </div>

                  <div className="deploy-section">
                    <h3 className="deploy-section__title">Changed Files</h3>
                    <p className="deploy-section__desc">Deploy all Git-modified workflow files</p>
                    <button
                      type="button"
                      className="deploy-btn deploy-btn--secondary"
                      onClick={() => postMessage({ type: 'deploy:changed' })}
                    >
                      Deploy Changed Files
                    </button>
                  </div>

                  <div className="deploy-section">
                    <button
                      type="button"
                      className="deploy-btn deploy-btn--secondary"
                      onClick={() => postMessage({ type: 'deploy:checkStatus' })}
                    >
                      Refresh Status
                    </button>
                  </div>
                </>
              )}
            </div>
          </FlyoutPanel>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onConnectStart={onConnectStart}
            onConnectEnd={onConnectEnd}
            onReconnect={onReconnect}
            onEdgesDelete={onEdgesDelete}
            onNodesDelete={onNodesDelete}
            onSelectionChange={onSelectionChange}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            isValidConnection={isValidConnection}
            edgesReconnectable={true}
            edgesFocusable={true}
            elementsSelectable={true}
            selectNodesOnDrag={false}
            defaultEdgeOptions={defaultEdgeOptions}
            defaultMarkerColor="#94a3b8"
            fitView
            defaultViewport={{ x: 0, y: 0, zoom: 1 }}
            onInit={setReactFlowInstance}
            className={isConnecting ? 'connecting' : ''}
            onDrop={onDropCanvas}
            onDragOver={onDragOverCanvas}
            onPaneContextMenu={handlePaneContextMenu}
            onNodeContextMenu={handleNodeContextMenu}
            onEdgeContextMenu={handleEdgeContextMenu}
            onPaneClick={handlePaneClick}
          >
            <Background />
            <Controls position="bottom-left" >
              <LayerControlButton
                showRegularTransitions={showRegularTransitions}
                showSharedTransitions={showSharedTransitions}
                onToggleRegular={toggleRegularTransitions}
                onToggleShared={toggleSharedTransitions}
              />
            </Controls>
            <Panel position="bottom-left" style={{ left: 20, bottom: 158 }}>
            </Panel>
          </ReactFlow>
        </div>
      </div>
      {workflow ? (
        <PropertyPanel
          workflow={workflow}
          selection={selection}
          collapsed={!selection}
          availableTasks={taskCatalog}
          catalogs={catalogs}
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
          {contextMenu.nodeId ? (
            <>
              <button
                type="button"
                className="flow-context-menu__item"
                onClick={() => handleSetStartNode(contextMenu.nodeId!)}
              >
                Start from here
              </button>
            </>
          ) : contextMenu.edgeId ? (
            <>
              {contextMenu.edgeId.startsWith('t:local:') ? (
                <button
                  type="button"
                  className="flow-context-menu__item"
                  onClick={() => handleMakeTransitionShared(contextMenu.edgeId!)}
                >
                  Make Shared Transition
                </button>
              ) : contextMenu.edgeId.startsWith('t:shared:') ? (
                <button
                  type="button"
                  className="flow-context-menu__item"
                  onClick={() => handleConvertToRegular(contextMenu.edgeId!)}
                >
                  Convert to Regular Transition
                </button>
              ) : null}
            </>
          ) : (
            <button type="button" className="flow-context-menu__item" onClick={handleAutoLayoutRequest}>
              Auto layout
            </button>
          )}
        </div>
      )}

      {/* Documentation Viewer */}
      {showDocumentation && workflow && (
        <DocumentationViewer
          workflow={workflow}
          onClose={() => setShowDocumentation(false)}
          onExportWithDiagram={handleExportWithDiagram}
        />
      )}
    </div>
  );
}
