import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

const ROOT_ID = 'react-control-panel';
const HOST_ID = 'app-root';

let root = null;
let rootContainer = null;

export function mountReactApp() {
  if (typeof document === 'undefined') return;

  const existing = document.getElementById(ROOT_ID);
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
  const host = ensureHost();
  const container = document.createElement('div');
  container.id = ROOT_ID;
  container.className = 'w-full';

  if (host) {
    host.innerHTML = '';
    host.appendChild(container);
  }

  return container;
}

function ensureHost() {
  if (typeof document === 'undefined') return undefined;

  document.body.classList.remove('no-react');
  removeLegacyNodes();

  let host = document.getElementById(HOST_ID);
  if (!host) {
    host = document.createElement('div');
    host.id = HOST_ID;
    host.dataset.reactHost = 'true';
    document.body.prepend(host);
  } else {
    host.dataset.reactHost = 'true';
  }

  return host;
}

function removeLegacyNodes() {
  const legacyNodes = document.querySelectorAll('.container, body > header, body > main, body > footer');
  legacyNodes.forEach((node) => {
    if (node.dataset?.reactHost !== 'true') {
      node.remove();
    }
  });
}
