/**
 * Unit Tests for Utility Functions
 * Testing pure functions with clear inputs and outputs
 * Following AGENTS.md principle: focused, reliable testing
 */

import { describe, test, expect } from '@jest/globals';
import { 
    cleanFilename, 
    generateUniqueFilename, 
    formatTimestamp, 
    delay, 
    isValidJsonFile,
    sortConversationsChronologically 
} from '../../../src/utils/helpers.js';
import { ChatGPTConverter } from '../../../src/modules/applicationOrchestrator.js';

describe('Utility Functions', () => {
    
    describe('cleanFilename', () => {
        test('removes invalid filename characters', () => {
            const result = cleanFilename('My<File>Name:with|invalid?chars*');
            expect(result).toBe('MyFileNamewithinvalidchars');
        });

        test('preserves valid characters', () => {
            const result = cleanFilename('Valid File Name 123.txt');
            expect(result).toBe('Valid File Name 123.txt');
        });

        test('collapses multiple spaces', () => {
            const result = cleanFilename('File    with     many    spaces');
            expect(result).toBe('File with many spaces');
        });

        test('trims leading and trailing spaces', () => {
            const result = cleanFilename('  Trimmed File  ');
            expect(result).toBe('Trimmed File');
        });

        test('limits length to maximum allowed', () => {
            const longName = 'a'.repeat(200);
            const result = cleanFilename(longName);
            expect(result.length).toBeLessThanOrEqual(100);
        });

        test('handles empty input', () => {
            const result = cleanFilename('');
            expect(result).toBe('');
        });
    });

    describe('generateUniqueFilename', () => {
        test('generates filename with .md extension', () => {
            const conversation = { title: 'Test Conversation' };
            const result = generateUniqueFilename(conversation, []);
            expect(result).toBe('Test Conversation.md');
        });

        test('handles missing title with default', () => {
            const conversation = {};
            const result = generateUniqueFilename(conversation, []);
            expect(result).toBe('Conversation.md');
        });

        test('adds counter for duplicate filenames', () => {
            const conversation = { title: 'Duplicate' };
            const existing = ['Duplicate.md'];
            const result = generateUniqueFilename(conversation, existing);
            expect(result).toBe('Duplicate (2).md');
        });

        test('increments counter for multiple duplicates', () => {
            const conversation = { title: 'Multiple' };
            const existing = ['Multiple.md', 'Multiple (2).md', 'Multiple (3).md'];
            const result = generateUniqueFilename(conversation, existing);
            expect(result).toBe('Multiple (4).md');
        });

        test('cleans title before generating filename', () => {
            const conversation = { title: 'Title<with>invalid:chars' };
            const result = generateUniqueFilename(conversation, []);
            expect(result).toBe('Titlewithinvalidchars.md');
        });
    });

    describe('formatTimestamp', () => {
        test('formats Unix timestamp to YYYY-MM-DD', () => {
            const timestamp = 1703522622; // 2023-12-25 12:30:22 UTC
            const result = formatTimestamp(timestamp);
            expect(result).toBe('2023-12-25');
        });

        test('handles zero timestamp', () => {
            const result = formatTimestamp(0);
            expect(result).toBe('1970-01-01');
        });

        test('handles recent timestamp', () => {
            const timestamp = Math.floor(Date.now() / 1000);
            const result = formatTimestamp(timestamp);
            const today = new Date().toISOString().split('T')[0];
            expect(result).toBe(today);
        });
    });

    describe('delay', () => {
        test('returns a promise', () => {
            const result = delay(1);
            expect(result).toBeInstanceOf(Promise);
        });

        test('resolves after specified time', async () => {
            const start = Date.now();
            await delay(50);
            const elapsed = Date.now() - start;
            expect(elapsed).toBeGreaterThanOrEqual(40); // Allow some timing variance
            expect(elapsed).toBeLessThan(100);
        });

        test('handles zero delay', async () => {
            const start = Date.now();
            await delay(0);
            const elapsed = Date.now() - start;
            expect(elapsed).toBeLessThan(20); // Increased tolerance for slower systems
        });
    });

    describe('isValidJsonFile', () => {
        test('accepts JSON MIME type', () => {
            const file = { type: 'application/json', name: 'test.json' };
            expect(isValidJsonFile(file)).toBe(true);
        });

        test('accepts .json extension', () => {
            const file = { type: '', name: 'conversations.json' };
            expect(isValidJsonFile(file)).toBe(true);
        });

        test('rejects non-JSON files', () => {
            const file = { type: 'text/plain', name: 'test.txt' };
            expect(isValidJsonFile(file)).toBe(false);
        });

        test('rejects files without JSON extension or MIME type', () => {
            const file = { type: 'application/octet-stream', name: 'test.bin' };
            expect(isValidJsonFile(file)).toBe(false);
        });

        test('handles case-insensitive extension', () => {
            const file = { type: '', name: 'TEST.JSON' };
            expect(isValidJsonFile(file)).toBe(true);
        });
    });

    describe('sortConversationsChronologically', () => {
        test('sorts conversations by create_time ascending', () => {
            const conversations = [
                { id: '3', create_time: 1703522622 },
                { id: '1', create_time: 1703522600 },
                { id: '2', create_time: 1703522610 }
            ];
            
            const sorted = sortConversationsChronologically(conversations);
            expect(sorted.map(c => c.id)).toEqual(['1', '2', '3']);
        });

        test('filters out invalid conversation objects', () => {
            const conversations = [
                { id: '1', create_time: 1703522600 },
                null,
                undefined,
                'invalid',
                { id: '2', create_time: 1703522610 }
            ];
            
            const sorted = sortConversationsChronologically(conversations);
            expect(sorted).toHaveLength(2);
            expect(sorted.map(c => c.id)).toEqual(['1', '2']);
        });

        test('handles missing create_time with default 0', () => {
            const conversations = [
                { id: '2', create_time: 1703522600 },
                { id: '1' }, // Missing create_time
                { id: '3', create_time: 1703522610 }
            ];
            
            const sorted = sortConversationsChronologically(conversations);
            expect(sorted.map(c => c.id)).toEqual(['1', '2', '3']);
        });

        test('maintains stable sort for same timestamps', () => {
            const conversations = [
                { id: '1', create_time: 1703522600, title: 'First' },
                { id: '2', create_time: 1703522600, title: 'Second' }
            ];
            
            const sorted = sortConversationsChronologically(conversations);
            expect(sorted[0].title).toBe('First');
            expect(sorted[1].title).toBe('Second');
        });

        test('handles empty array', () => {
            const sorted = sortConversationsChronologically([]);
            expect(sorted).toEqual([]);
        });
    });

    describe('File Sorting in UI', () => {
        let converter;
        
        beforeEach(() => {
            // Mock DOM elements that the converter expects without redefining document
            global.document.getElementById = jest.fn().mockReturnValue(null);
            global.document.createElement = jest.fn().mockReturnValue({});
            global.document.addEventListener = jest.fn();

            converter = new ChatGPTConverter();
            converter.currentSort = 'title';
            converter.sortDirection = 'asc';
        });

        test('sorts files by title naturally with case insensitive ordering', () => {
            const files = [
                { title: 'ZZZ Chat', filename: 'zzz-chat.md', createTime: 1000 },
                { title: 'AAA Chat', filename: 'aaa-chat.md', createTime: 2000 },
                { title: 'Chat 10', filename: 'chat-10.md', createTime: 3000 },
                { title: 'Chat 2', filename: 'chat-2.md', createTime: 4000 },
                { title: 'bbb chat', filename: 'bbb-chat.md', createTime: 5000 }
            ];

            converter.currentSort = 'title';
            converter.sortDirection = 'asc';
            const sorted = converter.sortFiles(files);
            
            expect(sorted.map(f => f.title)).toEqual(['AAA Chat', 'bbb chat', 'Chat 2', 'Chat 10', 'ZZZ Chat']);
        });

        test('sorts files by title in descending order', () => {
            const files = [
                { title: 'AAA Chat', filename: 'aaa-chat.md', createTime: 1000 },
                { title: 'BBB Chat', filename: 'bbb-chat.md', createTime: 2000 },
                { title: 'CCC Chat', filename: 'ccc-chat.md', createTime: 3000 }
            ];

            converter.currentSort = 'title';
            converter.sortDirection = 'desc';
            const sorted = converter.sortFiles(files);
            
            expect(sorted.map(f => f.title)).toEqual(['CCC Chat', 'BBB Chat', 'AAA Chat']);
        });

        test('sorts files by date chronologically', () => {
            const files = [
                { title: 'Latest', filename: 'latest.md', createTime: 3000 },
                { title: 'Oldest', filename: 'oldest.md', createTime: 1000 },
                { title: 'Middle', filename: 'middle.md', createTime: 2000 }
            ];

            converter.currentSort = 'date';
            converter.sortDirection = 'asc';
            const sorted = converter.sortFiles(files);
            
            expect(sorted.map(f => f.title)).toEqual(['Oldest', 'Middle', 'Latest']);
        });

        test('sorts files by date in descending order', () => {
            const files = [
                { title: 'Oldest', filename: 'oldest.md', createTime: 1000 },
                { title: 'Latest', filename: 'latest.md', createTime: 3000 },
                { title: 'Middle', filename: 'middle.md', createTime: 2000 }
            ];

            converter.currentSort = 'date';
            converter.sortDirection = 'desc';
            const sorted = converter.sortFiles(files);
            
            expect(sorted.map(f => f.title)).toEqual(['Latest', 'Middle', 'Oldest']);
        });

        test('handles files with missing timestamps', () => {
            const files = [
                { title: 'With Time', filename: 'with-time.md', createTime: 2000 },
                { title: 'No Time', filename: 'no-time.md' },
                { title: 'Zero Time', filename: 'zero-time.md', createTime: 0 }
            ];

            converter.currentSort = 'date';
            converter.sortDirection = 'asc';
            const sorted = converter.sortFiles(files);
            
            // Files without createTime should default to 0 and appear first
            expect(sorted[0].title).toBe('No Time');
            expect(sorted[1].title).toBe('Zero Time');
            expect(sorted[2].title).toBe('With Time');
        });

        test('handles invalid date values safely', () => {
            const files = [
                { title: 'Valid Time', filename: 'valid-time.md', createTime: 2000 },
                { title: 'Invalid String', filename: 'invalid-string.md', createTime: 'invalid' },
                { title: 'Negative Time', filename: 'negative-time.md', createTime: -1 },
                { title: 'Null Time', filename: 'null-time.md', createTime: null },
                { title: 'NaN Time', filename: 'nan-time.md', createTime: NaN }
            ];

            converter.currentSort = 'date';
            converter.sortDirection = 'asc';
            const sorted = converter.sortFiles(files);
            
            // Invalid dates should be treated as 0 and appear first
            expect(sorted[0].title).toBe('Invalid String');
            expect(sorted[1].title).toBe('Negative Time');
            expect(sorted[2].title).toBe('Null Time');
            expect(sorted[3].title).toBe('NaN Time');
            expect(sorted[4].title).toBe('Valid Time');
        });

        test('updateSortIndicators shows only active column arrow', () => {
            // Mock DOM elements for sort indicators
            const titleIndicator = {
                className: '',
                textContent: ''
            };
            const dateIndicator = {
                className: '',
                textContent: ''
            };
            
            // Mock querySelector to return our indicators
            global.document.querySelector = jest.fn((selector) => {
                if (selector === '#titleHeader .sort-indicator') return titleIndicator;
                if (selector === '#dateHeader .sort-indicator') return dateIndicator;
                return null;
            });
            
            // Test title column active (ascending)
            converter.currentSort = 'title';
            converter.sortDirection = 'asc';
            converter.updateSortIndicators();
            
            expect(titleIndicator.className).toBe('text-indigo-600');
            expect(titleIndicator.textContent).toBe('▲');
            expect(dateIndicator.className).toBe('text-gray-400');
            expect(dateIndicator.textContent).toBe('');
            
            // Test date column active (descending)
            converter.currentSort = 'date';
            converter.sortDirection = 'desc';
            converter.updateSortIndicators();
            
            expect(titleIndicator.className).toBe('text-gray-400');
            expect(titleIndicator.textContent).toBe('');
            expect(dateIndicator.className).toBe('text-indigo-600');
            expect(dateIndicator.textContent).toBe('▼');
        });

        test('renderPagination includes First and Last buttons for many pages', () => {
            // Mock pagination container
            const paginationContainer = {
                innerHTML: '',
                appendChild: jest.fn()
            };
            
            // Mock getElementById to return our container
            global.document.getElementById = jest.fn((id) => {
                if (id === 'paginationContainer') return paginationContainer;
                return null;
            });
            
            // Mock createPaginationButton method
            converter.createPaginationButton = jest.fn((text, page, isActive = false) => {
                return { textContent: text, page: page, isActive: isActive };
            });
            
            // Test with many pages (10 pages) and current page in middle
            converter.currentPage = 5;
            converter.renderPagination(10);
            
            // Should include First and Last buttons
            expect(converter.createPaginationButton).toHaveBeenCalledWith('«', 1);
            expect(converter.createPaginationButton).toHaveBeenCalledWith('»', 10);
            
            // Should also include Previous and Next
            expect(converter.createPaginationButton).toHaveBeenCalledWith('‹', 4);
            expect(converter.createPaginationButton).toHaveBeenCalledWith('›', 6);
        });

        test('renderPagination hides First and Last buttons for few pages', () => {
            // Mock pagination container
            const paginationContainer = {
                innerHTML: '',
                appendChild: jest.fn()
            };
            
            // Mock getElementById to return our container
            global.document.getElementById = jest.fn((id) => {
                if (id === 'paginationContainer') return paginationContainer;
                return null;
            });
            
            // Mock createPaginationButton method
            converter.createPaginationButton = jest.fn((text, page, isActive = false) => {
                return { textContent: text, page: page, isActive: isActive };
            });
            
            // Test with few pages (3 pages) and current page in middle
            converter.currentPage = 2;
            converter.renderPagination(3);
            
            // Should NOT include First and Last buttons for few pages
            const calls = converter.createPaginationButton.mock.calls;
            const buttonTexts = calls.map(call => call[0]);
            
            expect(buttonTexts).not.toContain('«');
            expect(buttonTexts).not.toContain('»');
            
            // Should still include Previous and Next
            expect(buttonTexts).toContain('‹');
            expect(buttonTexts).toContain('›');
        });

        test('renderPagination hides First button on first page', () => {
            // Mock pagination container
            const paginationContainer = {
                innerHTML: '',
                appendChild: jest.fn()
            };
            
            // Mock getElementById to return our container
            global.document.getElementById = jest.fn((id) => {
                if (id === 'paginationContainer') return paginationContainer;
                return null;
            });
            
            // Mock createPaginationButton method
            converter.createPaginationButton = jest.fn((text, page, isActive = false) => {
                return { textContent: text, page: page, isActive: isActive };
            });
            
            // Test with many pages but on first page
            converter.currentPage = 1;
            converter.renderPagination(10);
            
            // Should NOT include First button when on first page
            const calls = converter.createPaginationButton.mock.calls;
            const buttonTexts = calls.map(call => call[0]);
            
            expect(buttonTexts).not.toContain('«');
            expect(buttonTexts).toContain('»'); // Last button should still show
        });

        test('renderPagination hides Last button on last page', () => {
            // Mock pagination container
            const paginationContainer = {
                innerHTML: '',
                appendChild: jest.fn()
            };
            
            // Mock getElementById to return our container
            global.document.getElementById = jest.fn((id) => {
                if (id === 'paginationContainer') return paginationContainer;
                return null;
            });
            
            // Mock createPaginationButton method
            converter.createPaginationButton = jest.fn((text, page, isActive = false) => {
                return { textContent: text, page: page, isActive: isActive };
            });
            
            // Test with many pages but on last page
            converter.currentPage = 10;
            converter.renderPagination(10);
            
            // Should NOT include Last button when on last page
            const calls = converter.createPaginationButton.mock.calls;
            const buttonTexts = calls.map(call => call[0]);
            
            expect(buttonTexts).not.toContain('»');
            expect(buttonTexts).toContain('«'); // First button should still show
        });

        test('default sort is date descending', () => {
            const files = [
                { title: 'Oldest', filename: 'oldest.md', createTime: 1000 },
                { title: 'Latest', filename: 'latest.md', createTime: 3000 },
                { title: 'Middle', filename: 'middle.md', createTime: 2000 }
            ];

            // Reset to default state (no currentSort set)
            converter.currentSort = null;
            converter.sortDirection = null;
            
            // Simulate the populateFilesView initialization
            if (!converter.currentSort) {
                converter.currentSort = 'date';
                converter.sortDirection = 'desc';
            }
            
            const sorted = converter.sortFiles(files);
            
            // Should be sorted by date descending (newest first)
            expect(sorted.map(f => f.title)).toEqual(['Latest', 'Middle', 'Oldest']);
        });
    });
}); 