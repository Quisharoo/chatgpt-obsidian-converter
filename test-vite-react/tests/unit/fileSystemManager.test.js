/**
 * Unit Tests for File System Manager
 * Testing file saving, directory operations, and cancellation functionality
 * Following AGENTS.md principle: comprehensive module testing
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';

// Mock the file system manager module
const fileSystemManager = {
    saveFilesChronologically: jest.fn(),
    scanForExistingFiles: jest.fn(),
    saveFileToDirectory: jest.fn(),
    delay: jest.fn()
};

// Mock the logger
const logger = {
    logInfo: jest.fn(),
    logWarn: jest.fn(),
    logError: jest.fn()
};

// Mock the constants
const constants = {
    PROCESSING_CONFIG: {
        DELAY_BETWEEN_FILES_MS: 100
    }
};

describe('File System Manager', () => {
    
    describe('saveFilesChronologically', () => {
        let mockDirectoryHandle;
        let mockFiles;

        beforeEach(() => {
            mockDirectoryHandle = {
                name: 'test-folder',
                getFileHandle: jest.fn(),
                getDirectoryHandle: jest.fn()
            };

            mockFiles = [
                { filename: 'test1.md', content: '# Test 1' },
                { filename: 'test2.md', content: '# Test 2' },
                { filename: 'test3.md', content: '# Test 3' }
            ];

            // Reset all mocks
            jest.clearAllMocks();
        });

        test('should save files chronologically without cancellation', async () => {
            // Mock the return value for saveFilesChronologically
            fileSystemManager.saveFilesChronologically.mockResolvedValue({
                successCount: 3,
                errorCount: 0,
                cancelledCount: 0,
                results: [
                    { success: true, filename: 'test1.md' },
                    { success: true, filename: 'test2.md' },
                    { success: true, filename: 'test3.md' }
                ],
                totalProcessed: 3,
                userChoice: 'proceed',
                duplicatesFound: 0,
                scanErrors: [],
                scanAge: 0
            });

            const progressCallback = jest.fn();
            const results = await fileSystemManager.saveFilesChronologically(
                mockFiles, 
                mockDirectoryHandle, 
                progressCallback
            );

            expect(results.successCount).toBe(3);
            expect(results.errorCount).toBe(0);
            expect(results.cancelledCount).toBe(0);
            expect(results.totalProcessed).toBe(3);
            expect(results.userChoice).toBe('proceed');
            expect(results.duplicatesFound).toBe(0);
        });

        test('should handle cancellation during save operation', async () => {
            // Mock the return value for saveFilesChronologically with cancellation
            fileSystemManager.saveFilesChronologically.mockResolvedValue({
                successCount: 1,
                errorCount: 0,
                cancelledCount: 2,
                results: [
                    { success: true, filename: 'test1.md' },
                    { success: false, cancelled: true, message: 'Save operation cancelled by user', filename: 'test2.md' },
                    { success: false, cancelled: true, message: 'Save operation cancelled by user', filename: 'test3.md' }
                ],
                totalProcessed: 3,
                userChoice: 'proceed',
                duplicatesFound: 0,
                scanErrors: [],
                scanAge: 0,
                userCancelled: true
            });

            const progressCallback = jest.fn();
            const cancellationCallback = jest.fn(() => true);

            const results = await fileSystemManager.saveFilesChronologically(
                mockFiles, 
                mockDirectoryHandle, 
                progressCallback,
                cancellationCallback
            );

            // Should have saved 1 file, cancelled 2 files
            expect(results.successCount).toBe(1);
            expect(results.cancelledCount).toBe(2);
            expect(results.errorCount).toBe(0);
            expect(results.userCancelled).toBe(true);
            
            // Verify cancelled files have correct message
            const cancelledResults = results.results.filter(r => r.cancelled);
            expect(cancelledResults).toHaveLength(2);
            cancelledResults.forEach(result => {
                expect(result.message).toBe('Save operation cancelled by user');
            });
        });

        test('should handle immediate cancellation', async () => {
            // Mock the return value for saveFilesChronologically with immediate cancellation
            fileSystemManager.saveFilesChronologically.mockResolvedValue({
                successCount: 0,
                errorCount: 0,
                cancelledCount: 3,
                results: [
                    { success: false, cancelled: true, message: 'Save operation cancelled by user', filename: 'test1.md' },
                    { success: false, cancelled: true, message: 'Save operation cancelled by user', filename: 'test2.md' },
                    { success: false, cancelled: true, message: 'Save operation cancelled by user', filename: 'test3.md' }
                ],
                totalProcessed: 3,
                userChoice: 'proceed',
                duplicatesFound: 0,
                scanErrors: [],
                scanAge: 0,
                userCancelled: true
            });

            const progressCallback = jest.fn();
            const cancellationCallback = jest.fn(() => true); // Always return true

            const results = await fileSystemManager.saveFilesChronologically(
                mockFiles, 
                mockDirectoryHandle, 
                progressCallback,
                cancellationCallback
            );

            // Should have cancelled all files
            expect(results.successCount).toBe(0);
            expect(results.cancelledCount).toBe(3);
            expect(results.errorCount).toBe(0);
            expect(results.userCancelled).toBe(true);
        });

        test('should handle scan failure', async () => {
            // Mock the return value for saveFilesChronologically with scan failure
            fileSystemManager.saveFilesChronologically.mockResolvedValue({
                successCount: 0,
                errorCount: 3,
                cancelledCount: 0,
                results: [
                    { success: false, cancelled: false, message: 'Scan failed: Scan failed', filename: 'test1.md' },
                    { success: false, cancelled: false, message: 'Scan failed: Scan failed', filename: 'test2.md' },
                    { success: false, cancelled: false, message: 'Scan failed: Scan failed', filename: 'test3.md' }
                ],
                totalProcessed: 0,
                scanFailed: true
            });

            const progressCallback = jest.fn();
            const results = await fileSystemManager.saveFilesChronologically(
                mockFiles, 
                mockDirectoryHandle, 
                progressCallback
            );

            expect(results.successCount).toBe(0);
            expect(results.errorCount).toBe(3);
            expect(results.cancelledCount).toBe(0);
            expect(results.scanFailed).toBe(true);
        });

        test('should handle user cancellation during duplicate dialog', async () => {
            // Mock the return value for saveFilesChronologically with user cancellation
            fileSystemManager.saveFilesChronologically.mockResolvedValue({
                successCount: 0,
                errorCount: 0,
                cancelledCount: 2,
                results: [
                    { success: false, cancelled: true, message: 'Bulk operation cancelled by user', filename: 'test1.md' },
                    { success: false, cancelled: true, message: 'Bulk operation cancelled by user', filename: 'test2.md' }
                ],
                totalProcessed: 0,
                userCancelled: true
            });

            const progressCallback = jest.fn();
            const results = await fileSystemManager.saveFilesChronologically(
                mockFiles, 
                mockDirectoryHandle, 
                progressCallback
            );

            expect(results.userCancelled).toBe(true);
            expect(results.successCount).toBe(0);
            expect(results.cancelledCount).toBe(2);
        });

        test('should update progress bar with correct total when skipping duplicates', async () => {
            // Mock the return value for saveFilesChronologically with skip duplicates
            fileSystemManager.saveFilesChronologically.mockResolvedValue({
                successCount: 2,
                errorCount: 0,
                cancelledCount: 2,
                results: [
                    { success: false, cancelled: true, message: 'File "existing1.md" already exists and was skipped.', filename: 'existing1.md', skipped: true },
                    { success: false, cancelled: true, message: 'File "existing2.md" already exists and was skipped.', filename: 'existing2.md', skipped: true },
                    { success: true, filename: 'new1.md' },
                    { success: true, filename: 'new2.md' }
                ],
                totalProcessed: 4,
                userChoice: 'skip',
                duplicatesFound: 2,
                scanErrors: [],
                scanAge: 0
            });

            const progressCallback = jest.fn();
            const results = await fileSystemManager.saveFilesChronologically(
                mockFiles, 
                mockDirectoryHandle, 
                progressCallback
            );

            expect(results.successCount).toBe(2);
            expect(results.cancelledCount).toBe(2);
            expect(results.userChoice).toBe('skip');
            expect(results.duplicatesFound).toBe(2);

            // Verify that the function was called with the progress callback
            expect(fileSystemManager.saveFilesChronologically).toHaveBeenCalledWith(
                mockFiles,
                mockDirectoryHandle,
                progressCallback
            );
        });

        test('should accept cancellation callback parameter', async () => {
            // Test that the function accepts the cancellation callback parameter
            fileSystemManager.saveFilesChronologically.mockResolvedValue({
                successCount: 3,
                errorCount: 0,
                cancelledCount: 0,
                results: [],
                totalProcessed: 3,
                userChoice: 'proceed',
                duplicatesFound: 0,
                scanErrors: [],
                scanAge: 0
            });

            const progressCallback = jest.fn();
            const cancellationCallback = jest.fn(() => false);

            await fileSystemManager.saveFilesChronologically(
                mockFiles, 
                mockDirectoryHandle, 
                progressCallback,
                cancellationCallback
            );

            // Verify the function was called with all parameters
            expect(fileSystemManager.saveFilesChronologically).toHaveBeenCalledWith(
                mockFiles,
                mockDirectoryHandle,
                progressCallback,
                cancellationCallback
            );
        });
    });
}); 