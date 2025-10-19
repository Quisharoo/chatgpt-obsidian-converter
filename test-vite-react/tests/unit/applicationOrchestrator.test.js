/**
 * Unit Tests for Application Orchestrator Business Logic
 * Testing core application methods for file processing and UI management
 * Following AGENTS.md principle: comprehensive testing of business logic
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { ChatGPTConverter } from '../../../src/modules/applicationOrchestrator.js';

// Mock dependencies
jest.mock('../../../src/components/FileUploader.js', () => ({
    FileUploader: jest.fn().mockImplementation(() => ({
        setFileSelectedCallback: jest.fn(),
        setProcessingState: jest.fn()
    }))
}));

jest.mock('../../../src/components/ProgressDisplay.js', () => ({
    ProgressDisplay: jest.fn().mockImplementation(() => ({
        show: jest.fn(),
        hide: jest.fn(),
        updateProgress: jest.fn(),
        showError: jest.fn(),
        setCancelCallback: jest.fn(),
        isVisible: false
    }))
}));

jest.mock('../../../src/modules/ui/resultsView.js', () => ({
    ResultsView: jest.fn().mockImplementation(() => ({
        show: jest.fn(),
        refreshTable: jest.fn()
    }))
}));

jest.mock('../../../src/modules/ui/dialogService.js', () => ({
    DialogService: jest.fn().mockImplementation(() => ({
        showFileSaveConfirmation: jest.fn()
    }))
}));

jest.mock('../../../src/modules/ui/notificationService.js', () => ({
    NotificationService: jest.fn().mockImplementation(() => ({
        setProgressController: jest.fn(),
        show: jest.fn(),
        showSuccess: jest.fn(),
        showInfo: jest.fn(),
        showError: jest.fn()
    }))
}));

jest.mock('../../../src/utils/telemetry.js', () => ({
    telemetry: {
        trackConversionStarted: jest.fn(),
        trackConversionCompleted: jest.fn(),
        trackConversionFailed: jest.fn(),
        trackFilesSaved: jest.fn(),
        trackError: jest.fn()
    }
}));

jest.mock('../../../src/utils/accessibility.js', () => ({
    accessibilityManager: {
        announceStatus: jest.fn(),
        announceProgress: jest.fn(),
        announceResults: jest.fn()
    }
}));

describe('Application Orchestrator Business Logic', () => {
    let converter;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        
        // Mock window functions (document is already mocked in setup.js)
        global.window.switchToComplete = jest.fn();
        global.window.showResults = jest.fn();
        global.window.showFiles = jest.fn();
        global.window.switchToView = jest.fn();

        converter = new ChatGPTConverter();
    });

    describe('parseConversations', () => {
        test('parses valid JSON array', () => {
            const validJson = '[{"title": "Test", "mapping": {}}]';
            const result = converter.parseConversations(validJson);
            
            expect(result).toEqual([{"title": "Test", "mapping": {}}]);
        });

        test('throws error for invalid JSON', () => {
            const invalidJson = '{ invalid json }';
            
            expect(() => {
                converter.parseConversations(invalidJson);
            }).toThrow('Invalid JSON file. Please upload a valid ChatGPT export.');
        });

        test('throws error for non-array JSON', () => {
            const nonArrayJson = '{"title": "Test", "mapping": {}}';
            
            expect(() => {
                converter.parseConversations(nonArrayJson);
            }).toThrow('Invalid file structure. Expected an array of conversations.');
        });

        test('handles empty array', () => {
            const emptyArray = '[]';
            const result = converter.parseConversations(emptyArray);
            
            expect(result).toEqual([]);
        });

        test('handles complex nested conversation structure', () => {
            const complexJson = JSON.stringify([
                {
                    title: "Complex Conversation",
                    create_time: 1703522622,
                    mapping: {
                        "msg_1": {
                            message: {
                                author: { role: "user" },
                                content: { parts: ["Hello"] }
                            }
                        }
                    }
                }
            ]);
            
            const result = converter.parseConversations(complexJson);
            
            expect(result).toHaveLength(1);
            expect(result[0].title).toBe("Complex Conversation");
            expect(result[0].mapping).toBeDefined();
        });
    });


    describe('readFileContent', () => {
        test('reads file content successfully', async () => {
            const mockFile = {
                name: 'test.json',
                size: 1000
            };
            
            // Mock FileReader
            const mockFileReader = {
                readAsText: jest.fn(),
                onload: null,
                onerror: null,
                result: '{"test": "data"}'
            };
            
            global.FileReader = jest.fn(() => mockFileReader);
            
            const promise = converter.readFileContent(mockFile);
            
            // Simulate successful read
            setTimeout(() => {
                mockFileReader.onload({ target: { result: '{"test": "data"}' } });
            }, 0);
            
            const result = await promise;
            expect(result).toBe('{"test": "data"}');
            expect(mockFileReader.readAsText).toHaveBeenCalledWith(mockFile);
        });

        test('handles file read error', async () => {
            const mockFile = {
                name: 'test.json',
                size: 1000
            };
            
            const mockFileReader = {
                readAsText: jest.fn(),
                onload: null,
                onerror: null
            };
            
            global.FileReader = jest.fn(() => mockFileReader);
            
            const promise = converter.readFileContent(mockFile);
            
            // Simulate read error
            setTimeout(() => {
                mockFileReader.onerror(new Error('Read failed'));
            }, 0);
            
            await expect(promise).rejects.toThrow('Failed to read file');
        });
    });

    describe('delay', () => {
        test('resolves after specified time', async () => {
            const startTime = Date.now();
            await converter.delay(100);
            const endTime = Date.now();
            
            // Allow some margin for timing variations
            expect(endTime - startTime).toBeGreaterThanOrEqual(90);
            expect(endTime - startTime).toBeLessThan(200);
        });

        test('works with zero delay', async () => {
            const startTime = Date.now();
            await converter.delay(0);
            const endTime = Date.now();
            
            // Should complete very quickly
            expect(endTime - startTime).toBeLessThan(50);
        });
    });

    describe('Error Handling', () => {
        test('parseConversations provides helpful error messages', () => {
            const malformedJson = '{"incomplete": true,';
            
            expect(() => {
                converter.parseConversations(malformedJson);
            }).toThrow('Invalid JSON file. Please upload a valid ChatGPT export.');
        });

        test('parseConversations handles edge case JSON structures', () => {
            // Test various edge cases
            expect(() => converter.parseConversations('null')).toThrow('Invalid file structure. Expected an array of conversations.');
            expect(() => converter.parseConversations('true')).toThrow('Invalid file structure. Expected an array of conversations.');
            expect(() => converter.parseConversations('123')).toThrow('Invalid file structure. Expected an array of conversations.');
            expect(() => converter.parseConversations('"string"')).toThrow('Invalid file structure. Expected an array of conversations.');
        });
    });
}); 
