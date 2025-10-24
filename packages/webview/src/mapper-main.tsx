import React from 'react';
import { createRoot } from 'react-dom/client';
import { ReactFlowProvider } from '@xyflow/react';
import { MapperCanvas } from './mapper/MapperCanvas';
import '@xyflow/react/dist/style.css';

function MapperApp() {
  return (
    <ReactFlowProvider>
      <MapperCanvas />
    </ReactFlowProvider>
  );
}

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<MapperApp />);
}
