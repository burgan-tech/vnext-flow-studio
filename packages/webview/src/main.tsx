import React from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas } from './components/Canvas';
import '@xyflow/react/dist/style.css';
import './rf-theme.css';
import './enhanced-editors.css';
import './styles/reference-selector.css';
import './styles/palette.css';
import './styles/service-task-properties.css';
import './styles/comments.css';
import './styles/task-mapping-popup.css';
import './styles/mapping-section.css';
import './styles/task-search-panel.css';
import './styles/task-badges.css';
import './styles/state-toolbar.css';
import './styles/state-edit-popup.css';
import './styles/subflow-config-popup.css';

function App() {
  return <Canvas />;
}

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
