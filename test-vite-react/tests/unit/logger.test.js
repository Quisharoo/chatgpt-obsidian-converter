/**
 * Logger Unit Tests
 * Tests for the centralized logging system
 */

import { 
    logError, 
    logWarn, 
    logInfo, 
    logDebug, 
    logTrace,
    configureLogger,
    setLogLevel,
    LOG_LEVELS,
    getLoggerConfig
} from '../../../src/utils/logger.js';

// Mock console methods
const originalConsole = { ...console };
let consoleLogs = [];
let consoleWarns = [];
let consoleErrors = [];
let consoleDebugs = [];
let consoleTraces = [];

beforeEach(() => {
    // Reset console mocks
    consoleLogs = [];
    consoleWarns = [];
    consoleErrors = [];
    consoleDebugs = [];
    consoleTraces = [];
    
    // Mock console methods
    console.log = jest.fn((...args) => consoleLogs.push(args));
    console.warn = jest.fn((...args) => consoleWarns.push(args));
    console.error = jest.fn((...args) => consoleErrors.push(args));
    console.debug = jest.fn((...args) => consoleDebugs.push(args));
    console.trace = jest.fn((...args) => consoleTraces.push(args));
    
    // Reset logger to default state
    configureLogger({
        level: LOG_LEVELS.INFO,
        enableConsole: true,
        enableExternal: false,
        externalLogger: null
    });
});

afterEach(() => {
    // Restore original console
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    console.debug = originalConsole.debug;
    console.trace = originalConsole.trace;
});

describe('Logger Configuration', () => {
    test('should have correct default configuration', () => {
        const config = getLoggerConfig();
        expect(config.level).toBe(LOG_LEVELS.INFO);
        expect(config.enableConsole).toBe(true);
        expect(config.enableExternal).toBe(false);
    });

    test('should configure logger with custom settings', () => {
        configureLogger({
            level: LOG_LEVELS.DEBUG,
            enableConsole: false
        });
        
        const config = getLoggerConfig();
        expect(config.level).toBe(LOG_LEVELS.DEBUG);
        expect(config.enableConsole).toBe(false);
    });

    test('should set log level by name', () => {
        setLogLevel('DEBUG');
        const config = getLoggerConfig();
        expect(config.level).toBe(LOG_LEVELS.DEBUG);
    });

    test('should handle invalid log level gracefully', () => {
        setLogLevel('INVALID_LEVEL');
        const config = getLoggerConfig();
        expect(config.level).toBe(LOG_LEVELS.INFO); // Should remain at default
    });
});

describe('Log Level Filtering', () => {
    test('should log ERROR level messages at INFO level', () => {
        logError('Test error');
        expect(consoleErrors).toHaveLength(1);
        expect(consoleErrors[0][0]).toBe('Test error');
    });

    test('should log WARN level messages at INFO level', () => {
        logWarn('Test warning');
        expect(consoleWarns).toHaveLength(1);
        expect(consoleWarns[0][0]).toBe('Test warning');
    });

    test('should log INFO level messages at INFO level', () => {
        logInfo('Test info');
        expect(consoleLogs).toHaveLength(1);
        expect(consoleLogs[0][0]).toBe('Test info');
    });

    test('should NOT log DEBUG level messages at INFO level', () => {
        logDebug('Test debug');
        expect(consoleDebugs).toHaveLength(0);
    });

    test('should NOT log TRACE level messages at INFO level', () => {
        logTrace('Test trace');
        expect(consoleTraces).toHaveLength(0);
    });

    test('should log DEBUG level messages when set to DEBUG level', () => {
        setLogLevel('DEBUG');
        logDebug('Test debug');
        expect(consoleDebugs).toHaveLength(1);
        expect(consoleDebugs[0][0]).toBe('Test debug');
    });

    test('should log all levels when set to TRACE level', () => {
        setLogLevel('TRACE');
        
        logError('Test error');
        logWarn('Test warning');
        logInfo('Test info');
        logDebug('Test debug');
        logTrace('Test trace');
        
        expect(consoleErrors).toHaveLength(1);
        expect(consoleWarns).toHaveLength(1);
        expect(consoleLogs).toHaveLength(2); // INFO (including the setLogLevel message)
        expect(consoleDebugs).toHaveLength(1); // DEBUG
        expect(consoleTraces).toHaveLength(1); // TRACE
    });
});

describe('Log Data Handling', () => {
    test('should handle log messages with data', () => {
        const testData = { key: 'value', number: 42 };
        logInfo('Test message', testData);
        
        expect(consoleLogs).toHaveLength(1);
        expect(consoleLogs[0][0]).toBe('Test message');
        expect(consoleLogs[0][1]).toEqual(testData);
    });

    test('should handle log messages without data', () => {
        logInfo('Test message');
        
        expect(consoleLogs).toHaveLength(1);
        expect(consoleLogs[0][0]).toBe('Test message');
        expect(consoleLogs[0][1]).toBeUndefined();
    });
});

describe('Console Output Control', () => {
    test('should not output to console when disabled', () => {
        configureLogger({ enableConsole: false });
        logInfo('Test message');
        expect(consoleLogs).toHaveLength(0);
    });

    test('should output to console when enabled', () => {
        configureLogger({ enableConsole: true });
        logInfo('Test message');
        expect(consoleLogs).toHaveLength(1);
    });
});

describe('External Logging', () => {
    test('should call external logger when configured', () => {
        const externalLogger = jest.fn();
        configureLogger({
            enableExternal: true,
            externalLogger
        });
        
        logInfo('Test message', { data: 'test' });
        
        expect(externalLogger).toHaveBeenCalledWith(
            expect.objectContaining({
                level: 'LOG',
                message: 'Test message',
                data: { data: 'test' },
                timestamp: expect.any(String),
                context: expect.objectContaining({
                    userAgent: expect.any(String),
                    url: expect.any(String)
                })
            })
        );
    });

    test('should not call external logger when disabled', () => {
        const externalLogger = jest.fn();
        configureLogger({
            enableExternal: false,
            externalLogger
        });
        
        logInfo('Test message');
        expect(externalLogger).not.toHaveBeenCalled();
    });

    test('should handle external logger errors gracefully', () => {
        const externalLogger = jest.fn().mockImplementation(() => {
            throw new Error('External logger failed');
        });
        
        configureLogger({
            enableExternal: true,
            externalLogger
        });
        
        // Should not throw error
        expect(() => {
            logInfo('Test message');
        }).not.toThrow();
        
        // Should still log to console
        expect(consoleLogs).toHaveLength(1);
    });
});

describe('LOG_LEVELS Constants', () => {
    test('should have correct level hierarchy', () => {
        expect(LOG_LEVELS.ERROR).toBe(0);
        expect(LOG_LEVELS.WARN).toBe(1);
        expect(LOG_LEVELS.INFO).toBe(2);
        expect(LOG_LEVELS.DEBUG).toBe(3);
        expect(LOG_LEVELS.TRACE).toBe(4);
    });
}); 