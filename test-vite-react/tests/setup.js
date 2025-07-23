/**
 * Jest setup file for ChatGPT to Obsidian Converter tests
 * Following AGENTS.md testing guidelines
 */

import { jest } from '@jest/globals';

// Mock DOM globals for testing environment
global.Blob = class Blob {
    constructor(parts, options = {}) {
        this.parts = parts;
        this.type = options.type || '';
        this.size = parts.reduce((size, part) => size + part.length, 0);
    }
};

global.URL = {
    createObjectURL: jest.fn(() => 'mock-blob-url'),
    revokeObjectURL: jest.fn()
};

global.FileReader = class FileReader {
    constructor() {
        this.onload = null;
        this.onerror = null;
        this.result = null;
    }
    
    readAsText(file) {
        setTimeout(() => {
            this.result = file.content || '{}';
            if (this.onload) {
                this.onload({ target: { result: this.result } });
            }
        }, 0);
    }
};

// Mock File System Access API
global.window = {
    showDirectoryPicker: jest.fn()
};

// Mock document
global.document = {
    getElementById: jest.fn((id) => ({
        id,
        textContent: '',
        className: '',
        style: {},
        appendChild: jest.fn(),
        removeChild: jest.fn()
    })),
    createElement: jest.fn((tag) => ({
        tagName: tag,
        textContent: '',
        className: '',
        style: {},
        onclick: null,
        appendChild: jest.fn(),
        removeChild: jest.fn(),
        click: jest.fn(),
        href: '',
        download: ''
    })),
    body: {
        appendChild: jest.fn(),
        removeChild: jest.fn()
    }
};

// Console setup for test output
console.log('🧪 Test environment setup complete');
console.log('📊 Running ChatGPT to Obsidian Converter tests...');

// Global test configuration
global.testConfig = {
    sampleConversation: {
        id: 'test_conversation_001',
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
                    content: { parts: ['Python is a programming language created by Guido van Rossum.'] }
                },
                children: [],
                parent: 'msg_001'
            }
        }
    },
    expectedMarkdown: `# Test Conversation

**Created:** 12/25/2024, 2:30:22 PM

---

**User:**

What is Python?

**Assistant:**

Python is a programming language created by Guido van Rossum.

`,
    expectedFilename: '2024-12-25_test-conversation_test_conversation_001.md'
}; 