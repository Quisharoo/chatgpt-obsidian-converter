/**
 * Main Application Entry Point
 * Initializes the ChatGPT to Markdown converter with clean architecture
 * Following AGENTS.md principle: clean separation of concerns and initialization
 */

import { ChatGPTConverter } from './modules/applicationOrchestrator.js';
import { logInfo, logError, configureLogger } from './utils/logger.js';
import { LOGGING_CONFIG } from './utils/constants.js';
import { getPreferences, setPreferences } from './utils/helpers.js';

/**
 * Global application instance
 * WHY: Provides single point of control for the application
 */
let converterApp = null;

/**
 * Initialize the application
 * WHY: Sets up the application and provides error handling for initialization
 */
function initializeApplication() {
    try {
        // Configure logging
        configureLogger({ level: LOGGING_CONFIG.DEFAULT_LEVEL });
        
        // Create application instance
        converterApp = new ChatGPTConverter();
        
        // Add global error handling
        window.addEventListener('error', handleGlobalError);
        window.addEventListener('unhandledrejection', handleUnhandledRejection);
        
        // Add pulse animation CSS if not present
        addPulseAnimation();
        
        // Add screen reader only styles if not present
        addAccessibilityStyles();
        
        // Apply theme from prefs
        try {
            const prefs = getPreferences();
            document.documentElement.setAttribute('data-theme', prefs.theme || 'dark');
        } catch (_) {}

        // Inject DevUI CSS/JS via CDN (no index.html edits)
        try {
            const devuiCss = document.createElement('link');
            devuiCss.rel = 'stylesheet';
            devuiCss.href = 'https://cdn.jsdelivr.net/npm/devui-css@latest/dist/devui.min.css';
            document.head.appendChild(devuiCss);
        } catch (_) {}

        logInfo('🚀 Application initialized successfully');
        
        // Register service worker for offline capability (manifest deferred)
        if ('serviceWorker' in navigator && location.protocol !== 'file:') {
            const swUrl = '/sw.js';
            try {
                // Check availability and content-type before registering to avoid MIME errors
                fetch(swUrl, { method: 'HEAD', cache: 'no-store' })
                    .then((resp) => {
                        const contentType = (resp.headers && resp.headers.get && resp.headers.get('content-type')) || '';
                        const isJs = /javascript|ecmascript/i.test(contentType);
                        if (resp.ok && isJs) {
                            return navigator.serviceWorker.register(swUrl)
                                .then(() => {
                                    logInfo('🛡️ Service worker registration initiated');
                                })
                                .catch((e) => {
                                    logError('Service worker registration failed (async):', e);
                                });
                        } else {
                            logInfo('ℹ️ Service worker not registered (missing or wrong content-type)');
                            return null;
                        }
                    })
                    .catch((e) => {
                        // HEAD check failed; skip registration to avoid noisy console errors
                        logInfo('ℹ️ Skipping service worker (pre-check failed)');
                    });
            } catch (e) {
                logError('Service worker registration failed (sync):', e);
            }
        }

    } catch (error) {
        logError('❌ Failed to initialize application:', error);
        showFallbackError('Failed to initialize application. Please refresh the page.');
    }
}

/**
 * Handle global JavaScript errors
 * WHY: Provides graceful error handling and user feedback
 * 
 * @param {ErrorEvent} event - Error event
 */
function handleGlobalError(event) {
    logError('Global error:', event.error);
    
    // Don't show user errors for known harmless issues
    if (event.error?.message?.includes('Non-Error promise rejection')) {
        return;
    }
    // Ignore resource loading/CORS noise and known benign errors
    const msg = String(event?.message || '');
    if (msg.includes('Script error.') || msg.includes('ResizeObserver loop') || msg.includes('favicon.ico')) {
        return;
    }
    
    showFallbackError('An unexpected error occurred. Please try refreshing the page.');
}

/**
 * Handle unhandled promise rejections
 * WHY: Catches async errors that might otherwise be silent
 * 
 * @param {PromiseRejectionEvent} event - Rejection event
 */
function handleUnhandledRejection(event) {
    logError('Unhandled promise rejection:', event.reason);
    
    // Don't show user errors for known harmless issues
    if (event.reason?.name === 'AbortError') {
        return; // User cancelled operation
    }
    const reasonMsg = String(event?.reason?.message || '');
    if (reasonMsg.includes('ResizeObserver') || reasonMsg.includes('Non-Error promise rejection')) {
        return;
    }
    
    showFallbackError('An error occurred during processing. Please try again.');
}

/**
 * Show fallback error message when normal UI is unavailable
 * WHY: Ensures users always get feedback even when application fails to initialize
 * 
 * @param {string} message - Error message to display
 */
function showFallbackError(message) {
    // Try to find status element first
    const statusElement = document.getElementById('statusText');
    if (statusElement) {
        statusElement.textContent = message;
        statusElement.className = 'status error';
        statusElement.setAttribute('role', 'alert');
        return;
    }
    
    // Fallback: create error display
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
    errorDiv.textContent = message;
    
    document.body.appendChild(errorDiv);
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
        if (errorDiv.parentNode) {
            errorDiv.remove();
        }
    }, 10000);
}

/**
 * Add pulse animation CSS for save button
 * WHY: Provides visual feedback for save button state
 */
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

/**
 * Add screen reader only styles for accessibility
 * WHY: Ensures screen reader content is properly hidden visually
 */
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
        
        /* Focus styles for better keyboard navigation */
        .upload-area:focus,
        .btn:focus,
        button:focus {
            outline: 2px solid #667eea;
            outline-offset: 2px;
        }
        
        /* High contrast mode support */
        @media (prefers-contrast: high) {
            .btn {
                border: 2px solid currentColor;
            }
            
            .upload-area {
                border-width: 3px;
                border-style: solid;
            }
        }
        
        /* Reduced motion support */
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

/**
 * Get current application instance
 * WHY: Allows external access to application for debugging or extensions
 * 
 * @returns {ChatGPTConverter|null} - Current application instance
 */
function getApplicationInstance() {
    return converterApp;
}

/**
 * Restart the application
 * WHY: Allows recovery from errors or reset of state
 */
function restartApplication() {
    if (converterApp) {
        converterApp.reset();
    }
    
    // Clear any error displays
    const errorElements = document.querySelectorAll('[role="alert"]');
    errorElements.forEach(el => {
        if (el.parentNode && !el.id) { // Don't remove permanent elements
            el.remove();
        }
    });
    
    initializeApplication();
}

// Export for potential external use
window.ChatGPTConverterApp = {
    getInstance: getApplicationInstance,
    restart: restartApplication
};



// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApplication);
} else {
    // DOM already loaded
    initializeApplication();
} 

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) return;
    // Cmd/Ctrl+U to open upload dialog
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'u') {
        const app = window.ChatGPTConverterApp.getInstance();
        const uploader = app && app.fileUploader;
        if (uploader && uploader.fileInput) {
            e.preventDefault();
            uploader.fileInput.click();
        }
    }
    // Cmd/Ctrl+S to save all (if directory already selected)
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        const app = window.ChatGPTConverterApp.getInstance();
        if (app && typeof app.handleLocalSave === 'function') {
            e.preventDefault();
            app.handleLocalSave();
        }
    }
    // Cmd/Ctrl+R to restart flow
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        window.ChatGPTConverterApp.restart();
    }
});