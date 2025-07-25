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
    <div id="uploadCard" style="display: block;"></div>
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
        document.getElementById('uploadCard').style.display = 'block';
        
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
            expect(progressDisplay.cancelButton.textContent).toContain('Cancelling...');
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

    describe('Progress bar visibility logic', () => {
        test('should show only one progress bar at a time', () => {
            // Mock DOM elements
            const mockProgressCard = { style: { display: 'none' } };
            const mockConversionProgressCard = { style: { display: 'none' } };
            
            // Mock document.getElementById
            const originalGetElementById = document.getElementById;
            document.getElementById = jest.fn((id) => {
                if (id === 'progressCard') return mockProgressCard;
                if (id === 'conversionProgressCard') return mockConversionProgressCard;
                return null;
            });
            
            // Test conversion progress (should show conversion card)
            progressDisplay.show(false, false);
            expect(mockConversionProgressCard.style.display).toBe('block');
            expect(mockProgressCard.style.display).toBe('none');
            
            // Reset display
            mockProgressCard.style.display = 'none';
            mockConversionProgressCard.style.display = 'none';
            
            // Test save progress (should show files card)
            progressDisplay.show(true, true);
            expect(mockProgressCard.style.display).toBe('block');
            expect(mockConversionProgressCard.style.display).toBe('none');
            
            // Restore original function
            document.getElementById = originalGetElementById;
        });

        test('should visually update progress bar width', () => {
            progressDisplay.initialize();
            progressDisplay.show();
            
            // Test 0% progress
            progressDisplay.updateProgress(0, 'Starting...');
            expect(progressDisplay.progressFill.style.width).toBe('0%');
            
            // Test 50% progress
            progressDisplay.updateProgress(50, 'Halfway...');
            expect(progressDisplay.progressFill.style.width).toBe('50%');
            
            // Test 100% progress
            progressDisplay.updateProgress(100, 'Complete');
            expect(progressDisplay.progressFill.style.width).toBe('100%');
            expect(progressDisplay.statusText.className).toContain('success');
        });

        test('should handle progress values outside 0-100 range', () => {
            progressDisplay.initialize();
            progressDisplay.show();
            
            // Test negative value
            progressDisplay.updateProgress(-10, 'Negative');
            expect(progressDisplay.progressFill.style.width).toBe('0%');
            
            // Test value over 100
            progressDisplay.updateProgress(150, 'Over 100');
            expect(progressDisplay.progressFill.style.width).toBe('100%');
        });

        test('should hide upload card during conversion progress', () => {
            const uploadCard = document.getElementById('uploadCard');
            expect(uploadCard.style.display).toBe('block'); // Initially visible
            
            progressDisplay.initialize();
            progressDisplay.show(false, false); // Conversion progress (not files view)
            
            expect(uploadCard.style.display).toBe('none'); // Should be hidden
        });

        test('should show upload card again when progress is hidden', () => {
            const uploadCard = document.getElementById('uploadCard');
            expect(uploadCard.style.display).toBe('block'); // Initially visible
            
            progressDisplay.initialize();
            progressDisplay.show(false, false); // Conversion progress
            expect(uploadCard.style.display).toBe('none'); // Hidden during progress
            
            progressDisplay.hide();
            expect(uploadCard.style.display).toBe('block'); // Should be visible again
        });

        test('should not hide upload card during files view progress', () => {
            const uploadCard = document.getElementById('uploadCard');
            expect(uploadCard.style.display).toBe('block'); // Initially visible
            
            progressDisplay.initialize();
            progressDisplay.show(true, true); // Files view progress
            
            expect(uploadCard.style.display).toBe('block'); // Should remain visible
        });
    });
}); 