/**
 * Unit Tests for File System Manager
 * Testing file operations with proper mocking
 * Following AGENTS.md principle: isolated, reliable testing
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';

// Mock the File System Access API
const mockDirectoryHandle = {
    name: 'TestFolder',
    getFileHandle: jest.fn(),
    requestPermission: jest.fn()
};

const mockFileHandle = {
    requestPermission: jest.fn(),
    createWritable: jest.fn()
};

const mockWritable = {
    write: jest.fn(),
    close: jest.fn()
};

// Mock window.showDirectoryPicker
global.window = {
    showDirectoryPicker: jest.fn()
};

// Import after mocking
import { 
    isFileSystemAccessSupported, 
    selectDirectory, 
    saveFileToDirectory,
    validateDirectoryAccess,
    createDownloadBlob,
    downloadFile 
} from '../../../src/modules/fileSystemManager.js';

describe('File System Manager', () => {
    
    beforeEach(() => {
        jest.clearAllMocks();
        
        // Reset default mock behaviors
        window.showDirectoryPicker.mockResolvedValue(mockDirectoryHandle);
        mockDirectoryHandle.requestPermission.mockResolvedValue('granted');
        mockFileHandle.requestPermission.mockResolvedValue('granted');
        mockFileHandle.createWritable.mockResolvedValue(mockWritable);
        mockDirectoryHandle.getFileHandle.mockResolvedValue(mockFileHandle);
    });

    describe('isFileSystemAccessSupported', () => {
        test('returns true when showDirectoryPicker is available', () => {
            // Setup is already done in beforeEach
            expect(isFileSystemAccessSupported()).toBe(true);
        });

        test('returns false when showDirectoryPicker is not available', () => {
            delete window.showDirectoryPicker;
            
            // Re-import to get fresh evaluation
            jest.resetModules();
            const { isFileSystemAccessSupported: freshCheck } = require('../../../src/modules/fileSystemManager.js');
            
            expect(freshCheck()).toBe(false);
        });
    });

    describe('selectDirectory', () => {
        test('successfully selects directory', async () => {
            const result = await selectDirectory();
            
            expect(window.showDirectoryPicker).toHaveBeenCalledWith({
                mode: 'readwrite'
            });
            expect(result).toBe(mockDirectoryHandle);
        });

        test('passes options to directory picker', async () => {
            const customOptions = { startIn: 'documents' };
            await selectDirectory(customOptions);
            
            expect(window.showDirectoryPicker).toHaveBeenCalledWith({
                mode: 'readwrite',
                startIn: 'documents'
            });
        });

        test('throws error when API not supported', async () => {
            delete window.showDirectoryPicker;
            
            await expect(selectDirectory()).rejects.toThrow('File System Access API not supported');
        });

        test('handles user cancellation', async () => {
            const abortError = new Error('User cancelled');
            abortError.name = 'AbortError';
            window.showDirectoryPicker.mockRejectedValue(abortError);
            
            await expect(selectDirectory()).rejects.toThrow('Directory selection cancelled');
        });

        test('handles permission denied', async () => {
            const permissionError = new Error('Permission denied');
            permissionError.name = 'NotAllowedError';
            window.showDirectoryPicker.mockRejectedValue(permissionError);
            
            await expect(selectDirectory()).rejects.toThrow('Permission denied');
        });

        test('handles security error', async () => {
            const securityError = new Error('Security error');
            securityError.name = 'SecurityError';
            window.showDirectoryPicker.mockRejectedValue(securityError);
            
            await expect(selectDirectory()).rejects.toThrow('Security restriction');
        });
    });

    describe('saveFileToDirectory', () => {
        test('successfully saves file', async () => {
            const filename = 'test.md';
            const content = '# Test Content';
            
            const result = await saveFileToDirectory(filename, content, mockDirectoryHandle);
            
            expect(mockDirectoryHandle.getFileHandle).toHaveBeenCalledWith(filename, { create: true });
            expect(mockFileHandle.requestPermission).toHaveBeenCalledWith({ mode: 'readwrite' });
            expect(mockWritable.write).toHaveBeenCalledWith(content);
            expect(mockWritable.close).toHaveBeenCalled();
            expect(result).toBe(true);
        });

        test('sanitizes invalid filename characters', async () => {
            const filename = 'test<file>name:with|invalid?chars*.md';
            const content = 'content';
            
            await saveFileToDirectory(filename, content, mockDirectoryHandle);
            
            expect(mockDirectoryHandle.getFileHandle).toHaveBeenCalledWith(
                'test_file_name_with_invalid_chars_.md', 
                { create: true }
            );
        });

        test('handles permission denied for file', async () => {
            mockFileHandle.requestPermission.mockResolvedValue('denied');
            
            const result = await saveFileToDirectory('test.md', 'content', mockDirectoryHandle);
            
            expect(result).toBe(false);
        });

        test('handles file creation error', async () => {
            mockDirectoryHandle.getFileHandle.mockRejectedValue(new Error('File creation failed'));
            
            const result = await saveFileToDirectory('test.md', 'content', mockDirectoryHandle);
            
            expect(result).toBe(false);
        });

        test('handles write error', async () => {
            mockWritable.write.mockRejectedValue(new Error('Write failed'));
            
            const result = await saveFileToDirectory('test.md', 'content', mockDirectoryHandle);
            
            expect(result).toBe(false);
        });
    });

    describe('validateDirectoryAccess', () => {
        test('returns true for valid directory handle', async () => {
            const result = await validateDirectoryAccess(mockDirectoryHandle);
            
            expect(mockDirectoryHandle.requestPermission).toHaveBeenCalledWith({ mode: 'readwrite' });
            expect(result).toBe(true);
        });

        test('returns false for null directory handle', async () => {
            const result = await validateDirectoryAccess(null);
            expect(result).toBe(false);
        });

        test('returns false when permission request fails', async () => {
            mockDirectoryHandle.requestPermission.mockRejectedValue(new Error('Permission failed'));
            
            const result = await validateDirectoryAccess(mockDirectoryHandle);
            expect(result).toBe(false);
        });
    });

    describe('createDownloadBlob', () => {
        test('creates blob with correct content and type', () => {
            const content = '# Test Markdown';
            const result = createDownloadBlob(content);
            
            expect(result).toBeInstanceOf(Blob);
            expect(result.type).toBe('text/markdown');
            expect(result.size).toBe(content.length);
        });

        test('accepts custom MIME type', () => {
            const content = 'Plain text';
            const result = createDownloadBlob(content, 'text/plain');
            
            expect(result.type).toBe('text/plain');
        });
    });

    describe('downloadFile', () => {
        let mockLink;
        let mockCreateObjectURL;
        let mockRevokeObjectURL;

        beforeEach(() => {
            mockLink = {
                href: '',
                download: '',
                click: jest.fn()
            };

            mockCreateObjectURL = jest.fn(() => 'mock-url');
            mockRevokeObjectURL = jest.fn();

            global.URL = {
                createObjectURL: mockCreateObjectURL,
                revokeObjectURL: mockRevokeObjectURL
            };

            global.document = {
                createElement: jest.fn(() => mockLink),
                body: {
                    appendChild: jest.fn(),
                    removeChild: jest.fn()
                }
            };
        });

        test('creates download link and triggers click', () => {
            const blob = new Blob(['content'], { type: 'text/plain' });
            const filename = 'test.txt';
            
            downloadFile(blob, filename);
            
            expect(mockCreateObjectURL).toHaveBeenCalledWith(blob);
            expect(mockLink.href).toBe('mock-url');
            expect(mockLink.download).toBe(filename);
            expect(document.body.appendChild).toHaveBeenCalledWith(mockLink);
            expect(mockLink.click).toHaveBeenCalled();
            expect(document.body.removeChild).toHaveBeenCalledWith(mockLink);
            expect(mockRevokeObjectURL).toHaveBeenCalledWith('mock-url');
        });
    });
}); 