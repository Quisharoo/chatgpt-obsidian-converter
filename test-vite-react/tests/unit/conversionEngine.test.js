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
            
            expect(result).toContain('# Test Conversation');
            expect(result).toContain('**User:**');
            expect(result).toContain('Hello, how are you?');
            expect(result).toContain('**Assistant:**');
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
            expect(result).toContain('# Untitled Conversation');
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
            expect(result).toContain('**Created:** Thu Jan 01 1970');
        });

        test('handles empty mapping', () => {
            const conversation = {
                title: 'Empty Chat',
                create_time: 1703522622,
                mapping: {}
            };

            const result = convertConversationToMarkdown(conversation);
            expect(result).toContain('# Empty Chat');
            expect(result).not.toContain('**User:**');
            expect(result).not.toContain('**Assistant:**');
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
            const assistantCount = (result.match(/\*\*Assistant:\*\*/g) || []).length;
            expect(assistantCount).toBe(0);
        });
    });

    describe('processConversations', () => {
        let mockProcessedIds;

        beforeEach(() => {
            mockProcessedIds = new Set();
        });

        test('processes valid conversations successfully', () => {
            const conversations = [
                {
                    id: 'conv_1',
                    title: 'First Conversation',
                    create_time: 1703522600,
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
                },
                {
                    id: 'conv_2',
                    title: 'Second Conversation',
                    create_time: 1703522610,
                    mapping: {
                        'msg_1': {
                            message: {
                                author: { role: 'user' },
                                content: { parts: ['Another test'] }
                            },
                            children: [],
                            parent: null
                        }
                    }
                }
            ];

            const results = processConversations(conversations, mockProcessedIds);

            expect(results.processed).toBe(2);
            expect(results.skipped).toBe(0);
            expect(results.errors).toBe(0);
            expect(results.files).toHaveLength(2);
            expect(results.files[0].filename).toBe('First Conversation.md');
            expect(results.files[1].filename).toBe('Second Conversation.md');
        });

        test('sorts conversations chronologically', () => {
            const conversations = [
                {
                    id: 'conv_new',
                    title: 'Newer Conversation',
                    create_time: 1703522610,
                    mapping: { 'msg_1': { message: { author: { role: 'user' }, content: { parts: ['New'] } }, children: [], parent: null } }
                },
                {
                    id: 'conv_old',
                    title: 'Older Conversation',
                    create_time: 1703522600,
                    mapping: { 'msg_1': { message: { author: { role: 'user' }, content: { parts: ['Old'] } }, children: [], parent: null } }
                }
            ];

            const results = processConversations(conversations, mockProcessedIds);

            // Should be processed oldest first
            expect(results.files[0].title).toBe('Older Conversation');
            expect(results.files[1].title).toBe('Newer Conversation');
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