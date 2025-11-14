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
  getNodesBounds,
  reconnectEdge
} from '@xyflow/react';
import { toSvg } from 'html-to-image';
import { Boxes, Rocket, BookOpen } from 'lucide-react';
import { PluggableStateNode } from './nodes/PluggableStateNode';
import { LayerControlButton } from './LayerControlButton';
import { DocumentationViewer } from './DocumentationViewer';
import { DeploymentResultModal } from './DeploymentResultModal';
import { ToolbarIconButton } from './ToolbarIconButton';
import { FlyoutPanel } from './FlyoutPanel';
import { TaskMappingPopup } from './editors/TaskMappingPopup';
import { TransitionMappingPopup } from './editors/TransitionMappingPopup';
import { StateKeyEditPopup } from './editors/StateKeyEditPopup';
import { StateLabelEditPopup } from './editors/StateLabelEditPopup';
import { StateViewEditPopup } from './editors/StateViewEditPopup';
import { SubFlowConfigPopup } from './editors/SubFlowConfigPopup';
import { TransitionSchemaEditPopup } from './editors/TransitionSchemaEditPopup';
import { TransitionRuleEditPopup, type TransitionRuleData } from './editors/TransitionRuleEditPopup';
import { TransitionKeyEditPopup } from './editors/TransitionKeyEditPopup';
import { TransitionLabelEditPopup } from './editors/TransitionLabelEditPopup';
import { TimeoutConfigPopup } from './editors/TimeoutConfigPopup';
import { StateToolbar } from './toolbar/StateToolbar';
import { TransitionToolbar } from './toolbar/TransitionToolbar';
import { ContextMenuSubmenu } from './ContextMenuSubmenu';
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

    // Add edge type to data for filtering and enable reconnection
    return className
      ? { ...edge, className, type, reconnectable: true, data: { ...edge.data, isShared } }
      : { ...edge, type, reconnectable: true, data: { ...edge.data, isShared } };
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
  const [deployStatus, setDeployStatus] = useState<{ ready: boolean; configured: boolean; environment?: { id: string; name?: string; baseUrl: string; domain: string }; apiReachable: boolean; error?: string } | null>(null);
  const [deployProgress, setDeployProgress] = useState<{ step: string; current: number; total: number; workflow?: { key: string; domain: string; filePath: string }; message: string; percentage: number } | null>(null);
  const [deployResult, setDeployResult] = useState<{ success: boolean; message: string; results?: Array<{ success: boolean; key: string; domain: string; error?: string }> } | null>(null);

  // Task Mapping Popup state
  const [taskPopupState, setTaskPopupState] = useState<{
    stateKey?: string;
    lane?: 'onEntries' | 'onExits';
    transitionId?: string;
  } | null>(null);

  // Transition Mapping Popup state
  const [transitionMappingPopupState, setTransitionMappingPopupState] = useState<{
    transitionId: string;
  } | null>(null);

  // State Edit Popups state
  const [stateKeyEditPopup, setStateKeyEditPopup] = useState<{ stateKey: string } | null>(null);
  const [stateLabelEditPopup, setStateLabelEditPopup] = useState<{ stateKey: string } | null>(null);
  const [stateViewEditPopup, setStateViewEditPopup] = useState<{ stateKey: string } | null>(null);
  const [stateSubFlowEditPopup, setStateSubFlowEditPopup] = useState<{ stateKey: string } | null>(null);

  // Transition Edit Popups state
  const [transitionSchemaEditPopup, setTransitionSchemaEditPopup] = useState<{ transitionId: string } | null>(null);
  const [transitionRuleEditPopup, setTransitionRuleEditPopup] = useState<{ transitionId: string } | null>(null);
  const [transitionKeyEditPopup, setTransitionKeyEditPopup] = useState<{ transitionId: string } | null>(null);
  const [transitionLabelEditPopup, setTransitionLabelEditPopup] = useState<{ transitionId: string } | null>(null);
  const [timeoutConfigPopup, setTimeoutConfigPopup] = useState<{ transitionId: string } | null>(null);

  // Reconnection mode state
  const [reconnectionMode, setReconnectionMode] = useState<{
    edgeId: string;
    end: 'source' | 'target';
    oldSource: string;
    oldTarget: string;
  } | null>(null);

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
  // Also highlight edge when in reconnection mode
  useEffect(() => {
    const filteredEdges = filterEdgesByVisibility(allEdges);

    // Highlight edge being reconnected
    if (reconnectionMode) {
      const highlightedEdges = filteredEdges.map(edge => {
        if (edge.id === reconnectionMode.edgeId) {
          return {
            ...edge,
            animated: true,
            style: { ...edge.style, strokeWidth: 3, stroke: '#2563eb' }
          };
        }
        return edge;
      });
      setEdges(highlightedEdges);
    } else {
      setEdges(filteredEdges);
    }
  }, [allEdges, filterEdgesByVisibility, reconnectionMode]);

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

  // Task Mapping Popup handlers (defined early to avoid initialization errors)
  const handleOpenTaskPopup = useCallback((stateKey: string, lane?: 'onEntries' | 'onExits') => {
    setTaskPopupState({ stateKey, lane });
    setContextMenu(null);
  }, []);

  // Transition Edit handlers (defined early to avoid initialization errors)
  const handleEditTransitionKey = useCallback((transitionId: string) => {
    setTransitionKeyEditPopup({ transitionId });
    setContextMenu(null);
  }, []);

  const handleEditTransitionLabels = useCallback((transitionId: string) => {
    setTransitionLabelEditPopup({ transitionId });
    setContextMenu(null);
  }, []);

  const handleEditTransitionTimeout = useCallback((transitionId: string) => {
    setTimeoutConfigPopup({ transitionId });
    setContextMenu(null);
  }, []);

  // Helper to enrich nodes with callbacks
  const enrichNodes = useCallback((nodes: Node[]) => {
    return nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        onTaskBadgeClick: handleOpenTaskPopup
      }
    }));
  }, [handleOpenTaskPopup]);

  // Handler for transition task badge clicks
  const handleOpenTransitionTaskBadge = useCallback((edgeId: string) => {
    setTaskPopupState({ transitionId: edgeId });
    setContextMenu(null);
  }, []);

  // Helper to enrich edges with callbacks
  const enrichEdges = useCallback((edges: Edge[]) => {
    return edges.map((edge) => ({
      ...edge,
      data: {
        ...edge.data,
        onTaskBadgeClick: () => handleOpenTransitionTaskBadge(edge.id)
      }
    }));
  }, [handleOpenTransitionTaskBadge]);

  // Handle messages from host
  useEffect(() => {
    return onMessage((message: MsgToWebview) => {
      switch (message.type) {
        case 'init':
          setWorkflow(message.workflow);
          setDiagram(message.diagram);
          setNodes(enrichNodes(message.derived.nodes));
          setAllEdges(enrichEdges(decorateEdges(message.derived.edges)));
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
          setNodes(enrichNodes(message.derived.nodes));
          setAllEdges(enrichEdges(decorateEdges(message.derived.edges)));
          break;
        case 'diagram:update':
          setDiagram(message.diagram);
          setNodes((prevNodes) =>
            enrichNodes(prevNodes.map((node) => {
              const position = message.diagram.nodePos[node.id];
              return position ? { ...node, position } : node;
            }))
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
            console.log('[Canvas] Received catalog update:', {
              mapper: message.catalogs.mapper?.length || 0,
              task: message.catalogs.task?.length || 0,
              mappers: message.catalogs.mapper
            });
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
          setDeployStatus({
            ready: message.ready,
            configured: message.configured,
            environment: message.environment,
            apiReachable: message.apiReachable,
            error: message.error
          });
          break;
        case 'deploy:progress':
          setDeployProgress({
            step: message.step,
            current: message.current,
            total: message.total,
            workflow: message.workflow,
            message: message.message,
            percentage: message.percentage
          });
          break;
        case 'deploy:result':
          setDeployResult({
            success: message.success,
            message: message.message,
            results: message.results
          });
          setDeployProgress(null); // Clear progress when done
          // Update status after deployment
          if (message.success) {
            postMessage({ type: 'deploy:checkStatus' });
          }
          break;
        case 'mapper:saved':
          console.log('[Canvas] Mapper saved:', message.mapperRef, message.mapperId);
          // TODO: Auto-update task mapping if task editor is still open
          // For now, users need to manually select the mapper from the dropdown
          break;
        case 'transition:editKey':
          console.log('[Canvas] Received transition:editKey message:', message.transitionId);
          if (message.transitionId) {
            handleEditTransitionKey(message.transitionId);
          }
          break;
      }
    });
  }, [onMessage, reactFlowInstance, nodes, workflow, postMessage, enrichNodes, enrichEdges, handleEditTransitionKey]);

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
    // Clear reconnection mode if user didn't complete the connection
    if (reconnectionMode) {
      setReconnectionMode(null);
    }
  }, [reconnectionMode]);

  // Handle new connections
  const onConnect: OnConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return;

    // Normal connection handling (reconnection is handled via node clicks)
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

    // Wizard states (stateType === 5) can only have one outgoing transition
    if (sourceNode?.data?.stateType === 5) {
      // Check if this wizard state already has a transition
      const hasExistingTransition = edges.some(e =>
        e.source === connection.source &&
        e.id !== (edge as Edge)?.id // Allow reconnecting existing edges
      );
      if (hasExistingTransition) {
        return false;
      }
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

    // Optimistically update edges state for immediate UI feedback
    setAllEdges((els) => reconnectEdge(oldEdge, newConnection, els));

    // Send domain message to persist the change
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
  }, [postMessage, isValidConnection, setAllEdges]);

  // Handle edge update (alternative to onReconnect for some React Flow versions)
  const onEdgeUpdate = useCallback((oldEdge: Edge, newConnection: Connection) => {
    return onReconnect(oldEdge, newConnection);
  }, [onReconnect]);

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
    const stateLabel = variant ? variant.label : `${plugin.defaultLabel}${labelSuffix}`.trim();

    // Create state based on variant or plugin
    let newState: State;
    if (variant?.stateTemplate) {
      // Use variant template (should already have xProfile set)
      // Ensure all required properties are defined
      newState = {
        key: stateKey, // Default key, will be overridden below
        stateType: 2 as StateType, // Default to Intermediate if not provided
        labels: [
          { label: stateLabel, language: 'en-US' },
          { label: stateLabel, language: 'tr-TR' }
        ],
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
        // Ensure labels for both required languages
        if (!newState.labels || newState.labels.length === 0) {
          newState.labels = [
            { label: stateLabel, language: 'en-US' },
            { label: stateLabel, language: 'tr-TR' }
          ];
        } else {
          // Ensure both required languages are present
          const hasEnUS = newState.labels.some(l => l.language === 'en-US');
          const hasTrTR = newState.labels.some(l => l.language === 'tr-TR');
          if (!hasEnUS) newState.labels.push({ label: stateLabel, language: 'en-US' });
          if (!hasTrTR) newState.labels.push({ label: stateLabel, language: 'tr-TR' });
        }
      } else {
        // Fallback for plugins without createState
        newState = {
          key: stateKey,
          stateType: plugin.stateType,
          xProfile: plugin.id, // Set xProfile to plugin ID
          versionStrategy: 'Minor',
          labels: [
            { label: stateLabel, language: 'en-US' },
            { label: stateLabel, language: 'tr-TR' }
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
    // Ensure labels are always set for both required languages
    if (!newState.labels || newState.labels.length === 0) {
      newState.labels = [
        { label: stateLabel, language: 'en-US' },
        { label: stateLabel, language: 'tr-TR' }
      ];
    } else {
      // Update existing labels for both required languages
      const hasEnUS = newState.labels.some(l => l.language === 'en-US');
      const hasTrTR = newState.labels.some(l => l.language === 'tr-TR');

      if (hasEnUS) {
        const enLabel = newState.labels.find(l => l.language === 'en-US');
        if (enLabel) enLabel.label = stateLabel;
      } else {
        newState.labels.push({ label: stateLabel, language: 'en-US' });
      }

      if (hasTrTR) {
        const trLabel = newState.labels.find(l => l.language === 'tr-TR');
        if (trLabel) trLabel.label = stateLabel;
      } else {
        newState.labels.push({ label: stateLabel, language: 'tr-TR' });
      }
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
  }, []);

  const handleEdgeContextMenu = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.preventDefault();
    // Show context menu for local, shared, and start transitions
    if (edge.id.startsWith('t:local:') || edge.id.startsWith('t:shared:') || edge.id.startsWith('t:start:')) {
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

  const handleConvertTransitionType = useCallback((edgeId: string, newTriggerType: 0 | 1 | 2 | 3) => {
    if (!workflow) return;

    const localMatch = /^t:local:([^:]+):(.+)$/.exec(edgeId);
    const sharedMatch = /^t:shared:([^:]+):/.exec(edgeId);
    const startMatch = /^t:start:(.+)$/.exec(edgeId);

    if (localMatch) {
      const [, from, transitionKey] = localMatch;
      const state = workflow.attributes?.states?.find(s => s.key === from);
      const transition = state?.transitions?.find(t => t.key === transitionKey);
      if (transition) {
        const updatedTransition = { ...transition, triggerType: newTriggerType };
        postMessage({
          type: 'domain:updateTransition',
          from,
          transitionKey,
          transition: updatedTransition,
        });
      }
    } else if (sharedMatch) {
      const [, transitionKey] = sharedMatch;
      const transition = workflow.attributes?.sharedTransitions?.find(t => t.key === transitionKey);
      if (transition) {
        const updatedTransition = { ...transition, triggerType: newTriggerType };
        postMessage({
          type: 'domain:updateSharedTransition',
          transitionKey,
          sharedTransition: updatedTransition,
        });
      }
    } else if (startMatch) {
      const transition = workflow.attributes?.startTransition;
      if (transition) {
        const updatedTransition = { ...transition, triggerType: newTriggerType };
        postMessage({
          type: 'domain:updateStartTransition',
          startTransition: updatedTransition,
        });
      }
    }
    setContextMenu(null);
  }, [workflow, postMessage]);

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

  const handleOpenTransitionTaskPopup = useCallback((edgeId: string) => {
    setTaskPopupState({ transitionId: edgeId });
    setContextMenu(null);
  }, []);

  const handleOpenTransitionMappingPopup = useCallback((edgeId: string) => {
    setTransitionMappingPopupState({ transitionId: edgeId });
    setContextMenu(null);
  }, []);

  const handleCloseTaskPopup = useCallback(() => {
    setTaskPopupState(null);
  }, []);

  const handleCloseTransitionMappingPopup = useCallback(() => {
    setTransitionMappingPopupState(null);
  }, []);

  const handleApplyTaskChanges = useCallback((updates: { onEntries?: any[]; onExits?: any[]; onExecutionTasks?: any[] }) => {
    if (!taskPopupState || !workflow) return;

    // Handle state task updates
    if (taskPopupState.stateKey) {
      const state = workflow.attributes?.states?.find(s => s.key === taskPopupState.stateKey);
      if (!state) return;

      const updatedState = {
        ...state,
        onEntries: updates.onEntries,
        onExits: updates.onExits,
      };

      postMessage({
        type: 'domain:updateState',
        stateKey: taskPopupState.stateKey,
        state: updatedState,
      });
    }
    // Handle transition task updates
    else if (taskPopupState.transitionId) {
      const edgeId = taskPopupState.transitionId;

      // Parse edge ID to get transition info
      const localMatch = /^t:local:([^:]+):(.+)$/.exec(edgeId);
      const sharedMatch = /^t:shared:([^:]+):/.exec(edgeId);

      if (localMatch) {
        const [, from, transitionKey] = localMatch;
        const state = workflow.attributes?.states?.find(s => s.key === from);
        const transition = state?.transitions?.find(t => t.key === transitionKey);

        if (transition) {
          const updatedTransition = {
            ...transition,
            onExecutionTasks: updates.onExecutionTasks,
          };

          postMessage({
            type: 'domain:updateTransition',
            from,
            transitionKey,
            transition: updatedTransition,
          });
        }
      } else if (sharedMatch) {
        const [, transitionKey] = sharedMatch;
        const sharedTransition = workflow.sharedTransitions?.find(t => t.key === transitionKey);

        if (sharedTransition) {
          const updatedSharedTransition = {
            ...sharedTransition,
            onExecutionTasks: updates.onExecutionTasks,
          };

          postMessage({
            type: 'domain:updateSharedTransition',
            transitionKey,
            sharedTransition: updatedSharedTransition,
          });
        }
      }
    }
  }, [taskPopupState, workflow, postMessage]);

  const handleApplyTransitionMapping = useCallback((mapping: any) => {
    if (!transitionMappingPopupState || !workflow) return;

    const edgeId = transitionMappingPopupState.transitionId;

    // Parse edge ID to get transition info
    const localMatch = /^t:local:([^:]+):(.+)$/.exec(edgeId);
    const sharedMatch = /^t:shared:([^:]+):/.exec(edgeId);
    const startMatch = /^t:start:(.+)$/.exec(edgeId);

    if (localMatch) {
      const [, from, transitionKey] = localMatch;
      const state = workflow.attributes?.states?.find(s => s.key === from);
      const transition = state?.transitions?.find(t => t.key === transitionKey);

      if (transition) {
        const updatedTransition = {
          ...transition,
          mapping,
        };

        postMessage({
          type: 'domain:updateTransition',
          from,
          transitionKey,
          transition: updatedTransition,
        });
      }
    } else if (sharedMatch) {
      const [, transitionKey] = sharedMatch;
      const sharedTransition = workflow.sharedTransitions?.find(t => t.key === transitionKey);

      if (sharedTransition) {
        const updatedSharedTransition = {
          ...sharedTransition,
          mapping,
        };

        postMessage({
          type: 'domain:updateSharedTransition',
          transitionKey,
          sharedTransition: updatedSharedTransition,
        });
      }
    } else if (startMatch) {
      const startTransition = workflow.attributes?.startTransition;

      if (startTransition) {
        const updatedStartTransition = {
          ...startTransition,
          mapping,
        };

        postMessage({
          type: 'domain:updateStartTransition',
          startTransition: updatedStartTransition,
        });
      }
    }
  }, [transitionMappingPopupState, workflow, postMessage]);

  // State Edit Popup handlers
  const handleEditStateKey = useCallback((stateKey: string) => {
    setStateKeyEditPopup({ stateKey });
    setContextMenu(null);
  }, []);

  const handleApplyKeyChange = useCallback((oldKey: string, newKey: string) => {
    const state = workflow?.attributes?.states?.find(s => s.key === oldKey);
    if (!state) return;

    postMessage({
      type: 'domain:updateState',
      stateKey: oldKey,
      state: { ...state, key: newKey }
    });
  }, [workflow, postMessage]);

  const handleEditStateLabel = useCallback((stateKey: string) => {
    setStateLabelEditPopup({ stateKey });
    setContextMenu(null);
  }, []);

  const handleApplyLabelChanges = useCallback((stateKey: string, labels: any[]) => {
    const state = workflow?.attributes?.states?.find(s => s.key === stateKey);
    if (!state) return;

    postMessage({
      type: 'domain:updateState',
      stateKey,
      state: { ...state, labels }
    });
  }, [workflow, postMessage]);

  const handleEditView = useCallback((stateKey: string) => {
    setStateViewEditPopup({ stateKey });
    setContextMenu(null);
  }, []);

  const handleApplyViewChange = useCallback((stateKey: string, view: any) => {
    const state = workflow?.attributes?.states?.find(s => s.key === stateKey);
    if (!state) return;

    postMessage({
      type: 'domain:updateState',
      stateKey,
      state: { ...state, view: view || undefined }
    });
  }, [workflow, postMessage]);

  const handleConfigureSubFlow = useCallback((stateKey: string) => {
    setStateSubFlowEditPopup({ stateKey });
    setContextMenu(null);
  }, []);

  const handleApplySubFlowChange = useCallback((stateKey: string, subFlow: any) => {
    const state = workflow?.attributes?.states?.find(s => s.key === stateKey);
    if (!state) return;

    postMessage({
      type: 'domain:updateState',
      stateKey,
      state: { ...state, subFlow: subFlow || undefined }
    });
  }, [workflow, postMessage]);

  const handleEditTransitionSchema = useCallback((transitionId: string) => {
    setTransitionSchemaEditPopup({ transitionId });
    setContextMenu(null);
  }, []);

  const handleEditTransitionRule = useCallback((transitionId: string) => {
    setTransitionRuleEditPopup({ transitionId });
    setContextMenu(null);
  }, []);

  const handleApplyTransitionRule = useCallback((transitionId: string, rule?: TransitionRuleData) => {
    if (!workflow) return;

    const localMatch = /^t:local:([^:]+):(.+)$/.exec(transitionId);
    const sharedMatch = /^t:shared:([^:]+):/.exec(transitionId);

    if (localMatch) {
      const [, from, tKey] = localMatch;
      // Find state by key (states is an array)
      const state = workflow.attributes.states.find(s => s.key === from);
      if (!state?.transitions) return;

      // Find transition by key (transitions is an array)
      const transition = state.transitions.find(t => t.key === tKey);
      if (!transition) return;

      postMessage({
        type: 'domain:updateTransition',
        from,
        transitionKey: tKey,
        transition: {
          ...transition,
          rule
        }
      });
    } else if (sharedMatch) {
      const [, tKey] = sharedMatch;
      // Find shared transition by key (sharedTransitions is an array)
      const sharedTransition = workflow.attributes.sharedTransitions?.find(st => st.key === tKey);
      if (!sharedTransition) return;

      postMessage({
        type: 'domain:updateSharedTransition',
        transitionKey: tKey,
        sharedTransition: {
          ...sharedTransition,
          rule
        }
      });
    }

    setTransitionRuleEditPopup(null);
  }, [workflow, postMessage]);

  const handleApplyTransitionKey = useCallback((transitionId: string, newKey: string) => {
    if (!workflow) return;

    const localMatch = /^t:local:([^:]+):(.+)$/.exec(transitionId);
    const sharedMatch = /^t:shared:([^:]+):/.exec(transitionId);
    const startMatch = /^t:start:(.+)$/.exec(transitionId);

    if (localMatch) {
      const [, from, oldKey] = localMatch;
      const state = workflow.attributes?.states?.find(s => s.key === from);
      const transition = state?.transitions?.find(t => t.key === oldKey);

      if (transition) {
        const updatedTransition = { ...transition, key: newKey };
        postMessage({
          type: 'domain:updateTransition',
          from,
          transitionKey: oldKey,
          transition: updatedTransition,
        });
      }
    } else if (sharedMatch) {
      const [, oldKey] = sharedMatch;
      const sharedTransition = workflow.attributes?.sharedTransitions?.find(t => t.key === oldKey);

      if (sharedTransition) {
        const updatedSharedTransition = { ...sharedTransition, key: newKey };
        postMessage({
          type: 'domain:updateSharedTransition',
          transitionKey: oldKey,
          sharedTransition: updatedSharedTransition,
        });
      }
    } else if (startMatch) {
      const startTransition = workflow.attributes?.startTransition;
      if (startTransition) {
        const updatedStartTransition = { ...startTransition, key: newKey };
        postMessage({
          type: 'domain:updateStartTransition',
          startTransition: updatedStartTransition,
        });
      }
    }

    setTransitionKeyEditPopup(null);
  }, [workflow, postMessage]);

  const handleApplyTransitionLabels = useCallback((transitionId: string, labels: any[]) => {
    if (!workflow) return;

    const localMatch = /^t:local:([^:]+):(.+)$/.exec(transitionId);
    const sharedMatch = /^t:shared:([^:]+):/.exec(transitionId);
    const startMatch = /^t:start:(.+)$/.exec(transitionId);

    if (localMatch) {
      const [, from, transitionKey] = localMatch;
      const state = workflow.attributes?.states?.find(s => s.key === from);
      const transition = state?.transitions?.find(t => t.key === transitionKey);

      if (transition) {
        const updatedTransition = { ...transition, labels };
        postMessage({
          type: 'domain:updateTransition',
          from,
          transitionKey,
          transition: updatedTransition,
        });
      }
    } else if (sharedMatch) {
      const [, transitionKey] = sharedMatch;
      const sharedTransition = workflow.attributes?.sharedTransitions?.find(t => t.key === transitionKey);

      if (sharedTransition) {
        const updatedSharedTransition = { ...sharedTransition, labels };
        postMessage({
          type: 'domain:updateSharedTransition',
          transitionKey,
          sharedTransition: updatedSharedTransition,
        });
      }
    } else if (startMatch) {
      const startTransition = workflow.attributes?.startTransition;
      if (startTransition) {
        const updatedStartTransition = { ...startTransition, labels };
        postMessage({
          type: 'domain:updateStartTransition',
          startTransition: updatedStartTransition,
        });
      }
    }

    setTransitionLabelEditPopup(null);
  }, [workflow, postMessage]);

  const handleApplyTimeoutConfig = useCallback((transitionId: string, timer: any) => {
    if (!workflow) return;

    const localMatch = /^t:local:([^:]+):(.+)$/.exec(transitionId);
    const sharedMatch = /^t:shared:([^:]+):/.exec(transitionId);
    const startMatch = /^t:start:(.+)$/.exec(transitionId);

    if (localMatch) {
      const [, from, transitionKey] = localMatch;
      const state = workflow.attributes?.states?.find(s => s.key === from);
      const transition = state?.transitions?.find(t => t.key === transitionKey);

      if (transition) {
        const updatedTransition = { ...transition, timer };
        postMessage({
          type: 'domain:updateTransition',
          from,
          transitionKey,
          transition: updatedTransition,
        });
      }
    } else if (sharedMatch) {
      const [, transitionKey] = sharedMatch;
      const sharedTransition = workflow.attributes?.sharedTransitions?.find(t => t.key === transitionKey);

      if (sharedTransition) {
        const updatedSharedTransition = { ...sharedTransition, timer };
        postMessage({
          type: 'domain:updateSharedTransition',
          transitionKey,
          sharedTransition: updatedSharedTransition,
        });
      }
    } else if (startMatch) {
      const startTransition = workflow.attributes?.startTransition;
      if (startTransition) {
        const updatedStartTransition = { ...startTransition, timer };
        postMessage({
          type: 'domain:updateStartTransition',
          startTransition: updatedStartTransition,
        });
      }
    }

    setTimeoutConfigPopup(null);
  }, [workflow, postMessage]);

  const handleApplyTransitionSchema = useCallback((transitionId: string, schema: any) => {
    if (!workflow) return;

    // Check for local transition: t:local:from:key
    const localMatch = /^t:local:([^:]+):(.+)$/.exec(transitionId);
    if (localMatch) {
      const [, from, transitionKey] = localMatch;
      const state = workflow.attributes.states.find(s => s.key === from);
      const transition = state?.transitions?.find(t => t.key === transitionKey);
      if (transition) {
        postMessage({
          type: 'domain:updateTransition',
          from,
          transitionKey,
          transition: { ...transition, schema: schema || null }
        });
        return;
      }
    }

    // Check for shared transition: t:shared:key:...
    const sharedMatch = /^t:shared:([^:]+):/.exec(transitionId);
    if (sharedMatch) {
      const [, transitionKey] = sharedMatch;
      const transition = workflow.attributes.sharedTransitions?.find(t => t.key === transitionKey);
      if (transition) {
        postMessage({
          type: 'domain:updateSharedTransition',
          transitionKey,
          sharedTransition: { ...transition, schema: schema || null }
        });
        return;
      }
    }

    // Check for start transition: t:start:key
    const startMatch = /^t:start:(.+)$/.exec(transitionId);
    if (startMatch) {
      const transition = workflow.attributes.startTransition;
      if (transition) {
        postMessage({
          type: 'domain:updateStartTransition',
          startTransition: { ...transition, schema: schema || null }
        });
        return;
      }
    }
  }, [workflow, postMessage]);

  // State type conversion handlers
  const handleConvertToFinal = useCallback((stateKey: string, subType: any) => {
    const state = workflow?.attributes?.states?.find(s => s.key === stateKey);
    if (!state) return;

    postMessage({
      type: 'domain:updateState',
      stateKey,
      state: { ...state, stateType: 3, stateSubType: subType, transitions: [] }
    });
    setContextMenu(null);
  }, [workflow, postMessage]);

  const handleConvertToIntermediate = useCallback((stateKey: string) => {
    const state = workflow?.attributes?.states?.find(s => s.key === stateKey);
    if (!state) return;

    postMessage({
      type: 'domain:updateState',
      stateKey,
      state: { ...state, stateType: 2, stateSubType: undefined }
    });
    setContextMenu(null);
  }, [workflow, postMessage]);

  const handleConvertToSubFlow = useCallback((stateKey: string) => {
    const state = workflow?.attributes?.states?.find(s => s.key === stateKey);
    if (!state) return;

    postMessage({
      type: 'domain:updateState',
      stateKey,
      state: { ...state, stateType: 4 }
    });
    setContextMenu(null);
  }, [workflow, postMessage]);

  const handleConvertToWizard = useCallback((stateKey: string) => {
    const state = workflow?.attributes?.states?.find(s => s.key === stateKey);
    if (!state) return;

    postMessage({
      type: 'domain:updateState',
      stateKey,
      state: { ...state, stateType: 5 }
    });
    setContextMenu(null);
  }, [workflow, postMessage]);

  const handleSetFinalSubType = useCallback((stateKey: string, subType: any) => {
    const state = workflow?.attributes?.states?.find(s => s.key === stateKey);
    if (!state) return;

    postMessage({
      type: 'domain:updateState',
      stateKey,
      state: { ...state, stateSubType: subType }
    });
    setContextMenu(null);
  }, [workflow, postMessage]);

  const handleDeleteState = useCallback((stateKey: string) => {
    postMessage({
      type: 'domain:removeState',
      stateKey
    });
    setContextMenu(null);
  }, [postMessage]);

  const handleDeleteTransition = useCallback((edgeId: string) => {
    // Parse edge ID to determine transition type
    const localMatch = /^t:local:([^:]+):(.+)$/.exec(edgeId);
    const sharedMatch = /^t:shared:([^:]+):(.+)$/.exec(edgeId);

    if (localMatch) {
      // Delete local transition
      const [, from, tKey] = localMatch;
      postMessage({
        type: 'domain:removeTransition',
        from,
        tKey
      });
    } else if (sharedMatch) {
      // Remove this state from the shared transition's availableIn list
      const [, transitionKey, stateKey] = sharedMatch;
      postMessage({
        type: 'domain:removeFromSharedTransition',
        transitionKey,
        stateKey
      });
    }
    // Note: Start transitions cannot be deleted

    setContextMenu(null);
  }, [postMessage]);

  const handleReconnectSource = useCallback((edgeId: string) => {
    // Parse edge to get source and target
    const edge = allEdges.find(e => e.id === edgeId);
    if (!edge) return;

    // Enter reconnection mode
    setReconnectionMode({
      edgeId,
      end: 'source',
      oldSource: edge.source,
      oldTarget: edge.target
    });
    setIsConnecting(true); // Visual feedback
    setContextMenu(null);
  }, [allEdges]);

  const handleReconnectTarget = useCallback((edgeId: string) => {
    // Parse edge to get source and target
    const edge = allEdges.find(e => e.id === edgeId);
    if (!edge) return;

    // Enter reconnection mode
    setReconnectionMode({
      edgeId,
      end: 'target',
      oldSource: edge.source,
      oldTarget: edge.target
    });
    setIsConnecting(true); // Visual feedback
    setContextMenu(null);
  }, [allEdges]);

  const handleToggleSharedTransition = useCallback((stateKey: string, transitionKey: string, enabled: boolean) => {
    if (!workflow) return;

    const sharedTransition = workflow.attributes?.sharedTransitions?.find(st => st.key === transitionKey);
    if (!sharedTransition) return;

    if (enabled) {
      // Add state to shared transition's availableIn
      const updatedAvailableIn = [...sharedTransition.availableIn, stateKey];
      const updatedTransition = { ...sharedTransition, availableIn: updatedAvailableIn };
      postMessage({
        type: 'domain:updateSharedTransition',
        transitionKey,
        sharedTransition: updatedTransition
      });
    } else {
      // Remove state from shared transition's availableIn
      postMessage({
        type: 'domain:removeFromSharedTransition',
        transitionKey,
        stateKey
      });
    }
    setContextMenu(null);
  }, [workflow, postMessage]);

  const handleNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    // Handle reconnection mode
    if (reconnectionMode) {
      const { edgeId, end, oldSource, oldTarget } = reconnectionMode;
      const newNodeId = node.id;

      // Don't allow connecting to start node
      if (newNodeId === '__start__' && end === 'target') {
        setReconnectionMode(null);
        setIsConnecting(false);
        return;
      }

      // Determine new source and target based on reconnection mode
      const newSource = end === 'source' ? newNodeId : oldSource;
      const newTarget = end === 'target' ? newNodeId : oldTarget;

      // Validate the new connection
      const testConnection = {
        source: newSource,
        target: newTarget,
        sourceHandle: null,
        targetHandle: null
      };

      // Find the edge being reconnected to pass to isValidConnection
      const currentEdge = allEdges.find(e => e.id === edgeId);
      if (!isValidConnection({ ...testConnection, id: edgeId } as Edge)) {
        // Connection is invalid, cancel reconnection mode
        setReconnectionMode(null);
        setIsConnecting(false);
        return;
      }

      // Parse edge ID to determine transition type
      const localMatch = /^t:local:([^:]+):(.+)$/.exec(edgeId);
      const sharedMatch = /^t:shared:([^:]+):(.+)$/.exec(edgeId);
      const startMatch = /^t:start:/.exec(edgeId);

      if (localMatch) {
        const [, from, tKey] = localMatch;
        // Use domain:moveTransition to reconnect
        postMessage({
          type: 'domain:moveTransition',
          oldFrom: from,
          tKey,
          newFrom: newSource,
          newTarget
        });
      } else if (startMatch) {
        // For start transitions, just update the target
        postMessage({
          type: 'domain:setStart',
          target: newTarget
        });
      } else if (sharedMatch) {
        // For shared transitions, we need to remove from old state and add to new
        const [, transitionKey, oldFromState] = sharedMatch;
        if (end === 'source' && newSource !== oldFromState) {
          // Remove from old state
          postMessage({
            type: 'domain:removeFromSharedTransition',
            transitionKey,
            stateKey: oldFromState
          });
          // Add to new state (if not already there)
          postMessage({
            type: 'domain:toggleSharedTransition',
            stateKey: newSource,
            transitionKey,
            enabled: true
          });
        }
        // Target changes for shared transitions would require updating the transition itself
        if (end === 'target' && newTarget !== oldTarget) {
          // Update shared transition target
          postMessage({
            type: 'domain:updateSharedTransitionTarget',
            transitionKey,
            newTarget
          });
        }
      }

      // Clear reconnection mode
      setReconnectionMode(null);
      setIsConnecting(false);
    }
  }, [reconnectionMode, postMessage, allEdges, isValidConnection]);

  const handleNodeDoubleClick = useCallback((_event: React.MouseEvent, node: Node) => {
    // Open key edit popup on double-click
    handleEditStateKey(node.id);
  }, [handleEditStateKey]);

  const handleEdgeDoubleClick = useCallback((_event: React.MouseEvent, edge: Edge) => {
    // Open transition key edit popup on double-click
    handleEditTransitionKey(edge.id);
  }, [handleEditTransitionKey]);

  // Handle escape key to cancel reconnection mode
  useEffect(() => {
    if (!reconnectionMode) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setReconnectionMode(null);
        setIsConnecting(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [reconnectionMode]);

  useEffect(() => {
    if (!contextMenu) {
      return undefined;
    }

    const handleDismiss = (event: Event) => {
      const target = event.target as HTMLElement | null;
      // Don't dismiss if clicking inside context menu, state toolbar, or transition toolbar
      if (target?.closest('.flow-context-menu') ||
          target?.closest('.state-toolbar') ||
          target?.closest('.transition-toolbar')) {
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
        <div className="flow-canvas" style={{ height: '100vh', cursor: reconnectionMode ? 'crosshair' : 'default' }}>
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
                  'Wizard': 'state-node--wizard',
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
              {!deployStatus ? (
                <div className="deploy-loading">
                  <p>Checking deployment status...</p>
                </div>
              ) : !deployStatus.configured ? (
                <div className="deploy-setup">
                  <div className="deploy-setup__header">
                    <h3>No Environment Configured</h3>
                    <p>You need to configure a deployment environment to deploy workflows.</p>
                  </div>
                  <button
                    type="button"
                    className="deploy-btn deploy-btn--primary"
                    onClick={() => postMessage({ type: 'deploy:selectEnvironment' })}
                  >
                    Configure Environment
                  </button>
                  <div className="deploy-info">
                    <p className="deploy-info__note">
                      ℹ️ You can configure environments in VS Code settings (Amorphie: Open Settings)
                    </p>
                  </div>
                </div>
              ) : deployStatus.error ? (
                <div className="deploy-setup">
                  <div className="deploy-setup__header">
                    <h3>Deployment Error</h3>
                    <p>{deployStatus.error}</p>
                  </div>
                  <button
                    type="button"
                    className="deploy-btn deploy-btn--primary"
                    onClick={() => postMessage({ type: 'deploy:selectEnvironment' })}
                  >
                    Select Different Environment
                  </button>
                </div>
              ) : (
                <>
                  <div className="deploy-status">
                    <div className="deploy-status__item">
                      <span className="deploy-status__label">Environment:</span>
                      <span className="deploy-status__value">{deployStatus.environment?.name || deployStatus.environment?.id || 'None'}</span>
                    </div>
                    <div className="deploy-status__item">
                      <span className="deploy-status__label">API:</span>
                      <span className={`deploy-status__value ${deployStatus.apiReachable ? 'deploy-status__value--success' : 'deploy-status__value--error'}`}>
                        {deployStatus.apiReachable ? 'Connected' : 'Not reachable'}
                      </span>
                    </div>
                    {deployStatus.environment && (
                      <>
                        <div className="deploy-status__item">
                          <span className="deploy-status__label">Base URL:</span>
                          <span className="deploy-status__value deploy-status__value--small">{deployStatus.environment.baseUrl}</span>
                        </div>
                        <div className="deploy-status__item">
                          <span className="deploy-status__label">Domain:</span>
                          <span className="deploy-status__value">{deployStatus.environment.domain}</span>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="deploy-section">
                    <h3 className="deploy-section__title">Deploy Workflow</h3>
                    <p className="deploy-section__desc">Deploy the currently open workflow file to the vNext API</p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        className="deploy-btn deploy-btn--primary"
                        onClick={() => postMessage({ type: 'deploy:current' })}
                        disabled={!!deployProgress}
                        style={{ flex: 1 }}
                      >
                        Deploy Workflow
                      </button>
                      <button
                        type="button"
                        className="deploy-btn deploy-btn--secondary"
                        onClick={() => postMessage({ type: 'deploy:current', force: true })}
                        disabled={!!deployProgress}
                        title="Force deploy without checking for changes"
                        style={{ flex: 1 }}
                      >
                        Force Deploy
                      </button>
                    </div>
                  </div>

                  {/* Deployment Progress */}
                  {deployProgress && (
                    <div className="deploy-section">
                      <div className="deploy-progress">
                        <div className="deploy-progress__header">
                          <h4 className="deploy-progress__title">
                            {deployProgress.step === 'normalizing' && '⚙️ Normalizing...'}
                            {deployProgress.step === 'validating' && '🔍 Validating...'}
                            {deployProgress.step === 'deploying' && '🚀 Deploying...'}
                            {deployProgress.step === 'completed' && '✅ Completed'}
                            {deployProgress.step === 'failed' && '❌ Failed'}
                          </h4>
                          <span className="deploy-progress__count">{deployProgress.current}/{deployProgress.total}</span>
                        </div>
                        <div className="deploy-progress__bar-container">
                          <div
                            className="deploy-progress__bar"
                            style={{ width: `${deployProgress.percentage}%` }}
                          />
                        </div>
                        <p className="deploy-progress__message">{deployProgress.message}</p>
                        {deployProgress.workflow && (
                          <div className="deploy-progress__workflow">
                            <strong>{deployProgress.workflow.key}</strong>
                            <span className="deploy-progress__domain">{deployProgress.workflow.domain}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

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
            onEdgeUpdate={onEdgeUpdate}
            onEdgesDelete={onEdgesDelete}
            onNodesDelete={onNodesDelete}
            onNodeClick={handleNodeClick}
            onNodeDoubleClick={handleNodeDoubleClick}
            onEdgeDoubleClick={handleEdgeDoubleClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            isValidConnection={isValidConnection}
            edgesReconnectable={true}
            reconnectRadius={20}
            edgeUpdaterRadius={10}
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
      {/* State Context Toolbar - appears on right-click */}
      {contextMenu && contextMenu.nodeId && workflow && (() => {
        const state = workflow.attributes?.states?.find(s => s.key === contextMenu.nodeId);
        if (!state) return null;

        const stateType = state.stateType || 2;

        return (
          <StateToolbar
            state={state}
            position={{ x: contextMenu.x, y: contextMenu.y }}
            sharedTransitions={workflow.attributes?.sharedTransitions}
            onEditTasks={() => handleOpenTaskPopup(contextMenu.nodeId!)}
            onEditLabel={() => handleEditStateLabel(contextMenu.nodeId!)}
            onEditView={() => handleEditView(contextMenu.nodeId!)}
            onEditKey={() => handleEditStateKey(contextMenu.nodeId!)}
            onStartFromHere={stateType === 1 || stateType === 2 || stateType === 5 ? () => handleSetStartNode(contextMenu.nodeId!) : undefined}
            onConvertToFinal={stateType === 1 || stateType === 2 ? (subType) => handleConvertToFinal(contextMenu.nodeId!, subType) : undefined}
            onConvertToIntermediate={stateType === 1 || stateType === 3 || stateType === 4 || stateType === 5 ? () => handleConvertToIntermediate(contextMenu.nodeId!) : undefined}
            onConvertToSubFlow={stateType === 1 || stateType === 2 ? () => handleConvertToSubFlow(contextMenu.nodeId!) : undefined}
            onConvertToWizard={stateType === 1 || stateType === 2 ? () => handleConvertToWizard(contextMenu.nodeId!) : undefined}
            onConfigureSubFlow={stateType === 4 ? () => handleConfigureSubFlow(contextMenu.nodeId!) : undefined}
            onSetSubType={stateType === 3 ? (subType) => handleSetFinalSubType(contextMenu.nodeId!, subType) : undefined}
            onToggleSharedTransition={(transitionKey, enabled) => handleToggleSharedTransition(contextMenu.nodeId!, transitionKey, enabled)}
            onDelete={() => handleDeleteState(contextMenu.nodeId!)}
          />
        );
      })()}

      {/* Transition Context Toolbar - appears on right-click */}
      {contextMenu && contextMenu.edgeId && workflow && (() => {
        const edgeId = contextMenu.edgeId;
        const isLocal = edgeId.startsWith('t:local:');
        const isShared = edgeId.startsWith('t:shared:');
        const isStart = edgeId.startsWith('t:start:');

        if (isLocal || isShared || isStart) {
          let transitionLabel = '';
          let triggerType: number | undefined;
          let transition: any = null;

          if (isLocal) {
            const match = /^t:local:([^:]+):(.+)$/.exec(edgeId);
            if (match) {
              const [, from, transitionKey] = match;
              const state = workflow.attributes?.states?.find(s => s.key === from);
              transition = state?.transitions?.find(t => t.key === transitionKey);
              transitionLabel = `${from} → ${transition?.target || '?'}`;
              triggerType = transition?.triggerType;
            }
          } else if (isShared) {
            const match = /^t:shared:([^:]+):(.+)$/.exec(edgeId);
            if (match) {
              const [, transitionKey, fromState] = match;
              transition = workflow.attributes?.sharedTransitions?.find(t => t.key === transitionKey);
              // Resolve "$self" target to the actual from state
              const resolvedTarget = transition?.target === '$self' ? fromState : transition?.target;
              transitionLabel = `Shared: ${resolvedTarget || '?'}`;
              triggerType = transition?.triggerType;
            }
          } else if (isStart) {
            const match = /^t:start:(.+)$/.exec(edgeId);
            if (match) {
              const [, transitionKey] = match;
              transition = workflow.attributes?.startTransition;
              transitionLabel = `Start: ${transition?.target || '?'}`;
              triggerType = transition?.triggerType;
            }
          }

          const supportsSchema = triggerType === 0 || triggerType === 3;
          const isAuto = triggerType === 1;
          const isTimeout = triggerType === 2;

          return (
            <TransitionToolbar
              transitionLabel={transitionLabel}
              position={{ x: contextMenu.x, y: contextMenu.y }}
              triggerType={triggerType}
              onEditKey={() => handleEditTransitionKey(edgeId)}
              onEditLabels={() => handleEditTransitionLabels(edgeId)}
              onEditTasks={!isStart ? () => handleOpenTransitionTaskPopup(edgeId) : undefined}
              onEditMapping={() => handleOpenTransitionMappingPopup(edgeId)}
              onEditSchema={supportsSchema ? () => handleEditTransitionSchema(edgeId) : undefined}
              onEditRule={isAuto ? () => handleEditTransitionRule(edgeId) : undefined}
              onEditTimeout={isTimeout ? () => handleEditTransitionTimeout(edgeId) : undefined}
              onMakeShared={isLocal ? () => handleMakeTransitionShared(edgeId) : undefined}
              onConvertToRegular={isShared ? () => handleConvertToRegular(edgeId) : undefined}
              onConvertToManual={!isStart ? () => handleConvertTransitionType(edgeId, 0) : undefined}
              onConvertToAuto={!isStart ? () => handleConvertTransitionType(edgeId, 1) : undefined}
              onConvertToTimeout={!isStart ? () => handleConvertTransitionType(edgeId, 2) : undefined}
              onConvertToEvent={!isStart ? () => handleConvertTransitionType(edgeId, 3) : undefined}
              onReconnectSource={() => handleReconnectSource(edgeId)}
              onReconnectTarget={() => handleReconnectTarget(edgeId)}
              onDelete={(isLocal || isShared) ? () => handleDeleteTransition(edgeId) : undefined}
            />
          );
        }
        return null;
      })()}

      {/* Reconnection Mode Indicator */}
      {reconnectionMode && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            padding: '12px 20px',
            background: '#2563eb',
            color: 'white',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            fontSize: '14px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <span>
            {reconnectionMode.end === 'source'
              ? 'Click a node to set as new source'
              : 'Click a node to set as new target'}
          </span>
          <span style={{ opacity: 0.7, fontSize: '12px' }}>(Press Esc to cancel)</span>
        </div>
      )}

      {/* Canvas Context Menu - appears on right-click on canvas */}
      {contextMenu && !contextMenu.nodeId && !contextMenu.edgeId && (
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

      {/* Documentation Viewer */}
      {showDocumentation && workflow && (
        <DocumentationViewer
          workflow={workflow}
          onClose={() => setShowDocumentation(false)}
          onExportWithDiagram={handleExportWithDiagram}
        />
      )}

      {/* Deployment Result Modal */}
      {deployResult && !deployProgress && (
        <DeploymentResultModal
          success={deployResult.success}
          message={deployResult.message}
          results={deployResult.results}
          onClose={() => setDeployResult(null)}
        />
      )}

      {/* Task Mapping Popup */}
      {taskPopupState && workflow && (() => {
        // Handle state task editing
        if (taskPopupState.stateKey) {
          const state = workflow.attributes?.states?.find(s => s.key === taskPopupState.stateKey);
          return state ? (
            <TaskMappingPopup
              state={state}
              workflowName={workflow.key}
              onClose={handleCloseTaskPopup}
              onApply={handleApplyTaskChanges}
              initialLane={taskPopupState.lane}
              catalogs={catalogs}
            />
          ) : null;
        }
        // Handle transition task editing
        else if (taskPopupState.transitionId) {
          const edgeId = taskPopupState.transitionId;
          const localMatch = /^t:local:([^:]+):(.+)$/.exec(edgeId);
          const sharedMatch = /^t:shared:([^:]+):/.exec(edgeId);

          let transition: any = null;
          let transitionLabel = '';

          if (localMatch) {
            const [, from, transitionKey] = localMatch;
            const state = workflow.attributes?.states?.find(s => s.key === from);
            transition = state?.transitions?.find(t => t.key === transitionKey);
            transitionLabel = `${from} → ${transition?.target || '?'} (${transitionKey})`;
          } else if (sharedMatch) {
            const [, transitionKey] = sharedMatch;
            transition = workflow.sharedTransitions?.find(t => t.key === transitionKey);
            transitionLabel = `Shared: ${transition?.target || '?'} (${transitionKey})`;
          }

          if (!transition) return null;

          // Create a pseudo-state object for the transition
          const transitionAsState = {
            key: transitionLabel,
            onEntries: transition.onExecutionTasks || [],
            onExits: [],
          };

          return (
            <TaskMappingPopup
              state={transitionAsState as any}
              workflowName={workflow.key}
              onClose={handleCloseTaskPopup}
              onApply={(updates) => handleApplyTaskChanges({ onExecutionTasks: updates.onEntries })}
              initialLane="onEntries"
              catalogs={catalogs}
              isTransition={true}
            />
          );
        }
        return null;
      })()}

      {/* Transition Mapping Popup - for editing transition input mapping */}
      {transitionMappingPopupState && workflow && (() => {
        const edgeId = transitionMappingPopupState.transitionId;
        const localMatch = /^t:local:([^:]+):(.+)$/.exec(edgeId);
        const sharedMatch = /^t:shared:([^:]+):/.exec(edgeId);
        const startMatch = /^t:start:(.+)$/.exec(edgeId);

        let transition: any = null;
        let transitionLabel = '';
        let stateKey: string | undefined;

        if (localMatch) {
          const [, from, transitionKey] = localMatch;
          const state = workflow.attributes?.states?.find(s => s.key === from);
          transition = state?.transitions?.find(t => t.key === transitionKey);
          transitionLabel = `${from} → ${transition?.target || '?'} (${transitionKey})`;
          stateKey = from;
        } else if (sharedMatch) {
          const [, transitionKey] = sharedMatch;
          transition = workflow.sharedTransitions?.find(t => t.key === transitionKey);
          transitionLabel = `Shared: ${transition?.target || '?'} (${transitionKey})`;
        } else if (startMatch) {
          transition = workflow.attributes?.startTransition;
          transitionLabel = `Start → ${transition?.target || '?'}`;
        }

        if (!transition) return null;

        return (
          <TransitionMappingPopup
            transitionLabel={transitionLabel}
            mapping={transition.mapping}
            onClose={handleCloseTransitionMappingPopup}
            onApply={handleApplyTransitionMapping}
            catalogs={catalogs}
            stateKey={stateKey}
            workflowName={workflow.key}
          />
        );
      })()}

      {/* State Key Edit Popup */}
      {stateKeyEditPopup && workflow && (() => {
        const state = workflow.attributes?.states?.find(s => s.key === stateKeyEditPopup.stateKey);
        if (!state) return null;

        return (
          <StateKeyEditPopup
            currentKey={stateKeyEditPopup.stateKey}
            workflow={workflow}
            onClose={() => setStateKeyEditPopup(null)}
            onApply={handleApplyKeyChange}
          />
        );
      })()}

      {/* State Label Edit Popup */}
      {stateLabelEditPopup && workflow && (() => {
        const state = workflow.attributes?.states?.find(s => s.key === stateLabelEditPopup.stateKey);
        if (!state) return null;

        return (
          <StateLabelEditPopup
            stateKey={stateLabelEditPopup.stateKey}
            currentLabels={state.labels || []}
            onClose={() => setStateLabelEditPopup(null)}
            onApply={(labels) => handleApplyLabelChanges(stateLabelEditPopup.stateKey, labels)}
          />
        );
      })()}

      {/* State View Edit Popup */}
      {stateViewEditPopup && workflow && (() => {
        const state = workflow.attributes?.states?.find(s => s.key === stateViewEditPopup.stateKey);
        if (!state) return null;

        return (
          <StateViewEditPopup
            stateKey={stateViewEditPopup.stateKey}
            workflow={workflow}
            availableViews={catalogs.view || []}
            onClose={() => setStateViewEditPopup(null)}
            onApply={handleApplyViewChange}
          />
        );
      })()}

      {/* SubFlow Configuration Popup */}
      {stateSubFlowEditPopup && workflow && (() => {
        const state = workflow.attributes?.states?.find(s => s.key === stateSubFlowEditPopup.stateKey);
        if (!state) return null;

        return (
          <SubFlowConfigPopup
            stateKey={stateSubFlowEditPopup.stateKey}
            workflow={workflow}
            availableWorkflows={catalogs.workflow || []}
            availableMappers={catalogs.mapper || []}
            onClose={() => setStateSubFlowEditPopup(null)}
            onApply={handleApplySubFlowChange}
          />
        );
      })()}

      {/* Transition Schema Edit Popup */}
      {transitionSchemaEditPopup && workflow && (
        <TransitionSchemaEditPopup
          transitionId={transitionSchemaEditPopup.transitionId}
          workflow={workflow}
          availableSchemas={catalogs.schema || []}
          onClose={() => setTransitionSchemaEditPopup(null)}
          onApply={handleApplyTransitionSchema}
        />
      )}

      {/* Transition Rule Edit Popup */}
      {transitionRuleEditPopup && workflow && (() => {
        const transitionId = transitionRuleEditPopup.transitionId;
        const localMatch = /^t:local:([^:]+):(.+)$/.exec(transitionId);
        const sharedMatch = /^t:shared:([^:]+):/.exec(transitionId);

        let transitionKey = '';
        let fromState = '';
        let rule: TransitionRuleData | undefined = undefined;

        if (localMatch) {
          const [, from, tKey] = localMatch;
          fromState = from;
          transitionKey = tKey;
          // Find state by key (states is an array)
          const state = workflow.attributes.states.find(s => s.key === from);
          if (state?.transitions) {
            // Find transition by key (transitions is an array)
            const transition = state.transitions.find(t => t.key === tKey);
            if (transition?.rule) {
              rule = transition.rule;
            }
          }
        } else if (sharedMatch) {
          const [, tKey] = sharedMatch;
          transitionKey = tKey;
          fromState = 'shared';
          // Find shared transition by key (sharedTransitions is an array)
          const sharedTransition = workflow.attributes.sharedTransitions?.find(st => st.key === tKey);
          if (sharedTransition?.rule) {
            rule = sharedTransition.rule;
          }
        }

        return (
          <TransitionRuleEditPopup
            transitionKey={transitionKey}
            fromState={fromState}
            rule={rule}
            availableScripts={catalogs.rule || []}
            workflowName={workflow.key}
            onApply={(newRule) => handleApplyTransitionRule(transitionId, newRule)}
            onCancel={() => setTransitionRuleEditPopup(null)}
          />
        );
      })()}

      {/* Transition Key Edit Popup */}
      {transitionKeyEditPopup && workflow && (
        <TransitionKeyEditPopup
          transitionId={transitionKeyEditPopup.transitionId}
          workflow={workflow}
          onClose={() => setTransitionKeyEditPopup(null)}
          onApply={handleApplyTransitionKey}
        />
      )}

      {/* Transition Label Edit Popup */}
      {transitionLabelEditPopup && workflow && (
        <TransitionLabelEditPopup
          transitionId={transitionLabelEditPopup.transitionId}
          workflow={workflow}
          onClose={() => setTransitionLabelEditPopup(null)}
          onApply={handleApplyTransitionLabels}
        />
      )}

      {/* Timeout Config Popup */}
      {timeoutConfigPopup && workflow && (
        <TimeoutConfigPopup
          transitionId={timeoutConfigPopup.transitionId}
          workflow={workflow}
          onClose={() => setTimeoutConfigPopup(null)}
          onApply={handleApplyTimeoutConfig}
        />
      )}

    </div>
  );
}
