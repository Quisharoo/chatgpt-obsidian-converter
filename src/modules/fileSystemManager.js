/**
 * File System Manager
 * Handles directory selection, file saving, and File System Access API operations
 * Following AGENTS.md principle: modular, focused functionality
 */

import { API_SUPPORT, ERROR_MESSAGES, PROCESSING_CONFIG } from '../utils/constants.js';
import { delay } from '../utils/helpers.js';
import { logInfo, logDebug, logWarn, logError } from '../utils/logger.js';

/**
 * Check if File System Access API is available
 * WHY: Need to degrade gracefully when API is not supported
 * 
 * @returns {boolean} - Whether File System Access API is supported
 */
export function isFileSystemAccessSupported() {
    const apiSupport = API_SUPPORT.FILE_SYSTEM_ACCESS;
    
    // Debug logging to help troubleshoot
    logDebug('📁 File System Access API Detection:', apiSupport);
    
    return apiSupport.supported;
}

/**
 * Get detailed API support information
 * WHY: Provides detailed information for better user feedback
 * 
 * @returns {Object} - Detailed API support information
 */
export function getFileSystemAccessInfo() {
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
        logInfo(`✅ Directory selected: ${directoryHandle.name}`);
        
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
 * Save a single file to directory with permission handling and duplicate detection
 * WHY: File saving needs individual error handling, permission checks, and duplicate detection
 * 
 * @param {string} filename - Name of file to create
 * @param {string} content - File content to write
 * @param {FileSystemDirectoryHandle} directoryHandle - Target directory
 * @param {boolean} forceOverwrite - Whether to overwrite without asking (for bulk operations)
 * @returns {Promise<Object>} - Detailed result with success status and information
 */
export async function saveFileToDirectory(filename, content, directoryHandle, forceOverwrite = false) {
    try {
        // Sanitize filename for filesystem compatibility
        const safeFilename = sanitizeFilename(filename);
        
        // Check if file already exists
        let fileExists = false;
        try {
            await directoryHandle.getFileHandle(safeFilename);
            fileExists = true;
        } catch (error) {
            // File doesn't exist, which is fine
            fileExists = false;
        }
        
        // If file exists and we're not forcing overwrite, ask for confirmation
        if (fileExists && !forceOverwrite) {
            const shouldOverwrite = await showFileExistsConfirmation(safeFilename);
            if (!shouldOverwrite) {
                return { 
                    success: false, 
                    cancelled: true, 
                    message: `File "${safeFilename}" already exists and user chose not to overwrite.`,
                    filename: safeFilename 
                };
            }
        }
        
        // Create file handle (this will overwrite if exists)
        const fileHandle = await directoryHandle.getFileHandle(safeFilename, {
            create: true
        });
        
        // Verify write permissions
        const permission = await fileHandle.requestPermission({ mode: 'readwrite' });
        if (permission !== 'granted') {
            logError(`Permission denied for file: ${safeFilename}`);
            return { 
                success: false, 
                cancelled: false, 
                message: `Permission denied for file: ${safeFilename}`,
                filename: safeFilename 
            };
        }
        
        // Write content
        const writable = await fileHandle.createWritable();
        await writable.write(content);
        await writable.close();
        
        return { 
            success: true, 
            cancelled: false, 
            message: fileExists ? `File "${safeFilename}" overwritten successfully.` : `File "${safeFilename}" created successfully.`,
            filename: safeFilename,
            wasOverwrite: fileExists 
        };
    } catch (error) {
        logError(`Error saving file ${filename}:`, error);
        return { 
            success: false, 
            cancelled: false, 
            message: `Error saving file ${filename}: ${error.message}`,
            filename: sanitizeFilename(filename) 
        };
    }
}

/**
 * Show confirmation dialog for existing file
 * WHY: Provides user choice when file already exists
 * 
 * @param {string} filename - Name of the existing file
 * @returns {Promise<boolean>} - Whether user confirmed to overwrite
 */
async function showFileExistsConfirmation(filename) {
    return new Promise((resolve) => {
        // Create confirmation dialog
        const dialog = document.createElement('div');
        dialog.className = 'file-exists-dialog';
        dialog.innerHTML = `
            <div class="dialog-overlay">
                <div class="dialog-content">
                    <h3>File Already Exists</h3>
                    <p>The file "<strong>${filename}</strong>" already exists in the selected folder.</p>
                    <p>Do you want to overwrite it?</p>
                    <div class="dialog-buttons">
                        <button class="btn btn-secondary cancel-btn">Cancel</button>
                        <button class="btn btn-primary overwrite-btn">Overwrite</button>
                    </div>
                </div>
            </div>
        `;
        
        // Add dialog styles
        const style = document.createElement('style');
        style.textContent = `
            .file-exists-dialog .dialog-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                backdrop-filter: blur(2px);
            }
            .file-exists-dialog .dialog-content {
                background: #2a2a2a;
                border: 1px solid #444;
                border-radius: 12px;
                padding: 32px;
                max-width: 450px;
                width: 90%;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
                position: relative;
            }
            .file-exists-dialog h3 {
                margin: 0 0 20px 0;
                color: #ffffff;
                font-size: 20px;
                font-weight: 600;
            }
            .file-exists-dialog p {
                margin: 0 0 16px 0;
                color: #cccccc;
                line-height: 1.6;
                font-size: 15px;
            }
            .file-exists-dialog .dialog-buttons {
                display: flex;
                gap: 16px;
                justify-content: flex-end;
                margin-top: 24px;
            }
            .file-exists-dialog .btn {
                padding: 12px 20px;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
                transition: all 0.2s ease;
                min-width: 90px;
            }
            .file-exists-dialog .btn-secondary {
                background: #404040;
                color: #ffffff;
                border: 1px solid #555;
            }
            .file-exists-dialog .btn-secondary:hover {
                background: #4a4a4a;
                border-color: #666;
            }
            .file-exists-dialog .btn-primary {
                background: #007acc;
                color: #ffffff;
            }
            .file-exists-dialog .btn-primary:hover {
                background: #0066aa;
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(0, 122, 204, 0.3);
            }
        `;
        
        // Add to document
        document.head.appendChild(style);
        document.body.appendChild(dialog);
        
        // Focus the overwrite button for better UX
        const overwriteBtn = dialog.querySelector('.overwrite-btn');
        const cancelBtn = dialog.querySelector('.cancel-btn');
        
        // Handle button clicks
        const cleanup = () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.removeChild(dialog);
            document.head.removeChild(style);
        };
        
        overwriteBtn.addEventListener('click', () => {
            cleanup();
            resolve(true);
        });
        
        cancelBtn.addEventListener('click', () => {
            cleanup();
            resolve(false);
        });
        
        // Handle escape key
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                cleanup();
                resolve(false);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        
        // Focus the overwrite button
        setTimeout(() => overwriteBtn.focus(), 100);
    });
}

