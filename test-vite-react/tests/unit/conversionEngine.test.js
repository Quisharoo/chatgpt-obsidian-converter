/**
 * Unit Tests for Conversion Engine
 * Testing conversation processing and Markdown generation
 * Following AGENTS.md principle: comprehensive module testing
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { convertConversationToMarkdown, processConversations } from '../../../src/modules/conversionEngine.js';

describe('Conversion Engine', () => {
    
    describe('convertConversationToMarkdown', () => {
        test('converts simple conversation to Markdown', () => {
            const conversation = {
                title: 'Test Conversation',
                create_time: 1703522622,
                mapping: {
                    'msg_1': {
                        message: {
                            author: { role: 'user' },
                            content: { parts: ['Hello, how are you?'] }
                        },
                        children: ['msg_2'],
                        parent: null
                    },
                    'msg_2': {
                        message: {
                            author: { role: 'assistant' },
                            content: { parts: ['I am doing well, thank you!'] }
                        },
                        children: [],
                        parent: 'msg_1'
                    }
                }
            };

            const result = convertConversationToMarkdown(conversation);
            
            // Title no longer included in content (shown by filename)
            expect(result).not.toContain('# Test Conversation');
            expect(result).toContain('**🧑‍💬 User**');
            expect(result).toContain('Hello, how are you?');
            expect(result).toContain('**🤖 Assistant**');
            expect(result).toContain('I am doing well, thank you!');
            expect(result).toContain('**Created:**');
        });

        test('handles conversation without title', () => {
            const conversation = {
                create_time: 1703522622,
                mapping: {
                    'msg_1': {
                        message: {
                            author: { role: 'user' },
                            content: { parts: ['Test message'] }
                        },
                        children: [],
                        parent: null
                    }
                }
            };

            const result = convertConversationToMarkdown(conversation);
            // Title no longer included in content - shown as filename instead
            expect(result).toContain('**Created:**');
        });

        test('handles conversation without create_time', () => {
            const conversation = {
                title: 'No Timestamp',
                mapping: {
                    'msg_1': {
                        message: {
                            author: { role: 'user' },
                            content: { parts: ['Test'] }
                        },
                        children: [],
                        parent: null
                    }
                }
            };

            const result = convertConversationToMarkdown(conversation);
            expect(result).toContain('1970-01-01, 01:00:00');
        });

        test('handles empty mapping', () => {
            const conversation = {
                title: 'Empty Chat',
                create_time: 1703522622,
                mapping: {}
            };

            const result = convertConversationToMarkdown(conversation);
            // Title no longer included in content
            expect(result).toContain('**Created:**');
            expect(result).not.toContain('**🧑‍💬 User**');
            expect(result).not.toContain('**🤖 Assistant**');
        });

        test('handles complex message content structures', () => {
            const conversation = {
                title: 'Complex Content',
                create_time: 1703522622,
                mapping: {
                    'msg_1': {
                        message: {
                            author: { role: 'user' },
                            content: { parts: ['Part 1', 'Part 2', 'Part 3'] }
                        },
                        children: [],
                        parent: null
                    }
                }
            };

            const result = convertConversationToMarkdown(conversation);
            expect(result).toContain('Part 1Part 2Part 3');
        });

        test('handles string content format', () => {
            const conversation = {
                title: 'String Content',
                create_time: 1703522622,
                mapping: {
                    'msg_1': {
                        message: {
                            author: { role: 'user' },
                            content: 'Direct string content'
                        },
                        children: [],
                        parent: null
                    }
                }
            };

            const result = convertConversationToMarkdown(conversation);
            expect(result).toContain('Direct string content');
        });

        test('filters out non-string parts to prevent citation rendering bugs', () => {
            const conversation = {
                title: 'Citation Content',
                create_time: 1703522622,
                mapping: {
                    'msg_1': {
                        message: {
                            author: { role: 'assistant' },
                            content: { 
                                parts: [
                                    'This is text content',
                                    { type: 'cite', turn: 0, search: 2 }, // Non-string citation object
                                    ' and this continues the text',
                                    { type: 'search', turn: 0, search: 0 }, // Non-string search object
                                    ' with more text.'
                                ]
                            }
                        },
                        children: [],
                        parent: null
                    }
                }
            };

            const result = convertConversationToMarkdown(conversation);
            // Should only contain the text parts, not the garbled object strings
            expect(result).toContain('This is text content and this continues the text with more text.');
            // Should not contain the garbled citation text
            expect(result).not.toContain('citeturn');
            expect(result).not.toContain('[object Object]');
        });

        test('filters out empty messages', () => {
            const conversation = {
                title: 'With Empty Messages',
                create_time: 1703522622,
                mapping: {
                    'msg_1': {
                        message: {
                            author: { role: 'user' },
                            content: { parts: ['Valid message'] }
                        },
                        children: ['msg_2'],
                        parent: null
                    },
                    'msg_2': {
                        message: {
                            author: { role: 'assistant' },
                            content: { parts: [''] }
                        },
                        children: ['msg_3'],
                        parent: 'msg_1'
                    },
                    'msg_3': {
                        message: {
                            author: { role: 'user' },
                            content: { parts: ['Another valid message'] }
                        },
                        children: [],
                        parent: 'msg_2'
                    }
                }
            };

            const result = convertConversationToMarkdown(conversation);
            expect(result).toContain('Valid message');
            expect(result).toContain('Another valid message');
            // Should not contain empty assistant message
            const assistantCount = (result.match(/🤖 \*\*Assistant:\*\*/g) || []).length;
            expect(assistantCount).toBe(0);
        });
    });

    describe('processConversations', () => {
        let mockProcessedIds;

        beforeEach(() => {
            mockProcessedIds = new Set();
        });

        test('processes single conversation correctly', () => {
            const conversations = [{
                id: 'conv_1',
                title: 'First Conversation',
                create_time: 1703522622,
                mapping: {
                    'msg_1': {
                        message: {
                            author: { role: 'user' },
                            content: { parts: ['Test message'] }
                        },
                        children: [],
                        parent: null
                    }
                }
            }];

            const results = processConversations(conversations);
            
            expect(results.processed).toBe(1);
            expect(results.skipped).toBe(0);
            expect(results.errors).toBe(0);
            expect(results.files).toHaveLength(1);
            
            const file = results.files[0];
            expect(file.filename).toBe('First Conversation.md');
            expect(file.title).toBe('First Conversation');
            expect(file.conversationId).toBe('conv_1');
            expect(file.createTime).toBe(1703522622);
            expect(file.createdDate).toBe(new Date(1703522622 * 1000).toLocaleDateString());
            expect(file.content).toContain('**🧑‍💬 User**');
            expect(file.content).toContain('Test message');
        });

        test('processes conversations in chronological order', () => {
            const conversations = [
                {
                    id: 'conv_new',
                    title: 'Newer Conversation',
                    create_time: 1703522722, // Later time
                    mapping: {
                        'msg_1': {
                            message: {
                                author: { role: 'user' },
                                content: { parts: ['New message'] }
                            },
                            children: [],
                            parent: null
                        }
                    }
                },
                {
                    id: 'conv_old',
                    title: 'Older Conversation',
                    create_time: 1703522622, // Earlier time
                    mapping: {
                        'msg_1': {
                            message: {
                                author: { role: 'user' },
                                content: { parts: ['Old message'] }
                            },
                            children: [],
                            parent: null
                        }
                    }
                }
            ];

            const results = processConversations(conversations);
            
            expect(results.files).toHaveLength(2);
            
            // Should be ordered oldest first (for chronological file creation)
            expect(results.files[0].title).toBe('Older Conversation');
            expect(results.files[1].title).toBe('Newer Conversation');
            expect(results.files[0].createTime).toBe(1703522622);
            expect(results.files[1].createTime).toBe(1703522722);
        });

        test('skips conversations without ID', () => {
            const conversations = [
                {
                    // Missing id
                    title: 'No ID Conversation',
                    create_time: 1703522600,
                    mapping: {}
                },
                {
                    id: 'conv_valid',
                    title: 'Valid Conversation',
                    create_time: 1703522610,
                    mapping: {
                        'msg_1': {
                            message: {
                                author: { role: 'user' },
                                content: { parts: ['Valid'] }
                            },
                            children: [],
                            parent: null
                        }
                    }
                }
            ];

            const results = processConversations(conversations, mockProcessedIds);

            expect(results.processed).toBe(1);
            expect(results.skipped).toBe(0);
            expect(results.errors).toBe(1);
            expect(results.files).toHaveLength(1);
        });

        test('skips already processed conversations', () => {
            mockProcessedIds.add('conv_duplicate');
            
            const conversations = [
                {
                    id: 'conv_duplicate',
                    title: 'Already Processed',
                    create_time: 1703522600,
                    mapping: {}
                },
                {
                    id: 'conv_new',
                    title: 'New Conversation',
                    create_time: 1703522610,
                    mapping: {
                        'msg_1': {
                            message: {
                                author: { role: 'user' },
                                content: { parts: ['New'] }
                            },
                            children: [],
                            parent: null
                        }
                    }
                }
            ];

            const results = processConversations(conversations, mockProcessedIds);

            expect(results.processed).toBe(1);
            expect(results.skipped).toBe(1);
            expect(results.errors).toBe(0);
            expect(results.files).toHaveLength(1);
        });

        test('handles duplicate filenames', () => {
            const conversations = [
                {
                    id: 'conv_1',
                    title: 'Same Title',
                    create_time: 1703522600,
                    mapping: {
                        'msg_1': {
                            message: {
                                author: { role: 'user' },
                                content: { parts: ['First'] }
                            },
                            children: [],
                            parent: null
                        }
                    }
                },
                {
                    id: 'conv_2',
                    title: 'Same Title',
                    create_time: 1703522610,
                    mapping: {
                        'msg_1': {
                            message: {
                                author: { role: 'user' },
                                content: { parts: ['Second'] }
                            },
                            children: [],
                            parent: null
                        }
                    }
                }
            ];

            const results = processConversations(conversations, mockProcessedIds);

            expect(results.files[0].filename).toBe('Same Title.md');
            expect(results.files[1].filename).toBe('Same Title (2).md');
        });

        test('filters out invalid conversation objects', () => {
            const conversations = [
                null,
                undefined,
                'invalid',
                { id: 'valid', title: 'Valid', create_time: 1703522600, mapping: { 'msg_1': { message: { author: { role: 'user' }, content: { parts: ['Test'] } }, children: [], parent: null } } },
                42
            ];

            const results = processConversations(conversations, mockProcessedIds);

            expect(results.processed).toBe(1);
            expect(results.files).toHaveLength(1);
        });

        test('handles empty conversations array', () => {
            const results = processConversations([], mockProcessedIds);

            expect(results.processed).toBe(0);
            expect(results.skipped).toBe(0);
            expect(results.errors).toBe(0);
            expect(results.files).toHaveLength(0);
        });
    });
}); 