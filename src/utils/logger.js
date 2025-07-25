/**
 * Logging Utility
 * Centralized logging system with configurable levels
 * Following AGENTS.md principle: modular, focused functionality
 */

// Log levels in order of severity
export const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
    TRACE: 4
};

// Default configuration
const DEFAULT_CONFIG = {
    level: LOG_LEVELS.INFO, // Default to INFO level
    enableConsole: true,    // Enable console output by default
    enableExternal: false,  // Disable external logging by default
    externalLogger: null    // Function for external logging (e.g., Datadog)
};

// Initialize config immediately
let config = { ...DEFAULT_CONFIG };

// Check for debug mode immediately if in browser environment
if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    const debugMode = urlParams.get('debug') === 'true' || 
                     localStorage.getItem('chatgpt-converter-debug') === 'true';
    
    if (debugMode) {
        config.level = LOG_LEVELS.DEBUG;
    }
}

/**
 * Configure the logger
 * @param {Object} options - Configuration options
 */
export function configureLogger(options = {}) {
    config = { ...config, ...options };
}

/**
 * Get current log level name
 * @returns {string} - Current log level name
 */
function getCurrentLevelName() {
    return Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key] === config.level) || 'INFO';
}

/**
 * Format log message with timestamp and level
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {*} data - Optional data to log
 * @returns {Object} - Formatted log entry
 */
function formatLogEntry(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const entry = {
        timestamp,
        level,
        message,
        data,
        context: {
            userAgent: navigator.userAgent,
            url: window.location.href
        }
    };

    return entry;
}

/**
 * Internal logging function
 * @param {number} level - Log level number
 * @param {string} levelName - Log level name
 * @param {string} message - Log message
 * @param {*} data - Optional data
 */
function log(level, levelName, message, data = null) {
    if (level > config.level) {
        return; // Skip if below current log level
    }

    const entry = formatLogEntry(levelName, message, data);

    // Console output
    if (config.enableConsole) {
        const consoleMethod = levelName.toLowerCase();
        if (consoleMethod in console && typeof console[consoleMethod] === 'function') {
            if (data) {
                console[consoleMethod](message, data);
            } else {
                console[consoleMethod](message);
            }
        } else {
            // Fallback to console.log
            console.log(`[${levelName}] ${message}`, data || '');
        }
    }

    // External logging (e.g., Datadog)
    if (config.enableExternal && config.externalLogger && typeof config.externalLogger === 'function') {
        try {
            config.externalLogger(entry);
        } catch (error) {
            // Don't let external logging errors break the app
            console.warn('External logging failed:', error);
        }
    }
}

/**
 * Log error messages
 * @param {string} message - Error message
 * @param {*} data - Optional error data
 */
export function logError(message, data = null) {
    log(LOG_LEVELS.ERROR, 'ERROR', message, data);
}

/**
 * Log warning messages
 * @param {string} message - Warning message
 * @param {*} data - Optional warning data
 */
export function logWarn(message, data = null) {
    log(LOG_LEVELS.WARN, 'WARN', message, data);
}

/**
 * Log info messages
 * @param {string} message - Info message
 * @param {*} data - Optional info data
 */
export function logInfo(message, data = null) {
    log(LOG_LEVELS.INFO, 'LOG', message, data);
}

/**
 * Log debug messages
 * @param {string} message - Debug message
 * @param {*} data - Optional debug data
 */
export function logDebug(message, data = null) {
    log(LOG_LEVELS.DEBUG, 'DEBUG', message, data);
}

/**
 * Log trace messages (most verbose)
 * @param {string} message - Trace message
 * @param {*} data - Optional trace data
 */
export function logTrace(message, data = null) {
    log(LOG_LEVELS.TRACE, 'TRACE', message, data);
}

/**
 * Convenience method for logging with emoji prefixes (for backward compatibility)
 * @param {string} message - Log message
 * @param {*} data - Optional data
 */
export function logWithEmoji(message, data = null) {
    logInfo(message, data);
}

/**
 * Get current logger configuration
 * @returns {Object} - Current configuration
 */
export function getLoggerConfig() {
    return { ...config };
}

/**
 * Set log level by name
 * @param {string} levelName - Log level name (ERROR, WARN, INFO, DEBUG, TRACE)
 */
export function setLogLevel(levelName) {
    const level = LOG_LEVELS[levelName.toUpperCase()];
    if (level !== undefined) {
        config.level = level;
        logInfo(`Log level set to: ${levelName.toUpperCase()}`);
    } else {
        logWarn(`Invalid log level: ${levelName}. Available levels: ${Object.keys(LOG_LEVELS).join(', ')}`);
    }
}

 