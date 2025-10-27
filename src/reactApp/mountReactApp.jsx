import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

let root = null;
let rootContainer = null;

export function mountReactApp() {
  if (typeof document === 'undefined') return;

  const existing = document.getElementById('react-control-panel');
  const container = existing || createContainer();
  const containerChanged = container !== rootContainer;
  const containerDetached = rootContainer && !document.contains(rootContainer);

  if (!root || containerChanged || containerDetached) {
    if (root && (containerChanged || containerDetached)) {
      root.unmount();
    }
    root = createRoot(container);
    rootContainer = container;
  }

  root.render(
    React.createElement(
      React.StrictMode,
      null,
      React.createElement(App),
    ),
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
  
  // Mark container as loaded to show React content
  if (host.classList) {
    host.classList.add('loaded');
  }
  
  host.insertBefore(container, host.firstChild);
  return container;
}
