import React from 'react';
import ReactDOM from 'react-dom/client';
import { StreamViewer } from './StreamViewer';

const wsUrl = new URLSearchParams(window.location.search).get('ws') || `ws://${window.location.hostname}:3001`;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <StreamViewer wsUrl={wsUrl} title="P31 Agent Stream" />
  </React.StrictMode>
);
