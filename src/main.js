import './index.css';
import { configureLogger, logError, logInfo } from './utils/logger.js';
import { LOGGING_CONFIG } from './utils/constants.js';
import { getPreferences } from './utils/helpers.js';
import { mountReactApp } from './reactApp/mountReactApp.jsx';

function initializeApplication() {
  try {
    configureLogger({ level: LOGGING_CONFIG.DEFAULT_LEVEL });

    applyStoredTheme();
    removeLegacyArtifacts();
    mountReactApp();
    /* istanbul ignore next */

    logInfo('🚀 React interface mounted successfully');
  } catch (error) {
    logError('❌ Failed to initialize application:', error);
    showFallbackError('Failed to initialize application. Please refresh the page.');
  }
}

function applyStoredTheme() {
  try {
    const prefs = getPreferences();
    const theme = prefs.theme === 'dark' ? 'dark' : 'light';
    document.documentElement.classList.toggle('dark', theme === 'dark');
  } catch (_) {
    document.documentElement.classList.remove('dark');
  }
}

function removeLegacyArtifacts() {
  document.documentElement.removeAttribute('data-theme');
  document.body.classList.remove('no-react');
  document.body.classList.remove('bg-gray-50', 'min-h-screen');
  document.body.style.removeProperty('background-color');

  const existingHost = document.getElementById('app-root');
  const host = existingHost || document.createElement('div');
  host.id = 'app-root';
  host.dataset.reactHost = 'true';

  const preservedNodes = new Set([host]);

  Array.from(document.body.children).forEach((node) => {
    if (preservedNodes.has(node)) return;
    if (node.tagName === 'SCRIPT') return;
    node.remove();
  });

  if (!existingHost) {
    document.body.prepend(host);
  }

  document
    .querySelectorAll('script[src*="cdn.tailwindcss.com"], link[href*="font-awesome"], link[href*="fonts.googleapis"]')
    .forEach((el) => el.remove());

  document.querySelectorAll('style[id^="tailwind"], style[data-tailwind], style[tailwind]').forEach((el) => {
    el.remove();
  });
}

function showFallbackError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #f8d7da;
        color: #721c24;
        padding: 15px;
        border-radius: 8px;
        border: 1px solid #f5c6cb;
        z-index: 9999;
        max-width: 500px;
        text-align: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
  errorDiv.setAttribute('role', 'alert');
  const safeMessage = typeof message === 'string' && message.trim().length > 0
    ? message.trim()
    : 'An unexpected error occurred. Please refresh the page and try again.';
  errorDiv.textContent = safeMessage;

  document.body.appendChild(errorDiv);

  setTimeout(() => {
    if (errorDiv.parentNode) {
      errorDiv.remove();
    }
  }, 10000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApplication);
} else {
  initializeApplication();
}
