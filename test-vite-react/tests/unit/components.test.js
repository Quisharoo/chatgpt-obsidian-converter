/**
 * Unit Tests for UI Components
 * Testing component initialization and user interactions
 * Following AGENTS.md principle: component-focused testing with proper mocking
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';

// Mock DOM elements
const createMockElement = (id, tagName = 'div') => {
    const element = {
        id,
        tagName,
        textContent: '',
        className: '',
        style: {},
        disabled: false,
        onclick: null,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        appendChild: jest.fn(),
        removeChild: jest.fn(),
        setAttribute: jest.fn(),
        getAttribute: jest.fn(),
        classList: {
            add: jest.fn(),
            remove: jest.fn(),
            contains: jest.fn()
        },
        querySelector: jest.fn(),
        querySelectorAll: jest.fn(() => [])
    };
    
    return element;
};

// Mock document
global.document = {
    getElementById: jest.fn(),
    createElement: jest.fn(),
    body: createMockElement('body', 'body'),
    readyState: 'complete'
};

describe('UI Components', () => {
    
    describe('ProgressDisplay', () => {
        let mockContainer;
        let ProgressDisplay;

        beforeEach(async () => {
            jest.clearAllMocks();
            
            mockContainer = createMockElement('progressContainer');
            document.getElementById.mockImplementation((id) => {
                if (id === 'progressContainer') return mockContainer;
                return null;
            });

            // Dynamic import to ensure mocks are set up
            const module = await import('../../../src/components/ProgressDisplay.js');
            ProgressDisplay = module.ProgressDisplay;
        });

        test('initializes with container element', () => {
            const progressDisplay = new ProgressDisplay('progressContainer');
            
            expect(document.getElementById).toHaveBeenCalledWith('progressContainer');
            expect(progressDisplay.container).toBe(mockContainer);
        });

        test('handles missing container gracefully', () => {
            document.getElementById.mockReturnValue(null);
            
            const progressDisplay = new ProgressDisplay('nonexistent');
            expect(progressDisplay.container).toBe(null);
        });

        test('initializes progress elements', () => {
            const progressDisplay = new ProgressDisplay('progressContainer');
            progressDisplay.initialize();
            
            expect(mockContainer.innerHTML).toContain('role="progressbar"');
            expect(mockContainer.innerHTML).toContain('aria-valuenow="0"');
            expect(mockContainer.innerHTML).toContain('aria-live="polite"');
        });

        test('shows and hides progress display', () => {
            const progressDisplay = new ProgressDisplay('progressContainer');
            
            progressDisplay.show();
            expect(mockContainer.style.display).toBe('block');
            expect(progressDisplay.isVisible).toBe(true);
            
            progressDisplay.hide();
            expect(mockContainer.style.display).toBe('none');
            expect(progressDisplay.isVisible).toBe(false);
        });

        test('updates progress with accessibility attributes', () => {
            const mockProgressBar = createMockElement('progressBar');
            const mockProgressFill = createMockElement('progressFill');
            
            mockContainer.querySelector.mockImplementation((selector) => {
                if (selector === '.progress-bar') return mockProgressBar;
                if (selector === '.progress-fill') return mockProgressFill;
                return null;
            });

            const progressDisplay = new ProgressDisplay('progressContainer');
            progressDisplay.initialize();
            progressDisplay.show();
            progressDisplay.updateProgress(75, 'Testing progress');
            
            expect(mockProgressFill.style.width).toBe('75%');
            expect(mockProgressBar.setAttribute).toHaveBeenCalledWith('aria-valuenow', 75);
            expect(mockProgressBar.setAttribute).toHaveBeenCalledWith('aria-valuetext', '75% complete');
        });

        test('clamps progress percentage to valid range', () => {
            const mockProgressFill = createMockElement('progressFill');
            mockContainer.querySelector.mockReturnValue(mockProgressFill);

            const progressDisplay = new ProgressDisplay('progressContainer');
            progressDisplay.initialize();
            progressDisplay.show();
            
            // Test over 100%
            progressDisplay.updateProgress(150);
            expect(mockProgressFill.style.width).toBe('100%');
            
            // Test under 0%
            progressDisplay.updateProgress(-10);
            expect(mockProgressFill.style.width).toBe('0%');
        });
    });

    describe('FileUploader', () => {
        let mockUploadArea, mockFileInput, mockChooseButton;
        let FileUploader;

        beforeEach(async () => {
            jest.clearAllMocks();
            
            mockUploadArea = createMockElement('uploadArea');
            mockFileInput = createMockElement('fileInput', 'input');
            mockChooseButton = createMockElement('chooseFileBtn', 'button');
            
            document.getElementById.mockImplementation((id) => {
                switch (id) {
                    case 'uploadArea': return mockUploadArea;
                    case 'fileInput': return mockFileInput;
                    case 'chooseFileBtn': return mockChooseButton;
                    default: return null;
                }
            });

            // Dynamic import to ensure mocks are set up
            const module = await import('../../../src/components/FileUploader.js');
            FileUploader = module.FileUploader;
        });

        test('initializes with required elements', () => {
            const fileUploader = new FileUploader('uploadArea', 'fileInput', 'chooseFileBtn');
            
            expect(fileUploader.uploadArea).toBe(mockUploadArea);
            expect(fileUploader.fileInput).toBe(mockFileInput);
            expect(fileUploader.chooseButton).toBe(mockChooseButton);
        });

        test('throws error for missing elements', () => {
            document.getElementById.mockReturnValue(null);
            
            expect(() => {
                new FileUploader('missing', 'missing', 'missing');
            }).toThrow('Upload area element not found');
        });

        test('sets up accessibility attributes', () => {
            new FileUploader('uploadArea', 'fileInput', 'chooseFileBtn');
            
            expect(mockUploadArea.setAttribute).toHaveBeenCalledWith('tabindex', '0');
            expect(mockUploadArea.setAttribute).toHaveBeenCalledWith('role', 'button');
            expect(mockUploadArea.setAttribute).toHaveBeenCalledWith('aria-label', expect.any(String));
        });

        test('attaches event listeners', () => {
            new FileUploader('uploadArea', 'fileInput', 'chooseFileBtn');
            
            expect(mockUploadArea.addEventListener).toHaveBeenCalledWith('dragover', expect.any(Function));
            expect(mockUploadArea.addEventListener).toHaveBeenCalledWith('dragleave', expect.any(Function));
            expect(mockUploadArea.addEventListener).toHaveBeenCalledWith('drop', expect.any(Function));
            expect(mockUploadArea.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
            expect(mockUploadArea.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
            expect(mockChooseButton.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
            expect(mockFileInput.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
        });

        test('validates JSON files correctly', () => {
            const fileUploader = new FileUploader('uploadArea', 'fileInput', 'chooseFileBtn');
            
            // Mock valid JSON file
            const validFile = { type: 'application/json', name: 'test.json' };
            const invalidFile = { type: 'text/plain', name: 'test.txt' };
            
            const onFileSelected = jest.fn();
            fileUploader.setFileSelectedCallback(onFileSelected);
            
            fileUploader.processFile(validFile);
            expect(onFileSelected).toHaveBeenCalledWith(validFile);
            
            onFileSelected.mockClear();
            fileUploader.processFile(invalidFile);
            expect(onFileSelected).not.toHaveBeenCalled();
        });

        test('prevents multiple simultaneous processing', () => {
            const fileUploader = new FileUploader('uploadArea', 'fileInput', 'chooseFileBtn');
            const onFileSelected = jest.fn();
            fileUploader.setFileSelectedCallback(onFileSelected);
            
            const file = { type: 'application/json', name: 'test.json' };
            
            fileUploader.setProcessingState(true);
            fileUploader.processFile(file);
            
            expect(onFileSelected).not.toHaveBeenCalled();
        });

        test('updates processing state correctly', () => {
            const fileUploader = new FileUploader('uploadArea', 'fileInput', 'chooseFileBtn');
            
            fileUploader.setProcessingState(true);
            expect(mockUploadArea.style.pointerEvents).toBe('none');
            expect(mockChooseButton.disabled).toBe(true);
            expect(mockUploadArea.setAttribute).toHaveBeenCalledWith('aria-busy', 'true');
            
            fileUploader.setProcessingState(false);
            expect(mockUploadArea.style.pointerEvents).toBe('auto');
            expect(mockChooseButton.disabled).toBe(false);
            expect(mockUploadArea.setAttribute).toHaveBeenCalledWith('aria-busy', 'false');
        });

        test('handles keyboard navigation', () => {
            const fileUploader = new FileUploader('uploadArea', 'fileInput', 'chooseFileBtn');
            
            // Get the keydown handler
            const keydownHandler = mockUploadArea.addEventListener.mock.calls
                .find(call => call[0] === 'keydown')[1];
            
            const mockEvent = {
                key: 'Enter',
                preventDefault: jest.fn()
            };
            
            mockFileInput.click = jest.fn();
            keydownHandler(mockEvent);
            
            expect(mockEvent.preventDefault).toHaveBeenCalled();
            expect(mockFileInput.click).toHaveBeenCalled();
        });
    });
}); 