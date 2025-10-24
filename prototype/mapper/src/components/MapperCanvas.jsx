import { useCallback, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  useReactFlow
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { nodeTypes } from './CustomNodes';
import './MapperCanvas.css';

let nodeId = 0;

export function MapperCanvas({ onMappedFieldsChange }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { screenToFlowPosition } = useReactFlow();

  const onConnect = useCallback((params) => {
    setEdges((eds) => addEdge({ ...params, type: 'smoothstep', animated: true }, eds));
  }, [setEdges]);

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((event) => {
    event.preventDefault();

    const fieldData = JSON.parse(event.dataTransfer.getData('application/json'));
    if (!fieldData) return;

    const position = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });

    const newNode = {
      id: `${fieldData.side}_${nodeId++}`,
      type: fieldData.side === 'source' ? 'sourceField' : 'targetField',
      position,
      data: {
        label: fieldData.name,
        type: fieldData.type,
        path: fieldData.path,
        originalId: fieldData.id
      }
    };

    setNodes((nds) => nds.concat(newNode));

    // Notify parent about new mapping
    onMappedFieldsChange?.(fieldData.id);
  }, [screenToFlowPosition, setNodes, onMappedFieldsChange]);

  // Add a sample functoid for demonstration
  const addMultiplyNode = () => {
    const newNode = {
      id: `functoid_${nodeId++}`,
      type: 'functoid',
      position: { x: 400, y: 200 },
      data: {
        label: 'Multiply',
        icon: '×',
        category: 'math',
        operation: 'mul'
      }
    };
    setNodes((nds) => nds.concat(newNode));
  };

  return (
    <div className="mapper-canvas">
      <div className="canvas-toolbar">
        <button onClick={addMultiplyNode} className="toolbar-button">
          ➕ Add Multiply Node
        </button>
        <span className="toolbar-info">
          Nodes: {nodes.length} | Edges: {edges.length}
        </span>
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background variant="dots" gap={12} size={1} />
        <Controls />
        <MiniMap zoomable pannable />
      </ReactFlow>
    </div>
  );
}
