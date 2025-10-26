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

});
