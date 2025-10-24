import { useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  ReactFlowProvider
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { SchemaNodeTable } from './components/SchemaNodeTable';
import { SchemaNodeTreeView } from './components/SchemaNodeTreeView';
import { FunctoidNode } from './components/FunctoidNode';
import { sourceSchema, targetSchema, flattenSchema } from './schemas';
import { buildSchemaTree } from './schemas-tree';
import './App.css';

// Toggle between 'table' (flat) or 'tree' (hierarchical) view
const SCHEMA_VIEW_MODE = 'tree'; // Change to 'table' for flat view

const nodeTypes = {
  schema: SCHEMA_VIEW_MODE === 'tree' ? SchemaNodeTreeView : SchemaNodeTable,
  functoid: FunctoidNode
};

let functoidId = 0;

const sourceTerminals = flattenSchema(sourceSchema);
const targetTerminals = flattenSchema(targetSchema);
const sourceTree = buildSchemaTree(sourceSchema);
const targetTree = buildSchemaTree(targetSchema);

const initialNodes = [
  {
    id: 'source-schema',
    type: 'schema',
    position: { x: 50, y: 50 },
    data: {
      side: 'source',
      schema: sourceSchema,
      terminals: sourceTerminals,
      tree: sourceTree
    },
    draggable: false
  },
  {
    id: 'target-schema',
    type: 'schema',
    position: { x: 950, y: 50 },
    data: {
      side: 'target',
      schema: targetSchema,
      terminals: targetTerminals,
      tree: targetTree
    },
    draggable: false
  }
];

function MapperFlow() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const onConnect = useCallback((params) => {
    setEdges((eds) => addEdge({
      ...params,
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#3b82f6', strokeWidth: 2 }
    }, eds));
  }, [setEdges]);

  const addMultiplyNode = () => {
    const newNode = {
      id: `functoid-${functoidId++}`,
      type: 'functoid',
      position: { x: 500, y: 200 + functoidId * 100 },
      data: {
        label: 'Multiply',
        icon: '×',
        category: 'math'
      }
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const addConcatNode = () => {
    const newNode = {
      id: `functoid-${functoidId++}`,
      type: 'functoid',
      position: { x: 500, y: 200 + functoidId * 100 },
      data: {
        label: 'Concat',
        icon: '&',
        category: 'string'
      }
    };
    setNodes((nds) => [...nds, newNode]);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>🗺️ Mapper V2 - {SCHEMA_VIEW_MODE === 'tree' ? 'Tree Hierarchy' : 'Database Schema Style'}</h1>
        <p>{SCHEMA_VIEW_MODE === 'tree' ? 'Hierarchical tree with labeled handles' : 'Table-based schema nodes with labeled handles'}</p>
      </header>

      <div className="canvas-toolbar">
        <button onClick={addMultiplyNode} className="toolbar-button">
          ➕ Add Multiply (×)
        </button>
        <button onClick={addConcatNode} className="toolbar-button">
          ➕ Add Concat (&)
        </button>
        <span className="toolbar-info">
          Edges: {edges.length}
        </span>
      </div>

      <div className="mapper-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
        >
          <Background variant="dots" gap={16} size={1} />
          <Controls />
          <MiniMap
            nodeColor={(node) => {
              if (node.type === 'schema') {
                return node.data.side === 'source' ? '#3b82f6' : '#10b981';
              }
              return '#fbbf24';
            }}
          />
        </ReactFlow>
      </div>

      <footer className="app-footer">
        <div className="instructions">
          <strong>✨ {SCHEMA_VIEW_MODE === 'tree' ? 'Tree Hierarchy View' : 'Database Schema Style'}:</strong>
          <ul>
            {SCHEMA_VIEW_MODE === 'tree' ? (
              <>
                <li>🌲 <strong>Tree structure</strong> - Shows schema hierarchy with expand/collapse</li>
                <li>🏷️ <strong>Labeled handles</strong> - Only on leaf nodes (actual data fields)</li>
                <li>📂 <strong>Expand/collapse</strong> - Click arrows to show/hide nested fields</li>
                <li>🔗 Connect <strong>field → field</strong> or use <strong>functoids</strong> for transforms</li>
                <li>🔍 <strong>Search</strong> to filter fields</li>
              </>
            ) : (
              <>
                <li>📊 <strong>Table structure</strong> - Clean, organized field list</li>
                <li>🏷️ <strong>Labeled handles</strong> - Field names integrated with connection points</li>
                <li>🔗 Connect <strong>field → field</strong> or use <strong>functoids</strong> for transforms</li>
                <li>🎯 <strong>Professional look</strong> - Matches database diagram standards</li>
                <li>💡 <strong>Hover</strong> to see full field paths</li>
                <li>🔍 <strong>Search</strong> to filter fields</li>
              </>
            )}
          </ul>
        </div>
      </footer>
    </div>
  );
}

function App() {
  return (
    <ReactFlowProvider>
      <MapperFlow />
    </ReactFlowProvider>
  );
}

export default App;