/**
 * Sanitize filename for cross-platform filesystem compatibility
 * WHY: Different filesystems have different character restrictions
 * 
 * @param {string} filename - Original filename
 * @returns {string} - Sanitized filename
 */
function sanitizeFilename(filename) {
    if (!filename || typeof filename !== 'string') {
        logWarn('Invalid filename provided for sanitization:', filename);
        return 'untitled.md';
    }
    
    // Remove or replace problematic characters
    let sanitized = filename
        .replace(/[<>:"/\\|?*]/g, '_')  // Replace invalid chars with underscore
        .replace(/\s+/g, ' ')          // Normalize whitespace
        .replace(/\.+$/, '')           // Remove trailing dots
        .trim();                       // Remove leading/trailing whitespace
    
    // Ensure filename isn't too long (most filesystems have 255 char limit)
    if (sanitized.length > 200) {
        const ext = sanitized.slice(sanitized.lastIndexOf('.'));
        const nameWithoutExt = sanitized.slice(0, sanitized.lastIndexOf('.'));
        sanitized = nameWithoutExt.slice(0, 200 - ext.length) + ext;
        logWarn(`Filename truncated due to length: ${filename} → ${sanitized}`);
    }
    
    // Ensure it's not empty after sanitization
    if (!sanitized) {
        sanitized = 'untitled.md';
        logWarn(`Filename became empty after sanitization, using default: ${filename} → ${sanitized}`);
    }
    
    // Log only if changes were made
    if (sanitized !== filename) {
        logDebug(`Sanitized filename: ${filename} → ${sanitized}`);
    }
    
    return sanitized;
}

/**
 * Show bulk duplicate files confirmation dialog
 * WHY: Provides clear information about duplicates and user choice for bulk operations
 * 
 * @param {Object} scanResults - Results from scanForExistingFiles
 * @returns {Promise<string>} - User choice: 'skip', 'overwrite', or 'cancel'
 */
async function showBulkDuplicateDialog(scanResults) {
    const { existingFiles, newFiles, totalFiles, duplicateCount, scanErrors } = scanResults;
    
    logInfo(`📋 Showing duplicate dialog: ${duplicateCount} duplicates found out of ${totalFiles} files`);
    
    return new Promise((resolve) => {
        // Create confirmation dialog
        const dialog = document.createElement('div');
        dialog.className = 'bulk-duplicate-dialog';
        dialog.id = 'bulkDuplicateDialog'; // Add ID for debugging
        
        // Show first few duplicate filenames as examples
        const exampleFiles = existingFiles.slice(0, 3).map(f => f.safeFilename);
        const moreCount = duplicateCount - exampleFiles.length;
        
        const filesList = exampleFiles.map(name => `• ${name}`).join('\n');
        const moreText = moreCount > 0 ? `\n... and ${moreCount} more` : '';
        
        // Add scan errors warning if any
        let scanErrorsHtml = '';
        if (scanErrors && scanErrors.length > 0) {
            const errorSample = scanErrors.slice(0, 2);
            const errorList = errorSample.map(e => `• ${e.filename}: ${e.error}`).join('\n');
            const moreErrors = scanErrors.length > 2 ? `\n... and ${scanErrors.length - 2} more errors` : '';
            
            scanErrorsHtml = `
                <div class="scan-errors-warning">
                    <h4>⚠️ Scan Issues Detected</h4>
                    <div class="error-list">${errorList}${moreErrors}</div>
                    <p><small>Files with errors are treated as existing for safety.</small></p>
                </div>
            `;
        }
        
        dialog.innerHTML = `
            <div class="dialog-overlay">
                <div class="dialog-content">
                    <h3>📋 Duplicate Files Detected</h3>
                    <p><strong>${duplicateCount} of ${totalFiles} files</strong> already exist in this folder:</p>
                    <div class="file-list">${filesList}${moreText}</div>
                    ${scanErrorsHtml}
                    <p>What would you like to do?</p>
                    <div class="dialog-buttons">
                        <button class="btn btn-secondary cancel-btn">Cancel</button>
                        <button class="btn btn-info skip-btn">Skip Duplicates</button>
                        <button class="btn btn-warning overwrite-btn">Overwrite All</button>
                    </div>
                    <div class="dialog-info">
                        <small>• Skip: Only save ${newFiles.length} new files</small>
                        <small>• Overwrite: Replace existing files with new content</small>
                    </div>
                </div>
            </div>
        `;
        
        // Add dialog styles with higher z-index to ensure visibility
        const style = document.createElement('style');
        style.id = 'bulkDuplicateDialogStyles';
        style.textContent = `
            .bulk-duplicate-dialog .dialog-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 99999;
                backdrop-filter: blur(3px);
            }
            .bulk-duplicate-dialog .dialog-content {
                background: #2a2a2a;
                border: 1px solid #444;
                border-radius: 12px;
                padding: 32px;
                max-width: 550px;
                width: 90%;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8);
                position: relative;
                max-height: 80vh;
                overflow-y: auto;
                animation: dialogFadeIn 0.3s ease-out;
            }
            @keyframes dialogFadeIn {
                from { opacity: 0; transform: scale(0.9) translateY(-20px); }
                to { opacity: 1; transform: scale(1) translateY(0); }
            }
            .bulk-duplicate-dialog h3 {
                margin: 0 0 20px 0;
                color: #ffffff;
                font-size: 20px;
                font-weight: 600;
            }
            .bulk-duplicate-dialog p {
                margin: 0 0 16px 0;
                color: #cccccc;
                line-height: 1.6;
                font-size: 15px;
            }
            .bulk-duplicate-dialog .file-list {
                background: #1a1a1a;
                border: 1px solid #444;
                border-radius: 6px;
                padding: 16px;
                margin: 16px 0;
                font-family: 'Monaco', 'Consolas', monospace;
                font-size: 13px;
                color: #e0e0e0;
                white-space: pre-line;
                max-height: 150px;
                overflow-y: auto;
            }
            .bulk-duplicate-dialog .scan-errors-warning {
                background: #3d2914;
                border: 1px solid #b8860b;
                border-radius: 6px;
                padding: 16px;
                margin: 16px 0;
            }
            .bulk-duplicate-dialog .scan-errors-warning h4 {
                margin: 0 0 12px 0;
                color: #ffd700;
                font-size: 16px;
            }
            .bulk-duplicate-dialog .error-list {
                background: #2a1f0d;
                border: 1px solid #8b7355;
                border-radius: 4px;
                padding: 12px;
                font-family: 'Monaco', 'Consolas', monospace;
                font-size: 12px;
                color: #ffcc99;
                white-space: pre-line;
                max-height: 100px;
                overflow-y: auto;
                margin-bottom: 8px;
            }
            .bulk-duplicate-dialog .dialog-buttons {
                display: flex;
                gap: 12px;
                justify-content: flex-end;
                margin: 24px 0 16px 0;
            }
            .bulk-duplicate-dialog .btn {
                padding: 12px 18px;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
                transition: all 0.2s ease;
                min-width: 100px;
            }
            .bulk-duplicate-dialog .btn-secondary {
                background: #404040;
                color: #ffffff;
                border: 1px solid #555;
            }
            .bulk-duplicate-dialog .btn-secondary:hover {
                background: #4a4a4a;
                border-color: #666;
            }
            .bulk-duplicate-dialog .btn-info {
                background: #17a2b8;
                color: #ffffff;
            }
            .bulk-duplicate-dialog .btn-info:hover {
                background: #138496;
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(23, 162, 184, 0.3);
            }
            .bulk-duplicate-dialog .btn-warning {
                background: #ffc107;
                color: #212529;
            }
            .bulk-duplicate-dialog .btn-warning:hover {
                background: #e0a800;
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(255, 193, 7, 0.3);
            }
            .bulk-duplicate-dialog .dialog-info {
                display: flex;
                flex-direction: column;
                gap: 4px;
                border-top: 1px solid #444;
                padding-top: 16px;
            }
            .bulk-duplicate-dialog .dialog-info small {
                color: #999;
                font-size: 12px;
            }
        `;
        
        // Add to document
        document.head.appendChild(style);
        document.body.appendChild(dialog);
        
        logInfo('✅ Duplicate dialog added to DOM');
        
        // Get button references
        const cancelBtn = dialog.querySelector('.cancel-btn');
        const skipBtn = dialog.querySelector('.skip-btn');
        const overwriteBtn = dialog.querySelector('.overwrite-btn');
        
        // Handle button clicks
        const cleanup = () => {
            try {
                if (dialog.parentNode) {
                    document.body.removeChild(dialog);
                }
                if (style.parentNode) {
                    document.head.removeChild(style);
                }
                logInfo('✅ Duplicate dialog cleaned up');
            } catch (error) {
                logWarn('⚠️ Error cleaning up dialog:', error);
            }
        };
        
        cancelBtn.addEventListener('click', () => {
            logInfo('📋 User chose to cancel duplicate operation');
            cleanup();
            resolve('cancel');
        });
        
        skipBtn.addEventListener('click', () => {
            logInfo('📋 User chose to skip duplicates');
            cleanup();
            resolve('skip');
        });
        
        overwriteBtn.addEventListener('click', () => {
            logInfo('📋 User chose to overwrite duplicates');
            cleanup();
            resolve('overwrite');
        });
        
        // Handle escape key
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                document.removeEventListener('keydown', handleKeyDown);
                logInfo('📋 User cancelled with Escape key');
                cleanup();
                resolve('cancel');
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        
        // Focus the skip button (safest default)
        setTimeout(() => {
            try {
                skipBtn.focus();
                logInfo('✅ Duplicate dialog focused and ready');
            } catch (error) {
                logWarn('⚠️ Could not focus dialog button:', error);
            }
        }, 100);
    });
}

/**
 * Save multiple files with chronological timing and duplicate handling
 * WHY: Ensures files are created in chronological order for proper organization
 * 
 * @param {Array} files - Array of file objects to save
 * @param {FileSystemDirectoryHandle} directoryHandle - Target directory
 * @param {Function} progressCallback - Progress update callback
 * @param {Function} cancellationCallback - Function that returns true if operation should be cancelled
 * @returns {Promise<Object>} - Save results with success/error counts and details
 */
export async function saveFilesChronologically(files, directoryHandle, progressCallback = null, cancellationCallback = null) {
    logInfo(`🔄 Starting chronological save process: ${files.length} files to ${directoryHandle.name}/`);
    
    // First, scan for existing files
    if (progressCallback) {
        progressCallback(5, 0, files.length, 'Scanning for existing files...');
    }
    
    let scanResults;
    try {
        scanResults = await scanForExistingFiles(files, directoryHandle);
    } catch (error) {
        logError('❌ Scan failed:', error);
        return {
            successCount: 0,
            errorCount: files.length,
            cancelledCount: 0,
            results: files.map(f => ({
                success: false,
                cancelled: false,
                message: `Scan failed: ${error.message}`,
                filename: f.filename
            })),
            totalProcessed: 0,
            scanFailed: true
        };
    }
    
    // Report scan errors to user if any
    if (scanResults.scanErrors && scanResults.scanErrors.length > 0) {
        logWarn(`⚠️ ${scanResults.scanErrors.length} files had scan errors - they will be treated as existing files for safety`);
    }
    
    // If duplicates found, ask user what to do
    let filesToSave = files;
    let userChoice = 'proceed'; // Default for no duplicates
    
    if (scanResults.duplicateCount > 0) {
        logInfo(`📋 Found ${scanResults.duplicateCount} duplicate files, showing dialog...`);
        userChoice = await showBulkDuplicateDialog(scanResults);
        logInfo(`📋 User choice: ${userChoice}`);
        
        if (userChoice === 'cancel') {
            logInfo('📋 User cancelled the operation');
            return { 
                successCount: 0, 
                errorCount: 0, 
                cancelledCount: files.length,
                results: files.map(f => ({
                    success: false,
                    cancelled: true,
                    message: 'Bulk operation cancelled by user',
                    filename: f.filename
                })),
                totalProcessed: 0,
                userCancelled: true
            };
        } else if (userChoice === 'skip') {
            // Only save new files
            filesToSave = scanResults.newFiles;
            logInfo(`📂 User chose to skip duplicates. Saving ${filesToSave.length} new files only.`);
        } else if (userChoice === 'overwrite') {
            // Save all files (overwrite existing)
            filesToSave = files;
            logInfo(`⚠️ User chose to overwrite duplicates. Saving all ${filesToSave.length} files.`);
        }
    } else {
        logInfo('✅ No duplicate files found, proceeding with all files');
    }
    
    // Check for stale scan results (if more than 30 seconds have passed)
    const scanAge = Date.now() - scanResults.timestamp;
    const maxScanAge = 30000; // 30 seconds
    
    if (scanAge > maxScanAge && scanResults.duplicateCount > 0) {
        logWarn(`⚠️ Scan results are ${Math.round(scanAge/1000)}s old. Directory contents may have changed.`);
        
        // Quick re-validation for critical files if needed
        if (userChoice === 'skip') {
            if (progressCallback) {
                progressCallback(8, 0, files.length, 'Re-validating scan results...');
            }
            
            // Re-check a few files to ensure scan is still valid
            const samplesToCheck = Math.min(5, scanResults.existingFiles.length);
            let recheckFailed = false;
            
            for (let i = 0; i < samplesToCheck; i++) {
                const file = scanResults.existingFiles[i];
                try {
                    await directoryHandle.getFileHandle(file.safeFilename);
                } catch (error) {
                    if (error.name === 'NotFoundError') {
                        logWarn(`⚠️ File ${file.safeFilename} was deleted since scan. Results may be stale.`);
                        recheckFailed = true;
                        break;
                    }
                }
            }
            
            if (recheckFailed) {
                logWarn('🔄 Detected stale scan results. Consider re-scanning for accurate results.');
            }
        }
    }
    
            logDebug(`📅 Files will be created oldest-first to maintain chronological order`);
    
    // Now save the selected files
    let successCount = 0;
    let errorCount = 0;
    let cancelledCount = 0;
    const results = [];
    
    // Track skipped files if user chose to skip duplicates
    if (userChoice === 'skip') {
        for (const skippedFile of scanResults.existingFiles) {
            results.push({
                success: false,
                cancelled: true,
                message: `File "${skippedFile.safeFilename}" already exists and was skipped.`,
                filename: skippedFile.filename,
                skipped: true
            });
            cancelledCount++;
        }
    }

    for (let i = 0; i < filesToSave.length; i++) {
        // Check for cancellation before processing each file
        if (cancellationCallback && cancellationCallback()) {
            logInfo('🛑 Save operation cancelled by user');
            // Mark remaining files as cancelled
            for (let j = i; j < filesToSave.length; j++) {
                results.push({
                    success: false,
                    cancelled: true,
                    message: 'Save operation cancelled by user',
                    filename: filesToSave[j].filename
                });
                cancelledCount++;
            }
            break;
        }
        
        const file = filesToSave[i];
        
        try {
            // For bulk operations, force overwrite when user chose overwrite, or don't ask when no duplicates
            const forceOverwrite = userChoice === 'overwrite' || scanResults.duplicateCount === 0;
            const result = await saveFileToDirectory(file.filename, file.content, directoryHandle, forceOverwrite);
            
            results.push(result);
            
            if (result.success) {
                successCount++;
                logInfo(`✅ Saved: ${result.filename}${result.wasOverwrite ? ' (overwritten)' : ''}`);
            } else if (result.cancelled) {
                cancelledCount++;
                logInfo(`⏭️ Skipped: ${result.filename} - ${result.message}`);
            } else {
                errorCount++;
                logWarn(`❌ Failed to save: ${result.filename} - ${result.message}`);
            }
        } catch (error) {
            logError(`❌ Error saving ${file.filename}:`, error);
            errorCount++;
            results.push({
                success: false,
                cancelled: false,
                message: `Unexpected error: ${error.message}`,
                filename: file.filename
            });
        }
        
        // Delay ensures chronological file timestamps
        if (i < filesToSave.length - 1) {
            await delay(PROCESSING_CONFIG.DELAY_BETWEEN_FILES_MS);
        }
        
        // Report progress
        if (progressCallback) {
            // Calculate progress based on total files to ensure consistency with display
            // When duplicates are skipped, we need to account for the fact that some files were already "processed"
            const progress = Math.round((10 + ((i + 1) / files.length) * 90)); // 10% for scanning, 90% for saving
            // Always use the original files.length for the total display, regardless of user choice
            // This ensures the progress shows the total number of files being processed
            const totalForProgress = files.length;
            // The current file number should always be (i + 1) for the files being saved
            progressCallback(progress, i + 1, totalForProgress);
        }
    }

    return { 
        successCount, 
        errorCount, 
        cancelledCount, 
        results,
        totalProcessed: successCount + errorCount + cancelledCount,
        userChoice,
        duplicatesFound: scanResults.duplicateCount,
        scanErrors: scanResults.scanErrors,
        scanAge: Math.round(scanAge / 1000), // Include scan age in results
        userCancelled: cancellationCallback && cancellationCallback() // Check if cancelled at the end
    };
}

/**
 * Scan directory for existing files
 * WHY: Pre-scan allows users to make informed decisions about duplicates before bulk operations
 * 
 * @param {Array} files - Array of file objects to check
 * @param {FileSystemDirectoryHandle} directoryHandle - Target directory
 * @returns {Promise<Object>} - Scan results with existing and new files
 */
export async function scanForExistingFiles(files, directoryHandle) {
    // Validate directory handle first
    if (!directoryHandle) {
        throw new Error('Directory handle is required for scanning');
    }
    
    // Verify directory is still accessible
    try {
        const permission = await directoryHandle.requestPermission({ mode: 'readwrite' });
        if (permission !== 'granted') {
            throw new Error('Directory access permission denied');
        }
    } catch (error) {
        throw new Error(`Cannot access directory: ${error.message}`);
    }
    
    const existingFiles = [];
    const newFiles = [];
    const scanErrors = [];
    
    logInfo(`🔍 Scanning directory for existing files...`);
    
    for (const file of files) {
        const safeFilename = sanitizeFilename(file.filename);
        
        try {
            const fileHandle = await directoryHandle.getFileHandle(safeFilename);
            // File exists - verify it's actually accessible
            try {
                await fileHandle.requestPermission({ mode: 'readwrite' });
                existingFiles.push({
                    ...file,
                    safeFilename
                });
            } catch (permError) {
                // File exists but no write permission
                scanErrors.push({
                    filename: safeFilename,
                    error: 'File exists but no write permission'
                });
                existingFiles.push({
                    ...file,
                    safeFilename,
                    hasWriteAccess: false
                });
            }
        } catch (error) {
            // Check if this is actually a "file not found" error vs other issues
            if (error.name === 'NotFoundError' || error.message.includes('not found')) {
                // File doesn't exist
                newFiles.push({
                    ...file,
                    safeFilename
                });
            } else {
                // Other error - could be permission, corruption, etc.
                logWarn(`⚠️ Scan error for ${safeFilename}:`, error);
                scanErrors.push({
                    filename: safeFilename,
                    error: error.message
                });
                // Treat as existing to be safe (user can choose to overwrite)
                existingFiles.push({
                    ...file,
                    safeFilename,
                    hasError: true,
                    errorMessage: error.message
                });
            }
        }
    }
    
    logInfo(`📊 Scan results: ${existingFiles.length} existing, ${newFiles.length} new files${scanErrors.length > 0 ? `, ${scanErrors.length} errors` : ''}`);
    
    if (scanErrors.length > 0) {
        logWarn('⚠️ Scan errors detected:', scanErrors);
    }
    
    return {
        existingFiles,
        newFiles,
        totalFiles: files.length,
        duplicateCount: existingFiles.length,
        scanErrors,
        timestamp: Date.now() // Add timestamp for staleness detection
    };
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