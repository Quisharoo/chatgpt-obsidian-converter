/**
 * Tests for ChatGPT to Obsidian Converter
 * Following AGENTS.md testing guidelines
 */

// Mock DOM elements for testing
function createMockElement(id) {
    return {
        id: id,
        textContent: '',
        className: '',
        style: {},
        appendChild: jest.fn(),
        removeChild: jest.fn()
    };
}

// Mock document for browser functions
global.document = {
    getElementById: jest.fn((id) => createMockElement(id)),
    createElement: jest.fn((tag) => ({
        tagName: tag,
        textContent: '',
        className: '',
        style: {},
        onclick: null,
        appendChild: jest.fn(),
        removeChild: jest.fn()
    })),
    body: {
        appendChild: jest.fn(),
        removeChild: jest.fn()
    }
};

// Mock URL for blob handling
global.URL = {
    createObjectURL: jest.fn(() => 'mock-url'),
    revokeObjectURL: jest.fn()
};

// Mock window for File System Access API
global.window = {
    showDirectoryPicker: jest.fn()
};

// Load the converter functions
require('../converter.js');

describe('ChatGPT to Obsidian Converter', () => {
    
    describe('Utility Functions', () => {
        test('slugify converts text to URL-safe slug', () => {
            expect(slugify('Python Best Practices')).toBe('python-best-practices');
            expect(slugify('Redis & Caching: Advanced Strategies!')).toBe('redis-caching-advanced-strategies');
            expect(slugify('   Multiple   Spaces   ')).toBe('multiple-spaces');
            expect(slugify('Special@#$%Characters')).toBe('specialcharacters');
            expect(slugify('')).toBe('');
        });

        test('formatTimestamp converts UNIX timestamp to YYYY-MM-DD', () => {
            // Test timestamp: 2024-12-25 14:30:22 UTC
            const timestamp = 1703522622;
            expect(formatTimestamp(timestamp)).toBe('2024-12-25');
            
            // Test edge case: epoch
            expect(formatTimestamp(0)).toBe('1970-01-01');
        });

        test('generateFilename creates correct format', () => {
            const conversation = {
                id: 'test_conv_001',
                title: 'Python Best Practices',
                create_time: 1703522622
            };
            
            const filename = generateFilename(conversation);
            expect(filename).toBe('2024-12-25_python-best-practices_test_conv_001.md');
        });

        test('generateFilename handles long titles', () => {
            const conversation = {
                id: 'test_conv_002',
                title: 'This is a very long title that should be truncated because it exceeds the maximum length limit',
                create_time: 1703522622
            };
            
            const filename = generateFilename(conversation);
            expect(filename.length).toBeLessThan(100); // Reasonable filename length
            expect(filename).toContain('test_conv_002.md');
        });

        test('generateFilename handles missing data gracefully', () => {
            const conversation = {};
            const filename = generateFilename(conversation);
            expect(filename).toContain('unknown.md');
            expect(filename).toContain('untitled');
        });
    });

    describe('Message Extraction', () => {
        test('extractMessages handles simple conversation structure', () => {
            const mapping = {
                'msg_001': {
                    message: {
                        author: { role: 'user' },
                        content: { parts: ['Hello, how are you?'] }
                    },
                    children: ['msg_002'],
                    parent: null
                },
                'msg_002': {
                    message: {
                        author: { role: 'assistant' },
                        content: { parts: ['I am doing well, thank you!'] }
                    },
                    children: [],
                    parent: 'msg_001'
                }
            };

            const messages = extractMessages(mapping);
            expect(messages).toHaveLength(2);
            expect(messages[0].author).toBe('user');
            expect(messages[0].content).toBe('Hello, how are you?');
            expect(messages[1].author).toBe('assistant');
            expect(messages[1].content).toBe('I am doing well, thank you!');
        });

        test('extractMessages handles content as string', () => {
            const mapping = {
                'msg_001': {
                    message: {
                        author: { role: 'user' },
                        content: 'Direct string content'
                    },
                    children: [],
                    parent: null
                }
            };

            const messages = extractMessages(mapping);
            expect(messages).toHaveLength(1);
            expect(messages[0].content).toBe('Direct string content');
        });

        test('extractMessages handles empty or malformed mapping', () => {
            expect(extractMessages({})).toEqual([]);
            expect(extractMessages(null)).toEqual([]);
            
            const malformedMapping = {
                'msg_001': {
                    // Missing message field
                    children: [],
                    parent: null
                }
            };
            expect(extractMessages(malformedMapping)).toEqual([]);
        });

        test('extractMessages handles multi-part content', () => {
            const mapping = {
                'msg_001': {
                    message: {
                        author: { role: 'assistant' },
                        content: { 
                            parts: [
                                'Here is part one. ',
                                'And here is part two.'
                            ] 
                        }
                    },
                    children: [],
                    parent: null
                }
            };

            const messages = extractMessages(mapping);
            expect(messages[0].content).toBe('Here is part one. And here is part two.');
        });
    });

    describe('Conversation Conversion', () => {
        test('convertConversationToMarkdown creates proper format', () => {
            const conversation = {
                id: 'test_conv',
                title: 'Test Conversation',
                create_time: 1703522622,
                mapping: {
                    'msg_001': {
                        message: {
                            author: { role: 'user' },
                            content: { parts: ['What is Python?'] }
                        },
                        children: ['msg_002'],
                        parent: null
                    },
                    'msg_002': {
                        message: {
                            author: { role: 'assistant' },
                            content: { parts: ['Python is a programming language.'] }
                        },
                        children: [],
                        parent: 'msg_001'
                    }
                }
            };

            const markdown = convertConversationToMarkdown(conversation);
            
            // Check structure
            expect(markdown).toContain('# Test Conversation');
            expect(markdown).toContain('**Created:**');
            expect(markdown).toContain('---');
            expect(markdown).toContain('**User:**');
            expect(markdown).toContain('**Assistant:**');
            expect(markdown).toContain('What is Python?');
            expect(markdown).toContain('Python is a programming language.');
        });

        test('convertConversationToMarkdown handles missing title', () => {
            const conversation = {
                create_time: 1703522622,
                mapping: {}
            };

            const markdown = convertConversationToMarkdown(conversation);
            expect(markdown).toContain('# Untitled Conversation');
        });
    });

    describe('File Processing', () => {
        test('processConversations handles valid conversation array', () => {
            const conversations = [
                {
                    id: 'conv_001',
                    title: 'Test 1',
                    create_time: 1703522622,
                    mapping: {
                        'msg_001': {
                            message: {
                                author: { role: 'user' },
                                content: { parts: ['Hello'] }
                            },
                            children: [],
                            parent: null
                        }
                    }
                },
                {
                    id: 'conv_002',
                    title: 'Test 2',
                    create_time: 1703522622,
                    mapping: {
                        'msg_001': {
                            message: {
                                author: { role: 'user' },
                                content: { parts: ['Hi'] }
                            },
                            children: [],
                            parent: null
                        }
                    }
                }
            ];

            const results = processConversations(conversations);
            expect(results.processed).toBe(2);
            expect(results.skipped).toBe(0);
            expect(results.errors).toBe(0);
            expect(results.files).toHaveLength(2);
            expect(results.files[0].filename).toContain('test-1');
            expect(results.files[1].filename).toContain('test-2');
        });

        test('processConversations handles duplicate IDs', () => {
            const conversations = [
                {
                    id: 'conv_001',
                    title: 'Test 1',
                    create_time: 1703522622,
                    mapping: {}
                },
                {
                    id: 'conv_001', // Duplicate ID
                    title: 'Test 1 Duplicate',
                    create_time: 1703522622,
                    mapping: {}
                }
            ];

            const results = processConversations(conversations);
            expect(results.processed).toBe(1);
            expect(results.skipped).toBe(1);
            expect(results.files).toHaveLength(1);
        });

        test('processConversations handles conversations without IDs', () => {
            const conversations = [
                {
                    // Missing ID
                    title: 'Test Without ID',
                    create_time: 1703522622,
                    mapping: {}
                }
            ];

            const results = processConversations(conversations);
            expect(results.processed).toBe(0);
            expect(results.errors).toBe(1);
            expect(results.files).toHaveLength(0);
        });
    });

    describe('File System Access API', () => {
        test('isFileSystemAccessSupported detects API availability', () => {
            // Mock supported
            global.window.showDirectoryPicker = jest.fn();
            expect(isFileSystemAccessSupported()).toBe(true);
            
            // Mock not supported
            delete global.window.showDirectoryPicker;
            expect(isFileSystemAccessSupported()).toBe(false);
        });
    });

    describe('Blob and Download Functions', () => {
        test('createDownloadBlob creates blob with correct content', () => {
            const content = 'Test markdown content';
            const blob = createDownloadBlob(content);
            
            expect(blob).toBeInstanceOf(Blob);
            expect(blob.type).toBe('text/markdown');
        });
    });

    describe('Integration Tests', () => {
        test('full conversion pipeline produces consistent results', () => {
            const conversation = {
                id: 'integration_test',
                title: 'Integration Test Conversation',
                create_time: 1703522622,
                mapping: {
                    'msg_001': {
                        message: {
                            author: { role: 'user' },
                            content: { parts: ['Test question'] }
                        },
                        children: ['msg_002'],
                        parent: null
                    },
                    'msg_002': {
                        message: {
                            author: { role: 'assistant' },
                            content: { parts: ['Test answer'] }
                        },
                        children: [],
                        parent: 'msg_001'
                    }
                }
            };

            // Test the full pipeline
            const results = processConversations([conversation]);
            expect(results.processed).toBe(1);
            expect(results.files).toHaveLength(1);
            
            const file = results.files[0];
            expect(file.filename).toBe('Integration Test Conversation.md');
            expect(file.content).toContain('# Integration Test Conversation');
            expect(file.content).toContain('**User:**');
            expect(file.content).toContain('Test question');
            expect(file.content).toContain('**Assistant:**');
            expect(file.content).toContain('Test answer');
        });

        test('converter maintains state correctly across multiple operations', () => {
            // Reset state
            processedIds.clear();
            
            const conversation1 = {
                id: 'state_test_1',
                title: 'State Test 1',
                create_time: 1703522622,
                mapping: {}
            };

            const conversation2 = {
                id: 'state_test_2',
                title: 'State Test 2',
                create_time: 1703522622,
                mapping: {}
            };

            // Process first conversation
            const results1 = processConversations([conversation1]);
            expect(results1.processed).toBe(1);
            
            // Process second conversation
            const results2 = processConversations([conversation2]);
            expect(results2.processed).toBe(1);
            
            // Try to process first conversation again (should be skipped)
            const results3 = processConversations([conversation1]);
            expect(results3.processed).toBe(0);
            expect(results3.skipped).toBe(1);
        });
    });

    describe('Error Handling', () => {
        test('handles malformed conversation data gracefully', () => {
            const malformedConversations = [
                null,
                undefined,
                { id: 'test' }, // Missing required fields
                { title: 'No ID' }, // Missing ID
                { id: 'test', mapping: null } // Null mapping
            ];

            // Should not throw errors
            expect(() => {
                processConversations(malformedConversations);
            }).not.toThrow();
        });

        test('extractMessages handles circular references', () => {
            const circularMapping = {
                'msg_001': {
                    message: {
                        author: { role: 'user' },
                        content: { parts: ['Hello'] }
                    },
                    children: ['msg_002'],
                    parent: null
                },
                'msg_002': {
                    message: {
                        author: { role: 'assistant' },
                        content: { parts: ['Hi'] }
                    },
                    children: ['msg_001'], // Creates circular reference
                    parent: 'msg_001'
                }
            };

            // Should not cause infinite loop
            const messages = extractMessages(circularMapping);
            expect(messages.length).toBeGreaterThan(0);
            expect(messages.length).toBeLessThan(10); // Should stop before infinite loop
        });
    });
});

// Helper function to reset global state between tests
beforeEach(() => {
    if (typeof processedIds !== 'undefined') {
        processedIds.clear();
    }
    if (typeof selectedDirectoryHandle !== 'undefined') {
        selectedDirectoryHandle = null;
    }
});

console.log('✅ All tests defined - run with: npm test'); 