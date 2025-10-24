import { useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { SchemaTree } from './components/SchemaTree';
import { MapperCanvas } from './components/MapperCanvas';
import { flattenSchema, sourceSchema, targetSchema } from './schemas';
import './App.css';

function App() {
  const [mappedFields, setMappedFields] = useState(new Set());

  const sourceTerminals = flattenSchema(sourceSchema);
  const targetTerminals = flattenSchema(targetSchema);

  const handleMappedFieldsChange = (fieldId) => {
    setMappedFields(prev => new Set([...prev, fieldId]));
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>🗺️ Mapper Prototype</h1>
        <p>Demonstrating Canvas Architecture: Trees + React Flow</p>
      </header>

      <div className="mapper-layout">
        <SchemaTree
          side="source"
          terminals={sourceTerminals}
          mappedFields={mappedFields}
        />

        <ReactFlowProvider>
          <MapperCanvas onMappedFieldsChange={handleMappedFieldsChange} />
        </ReactFlowProvider>

        <SchemaTree
          side="target"
          terminals={targetTerminals}
          mappedFields={mappedFields}
        />
      </div>

      <footer className="app-footer">
        <div className="instructions">
          <strong>Instructions:</strong>
          <ul>
            <li>1️⃣ Drag fields from <strong>Source Tree</strong> (left) onto the canvas</li>
            <li>2️⃣ Click <strong>"Add Multiply Node"</strong> to add a functoid</li>
            <li>3️⃣ Drag fields from <strong>Target Tree</strong> (right) onto the canvas</li>
            <li>4️⃣ Connect nodes by dragging from output handles (right side) to input handles (left side)</li>
            <li>5️⃣ Notice: All edges are <strong>pure React Flow edges</strong> between canvas nodes ✅</li>
          </ul>
        </div>
      </footer>
    </div>
  );
}

export default App;
