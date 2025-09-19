import React from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas } from './components/Canvas';
import '@xyflow/react/dist/style.css';
import './rf-theme.css';

function App() {
  return <Canvas />;
}

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}