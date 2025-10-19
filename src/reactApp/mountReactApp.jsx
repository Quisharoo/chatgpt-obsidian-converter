import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

let root = null;

export function mountReactApp() {
  if (typeof document === 'undefined') return;

  const existing = document.getElementById('react-control-panel');
  const container = existing || createContainer();

  if (!root) {
    root = createRoot(container);
  }

  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

function createContainer() {
  const container = document.createElement('div');
  container.id = 'react-control-panel';
  container.className = 'w-full';

  const host = document.querySelector('.container') || document.body;
  const legacyHeader = host.querySelector('header');
  const legacyMain = host.querySelector('main');
  if (legacyHeader) legacyHeader.style.display = 'none';
  if (legacyMain) legacyMain.style.display = 'none';
  host.insertBefore(container, host.firstChild);
  return container;
}
