import React from 'react';
import ReactDOM from 'react-dom/client';
import { InstanceMonitorApp } from './InstanceMonitorApp';

const root = document.getElementById('root');
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <InstanceMonitorApp />
    </React.StrictMode>
  );
}
