/**
 * Unit Tests for Progress Display Component
 * Testing progress display functionality and cancel button
 * Following AGENTS.md principle: comprehensive component testing
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock DOM environment
document.body.innerHTML = `
    <div id="progressContainer"></div>
    <div id="progressCard" style="display: none;"></div>
`;

// Mock the constants
const constants = {
    STATUS_MESSAGES: {
        PROCESSING: 'Processing conversations...'
    }
};

// Mock the logger
const logger = {
    logInfo: jest.fn(),
    logWarn: jest.fn(),
    logError: jest.fn()
};

describe('Progress Display Component', () => {
    let ProgressDisplay;
    let progressDisplay;

    beforeEach(() => {
        // Reset DOM
        document.getElementById('progressContainer').innerHTML = '';
        document.getElementById('progressCard').style.display = 'none';
        
        // Reset mocks
        jest.clearAllMocks();
        
        // Mock window.switchToView
        global.window = {
            switchToView: jest.fn()
        };
        
        // Mock the module imports
        jest.doMock('../../../src/utils/constants.js', () => constants);
        jest.doMock('../../../src/utils/logger.js', () => logger);
        
        // Import the component
        const module = require('../../../src/components/ProgressDisplay.js');
        ProgressDisplay = module.ProgressDisplay;
        
        progressDisplay = new ProgressDisplay('progressContainer');
    });

    afterEach(() => {
        jest.dontMock('../../../src/utils/constants.js');
        jest.dontMock('../../../src/utils/logger.js');
    });

    describe('initialization', () => {
        test('should initialize with correct container', () => {
            expect(progressDisplay.container).toBeDefined();
            expect(progressDisplay.container.id).toBe('progressContainer');
        });

        test('should handle missing container gracefully', () => {
            const invalidProgressDisplay = new ProgressDisplay('nonexistent');
            expect(invalidProgressDisplay.container).toBeNull();
        });
    });

    describe('show method', () => {
        test('should show progress display without cancel button by default', () => {
            progressDisplay.show();
            
            expect(progressDisplay.isVisible).toBe(true);
            expect(progressDisplay.container.style.display).toBe('block');
            
            const cancelButton = progressDisplay.cancelButton;
            expect(cancelButton.style.display).toBe('none');
        });

        test('should show progress display with cancel button when requested', () => {
            progressDisplay.show(true);
            
            expect(progressDisplay.isVisible).toBe(true);
            expect(progressDisplay.container.style.display).toBe('block');
            
            const cancelButton = progressDisplay.cancelButton;
            expect(cancelButton.style.display).toBe('inline-flex');
            expect(cancelButton.disabled).toBe(false);
        });
    });

    describe('hide method', () => {
        test('should hide progress display', () => {
            progressDisplay.show();
            expect(progressDisplay.isVisible).toBe(true);
            
            progressDisplay.hide();
            
            expect(progressDisplay.isVisible).toBe(false);
            expect(progressDisplay.container.style.display).toBe('none');
        });
    });

    describe('updateProgress method', () => {
        test('should update progress with percentage and message', () => {
            progressDisplay.show();
            
            progressDisplay.updateProgress(50, 'Halfway done');
            
            const statusText = progressDisplay.statusText;
            expect(statusText.getAttribute('aria-valuenow')).toBe('50');
            expect(statusText.textContent).toBe('Halfway done');
        });

        test('should handle 100% completion styling', () => {
            progressDisplay.show();
            
            progressDisplay.updateProgress(100, 'Complete');
            
            const statusText = progressDisplay.statusText;
            expect(statusText.className).toContain('success');
        });
    });

    describe('showError method', () => {
        test('should display error message with correct styling', () => {
            progressDisplay.show();
            
            progressDisplay.showError('Something went wrong');
            
            const statusText = progressDisplay.statusText;
            expect(statusText.textContent).toBe('Something went wrong');
            expect(statusText.className).toContain('error');
            expect(statusText.getAttribute('role')).toBe('alert');
        });
    });

    describe('cancel button functionality', () => {
        test('should set cancel callback', () => {
            const mockCallback = jest.fn();
            progressDisplay.setCancelCallback(mockCallback);
            
            expect(progressDisplay.onCancelCallback).toBe(mockCallback);
        });

        test('should handle cancel button click', () => {
            const mockCallback = jest.fn();
            progressDisplay.setCancelCallback(mockCallback);
            progressDisplay.show(true);
            
            // Simulate cancel button click
            progressDisplay.handleCancel();
            
            expect(mockCallback).toHaveBeenCalled();
            expect(progressDisplay.cancelButton.disabled).toBe(true);
            expect(progressDisplay.cancelButton.textContent).toBe('Cancelling...');
        });

        test('should handle cancel button click without callback', () => {
            progressDisplay.show(true);
            
            // Should not throw error when no callback is set
            expect(() => {
                progressDisplay.handleCancel();
            }).not.toThrow();
        });
    });

    describe('DOM structure', () => {
        test('should create correct DOM structure on initialization', () => {
            progressDisplay.initialize();
            
            const statusText = progressDisplay.container.querySelector('#statusText');
            const cancelButton = progressDisplay.container.querySelector('#cancelButton');
            
            expect(statusText).toBeDefined();
            expect(statusText.getAttribute('role')).toBe('progressbar');
            expect(statusText.getAttribute('aria-live')).toBe('polite');
            
            expect(cancelButton).toBeDefined();
            expect(cancelButton.className).toContain('btn');
            expect(cancelButton.className).toContain('btn-secondary');
            expect(cancelButton.className).toContain('cancel-btn');
        });
    });
}); 