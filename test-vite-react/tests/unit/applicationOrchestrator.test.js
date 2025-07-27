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

    describe('sortFiles', () => {
        let testFiles;

        beforeEach(() => {
            testFiles = [
                {
                    title: "Zebra Conversation",
                    filename: "zebra.md",
                    createTime: 1703522600,
                    create_time: 1703522600
                },
                {
                    title: "Apple Discussion", 
                    filename: "apple.md",
                    createTime: 1703522700,
                    create_time: 1703522700
                },
                {
                    title: "Beta Test",
                    filename: "beta.md", 
                    createTime: 1703522650,
                    create_time: 1703522650
                }
            ];
        });

        test('sorts by title ascending', () => {
            converter.currentSort = 'title';
            converter.sortDirection = 'asc';
            
            const result = converter.sortFiles([...testFiles]);
            
            expect(result[0].title).toBe("Apple Discussion");
            expect(result[1].title).toBe("Beta Test");
            expect(result[2].title).toBe("Zebra Conversation");
        });

        test('sorts by title descending', () => {
            converter.currentSort = 'title';
            converter.sortDirection = 'desc';
            
            const result = converter.sortFiles([...testFiles]);
            
            expect(result[0].title).toBe("Zebra Conversation");
            expect(result[1].title).toBe("Beta Test");
            expect(result[2].title).toBe("Apple Discussion");
        });

        test('sorts by date ascending (oldest first)', () => {
            converter.currentSort = 'date';
            converter.sortDirection = 'asc';
            
            const result = converter.sortFiles([...testFiles]);
            
            expect(result[0].createTime).toBe(1703522600); // Zebra - oldest
            expect(result[1].createTime).toBe(1703522650); // Beta - middle  
            expect(result[2].createTime).toBe(1703522700); // Apple - newest
        });

        test('sorts by date descending (newest first)', () => {
            converter.currentSort = 'date';
            converter.sortDirection = 'desc';
            
            const result = converter.sortFiles([...testFiles]);
            
            expect(result[0].createTime).toBe(1703522700); // Apple - newest
            expect(result[1].createTime).toBe(1703522650); // Beta - middle
            expect(result[2].createTime).toBe(1703522600); // Zebra - oldest
        });

        test('handles files with invalid timestamps', () => {
            const filesWithInvalidDates = [
                {
                    title: "Valid Date",
                    createTime: 1703522600,
                    create_time: 1703522600
                },
                {
                    title: "Invalid Date",
                    createTime: null,
                    create_time: null
                },
                {
                    title: "Another Valid",
                    createTime: 1703522700, 
                    create_time: 1703522700
                }
            ];
            
            converter.currentSort = 'date';
            converter.sortDirection = 'desc';
            
            const result = converter.sortFiles([...filesWithInvalidDates]);
            
            // Valid dates should be sorted properly, invalid dates should be last
            expect(result[0].title).toBe("Another Valid");
            expect(result[1].title).toBe("Valid Date");
            expect(result[2].title).toBe("Invalid Date");
        });

        test('handles natural numeric sorting in titles', () => {
            const filesWithNumbers = [
                { title: "Chat 10", filename: "chat10.md", createTime: 1703522600 },
                { title: "Chat 2", filename: "chat2.md", createTime: 1703522650 },
                { title: "Chat 1", filename: "chat1.md", createTime: 1703522700 }
            ];
            
            converter.currentSort = 'title';
            converter.sortDirection = 'asc';
            
            const result = converter.sortFiles([...filesWithNumbers]);
            
            expect(result[0].title).toBe("Chat 1");
            expect(result[1].title).toBe("Chat 2");
            expect(result[2].title).toBe("Chat 10");
        });

        test('handles empty files array', () => {
            converter.currentSort = 'title';
            converter.sortDirection = 'asc';
            
            const result = converter.sortFiles([]);
            
            expect(result).toEqual([]);
        });

        test('handles files with missing title properties', () => {
            const filesWithMissingTitles = [
                { title: "Has Title", filename: "has.md", createTime: 1703522600 },
                { filename: "no-title.md", createTime: 1703522650 },
                { title: "", filename: "empty-title.md", createTime: 1703522700 }
            ];
            
            converter.currentSort = 'title';
            converter.sortDirection = 'asc';
            
            const result = converter.sortFiles([...filesWithMissingTitles]);
            
            // Should not crash and should handle missing/empty titles gracefully
            expect(result).toHaveLength(3);
            expect(result[0].title || result[0].filename).toBeTruthy();
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

    describe('getValidTimestamp', () => {
        test('returns valid timestamp unchanged', () => {
            const validTimestamp = 1703522622;
            const result = converter.getValidTimestamp(validTimestamp);
            
            expect(result).toBe(validTimestamp);
        });

        test('returns 0 for null timestamp', () => {
            const result = converter.getValidTimestamp(null);
            
            expect(result).toBe(0);
        });

        test('returns 0 for undefined timestamp', () => {
            const result = converter.getValidTimestamp(undefined);
            
            expect(result).toBe(0);
        });

        test('returns 0 for negative timestamp', () => {
            const result = converter.getValidTimestamp(-123);
            
            expect(result).toBe(0);
        });

        test('returns 0 for NaN timestamp', () => {
            const result = converter.getValidTimestamp(NaN);
            
            expect(result).toBe(0);
        });

        test('returns 0 for string timestamp', () => {
            const result = converter.getValidTimestamp("not-a-number");
            
            expect(result).toBe(0);
        });

        test('returns 0 for zero timestamp', () => {
            const result = converter.getValidTimestamp(0);
            
            expect(result).toBe(0);
        });
    });

    describe('getFileDate', () => {
        test('formats valid timestamp correctly', () => {
            const file = {
                createTime: 1703522622,
                create_time: 1703522622
            };
            
            const result = converter.getFileDate(file);
            
            // Should return a formatted date string
            expect(result).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/); // MM/DD/YYYY or similar
        });

        test('returns "Unknown" for invalid file object', () => {
            expect(converter.getFileDate(null)).toBe('Unknown');
            expect(converter.getFileDate(undefined)).toBe('Unknown'); 
            expect(converter.getFileDate("not-an-object")).toBe('Unknown');
        });

        test('returns "Unknown" for file without date properties', () => {
            const file = {
                title: "No Date File",
                filename: "no-date.md"
            };
            
            const result = converter.getFileDate(file);
            
            expect(result).toBe('Unknown');
        });

        test('handles create_time property', () => {
            const file = {
                create_time: 1703522622
            };
            
            const result = converter.getFileDate(file);
            
            expect(result).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
        });

        test('falls back to createdDate string', () => {
            const file = {
                createdDate: "12/25/2023"
            };
            
            const result = converter.getFileDate(file);
            
            expect(result).toBe("12/25/2023");
        });

        test('handles invalid createTime gracefully', () => {
            const file = {
                createTime: "invalid-timestamp",
                create_time: null
            };
            
            const result = converter.getFileDate(file);
            
            expect(result).toBe('Unknown');
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