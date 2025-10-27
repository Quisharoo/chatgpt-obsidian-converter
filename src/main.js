import { configureLogger, logError, logInfo } from './utils/logger.js';
import { LOGGING_CONFIG } from './utils/constants.js';
import { getPreferences } from './utils/helpers.js';
import { mountReactApp } from './reactApp/mountReactApp.jsx';

function initializeApplication() {
  try {
    configureLogger({ level: LOGGING_CONFIG.DEFAULT_LEVEL });

    applyStoredTheme();
    addPulseAnimation();
    addAccessibilityStyles();
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
    document.documentElement.setAttribute('data-theme', prefs.theme || 'dark');
  } catch (_) {}
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

function addPulseAnimation() {
  if (document.getElementById('pulseStyle')) return;

  const style = document.createElement('style');
  style.id = 'pulseStyle';
  style.textContent = `
        @keyframes pulse {
            0% { box-shadow: 0 0 0 0 rgba(40, 167, 69, 0.7); }
            70% { box-shadow: 0 0 0 10px rgba(40, 167, 69, 0); }
            100% { box-shadow: 0 0 0 0 rgba(40, 167, 69, 0); }
        }
        
        .pulse {
            animation: pulse 2s infinite;
        }
    `;
  document.head.appendChild(style);
}

function addAccessibilityStyles() {
  if (document.getElementById('accessibilityStyles')) return;

  const style = document.createElement('style');
  style.id = 'accessibilityStyles';
  style.textContent = `
        .sr-only {
            position: absolute !important;
            width: 1px !important;
            height: 1px !important;
            padding: 0 !important;
            margin: -1px !important;
            overflow: hidden !important;
            clip: rect(0, 0, 0, 0) !important;
            white-space: nowrap !important;
            border: 0 !important;
        }
        
        @media (prefers-reduced-motion: reduce) {
            .progress-fill,
            .btn,
            .upload-area {
                transition: none !important;
                animation: none !important;
            }
        }
    `;
  document.head.appendChild(style);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApplication);
} else {
  initializeApplication();
}
