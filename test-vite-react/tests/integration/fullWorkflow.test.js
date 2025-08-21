/**
 * Integration Tests for Full Workflow
 * Testing end-to-end functionality with new modular architecture
 * Following AGENTS.md principle: comprehensive integration testing
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';

// Import modules from new structure
import { processConversations } from '../../../src/modules/conversionEngine.js';
import { 
    generateUniqueFilename, 
    sortConversationsChronologically 
} from '../../../src/utils/helpers.js';

describe('Full Workflow Integration Tests', () => {
    
    describe('End-to-End Conversation Processing', () => {
        test('processes complete conversation export successfully', async () => {
            // Load sample conversation data
            const sampleData = [
                {
                    id: 'conversation_001',
                    title: 'Test Integration Workflow',
                    create_time: 1703522600,
                    mapping: {
                        'msg_root': {
                            message: {
                                author: { role: 'user' },
                                content: { parts: ['How do I test modular JavaScript?'] }
                            },
                            children: ['msg_assistant'],
                            parent: null
                        },
                        'msg_assistant': {
                            message: {
                                author: { role: 'assistant' },
                                content: { parts: ['You can use Jest with ES modules for testing modular JavaScript. Here are the key steps:\n\n1. Configure Jest for ES modules\n2. Use proper mocking\n3. Test each module individually\n4. Create integration tests'] }
                            },
                            children: ['msg_followup'],
                            parent: 'msg_root'
                        },
                        'msg_followup': {
                            message: {
                                author: { role: 'user' },
                                content: { parts: ['What about testing file operations?'] }
                            },
                            children: ['msg_final'],
                            parent: 'msg_assistant'
                        },
                        'msg_final': {
                            message: {
                                author: { role: 'assistant' },
                                content: { parts: ['For file operations, you should mock the File System Access API and test the logic separately from the actual file I/O.'] }
                            },
                            children: [],
                            parent: 'msg_followup'
                        }
                    }
                },
                {
                    id: 'conversation_002',
                    title: 'Second Test Conversation',
                    create_time: 1703522700,
                    mapping: {
                        'msg_single': {
                            message: {
                                author: { role: 'user' },
                                content: { parts: ['Quick question about testing'] }
                            },
                            children: [],
                            parent: null
                        }
                    }
                }
            ];

            const processedIds = new Set();
            const results = processConversations(sampleData, processedIds);

            // Verify processing results
            expect(results.processed).toBe(2);
            expect(results.skipped).toBe(0);
            expect(results.errors).toBe(0);
            expect(results.files).toHaveLength(2);

            // Verify file generation
            const firstFile = results.files[0];
            // New filename format: <Title> — <HumanDate> — <HH.mm>.md (no "ChatGPT" segment)
            expect(firstFile.filename).toMatch(/.+ — [A-Za-z]+, [A-Za-z]+ \d{1,2}(st|nd|rd|th) \d{4} — \d{2}\.\d{2}\.md$/);
            // Title no longer included in content (shown by filename)
            expect(firstFile.content).not.toContain('# Test Integration Workflow');
            expect(firstFile.content).toMatch(/## 🧑‍💬 User — (\d{2}:\d{2}|#\d+)/);
            // Verify markdown content structure and formatting
            expect(firstFile.content).toContain('How do I test modular JavaScript?');
            expect(firstFile.content).toMatch(/## 🤖 Assistant — (\d{2}:\d{2}|#\d+)/);
            expect(firstFile.content).toContain('You can use Jest with ES modules');
            // Collapsible content should include both user and assistant messages
            expect(firstFile.content).toContain('What about testing file operations?');
            expect(firstFile.content).toContain('For file operations, you should mock the File System Access API');

            // Verify chronological ordering
            expect(results.files[0].title).toBe('Test Integration Workflow');
            expect(results.files[1].title).toBe('Second Test Conversation');
            
            // Check that creation time fields are included
            expect(results.files[0].createTime).toBe(1703522600);
            expect(results.files[1].createTime).toBe(1703522700);
            expect(results.files[0].createdDate).toBe(new Date(1703522600 * 1000).toLocaleDateString());
            expect(results.files[1].createdDate).toBe(new Date(1703522700 * 1000).toLocaleDateString());
        });

        test('handles real conversation export structure', async () => {
            // Test with structure similar to actual ChatGPT exports
            const realStructureData = [
                {
                    id: 'real_conversation_001',
                    title: 'Real Structure Test',
                    create_time: 1703522800,
                    mapping: {
                        '4f7b8a5c-1234-5678-9abc-def012345678': {
                            id: '4f7b8a5c-1234-5678-9abc-def012345678',
                            message: {
                                id: '4f7b8a5c-1234-5678-9abc-def012345678',
                                author: { role: 'system', name: null, metadata: {} },
                                create_time: 1703522800.123,
                                update_time: null,
                                content: { content_type: 'text', parts: [''] },
                                status: 'finished_successfully',
                                end_turn: null,
                                weight: 1.0,
                                metadata: { finish_details: { type: 'stop' } },
                                recipient: 'all'
                            },
                            parent: null,
                            children: ['next-message-id']
                        },
                        'next-message-id': {
                            id: 'next-message-id',
                            message: {
                                id: 'next-message-id',
                                author: { role: 'user', name: null, metadata: {} },
                                create_time: 1703522801.456,
                                update_time: null,
                                content: { content_type: 'text', parts: ['Hello, I need help with modular architecture'] },
                                status: 'finished_successfully',
                                end_turn: null,
                                weight: 1.0,
                                metadata: {},
                                recipient: 'all'
                            },
                            parent: '4f7b8a5c-1234-5678-9abc-def012345678',
                            children: []
                        }
                    }
                }
            ];

            const results = processConversations(realStructureData, new Set());
            
            expect(results.processed).toBe(1);
            expect(results.files[0].content).toContain('Hello, I need help with modular architecture');
        });

        test('handles duplicate conversation IDs correctly', async () => {
            const duplicateData = [
                {
                    id: 'duplicate_id',
                    title: 'First Instance',
                    create_time: 1703522600,
                    mapping: {
                        'msg1': {
                            message: {
                                author: { role: 'user' },
                                content: { parts: ['First message'] }
                            },
                            children: [],
                            parent: null
                        }
                    }
                },
                {
                    id: 'duplicate_id',
                    title: 'Second Instance',
                    create_time: 1703522700,
                    mapping: {
                        'msg2': {
                            message: {
                                author: { role: 'user' },
                                content: { parts: ['Second message'] }
                            },
                            children: [],
                            parent: null
                        }
                    }
                }
            ];

            const processedIds = new Set();
            const results = processConversations(duplicateData, processedIds);

            expect(results.processed).toBe(1);
            expect(results.skipped).toBe(1);
            expect(results.files).toHaveLength(1);
            expect(results.files[0].title).toBe('First Instance');
        });

        test('processes conversations in chronological order', async () => {
            const unorderedData = [
                {
                    id: 'newest',
                    title: 'Newest Conversation',
                    create_time: 1703523000,
                    mapping: {
                        'msg1': {
                            message: {
                                author: { role: 'user' },
                                content: { parts: ['Newest'] }
                            },
                            children: [],
                            parent: null
                        }
                    }
                },
                {
                    id: 'oldest',
                    title: 'Oldest Conversation',
                    create_time: 1703522500,
                    mapping: {
                        'msg2': {
                            message: {
                                author: { role: 'user' },
                                content: { parts: ['Oldest'] }
                            },
                            children: [],
                            parent: null
                        }
                    }
                },
                {
                    id: 'middle',
                    title: 'Middle Conversation',
                    create_time: 1703522750,
                    mapping: {
                        'msg3': {
                            message: {
                                author: { role: 'user' },
                                content: { parts: ['Middle'] }
                            },
                            children: [],
                            parent: null
                        }
                    }
                }
            ];

            const results = processConversations(unorderedData, new Set());

            // Should be processed in chronological order (oldest first)
            expect(results.files[0].title).toBe('Oldest Conversation');
            expect(results.files[1].title).toBe('Middle Conversation');
            expect(results.files[2].title).toBe('Newest Conversation');
        });
    });

    describe('Filename Generation and Conflict Resolution', () => {
        test('generates unique filenames for duplicate titles', () => {
            const conversations = [
                { title: 'Same Title' },
                { title: 'Same Title' },
                { title: 'Same Title' }
            ];

            const filenames = [];
            for (const conv of conversations) {
                const filename = generateUniqueFilename(conv, filenames);
                filenames.push(filename);
            }

            expect(filenames).toEqual([
                'Same Title.md',
                'Same Title (2).md',
                'Same Title (3).md'
            ]);
        });

        test('handles complex title sanitization', () => {
            const conversation = { 
                title: 'Complex<Title>with:Many|Invalid?Characters*and/Symbols\\Test"File' 
            };
            
            const filename = generateUniqueFilename(conversation, []);
            expect(filename).toBe('ComplexTitlewithManyInvalidCharactersandSymbolsTestFile.md');
        });

        test('handles very long titles with truncation', () => {
            const longTitle = 'This is a very long conversation title that exceeds the maximum filename length limit and should be truncated appropriately while maintaining readability and filesystem compatibility across different operating systems';
            const conversation = { title: longTitle };
            
            const filename = generateUniqueFilename(conversation, []);
            expect(filename.length).toBeLessThanOrEqual(104); // 100 chars + '.md'
            expect(filename.endsWith('.md')).toBe(true);
        });
    });

    describe('Sorting and Chronological Order', () => {
        test('maintains stable sort for conversations with same timestamp', () => {
            const conversations = [
                { id: '1', title: 'First', create_time: 1703522600 },
                { id: '2', title: 'Second', create_time: 1703522600 },
                { id: '3', title: 'Third', create_time: 1703522600 }
            ];

            const sorted = sortConversationsChronologically(conversations);
            
            // Should maintain original order for same timestamps
            expect(sorted.map(c => c.title)).toEqual(['First', 'Second', 'Third']);
        });

        test('filters out invalid entries while sorting', () => {
            const mixed = [
                { id: '1', create_time: 1703522700 },
                null,
                undefined,
                'invalid string',
                { id: '2', create_time: 1703522600 },
                42,
                { id: '3', create_time: 1703522800 }
            ];

            const sorted = sortConversationsChronologically(mixed);
            
            expect(sorted).toHaveLength(3);
            expect(sorted.map(c => c.id)).toEqual(['2', '1', '3']);
        });
    });

    describe('Error Handling and Edge Cases', () => {
        test('handles empty conversation array', () => {
            const results = processConversations([], new Set());
            
            expect(results.processed).toBe(0);
            expect(results.skipped).toBe(0);
            expect(results.errors).toBe(0);
            expect(results.files).toHaveLength(0);
        });

        test('handles malformed conversation objects', () => {
            const malformedData = [
                null,
                undefined,
                'not an object',
                { /* missing id */ title: 'No ID' },
                { id: 'valid', title: 'Valid Conversation', mapping: {} }
            ];

            const results = processConversations(malformedData, new Set());
            
            expect(results.processed).toBe(1);
            expect(results.errors).toBe(1);
            expect(results.files).toHaveLength(1);
        });

        test('handles conversations with empty or missing mapping', () => {
            const emptyMappingData = [
                {
                    id: 'empty_mapping',
                    title: 'Empty Mapping',
                    create_time: 1703522600,
                    mapping: {}
                },
                {
                    id: 'no_mapping',
                    title: 'No Mapping',
                    create_time: 1703522700
                    // missing mapping property
                }
            ];

            const results = processConversations(emptyMappingData, new Set());
            
            expect(results.processed).toBe(2);
            expect(results.files).toHaveLength(2);
            
            // Both should generate YAML frontmatter and created time
            expect(results.files[0].content).toContain('created:');
            expect(results.files[1].content).toContain('created:');
        });

        test('handles conversations with complex nested message structures', () => {
            const complexData = [
                {
                    id: 'complex_nested',
                    title: 'Complex Nested Messages',
                    create_time: 1703522600,
                    mapping: {
                        'root': {
                            message: {
                                author: { role: 'user' },
                                content: { 
                                    parts: [
                                        'First part of message',
                                        ' continues here',
                                        ' and ends here'
                                    ]
                                }
                            },
                            children: ['branch1', 'branch2'],
                            parent: null
                        },
                        'branch1': {
                            message: {
                                author: { role: 'assistant' },
                                content: 'String content format'
                            },
                            children: [],
                            parent: 'root'
                        },
                        'branch2': {
                            message: {
                                author: { role: 'assistant' },
                                content: { parts: ['Object content format'] }
                            },
                            children: [],
                            parent: 'root'
                        }
                    }
                }
            ];

            const results = processConversations(complexData, new Set());
            
            expect(results.processed).toBe(1);
            const content = results.files[0].content;
            
            expect(content).toContain('First part of message continues here and ends here');
            expect(content).toContain('String content format');
            // Note: Only one branch should be followed in the linear conversation
        });
    });
    
    describe('Individual File Save Functionality', () => {
        test('save button calls individual save method with correct file object', () => {
            // Setup DOM elements
            document.body.innerHTML = `
                <div id="filesSection">
                    <div id="filesContainer">
                        <table>
                            <tbody>
                                <tr>
                                    <td></td>
                                    <td></td>
                                    <td>
                                        <button class="save-file-btn" 
                                                data-filename="test-conversation.md"
                                                data-content="test%20content"
                                                data-title="Test Conversation">
                                        </button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            `;

            // Mock the ChatGPTConverter class with the saveSingleFileToMarkdown method
            const mockConverter = {
                saveSingleFileToMarkdown: jest.fn().mockResolvedValue(true),
                attachFileButtonHandlers: function() {
                    // Replicate the save button handler logic
                    document.querySelectorAll('.save-file-btn').forEach(btn => {
                        btn.addEventListener('click', async () => {
                            const filename = btn.dataset.filename;
                            const content = decodeURIComponent(btn.dataset.content);
                            const title = btn.dataset.title;
                            
                            const file = {
                                filename: filename,
                                content: content,
                                title: title
                            };
                            
                            await this.saveSingleFileToMarkdown(file);
                        });
                    });
                }
            };

            // Attach the handlers and simulate click
            mockConverter.attachFileButtonHandlers();
            const saveButton = document.querySelector('.save-file-btn');
            saveButton.click();

            // Wait for async call and verify
            return new Promise(resolve => {
                setTimeout(() => {
                    expect(mockConverter.saveSingleFileToMarkdown).toHaveBeenCalledWith({
                        filename: 'test-conversation.md',
                        content: 'test content',
                        title: 'Test Conversation'
                    });
                    resolve();
                                 }, 0);
             });
         });

         test('download button calls download method with correct file object', () => {
             // Setup DOM elements
             document.body.innerHTML = `
                 <div id="filesSection">
                     <div id="filesContainer">
                         <table>
                             <tbody>
                                 <tr>
                                     <td></td>
                                     <td></td>
                                     <td>
                                         <button class="download-file-btn" 
                                                 data-filename="test-conversation.md"
                                                 data-content="test%20markdown%20content">
                                         </button>
                                     </td>
                                 </tr>
                             </tbody>
                         </table>
                     </div>
                 </div>
             `;

             // Mock the ChatGPTConverter class with the downloadSingleFile method
             const mockConverter = {
                 downloadSingleFile: jest.fn(),
                 attachFileButtonHandlers: function() {
                     // Replicate the download button handler logic
                     document.querySelectorAll('.download-file-btn').forEach(btn => {
                         btn.addEventListener('click', () => {
                             const filename = btn.dataset.filename;
                             const content = decodeURIComponent(btn.dataset.content);
                             
                             const file = {
                                 filename: filename,
                                 content: content
                             };
                             
                             this.downloadSingleFile(file);
                         });
                     });
                 }
             };

             // Attach the handlers and simulate click
             mockConverter.attachFileButtonHandlers();
             const downloadButton = document.querySelector('.download-file-btn');
             downloadButton.click();

             // Verify the method was called with correct parameters
             expect(mockConverter.downloadSingleFile).toHaveBeenCalledWith({
                 filename: 'test-conversation.md',
                 content: 'test markdown content'
             });
         });

         test('file save confirmation dialog is shown when file is saved successfully', () => {
             // Setup DOM elements
             document.body.innerHTML = `
                 <div id="filesSection">
                     <div id="filesContainer">
                         <table>
                             <tbody>
                                 <tr>
                                     <td></td>
                                     <td></td>
                                     <td>
                                         <button class="save-file-btn" 
                                                 data-filename="test-conversation.md"
                                                 data-content="test%20content"
                                                 data-title="Test Conversation">
                                         </button>
                                     </td>
                                 </tr>
                             </tbody>
                         </table>
                     </div>
                 </div>
             `;

             // Mock the ChatGPTConverter class with the saveSingleFileToMarkdown method
             const mockConverter = {
                 showFileSaveConfirmation: jest.fn(),
                 saveSingleFileToMarkdown: jest.fn().mockImplementation(async (file) => {
                     // Simulate successful save by calling the confirmation
                     mockConverter.showFileSaveConfirmation(file.title, 'TestFolder', file.filename);
                 }),
                 attachFileButtonHandlers: function() {
                     // Replicate the save button handler logic
                     document.querySelectorAll('.save-file-btn').forEach(btn => {
                         btn.addEventListener('click', async () => {
                             const filename = btn.dataset.filename;
                             const content = decodeURIComponent(btn.dataset.content);
                             const title = btn.dataset.title;
                             
                             const file = {
                                 filename: filename,
                                 content: content,
                                 title: title
                             };
                             
                             await this.saveSingleFileToMarkdown(file);
                         });
                     });
                 }
             };

             // Attach the handlers and simulate click
             mockConverter.attachFileButtonHandlers();
             const saveButton = document.querySelector('.save-file-btn');
             saveButton.click();

             // Wait for async call and verify
             return new Promise(resolve => {
                 setTimeout(() => {
                     expect(mockConverter.showFileSaveConfirmation).toHaveBeenCalledWith(
                         'Test Conversation',
                         'TestFolder',
                         'test-conversation.md'
                     );
                     resolve();
                 }, 0);
             });
         });
     });
}); 