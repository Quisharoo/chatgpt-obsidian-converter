/**
 * Jest Test Environment Setup
 * Configures mocks and global environment for testing
 * Following AGENTS.md principle: reliable test infrastructure
 */

// Enhanced DOM mocking
const createMockElement = (id, tagName = 'div') => {
    const element = {
        id,
        tagName,
        textContent: '',
        innerHTML: '',
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
            contains: jest.fn(),
            toggle: jest.fn()
        },
        querySelector: jest.fn(),
        querySelectorAll: jest.fn(() => []),
        click: jest.fn(),
        focus: jest.fn(),
        blur: jest.fn()
    };
    
    return element;
};

// Mock document with jest.fn() functions  
const mockGetElementById = jest.fn();
const mockCreateElement = jest.fn((tagName) => createMockElement('mock', tagName));
const mockQuerySelector = jest.fn();
const mockQuerySelectorAll = jest.fn(() => []);
const mockAddEventListener = jest.fn();
const mockRemoveEventListener = jest.fn();

// File System Access API Mocks
const mockWritableStream = {
    write: jest.fn(),
    close: jest.fn()
};

const mockFileHandle = {
    requestPermission: jest.fn(),
    createWritable: jest.fn()
};

const mockDirectoryHandle = {
    requestPermission: jest.fn(),
    getFileHandle: jest.fn()
};

// Mock document methods without overriding JSDOM's body property
if (!global.document) {
    global.document = {};
}

// Safely add mock methods to existing document
global.document.getElementById = mockGetElementById;
global.document.createElement = mockCreateElement;
global.document.querySelector = mockQuerySelector;
global.document.querySelectorAll = mockQuerySelectorAll;
global.document.addEventListener = mockAddEventListener;
global.document.removeEventListener = mockRemoveEventListener;

// Only set body if it doesn't exist (to avoid JSDOM conflicts)
if (!global.document.body) {
    global.document.body = createMockElement('body', 'body');
}

// Mock window with File System Access API support
if (!global.window) {
    global.window = {};
}

// Safely add mock methods and properties to existing window
global.window.showDirectoryPicker = jest.fn();
global.window.addEventListener = jest.fn();
global.window.removeEventListener = jest.fn();

// Only mock location if it doesn't exist or is configurable
if (!global.window.location) {
    global.window.location = {
        protocol: 'https:',
        hostname: 'localhost'
    };
} else {
    // If location exists, just set the properties we need
    try {
        if (global.window.location.protocol !== 'https:') {
            // Only set if different to avoid navigation errors
            Object.defineProperty(global.window.location, 'protocol', { value: 'https:', writable: false });
        }
        if (global.window.location.hostname !== 'localhost') {
            Object.defineProperty(global.window.location, 'hostname', { value: 'localhost', writable: false });
        }
    } catch (e) {
        // If we can't set them, that's ok for tests
    }
}

global.window.isSecureContext = true;

// Mock console to reduce noise in tests
global.console = {
    ...console,
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn()
};

// Mock URL APIs
global.URL = {
    createObjectURL: jest.fn(() => 'mock-url'),
    revokeObjectURL: jest.fn()
};

// Mock File APIs
global.FileReader = class MockFileReader {
    constructor() {
        this.onload = null;
        this.onerror = null;
        this.result = null;
    }
    
    readAsText(file) {
        setTimeout(() => {
            if (this.onload) {
                this.result = '{"test": "data"}';
                this.onload({ target: { result: this.result } });
            }
        }, 0);
    }
};

global.Blob = class MockBlob {
    constructor(parts, options) {
        this.parts = parts;
        this.size = parts.join('').length;
        this.type = options?.type || '';
    }
};

// Export utilities for tests using CommonJS
module.exports = { 
    createMockElement,
    mockGetElementById,
    mockCreateElement,
    mockQuerySelector,
    mockQuerySelectorAll,
    mockAddEventListener,
    mockRemoveEventListener
};

// Make mocks available globally for tests
global.testMocks = {
    mockGetElementById,
    mockCreateElement,
    mockQuerySelector,
    mockQuerySelectorAll,
    mockAddEventListener,
    mockRemoveEventListener,
    mockDirectoryHandle,
    mockFileHandle,
    mockWritableStream
};

// Export for ES modules
export const testMocks = global.testMocks;

console.log('🧪 Test environment setup complete');
    console.log('📊 Running ChatGPT to Markdown Converter tests...');

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