import React from 'react';
import ReactDOM from 'react-dom/client';
import { TestRunnerApp } from './TestRunnerApp';

const root = document.getElementById('root');
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <TestRunnerApp />
    </React.StrictMode>
  );
}
