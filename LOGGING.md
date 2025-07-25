# Logging System

This document explains the logging system implemented in the ChatGPT to Markdown converter.

## Overview

The application now uses a centralized logging system with configurable levels to reduce console noise while maintaining the ability to capture important information for debugging and monitoring.

## Log Levels

The logging system supports five levels (in order of increasing verbosity):

- **ERROR** (0): Critical errors that need immediate attention
- **WARN** (1): Warning messages for potential issues
- **INFO** (2): General information about application state (default)
- **DEBUG** (3): Detailed debugging information
- **TRACE** (4): Most verbose logging for deep debugging

## Default Behavior

By default, the application logs at the **INFO** level, which means:
- ✅ ERROR, WARN, and INFO messages are displayed
- ❌ DEBUG and TRACE messages are suppressed

## Configuration

### Environment-Based Configuration

The logger automatically detects debug mode through:

1. **URL Parameter**: Add `?debug=true` to the URL
2. **Local Storage**: Set `chatgpt-converter-debug` to `true` in browser localStorage

### Programmatic Configuration

You can configure the logger programmatically:

```javascript
import { configureLogger, setLogLevel, LOG_LEVELS } from './src/utils/logger.js';

// Set log level
setLogLevel('DEBUG'); // or 'ERROR', 'WARN', 'INFO', 'TRACE'

// Configure multiple options
configureLogger({
    level: LOG_LEVELS.DEBUG,
    enableConsole: true,
    enableExternal: false,
    externalLogger: null
});
```

## External Logging Integration

The logging system is designed to support external logging services like Datadog:

```javascript
import { configureLogger, LOG_LEVELS } from './src/utils/logger.js';

// Configure external logging
configureLogger({
    level: LOG_LEVELS.INFO,
    enableConsole: true,
    enableExternal: true,
    externalLogger: (logEntry) => {
        // Send to Datadog or other service
        datadogLogger.log(logEntry);
    }
});
```

## Log Entry Format

Each log entry includes:

```javascript
{
    timestamp: "2024-01-15T10:30:00.000Z",
    level: "INFO",
    message: "Application initialized successfully",
    data: null, // Optional additional data
    context: {
        userAgent: "Mozilla/5.0...",
        url: "https://example.com"
    }
}
```

## Usage Examples

### Basic Logging

```javascript
import { logInfo, logWarn, logError, logDebug } from './src/utils/logger.js';

logInfo('Application started');
logWarn('File size is large');
logError('Failed to save file', error);
logDebug('Processing file', { filename: 'conversations.json', size: 1024 });
```

### Conditional Debugging

```javascript
import { logDebug } from './src/utils/logger.js';

// This will only log when debug mode is enabled
logDebug('Processing conversation', { id: conversation.id, title: conversation.title });
```

## Migration from console.log

The logging system replaces excessive `console.log` statements with appropriate log levels:

- **console.log** → `logInfo()` or `logDebug()` depending on importance
- **console.warn** → `logWarn()`
- **console.error** → `logError()`

## Benefits

1. **Reduced Console Noise**: Only important messages are shown by default
2. **Configurable Verbosity**: Enable detailed logging when needed
3. **External Integration Ready**: Easy to integrate with monitoring services
4. **Structured Data**: Consistent log format with timestamps and context
5. **Performance**: Debug logs are completely skipped when not needed

## Debug Mode

To enable debug mode for development:

1. **Browser**: Add `?debug=true` to the URL
2. **Permanent**: Set `localStorage.setItem('chatgpt-converter-debug', 'true')`
3. **Programmatic**: Call `setLogLevel('DEBUG')`

Debug mode will show all log levels including detailed debugging information about:
- File processing steps
- Directory scanning operations
- Column sorting events
- API detection results 