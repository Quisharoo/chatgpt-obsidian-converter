/**
 * File System Manager
 * Handles directory selection, file saving, and File System Access API operations
 * Following AGENTS.md principle: modular, focused functionality
 */

import { API_SUPPORT, ERROR_MESSAGES, PROCESSING_CONFIG } from '../utils/constants.js';
import { delay } from '../utils/helpers.js';

/**
 * Check if File System Access API is available
 * WHY: Need to degrade gracefully when API is not supported
 * 
 * @returns {boolean} - Whether File System Access API is supported
 */
export function isFileSystemAccessSupported() {
    return API_SUPPORT.FILE_SYSTEM_ACCESS;
}

/**
 * Prompt user to select directory with enhanced error handling
 * WHY: Directory selection is the most error-prone operation, needs robust handling
 * 
 * @param {Object} options - Configuration options for directory picker
 * @returns {Promise<FileSystemDirectoryHandle|null>} - Selected directory handle or null
 */
export async function selectDirectory(options = {}) {
    if (!isFileSystemAccessSupported()) {
        throw new Error(ERROR_MESSAGES.FILE_SYSTEM_UNSUPPORTED);
    }

    try {
        const pickerOptions = {
            mode: 'readwrite',
            ...options
        };
        
        const directoryHandle = await window.showDirectoryPicker(pickerOptions);
        console.log(`✅ Directory selected: ${directoryHandle.name}`);
        
        return directoryHandle;
    } catch (error) {
        return handleDirectorySelectionError(error);
    }
}

/**
 * Handle directory selection errors with specific messages
 * WHY: Provides user-friendly error messages for different failure scenarios
 * 
 * @param {Error} error - Directory selection error
 * @returns {null} - Always returns null for failed selection
 * @throws {Error} - Throws error with user-friendly message
 */
function handleDirectorySelectionError(error) {
    console.error('Directory selection error:', error);
    
    switch (error.name) {
        case 'AbortError':
            throw new Error(ERROR_MESSAGES.CANCELLED);
        case 'NotAllowedError':
            throw new Error(ERROR_MESSAGES.PERMISSION_DENIED);
        case 'SecurityError':
            throw new Error(ERROR_MESSAGES.SECURITY_RESTRICTION);
        default:
            throw new Error(`${error.message}. Files will be downloaded instead.`);
    }
}

/**
 * Save a single file to directory with permission handling
 * WHY: File saving needs individual error handling and permission checks
 * 
 * @param {string} filename - Name of file to create
 * @param {string} content - File content to write
 * @param {FileSystemDirectoryHandle} directoryHandle - Target directory
 * @returns {Promise<boolean>} - Success status
 */
export async function saveFileToDirectory(filename, content, directoryHandle) {
    try {
        // Sanitize filename for filesystem compatibility
        const safeFilename = sanitizeFilename(filename);
        
        // Create file handle
        const fileHandle = await directoryHandle.getFileHandle(safeFilename, {
            create: true
        });
        
        // Verify write permissions
        const permission = await fileHandle.requestPermission({ mode: 'readwrite' });
        if (permission !== 'granted') {
            console.error(`Permission denied for file: ${safeFilename}`);
            return false;
        }
        
        // Write content
        const writable = await fileHandle.createWritable();
        await writable.write(content);
        await writable.close();
        
        return true;
    } catch (error) {
        console.error(`Error saving file ${filename}:`, error);
        return false;
    }
}

/**
 * Sanitize filename for cross-platform filesystem compatibility
 * WHY: Different filesystems have different character restrictions
 * 
 * @param {string} filename - Original filename
 * @returns {string} - Sanitized filename
 */
function sanitizeFilename(filename) {
    const sanitized = filename.replace(/[<>:"/\\|?*]/g, '_');
    if (sanitized !== filename) {
        console.warn(`Sanitized filename: ${filename} → ${sanitized}`);
    }
    return sanitized;
}

/**
 * Save multiple files with chronological timing
 * WHY: Ensures files are created in chronological order for proper Obsidian sorting
 * 
 * @param {Array} files - Array of file objects to save
 * @param {FileSystemDirectoryHandle} directoryHandle - Target directory
 * @param {Function} progressCallback - Progress update callback
 * @returns {Promise<Object>} - Save results with success/error counts
 */
export async function saveFilesChronologically(files, directoryHandle, progressCallback = null) {
    let successCount = 0;
    let errorCount = 0;

    console.log(`🔄 Starting chronological save process: ${files.length} files to ${directoryHandle.name}/`);
    console.log(`📅 Files will be created oldest-first to maintain chronological order in Obsidian`);

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        try {
            const success = await saveFileToDirectory(file.filename, file.content, directoryHandle);
            
            if (success) {
                successCount++;
                console.log(`✅ Saved: ${file.filename}`);
            } else {
                errorCount++;
                console.warn(`❌ Failed to save: ${file.filename}`);
            }
        } catch (error) {
            console.error(`❌ Error saving ${file.filename}:`, error);
            errorCount++;
        }
        
        // Delay ensures chronological file timestamps
        if (i < files.length - 1) {
            await delay(PROCESSING_CONFIG.DELAY_BETWEEN_FILES_MS);
        }
        
        // Report progress
        if (progressCallback) {
            const progress = Math.round(((i + 1) / files.length) * 100);
            progressCallback(progress, successCount + errorCount, files.length);
        }
    }

    return { successCount, errorCount };
}

/**
 * Validate directory handle is still accessible
 * WHY: Directory handles can become invalid due to permission changes
 * 
 * @param {FileSystemDirectoryHandle} directoryHandle - Directory to validate
 * @returns {Promise<boolean>} - Whether directory is still accessible
 */
export async function validateDirectoryAccess(directoryHandle) {
    if (!directoryHandle) return false;
    
    try {
        await directoryHandle.requestPermission({ mode: 'readwrite' });
        return true;
    } catch (error) {
        console.error('Directory validation failed:', error);
        return false;
    }
}

/**
 * Create downloadable blob for fallback download
 * WHY: Provides fallback when File System Access API fails
 * 
 * @param {string} content - File content
 * @param {string} mimeType - MIME type for blob
 * @returns {Blob} - Downloadable blob
 */
export function createDownloadBlob(content, mimeType = 'text/markdown') {
    return new Blob([content], { type: mimeType });
}

/**
 * Trigger file download in browser
 * WHY: Fallback download method when direct saving isn't available
 * 
 * @param {Blob} blob - File blob to download
 * @param {string} filename - Download filename
 */
export function downloadFile(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
} 