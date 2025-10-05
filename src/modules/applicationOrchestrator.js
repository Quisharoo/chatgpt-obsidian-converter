/**
 * Application Orchestrator
 * Main coordinator for the ChatGPT to Markdown converter application
 * Following AGENTS.md principle: clean architecture with separated concerns
 */

import { FileUploader } from '../components/FileUploader.js';
import { ProgressDisplay } from '../components/ProgressDisplay.js';
import UIBuilder from '../components/UIBuilder.js';
import { processConversations } from './conversionEngine.js';
import { 
    selectDirectory, 
    saveFilesChronologically, 
    validateDirectoryAccess,
    downloadFile,
    createDownloadBlob,
    isFileSystemAccessSupported,
    saveFileToDirectory,
    scanForExistingFiles,
    getFileSystemAccessInfo
} from './fileSystemManager.js';
import { ERROR_MESSAGES, STATUS_MESSAGES } from '../utils/constants.js';
import { logInfo, logDebug, logWarn, logError } from '../utils/logger.js';
import { telemetry } from '../utils/telemetry.js';
import { 
    getString, 
    status, 
    error, 
    success, 
    info, 
    ui, 
    message, 
    formatFileSize 
} from '../utils/strings.js';
import { accessibilityManager } from '../utils/accessibility.js';
import { switchToComplete, switchToView, showResults, showFiles } from '../utils/navigation.js';

/**
 * ChatGPT to Markdown Application
 * WHY: Orchestrates the entire conversion workflow with proper error handling
 */
export class ChatGPTConverter {
    constructor() {
        this.fileUploader = null;
        this.progressDisplay = null;
        this.selectedDirectoryHandle = null;
        this.convertedFiles = [];
        this.processedIds = new Set();
        this.saveLocalButton = null;
        this.uiBuilder = new UIBuilder();
        
        this.initializeComponents();
    }

    /**
     * Initialize all application components
     * WHY: Sets up the UI components and establishes connections
     */
    initializeComponents() {
        try {
            // Initialize components with new structure
            this.fileUploader = new FileUploader('dropzone', 'fileInput');
            this.progressDisplay = new ProgressDisplay('conversionProgressContainer');
            this.saveProgressDisplay = new ProgressDisplay('progressContainer');
            
            // Set up file upload handling
            this.fileUploader.setFileSelectedCallback(this.handleFileUpload.bind(this));
            
            // Mount privacy banner
            if (this.uiBuilder && typeof this.uiBuilder.mountPrivacyBanner === 'function') {
                this.uiBuilder.mountPrivacyBanner();
                this.uiBuilder.mountThemeToggle();
            }

            // Initialize accessibility features
            accessibilityManager.initialize();
            
            const initMessage = message('INITIALIZING_CONVERTER');
            const apiMessage = isFileSystemAccessSupported() 
                ? message('FILE_SYSTEM_API_AVAILABLE')
                : message('FILE_SYSTEM_API_NOT_AVAILABLE');
                
            logInfo(`✅ ${initMessage}`);
            logInfo(`📁 ${apiMessage}`);
            
            // Announce initialization to screen readers
            accessibilityManager.announceStatus(initMessage, 'success');
            
        } catch (e) {
            logError('❌ Failed to initialize application:', e);
            const errorMessage = error('FAILED_TO_INITIALIZE');
            this.showError(errorMessage);
            accessibilityManager.announceStatus(errorMessage, 'error');
        }
    }

    /**
     * Handle file upload and processing
     * WHY: Coordinates the entire file processing workflow
     * 
     * @param {File} file - Uploaded file to process
     */
    async handleFileUpload(file) {
        const startTime = Date.now();
        logInfo(message('PROCESSING_FILE', { fileName: file.name, fileSize: formatFileSize(file.size) }));
        
        // Track conversion start
        telemetry.trackConversionStarted(file.size, file.name);
        
        this.fileUploader.setProcessingState(true);
        this.progressDisplay.show(false, false); // Don't switch to Files view for conversion
        
        try {
            // Read and parse file (supports .json and .zip containing conversations.json)
            const readingMessage = status('READING_FILE');
            this.progressDisplay.updateProgress(0, readingMessage);
            accessibilityManager.announceProgress(readingMessage, 0);

            let conversations = [];
            const lowerName = (file.name || '').toLowerCase();
            if (lowerName.endsWith('.zip')) {
                // ZIP ingestion path
                this.progressDisplay.updateProgress(5, 'Scanning export…');
                accessibilityManager.announceProgress('Scanning export…', 5);
                const arrayBuffer = await file.arrayBuffer();
                // JSZip is loaded from CDN in index.html; guard if unavailable
                if (typeof JSZip === 'undefined') {
                    throw new Error('ZIP support unavailable. Please upload conversations.json directly or enable JSZip.');
                }
                const zip = await JSZip.loadAsync(arrayBuffer);
                // Try common paths
                const candidatePaths = ['conversations.json', 'conversations/conversations.json', 'data/conversations.json'];
                let conversationsEntry = null;
                for (const p of candidatePaths) {
                    if (zip.file(p)) { conversationsEntry = zip.file(p); break; }
                }
                // Fallback: search any conversations.json
                if (!conversationsEntry) {
                    const matches = Object.keys(zip.files).filter(k => /conversations\.json$/i.test(k));
                    if (matches.length > 0) conversationsEntry = zip.file(matches[0]);
                }
                if (!conversationsEntry) {
                    throw new Error('Could not find conversations.json in the ZIP export.');
                }
                this.progressDisplay.updateProgress(15, 'Loading conversations.json…');
                accessibilityManager.announceProgress('Loading conversations.json…', 15);
                const jsonText = await conversationsEntry.async('text');
                const parsingMessage = status('PARSING_JSON');
                this.progressDisplay.updateProgress(20, parsingMessage);
                accessibilityManager.announceProgress(parsingMessage, 20);
                conversations = this.parseConversations(jsonText);
                this.progressDisplay.updateProgress(30, `Found ${conversations.length} conversations`);
                accessibilityManager.announceProgress(`Found ${conversations.length} conversations`, 30);
            } else {
                // JSON file path
                const fileContent = await this.readFileContent(file);
                await this.delay(300);
                const parsingMessage = status('PARSING_JSON');
                this.progressDisplay.updateProgress(20, parsingMessage);
                accessibilityManager.announceProgress(parsingMessage, 20);
                conversations = this.parseConversations(fileContent);
            }
            
            // Add delay for parsing
            await this.delay(400);
            
            // Convert conversations with more granular progress
            const convertingMessage = status('CONVERTING');
            this.progressDisplay.updateProgress(40, convertingMessage);
            accessibilityManager.announceProgress(convertingMessage, 40);
            const results = processConversations(conversations, this.processedIds);
            
            // Add delay for conversion processing
            await this.delay(500);
            
            const finalizingMessage = status('FINALIZING');
            this.progressDisplay.updateProgress(80, finalizingMessage);
            accessibilityManager.announceProgress(finalizingMessage, 80);
            await this.delay(300);
            
            const completeMessage = status('COMPLETE');
            this.progressDisplay.updateProgress(100, completeMessage);
            accessibilityManager.announceProgress(completeMessage, 100);
            this.convertedFiles = results.files;
            
            // Track successful conversion
            const processingTime = Date.now() - startTime;
            telemetry.trackConversionCompleted(
                conversations.length, 
                results.files.length, 
                processingTime, 
                results.errors
            );
            
            // Add final delay before showing results
            await this.delay(800);
            
            // Display results with delay for smooth transition
            setTimeout(() => {
                this.displayResults(results);
                
                // Switch to complete section and show results
                switchToComplete();
                showResults();
                
                // Populate the Files view in the background
                setTimeout(() => {
                    if (results.files && results.files.length > 0) {
                        this.populateFilesView(results);
                        showFiles();
                        logInfo(`✅ Files view populated with ${results.files.length} files`);
                    } else {
                        logWarn('⚠️ No files available to populate Files view');
                    }
                }, 100);
                
                // Hide progress after switching to results view
                setTimeout(() => {
                    this.progressDisplay.hide();
                }, 200);
            }, 500);
            
        } catch (error) {
            logError('❌ Error processing file:', error);
            
            // Track conversion failure with context
            const stage = error.message.includes('JSON') ? 'parsing' : 
                         error.message.includes('structure') ? 'parsing' : 'processing';
            telemetry.trackConversionFailed(error, stage);
            
            this.progressDisplay.showError(error.message);
            this.showError(error.message);
            accessibilityManager.announceStatus(`Conversion failed: ${error.message}`, 'error');
        } finally {
            this.fileUploader.setProcessingState(false);
        }
    }

    /**
     * Read file content as text
     * WHY: Promisified file reading with error handling
     * 
     * @param {File} file - File to read
     * @returns {Promise<string>} - File content
     */
    readFileContent(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    /**
     * Parse conversations JSON with validation
     * WHY: Validates JSON structure before processing
     * 
     * @param {string} fileContent - Raw file content
     * @returns {Array} - Parsed conversations array
     */
    parseConversations(fileContent) {
        let conversations;
        
        try {
            conversations = JSON.parse(fileContent);
        } catch (parseError) {
            throw new Error(error('INVALID_JSON'));
        }
        
        if (!Array.isArray(conversations)) {
            throw new Error(error('INVALID_STRUCTURE'));
        }
        
        return conversations;
    }

    /**
     * Handle directory selection for local saving
     * WHY: Provides user control over save location
     */
    async handleDirectorySelection() {
        try {
            const directoryHandle = await selectDirectory();
            this.selectedDirectoryHandle = directoryHandle;
            this.uiBuilder.setDirectoryHandle(directoryHandle);
            
            // Track directory selection
            telemetry.trackDirectorySelected();
            
            const successMessage = `✅ ${success('DIRECTORY_SELECTED')}: ${directoryHandle.name}. ${success('READY_TO_SAVE')}`;
            this.showSuccess(successMessage);
            accessibilityManager.announceStatus(`Directory selected: ${directoryHandle.name}`, 'success');
            
            this.updateSaveButtonState();
            
            // Re-render the files table to show Save buttons
            if (this.allFiles && this.allFiles.length > 0) {
                this.renderFilesTable();
            }
            
        } catch (error) {
            console.error('Directory selection error:', error);
            this.showError(error.message);
            accessibilityManager.announceStatus(`Directory selection failed: ${error.message}`, 'error');
        }
    }



    /**
     * Save files to local directory
     * WHY: Orchestrates the file saving process with progress feedback
     */
    async handleLocalSave() {
        const saveStartTime = Date.now();
        
        if (!this.selectedDirectoryHandle) {
            const errorMessage = error('NO_DIRECTORY');
            this.showError(errorMessage);
            accessibilityManager.announceStatus(errorMessage, 'error');
            return;
        }

        // Validate directory is still accessible
        const isValid = await validateDirectoryAccess(this.selectedDirectoryHandle);
        if (!isValid) {
            const errorMessage = error('DIRECTORY_ACCESS_LOST');
            this.showError(`❌ ${errorMessage}`);
            accessibilityManager.announceStatus(errorMessage, 'error');
            this.selectedDirectoryHandle = null;
            this.uiBuilder.setDirectoryHandle(null);
            this.updateSaveButtonState();
            return;
        }

        logInfo(`💾 Starting save operation for ${this.convertedFiles.length} files to ${this.selectedDirectoryHandle.name}`);
        
        // Switch to Files view first, then show progress
        switchToView('files');
        logInfo('✅ Switched to Files view for save operation');
        
        // Set up cancellation flag
        let isCancelled = false;
        
        // Show progress display with cancel button and switch to Files view
        this.saveProgressDisplay.show(true, true);
        this.saveProgressDisplay.setCancelCallback(() => {
            isCancelled = true;
            logInfo('🛑 User requested cancellation of save operation');
        });
        
        const preparingMessage = info('PREPARING_FILES', { 
            count: this.convertedFiles.length, 
            folderName: this.selectedDirectoryHandle.name 
        });
        this.showInfo(`💾 ${preparingMessage}`);
        accessibilityManager.announceStatus(preparingMessage);

        try {
            const progressCallback = (progress, completed, total, statusMessage) => {
                const message = statusMessage || `💾 ${status('SAVING_FILES')} ${progress}% (${completed}/${total})`;
                logInfo(`📊 Progress update: ${progress}% - ${message}`);
                this.saveProgressDisplay.updateProgress(progress, message);
                accessibilityManager.announceProgress(message, progress);
            };

            const cancellationCallback = () => isCancelled;

            const results = await saveFilesChronologically(
                this.convertedFiles, 
                this.selectedDirectoryHandle, 
                progressCallback,
                cancellationCallback
            );

            // Track save operation results
            const saveTime = Date.now() - saveStartTime;
            telemetry.trackFilesSaved('local', this.convertedFiles.length, results.successCount, saveTime);

            logInfo(`✅ Save operation completed: ${results.successCount} saved, ${results.cancelledCount} cancelled, ${results.errorCount} errors`);

            // Handle different outcomes based on user choice and results
            if (results.userCancelled) {
                this.showInfo('📂 Save operation cancelled');
                return;
            }

            // Build detailed success message
            let message = '';
            const parts = [];
            
            if (results.successCount > 0) {
                parts.push(`✅ Saved ${results.successCount} files`);
            }
            
            if (results.cancelledCount > 0) {
                if (results.userChoice === 'skip') {
                    parts.push(`📂 Skipped ${results.cancelledCount} existing files`);
                } else {
                    parts.push(`📂 ${results.cancelledCount} cancelled`);
                }
            }
            
            if (results.errorCount > 0) {
                parts.push(`❌ ${results.errorCount} errors`);
            }
            
            message = parts.join(', ');
            
            // Show appropriate message based on results
            if (results.successCount > 0) {
                this.showSuccess(`${message} in ${this.selectedDirectoryHandle.name}`);
                
                // Show additional context about user choice
                if (results.duplicatesFound > 0) {
                    setTimeout(() => {
                        if (results.userChoice === 'skip') {
                            this.showSuccess(`✅ SUCCESS! ${results.successCount} new files saved. ${results.duplicatesFound} existing files left unchanged.`);
                        } else if (results.userChoice === 'overwrite') {
                            this.showSuccess(`✅ SUCCESS! All ${results.successCount} files saved. ${results.duplicatesFound} files were overwritten.`);
                        }
                    }, 1000);
                } else {
                    setTimeout(() => {
                        this.showSuccess(`✅ SUCCESS! Check your ${this.selectedDirectoryHandle.name} folder for the files`);
                    }, 1000);
                }
            } else if (results.cancelledCount > 0 && results.errorCount === 0) {
                if (results.userChoice === 'skip') {
                    this.showInfo(`📂 All files already existed and were skipped. No new files to save.`);
                } else {
                    this.showInfo(`📂 All ${results.cancelledCount} file saves were cancelled`);
                }
            } else {
                this.showError(`❌ Failed to save any files. ${results.errorCount} errors occurred. Check permissions or try downloading instead.`);
            }

        } catch (error) {
            console.error('❌ Error during save:', error);
            telemetry.trackError('save', error, { 
                fileCount: this.convertedFiles.length,
                directoryName: this.selectedDirectoryHandle?.name 
            });
            
            const errorMessage = `${error('SAVE_FAILED')}: ${error.message}`;
            this.showError(errorMessage);
            accessibilityManager.announceStatus(errorMessage, 'error');
        } finally {
            // Clear the cancel callback
            this.saveProgressDisplay.setCancelCallback(null);
            setTimeout(() => this.saveProgressDisplay.hide(), 1000);
        }
    }

    /**
     * Download individual file
     * WHY: Provides fallback download option
     * 
     * @param {Object} file - File object to download
     */
    downloadSingleFile(file) {
        try {
            const blob = createDownloadBlob(file.content);
            downloadFile(blob, file.filename);
            
            // Track individual file download
            telemetry.trackIndividualFileAction('download', true);
            accessibilityManager.announceFileOperation('download', true, file.filename);
        } catch (error) {
            console.error(`Error downloading ${file.filename}:`, error);
            telemetry.trackIndividualFileAction('download', false, error);
            
            const errorMessage = `${error('DOWNLOAD_FAILED')} ${file.filename}`;
            this.showError(errorMessage);
            accessibilityManager.announceFileOperation('download', false, file.filename);
        }
    }

    /**
     * Save individual file to chosen directory
     * WHY: Reuses the same File System Access API logic as bulk save for consistency
     * 
     * @param {Object} file - File object to save
     */
    async saveSingleFileToMarkdown(file) {
        try {
            // Check if File System Access API is supported
            if (!isFileSystemAccessSupported()) {
                const errorMessage = error('BROWSER_NOT_SUPPORTED');
                this.showError(errorMessage);
                accessibilityManager.announceStatus(errorMessage, 'error');
                return;
            }

            const chooseMessage = info('CHOOSE_SAVE_LOCATION', { filename: file.title || file.filename });
            this.showInfo(`📁 ${chooseMessage}`);
            
            // Let user select directory for this specific file
            const directoryHandle = await selectDirectory();
            
            if (!directoryHandle) {
                const cancelMessage = info('SAVE_CANCELLED');
                this.showInfo(`📂 ${cancelMessage}`);
                accessibilityManager.announceStatus(cancelMessage);
                return;
            }

            this.showInfo(`💾 Saving "${file.filename}" to ${directoryHandle.name}...`);

            // Use the updated save logic with detailed response
            const result = await saveFileToDirectory(file.filename, file.content, directoryHandle);
            
            if (result.success) {
                // Track successful individual file save
                telemetry.trackIndividualFileAction('save', true);
                
                // Show prominent success confirmation
                this.showFileSaveConfirmation(file.title || file.filename, directoryHandle.name, result.filename);
                logInfo(`✅ Individual file saved: ${result.filename} → ${directoryHandle.name}/`);
                accessibilityManager.announceFileOperation('save', true, file.filename);
            } else if (result.cancelled) {
                this.showInfo(`📂 ${result.message}`);
                logInfo(`📂 Save cancelled by user: ${result.filename}`);
                accessibilityManager.announceStatus(result.message);
            } else {
                telemetry.trackIndividualFileAction('save', false, new Error(result.message));
                this.showError(`❌ ${result.message}`);
                logError(`❌ Save failed: ${result.filename} - ${result.message}`);
                accessibilityManager.announceFileOperation('save', false, file.filename);
            }

        } catch (saveError) {
            logError(`Error saving individual file ${file.filename}:`, saveError);
            telemetry.trackError('save', saveError, { type: 'individual_file', filename: file.filename });
            
            // Provide specific error messages
            if (saveError.message.includes('cancelled')) {
                const cancelMessage = info('SAVE_CANCELLED');
                this.showInfo(`📂 ${cancelMessage}`);
                accessibilityManager.announceStatus(cancelMessage);
            } else {
                const errorMessage = `${error('SAVE_FAILED')} "${file.filename}": ${saveError.message}`;
                this.showError(errorMessage);
                accessibilityManager.announceStatus(errorMessage, 'error');
            }
        }
    }

    /**
     * Download all files individually
     * WHY: Batch download fallback when local saving fails
     */
    downloadAllFiles() {
        let successCount = 0;
        
        for (const file of this.convertedFiles) {
            try {
                this.downloadSingleFile(file);
                successCount++;
            } catch (error) {
                logError(`Error downloading ${file.filename}:`, error);
            }
        }
        
        this.showSuccess(`📥 Downloaded ${successCount} files`);
    }

    /**
     * Download all files as a ZIP archive
     * WHY: Provides a single download option for mobile users
     */
    async downloadAllAsZip() {
        const zipStartTime = Date.now();
        
        try {
            // Check if JSZip is available
            if (typeof JSZip === 'undefined') {
                // Fallback to individual downloads
                const fallbackMessage = info('ZIP_NOT_AVAILABLE');
                this.showInfo(`📦 ${fallbackMessage}`);
                accessibilityManager.announceStatus(fallbackMessage);
                this.downloadAllFiles();
                return;
            }

            const creatingMessage = status('CREATING_ZIP');
            this.showInfo(`📦 ${creatingMessage}`);
            accessibilityManager.announceStatus(creatingMessage);
            
            const zip = new JSZip();
            
            // Add all files to the ZIP
            for (const file of this.convertedFiles) {
                zip.file(file.filename, file.content);
            }
            
            // Generate the ZIP file
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            
            // Download the ZIP file
            const url = URL.createObjectURL(zipBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `chatgpt-conversations-${new Date().toISOString().split('T')[0]}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            // Track ZIP download success
            const zipTime = Date.now() - zipStartTime;
            telemetry.trackFilesSaved('zip', this.convertedFiles.length, this.convertedFiles.length, zipTime);
            
            const successMessage = `📦 ${success('FILES_DOWNLOADED')} ${this.convertedFiles.length} files as ZIP archive`;
            this.showSuccess(successMessage);
            accessibilityManager.announceStatus(successMessage, 'success');
            
        } catch (error) {
            logError('Error creating ZIP archive:', error);
            telemetry.trackError('save', error, { type: 'zip_creation', fileCount: this.convertedFiles.length });
            
            const errorMessage = error('ZIP_CREATION_FAILED');
            this.showError(errorMessage);
            accessibilityManager.announceStatus(errorMessage, 'error');
            // Fallback to individual downloads
            this.downloadAllFiles();
        }
    }

    /**
     * Update save button state based on directory selection
     * WHY: Provides visual feedback about readiness to save
     */
    updateSaveButtonState() {
        if (this.uiBuilder) {
            this.uiBuilder.updateSaveButtonState(this.convertedFiles);
        }
    }

    /**
     * Display conversion results with UI
     * WHY: Shows results and provides download/save options
     * 
     * @param {Object} results - Conversion results
     */
    displayResults(results) {
        const resultsDiv = document.getElementById('results');
        const downloadList = document.getElementById('downloadList');
        
        if (!resultsDiv || !downloadList) return;
        
        resultsDiv.classList.remove('hidden');
        downloadList.innerHTML = '';
        
        // Add summary card
        const summaryCard = this.uiBuilder.createResultsSummaryCard(results);
        downloadList.appendChild(summaryCard);
        
        if (results.files.length > 0) {
            // Add directory selection card with callbacks
            const directoryCard = this.uiBuilder.createDirectoryCard(results, {
                onDirectorySelect: () => this.handleDirectorySelection(),
                onSave: () => this.handleLocalSave(),
                onDownloadZip: () => this.downloadAllAsZip()
            });
            downloadList.appendChild(directoryCard);
            
            // Store files for the dedicated Files view (but don't create duplicate table in Results view)
            this.populateFilesView(results);
        }
    }

    /**
     * Populate the dedicated Files view with sorting and pagination
     * WHY: Provides a dedicated interface for browsing individual files
     */
    populateFilesView(results) {
        const filesContainer = document.getElementById('filesContainer');
        const fileTableBody = document.getElementById('fileTableBody');
        const resultsInfo = document.getElementById('resultsInfo');
        const sortSelect = document.getElementById('sortSelect');
        const paginationContainer = document.getElementById('paginationContainer');
        
        if (!filesContainer || !fileTableBody || !resultsInfo) return;
        
        // Show files container
        filesContainer.classList.remove('hidden');
        
        // Store files data for pagination/sorting
        this.allFiles = results.files;
        this.currentPage = 1;
        this.filesPerPage = 10;
        
        // Initialize sort state if not already set
        if (!this.currentSort) {
            this.currentSort = 'date';
            this.sortDirection = 'desc';
        }
        
        // Hide sort dropdown and set up column click handlers
        if (sortSelect) {
            sortSelect.style.display = 'none';
            // Also hide the sort label
            const sortLabel = sortSelect.previousElementSibling;
            if (sortLabel && sortLabel.textContent.includes('Sort by:')) {
                sortLabel.style.display = 'none';
            }
        }
        
        // Set up column header click handlers (only if not already set up)
        if (!this.columnSortingSetup) {
            this.setupColumnSorting();
            this.columnSortingSetup = true;
        }
        
        // Initial render
        this.renderFilesTable();
    }

    /**
     * Create a table row for a file
     * WHY: Extracted method for cleaner code and better maintainability
     */
    createFileRow(file) {
        const row = document.createElement('tr');
        row.className = 'border-b border-gray-200 hover:bg-gray-50 transition-colors';
        
        // Fix date extraction - use multiple possible properties
        const dateCreated = this.getFileDate(file);
        
        // Title column with filename shown as subtitle - FIXED WIDTH to prevent layout shifts
        const titleCell = document.createElement('td');
        titleCell.className = 'px-4 py-3 text-gray-800 font-medium align-top';
        titleCell.style.width = '65%'; // Match header width
        
        const titleContainer = document.createElement('div');
        const titleSpan = document.createElement('div');
        titleSpan.textContent = file.title;
        titleSpan.style.wordBreak = 'break-word'; // Prevent overflow
        
        titleContainer.appendChild(titleSpan);
        titleCell.appendChild(titleContainer);
        
        // Date column - FIXED WIDTH to prevent layout shifts
        const dateCell = document.createElement('td');
        dateCell.className = 'px-4 py-3 text-gray-600 text-sm align-top whitespace-nowrap';
        dateCell.style.width = '20%'; // Match header width
        dateCell.textContent = dateCreated;
        
        // Actions column - FIXED WIDTH to prevent layout shifts
        const actionsCell = document.createElement('td');
        actionsCell.className = 'px-4 py-3 text-right align-top whitespace-nowrap';
        actionsCell.style.width = '15%'; // Match header width
        
        const actionsContainer = document.createElement('div');
        actionsContainer.className = 'flex gap-2 justify-end';
        
        // Always create Save button first, then Download button
        // This maintains consistent layout and allows individual file saving
        const saveBtn = document.createElement('button');
        saveBtn.className = 'bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-1 rounded text-xs flex-shrink-0 transition-colors save-file-btn';
        saveBtn.setAttribute('data-filename', file.filename);
        saveBtn.setAttribute('data-content', encodeURIComponent(file.content));
        saveBtn.setAttribute('data-title', file.title);
        saveBtn.innerHTML = `
            <svg class="icon" style="width: 16px; height: 16px;" viewBox="0 0 24 24">
                <path d="M15,9H5V5H15M12,19A3,3 0 0,1 9,16A3,3 0 0,1 12,13A3,3 0 0,1 15,16A3,3 0 0,1 12,19M17,3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V7L17,3Z"/>
            </svg>
        `;
        actionsContainer.appendChild(saveBtn);
        
        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'bg-gray-500 hover:bg-gray-600 text-white px-2 py-1 rounded text-xs flex-shrink-0 transition-colors download-file-btn';
        downloadBtn.setAttribute('data-filename', file.filename);
        downloadBtn.setAttribute('data-content', encodeURIComponent(file.content));
        downloadBtn.innerHTML = `
            <svg class="icon" style="width: 16px; height: 16px;" viewBox="0 0 24 24">
                <path d="M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z"/>
            </svg>
        `;
        
        actionsContainer.appendChild(downloadBtn);
        
        actionsCell.appendChild(actionsContainer);
        
        row.appendChild(titleCell);
        row.appendChild(dateCell);
        row.appendChild(actionsCell);
        
        return row;
    }

    /**
     * Render the files table with current page of files
     * WHY: Displays paginated file list with sorting capabilities
     */
    renderFilesTable() {
        const fileTableBody = document.getElementById('fileTableBody');
        const resultsInfo = document.getElementById('resultsInfo');
        const paginationContainer = document.getElementById('paginationContainer');
        
        if (!fileTableBody) {
            logWarn('⚠️ File table body not found');
            return;
        }
        
        if (!this.allFiles || this.allFiles.length === 0) {
            logWarn('⚠️ No files available to render');
            
            // Clear table and show no files message
            fileTableBody.innerHTML = '';
            if (resultsInfo) {
                resultsInfo.textContent = 'No files available';
            }
            if (paginationContainer) {
                paginationContainer.innerHTML = '';
            }
            return;
        }
        
        // Sort files
        const sortedFiles = this.sortFiles([...this.allFiles]);
        
        // Calculate pagination
        const totalFiles = sortedFiles.length;
        const totalPages = Math.ceil(totalFiles / this.filesPerPage);
        const startIndex = (this.currentPage - 1) * this.filesPerPage;
        const endIndex = Math.min(startIndex + this.filesPerPage, totalFiles);
        const currentFiles = sortedFiles.slice(startIndex, endIndex);
        
        // Update results info
        if (resultsInfo) {
            resultsInfo.textContent = `Showing ${startIndex + 1}-${endIndex} of ${totalFiles} files`;
        }
        
        // Store current scroll position to maintain user's position
        const container = fileTableBody.closest('.card-content');
        const scrollTop = container ? container.scrollTop : 0;
        
        // Clear table body 
        fileTableBody.innerHTML = '';
        
        // Render current page files
        currentFiles.forEach(file => {
            const row = this.uiBuilder.createFileRow(file);
            fileTableBody.appendChild(row);
        });
        
        // Restore scroll position
        if (container) {
            container.scrollTop = scrollTop;
        }
        
        // Add event listeners to buttons
        this.attachFileButtonHandlers();
        
        // Update sort indicators after DOM is updated
        this.updateSortIndicators();
        
        // Render pagination
        this.renderPagination(totalPages);
        
        logInfo(`✅ Files table rendered: ${currentFiles.length} files on page ${this.currentPage} of ${totalPages}`);
    }

    /**
     * Set up column header click handlers for sorting
     * WHY: Provides natural table sorting interface
     */
    setupColumnSorting() {
        const titleHeader = document.getElementById('titleHeader');
        const dateHeader = document.getElementById('dateHeader');
        
        logDebug('🔧 Setting up column sorting...', { titleHeader: !!titleHeader, dateHeader: !!dateHeader });
        
        // Remove existing listeners to prevent duplicates
        if (titleHeader) {
            titleHeader.removeEventListener('click', this._titleSortHandler);
            titleHeader.removeEventListener('mouseenter', this._titleMouseEnterHandler);
            titleHeader.removeEventListener('mouseleave', this._titleMouseLeaveHandler);
            
            // Create bound handlers to ensure proper removal
            this._titleSortHandler = () => this.handleColumnSort('title');
            this._titleMouseEnterHandler = () => {
                titleHeader.classList.add('bg-gray-100');
            };
            this._titleMouseLeaveHandler = () => {
                titleHeader.classList.remove('bg-gray-100');
            };
            
            titleHeader.addEventListener('click', this._titleSortHandler);
            titleHeader.style.transition = 'background-color 0.2s ease';
            titleHeader.addEventListener('mouseenter', this._titleMouseEnterHandler);
            titleHeader.addEventListener('mouseleave', this._titleMouseLeaveHandler);
            logDebug('✅ Title header click listener attached');
        }
        
        if (dateHeader) {
            dateHeader.removeEventListener('click', this._dateSortHandler);
            dateHeader.removeEventListener('mouseenter', this._dateMouseEnterHandler);
            dateHeader.removeEventListener('mouseleave', this._dateMouseLeaveHandler);
            
            // Create bound handlers to ensure proper removal
            this._dateSortHandler = () => this.handleColumnSort('date');
            this._dateMouseEnterHandler = () => {
                dateHeader.classList.add('bg-gray-100');
            };
            this._dateMouseLeaveHandler = () => {
                dateHeader.classList.remove('bg-gray-100');
            };
            
            dateHeader.addEventListener('click', this._dateSortHandler);
            dateHeader.style.transition = 'background-color 0.2s ease';
            dateHeader.addEventListener('mouseenter', this._dateMouseEnterHandler);
            dateHeader.addEventListener('mouseleave', this._dateMouseLeaveHandler);
            logDebug('✅ Date header click listener attached');
        }
        
        // Initial sort state - set date as default descending (only if not already set)
        if (!this.currentSort) {
            this.currentSort = 'date';
            this.sortDirection = 'desc';
        }
        
        // Update sort indicators
        this.updateSortIndicators();
    }

    /**
     * Handle column sort when user clicks on table headers
     * WHY: Provides natural table sorting interface
     */
    handleColumnSort(column) {
        logDebug(`🔄 Column sort clicked: ${column}, current: ${this.currentSort}, direction: ${this.sortDirection}`);
        
        const previousColumn = this.currentSort;
        
        if (this.currentSort === column) {
            // Same column - toggle direction
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
            logDebug(`↕️ Toggling sort direction for ${column}: ${this.sortDirection}`);
        } else {
            // Different column - set new sort and default to ascending
            this.currentSort = column;
            this.sortDirection = 'asc';
            logDebug(`🔄 Switching to new column ${column}: ${this.sortDirection}`);
        }
        
        // Only reset to first page when changing columns, not when toggling direction
        if (previousColumn !== column) {
            this.currentPage = 1;
        }
        
        // Re-render table with new sort
        this.renderFilesTable();
    }

    /**
     * Update visual sort indicators in table headers
     * WHY: Shows users which column is active and sort direction
     */
    updateSortIndicators() {
        const titleIndicator = document.querySelector('#titleHeader .sort-indicator');
        const dateIndicator = document.querySelector('#dateHeader .sort-indicator');
        
        logDebug('🎨 Updating sort indicators...', { 
            currentSort: this.currentSort, 
            sortDirection: this.sortDirection,
            titleIndicator: !!titleIndicator,
            dateIndicator: !!dateIndicator 
        });
        
        if (!titleIndicator || !dateIndicator) {
            logWarn('⚠️ Sort indicators not found in DOM');
            return;
        }
        
        // Reset all indicators to inactive state (hide arrows)
        titleIndicator.className = 'text-gray-400';
        dateIndicator.className = 'text-gray-400';
        titleIndicator.textContent = '';
        dateIndicator.textContent = '';
        
        // Set active indicator with correct direction
        const activeIndicator = this.currentSort === 'title' ? titleIndicator : dateIndicator;
        activeIndicator.className = 'text-indigo-600';
        activeIndicator.textContent = this.sortDirection === 'asc' ? '▲' : '▼';
        
        logDebug(`✨ Active sort: ${this.currentSort} ${this.sortDirection === 'asc' ? '(ascending)' : '(descending)'}`);
    }

    /**
     * Get valid timestamp for sorting, treating invalid values as 0
     * WHY: Ensures consistent sorting behavior for invalid date values
     * 
     * @param {*} timestamp - Raw timestamp value
     * @returns {number} - Valid timestamp or 0 for invalid values
     */
    getValidTimestamp(timestamp) {
        if (timestamp && !isNaN(timestamp) && timestamp > 0) {
            try {
                const date = new Date(timestamp * 1000);
                // Check if date is valid
                if (!isNaN(date.getTime())) {
                    return timestamp;
                }
            } catch (error) {
                logWarn('Error validating timestamp:', error);
            }
        }
        return 0;
    }

    /**
     * Get properly formatted date from file object
     * WHY: Handles different date property names and formats consistently
     */
    getFileDate(file) {
        if (!file || typeof file !== 'object') {
            return 'Unknown';
        }
        
        // Try different possible date properties
        const createTime = file.createTime || file.create_time;
        
        if (createTime && !isNaN(createTime) && createTime > 0) {
            try {
                const date = new Date(createTime * 1000);
                // Check if date is valid
                if (!isNaN(date.getTime())) {
                    return date.toLocaleDateString();
                }
            } catch (error) {
                logWarn('Error formatting date:', error);
            }
        }
        
        // Fallback to createdDate if available
        if (file.createdDate && file.createdDate !== 'Unknown' && typeof file.createdDate === 'string') {
            return file.createdDate;
        }
        
        return 'Unknown';
    }

    /**
     * Sort files based on current criteria
     * WHY: Allows users to organize files by name or date with natural sorting
     */
    sortFiles(files) {
        return files.sort((a, b) => {
            let aValue, bValue;
            
            if (this.currentSort === 'title') {
                // Natural string sorting - case insensitive
                aValue = (a.title || a.filename || '').toLowerCase().trim();
                bValue = (b.title || b.filename || '').toLowerCase().trim();
                
                // Handle natural sorting for numbers in titles
                if (this.sortDirection === 'asc') {
                    return aValue.localeCompare(bValue, undefined, { numeric: true, sensitivity: 'base' });
                } else {
                    return bValue.localeCompare(aValue, undefined, { numeric: true, sensitivity: 'base' });
                }
            } else if (this.currentSort === 'date') {
                // Sort by timestamp for accurate chronological ordering
                // Handle invalid dates by treating them as 0
                aValue = this.getValidTimestamp(a.createTime || a.create_time);
                bValue = this.getValidTimestamp(b.createTime || b.create_time);
                
                if (this.sortDirection === 'asc') {
                    return aValue - bValue;
                } else {
                    return bValue - aValue;
                }
            }
            
            return 0;
        });
    }

    /**
     * Render pagination controls
     * WHY: Provides navigation for large numbers of files
     */
    renderPagination(totalPages) {
        const paginationContainer = document.getElementById('paginationContainer');
        if (!paginationContainer || totalPages <= 1) {
            if (paginationContainer) paginationContainer.innerHTML = '';
            return;
        }
        
        paginationContainer.innerHTML = '';
        
        const maxButtons = 7;
        let startPage = Math.max(1, this.currentPage - Math.floor(maxButtons / 2));
        let endPage = Math.min(totalPages, startPage + maxButtons - 1);
        
        // Adjust start if we're near the end
        if (endPage - startPage + 1 < maxButtons) {
            startPage = Math.max(1, endPage - maxButtons + 1);
        }
        
        // First button (only show if not on first page and there are many pages)
        if (this.currentPage > 1 && totalPages > 5) {
            const firstBtn = this.createPaginationButton('«', 1);
            paginationContainer.appendChild(firstBtn);
        }
        
        // Previous button
        if (this.currentPage > 1) {
            const prevBtn = this.createPaginationButton('‹', this.currentPage - 1);
            paginationContainer.appendChild(prevBtn);
        }
        
        // Page number buttons
        for (let i = startPage; i <= endPage; i++) {
            const pageBtn = this.createPaginationButton(i.toString(), i, i === this.currentPage);
            paginationContainer.appendChild(pageBtn);
        }
        
        // Next button
        if (this.currentPage < totalPages) {
            const nextBtn = this.createPaginationButton('›', this.currentPage + 1);
            paginationContainer.appendChild(nextBtn);
        }
        
        // Last button (only show if not on last page and there are many pages)
        if (this.currentPage < totalPages && totalPages > 5) {
            const lastBtn = this.createPaginationButton('»', totalPages);
            paginationContainer.appendChild(lastBtn);
        }
    }

    /**
     * Create pagination button
     * WHY: Creates consistent pagination button styling and behavior
     */
    createPaginationButton(text, page, isActive = false) {
        const button = document.createElement('button');
        button.textContent = text;
        button.className = `btn ${isActive ? 'btn-primary' : 'btn-secondary'}`;
        button.style.padding = 'var(--space-2) var(--space-3)';
        button.style.fontSize = 'var(--font-size-sm)';
        button.style.minWidth = '40px';
        
        if (!isActive) {
            button.addEventListener('click', () => {
                this.currentPage = page;
                this.renderFilesTable();
            });
        }
        
        return button;
    }

    /**
     * Attach event handlers to file action buttons
     * WHY: Enables download and save functionality for individual files
     */
    attachFileButtonHandlers() {
        // Download buttons
        document.querySelectorAll('.download-file-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const filename = btn.dataset.filename;
                const content = decodeURIComponent(btn.dataset.content);
                
                // Create file object and use the proper download method
                const file = {
                    filename: filename,
                    content: content
                };
                
                this.downloadSingleFile(file);
            });
        });

        // Save buttons - use individual file save method that lets user pick folder
        document.querySelectorAll('.save-file-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const filename = btn.dataset.filename;
                const content = decodeURIComponent(btn.dataset.content);
                const title = btn.dataset.title;
                
                // Create file object for the save method
                const file = {
                    filename: filename,
                    content: content,
                    title: title
                };
                
                // Use the dedicated individual file save method
                await this.saveSingleFileToMarkdown(file);
            });
        });
    }

    /**
     * Show success message
     * WHY: Provides feedback when files are saved successfully
     */
    showSuccessMessage(message) {
        // Create temporary success message
        const successDiv = document.createElement('div');
        successDiv.className = 'status success';
        successDiv.style.position = 'fixed';
        successDiv.style.top = 'var(--space-4)';
        successDiv.style.right = 'var(--space-4)';
        successDiv.style.zIndex = '1000';
        successDiv.style.maxWidth = '300px';
        successDiv.textContent = message;
        
        document.body.appendChild(successDiv);
        
        // Remove after 3 seconds
        setTimeout(() => {
            if (successDiv.parentNode) {
                successDiv.remove();
            }
        }, 3000);
    }

    /**
     * Create results summary element
     * WHY: Provides clear feedback about conversion results
     */
    createResultsSummary(results) {
        const summary = document.createElement('div');
        summary.innerHTML = `
            <h4>📊 Conversion Summary</h4>
            <p>✅ Converted: ${results.processed} conversations</p>
            ${results.errors > 0 ? `<p>❌ Errors: ${results.errors} conversations</p>` : ''}
        `;
        summary.style.marginBottom = '20px';
        return summary;
    }

    /**
     * Create summary card for results
     * WHY: Displays conversion statistics in a clean card format
     */
    createResultsSummaryCard(results) {
        const card = document.createElement('div');
        card.className = 'bg-white rounded-xl shadow-md p-6 mb-8';
        
        const header = document.createElement('div');
        header.className = 'mb-4';
        
        const title = document.createElement('h3');
        title.className = 'text-xl font-medium text-gray-800 flex items-center mb-2';
        title.innerHTML = `
            <i class="fas fa-check-circle mr-3 text-green-500"></i>
            Conversion Summary
        `;
        
        const description = document.createElement('p');
        description.className = 'text-gray-600';
        description.textContent = 'Your ChatGPT conversations have been successfully converted';
        
        header.appendChild(title);
        header.appendChild(description);
        
        const content = document.createElement('div');
        content.className = '';
        
        const stats = document.createElement('div');
        stats.className = 'flex justify-center gap-4';
        
        // Create stat items - simplified to show only the main conversion result
        const statItems = [
            { label: 'Conversations Converted', value: results.processed, icon: 'M12,3C6.5,3 2,6.58 2,11A7.18,7.18 0 0,0 2.24,12.65C2.09,13.6 2,14.62 2,15.68C2,17.68 2.5,19.5 3.5,21L12,12.5C12,12.33 12,12.17 12,12A1,1 0 0,1 13,11A1,1 0 0,1 14,12C14,12.17 14,12.33 14,12.5L22.5,21C23.5,19.5 24,17.68 24,15.68C24,14.62 23.91,13.6 23.76,12.65A7.18,7.18 0 0,0 24,11C24,6.58 19.5,3 14,3H12Z' }
        ];
        
        // Only show errors if there were any
        if (results.errors > 0) {
            statItems.push({ label: 'Errors', value: results.errors, icon: 'M13,14H11V10H13M13,18H11V16H13M1,21H23L12,2L1,21Z' });
        }
        
        statItems.forEach(item => {
            const statCard = document.createElement('div');
            statCard.className = 'bg-gray-50 p-6 rounded-lg text-center min-w-[200px]';
            
            // Use Font Awesome icon instead of SVG
            const iconClass = item.label.includes('Error') ? 'fas fa-exclamation-triangle text-red-500' : 'fas fa-comments text-indigo-500';
            
            statCard.innerHTML = `
                <i class="${iconClass} text-3xl mb-3 block"></i>
                <div class="text-2xl font-bold text-gray-800 mb-2">${item.value}</div>
                <div class="text-base text-gray-600">${item.label}</div>
            `;
            
            stats.appendChild(statCard);
        });
        
        content.appendChild(stats);
        card.appendChild(header);
        card.appendChild(content);
        
        return card;
    }

    /**
     * Create directory selection card
     * WHY: Provides local save options with clear instructions in card format
     */
    createDirectoryCard(results) {
        const card = document.createElement('div');
        card.className = 'bg-white rounded-xl shadow-md p-6 mb-8';
        
        const header = document.createElement('div');
        header.className = 'mb-4';
        
        const title = document.createElement('h3');
        title.className = 'text-xl font-medium text-gray-800 flex items-center mb-2';
        title.innerHTML = `
            <i class="fas fa-folder mr-3 text-indigo-500"></i>
            Save Location
        `;
        
        const description = document.createElement('p');
        description.className = 'text-gray-600';
        description.textContent = 'Choose where to save your converted files';
        
        header.appendChild(title);
        header.appendChild(description);
        
        const content = document.createElement('div');
        content.className = '';
        
        if (isFileSystemAccessSupported()) {
            // Directory selection buttons
            const buttonGroup = document.createElement('div');
            buttonGroup.className = 'flex flex-col gap-3 mb-4';
            
            const selectBtn = this.createDirectoryButton();
            const saveBtn = this.createSaveButton(results);
            
            buttonGroup.appendChild(selectBtn);
            buttonGroup.appendChild(saveBtn);
            content.appendChild(buttonGroup);
            
            // Instructions
            const instructions = this.createInstructions();
            content.appendChild(instructions);
            
        } else {
            const apiInfo = getFileSystemAccessInfo();
            const warning = this.createUnsupportedWarning();
            content.appendChild(warning);
            
            // Add prominent download button for mobile users
            if (apiInfo.mobile) {
                const downloadSection = document.createElement('div');
                downloadSection.className = 'mt-4';
                
                const downloadTitle = document.createElement('h4');
                downloadTitle.className = 'text-lg font-medium text-gray-800 mb-3 flex items-center';
                downloadTitle.innerHTML = `
                    <i class="fas fa-download mr-2 text-indigo-500"></i>
                    Download Options
                `;
                
                const downloadButton = document.createElement('button');
                downloadButton.className = 'bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-4 px-6 rounded-lg transition-colors w-full mb-3 flex items-center justify-center';
                downloadButton.innerHTML = `
                    <i class="fas fa-download mr-3"></i>
                    Download All as ZIP
                `;
                downloadButton.onclick = () => this.downloadAllAsZip();
                
                const downloadInfo = document.createElement('p');
                downloadInfo.className = 'text-sm text-gray-600 mb-3';
                downloadInfo.textContent = 'Download all converted files as a single ZIP archive for easy file management.';
                
                downloadSection.appendChild(downloadTitle);
                downloadSection.appendChild(downloadInfo);
                downloadSection.appendChild(downloadButton);
                
                content.appendChild(downloadSection);
            }
        }
        
        card.appendChild(header);
        card.appendChild(content);
        
        return card;
    }







    /**
     * Create directory selection button
     * WHY: Primary directory selection interface
     */
    createDirectoryButton() {
        const btn = document.createElement('button');
        btn.className = 'bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center';
        btn.innerHTML = this.selectedDirectoryHandle ? 
            `<i class="fas fa-folder-open mr-2"></i>Change Directory (Current: ${this.selectedDirectoryHandle.name})` : 
            '<i class="fas fa-folder mr-2"></i>Choose Folder';
        btn.onclick = () => this.handleDirectorySelection();
        return btn;
    }



    /**
     * Create save to local folder button
     * WHY: Main save action with visual feedback
     */
    createSaveButton(results) {
        const btn = document.createElement('button');
        btn.className = this.selectedDirectoryHandle ? 
            'bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center' :
            'bg-gray-300 text-gray-500 font-medium py-3 px-6 rounded-lg cursor-not-allowed flex items-center justify-center';
        btn.innerHTML = this.selectedDirectoryHandle ? 
            `<i class="fas fa-save mr-2"></i>Save ${results.files.length} files to selected folder` : 
            '<i class="fas fa-save mr-2"></i>Save to Local Folder (Select folder first)';
        btn.disabled = !this.selectedDirectoryHandle;
        btn.onclick = () => this.handleLocalSave();
        
        // Store reference for updates
        this.saveLocalButton = btn;
        
        return btn;
    }

    /**
     * Create instructions element
     * WHY: Provides clear guidance for saving files
     */
    createInstructions() {
        const instructions = document.createElement('div');
        instructions.className = 'mt-3 text-sm text-gray-600 leading-normal';
        
        if (this.selectedDirectoryHandle) {
            instructions.innerHTML = `
                <div class="bg-green-50 border-l-4 border-green-500 p-3 rounded">
                    <div class="flex">
                        <div class="flex-shrink-0">
                            <i class="fas fa-check-circle text-green-500"></i>
                        </div>
                        <div class="ml-3">
                            <p class="text-sm text-green-700">
                                <strong>Ready to save</strong><br>
                                Selected folder: <strong>${this.selectedDirectoryHandle.name}</strong><br>
                                Click "Save to Local Folder" to save all files directly to your chosen location.
                            </p>
                        </div>
                    </div>
                </div>
            `;
        } else {
            instructions.innerHTML = `
                <div class="bg-blue-50 border-l-4 border-blue-500 p-3 rounded">
                    <div class="flex">
                        <div class="flex-shrink-0">
                            <i class="fas fa-info-circle text-blue-500"></i>
                        </div>
                        <div class="ml-3">
                            <p class="text-sm text-blue-700">
                                <strong>Select your destination folder</strong><br>
                                Choose where you want to save your converted Markdown files.
                            </p>
                        </div>
                    </div>
                </div>
            `;
        }
        
        return instructions;
    }

    /**
     * Create unsupported API warning
     * WHY: Informs users when File System Access API is unavailable
     */
    createUnsupportedWarning() {
        const apiInfo = getFileSystemAccessInfo();
        const warning = document.createElement('div');
        warning.className = 'bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded mb-4';
        
        let message = 'Your browser doesn\'t support direct folder saving. ';
        
        if (apiInfo.mobile) {
            if (apiInfo.ios) {
                message += 'On iOS devices, use the download options below to save your files. You can then move them to your preferred folder using the Files app.';
            } else {
                message += 'On mobile devices, use the download options below to save your files.';
            }
        } else {
            message += 'Use the download options below to save your files.';
        }
        
        warning.innerHTML = `
            <div class="flex items-start space-x-3">
                <div class="flex-shrink-0">
                    <i class="fas fa-exclamation-triangle text-yellow-500 mt-1"></i>
                </div>
                <div>
                    <strong class="block mb-2 text-yellow-800">Mobile Browser Detected</strong>
                    <p class="text-yellow-700 leading-normal mb-0">${message}</p>
                    ${apiInfo.mobile ? `
                        <div class="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
                            <strong class="block mb-1 text-blue-800"><i class="fas fa-lightbulb mr-1"></i>Mobile Tip:</strong>
                            <p class="text-blue-700 text-sm mb-0">Download all files as a ZIP archive for easier file management on your device.</p>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
        
        return warning;
    }

    /**
     * Show success message
     * WHY: Provides positive feedback
     */
    showSuccess(message) {
        this.showStatusMessage(message, 'success');
    }

    /**
     * Show info message
     * WHY: Provides informational feedback
     */
    showInfo(message) {
        this.showStatusMessage(message, 'info');
    }

    /**
     * Show error message
     * WHY: Provides error feedback
     */
    showError(message) {
        this.showStatusMessage(message, 'error');
    }

    /**
     * Show file save confirmation dialog
     * WHY: Provides clear visual confirmation when individual files are saved
     */
    showFileSaveConfirmation(fileTitle, folderName, filename) {
        // Create confirmation dialog
        const dialog = document.createElement('div');
        dialog.className = 'file-save-confirmation-dialog';
        dialog.innerHTML = `
            <div class="dialog-overlay">
                <div class="dialog-content">
                    <div class="success-icon">✅</div>
                    <h3>File Saved Successfully!</h3>
                    <p><strong>${fileTitle}</strong> has been saved to the <strong>${folderName}</strong> folder.</p>
                    <p class="filename">Filename: <code>${filename}</code></p>
                    <div class="dialog-buttons">
                        <button class="btn btn-primary ok-btn">OK</button>
                    </div>
                </div>
            </div>
        `;
        
        // Add dialog styles
        const style = document.createElement('style');
        style.textContent = `
            .file-save-confirmation-dialog .dialog-overlay {
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
            .file-save-confirmation-dialog .dialog-content {
                background: #2a2a2a;
                border: 1px solid #444;
                border-radius: 12px;
                padding: 32px;
                max-width: 450px;
                width: 90%;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
                position: relative;
                text-align: center;
            }
            .file-save-confirmation-dialog .success-icon {
                font-size: 48px;
                margin-bottom: 16px;
                animation: bounce 0.6s ease-in-out;
            }
            .file-save-confirmation-dialog h3 {
                margin: 0 0 20px 0;
                color: #ffffff;
                font-size: 20px;
                font-weight: 600;
            }
            .file-save-confirmation-dialog p {
                margin: 0 0 16px 0;
                color: #cccccc;
                line-height: 1.6;
                font-size: 15px;
            }
            .file-save-confirmation-dialog .filename {
                background: #1a1a1a;
                border: 1px solid #333;
                border-radius: 6px;
                padding: 12px;
                margin: 16px 0;
                font-family: monospace;
                font-size: 13px;
            }
            .file-save-confirmation-dialog .filename code {
                color: #4CAF50;
                background: #1a1a1a;
                padding: 2px 6px;
                border-radius: 3px;
            }
            .file-save-confirmation-dialog .dialog-buttons {
                display: flex;
                justify-content: center;
                margin-top: 24px;
            }
            .file-save-confirmation-dialog .btn {
                padding: 12px 24px;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
                transition: all 0.2s ease;
                min-width: 80px;
            }
            .file-save-confirmation-dialog .btn-primary {
                background: #007acc;
                color: #ffffff;
            }
            .file-save-confirmation-dialog .btn-primary:hover {
                background: #0066aa;
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(0, 122, 204, 0.3);
            }
            @keyframes bounce {
                0%, 20%, 50%, 80%, 100% {
                    transform: translateY(0);
                }
                40% {
                    transform: translateY(-10px);
                }
                60% {
                    transform: translateY(-5px);
                }
            }
        `;
        
        // Add to document
        document.head.appendChild(style);
        document.body.appendChild(dialog);
        
        // Get button reference
        const okBtn = dialog.querySelector('.ok-btn');
        
        // Handle button click and cleanup
        const cleanup = () => {
            try {
                if (dialog.parentNode) {
                    document.body.removeChild(dialog);
                }
                if (style.parentNode) {
                    document.head.removeChild(style);
                }
            } catch (error) {
                logWarn('⚠️ Error cleaning up confirmation dialog:', error);
            }
        };
        
        okBtn.addEventListener('click', cleanup);
        
        // Handle escape key
        const handleKeyDown = (event) => {
            if (event.key === 'Escape' || event.key === 'Enter') {
                document.removeEventListener('keydown', handleKeyDown);
                cleanup();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        
        // Focus the OK button
        setTimeout(() => okBtn.focus(), 100);
        
        // Auto-close after 5 seconds
        setTimeout(() => {
            if (dialog.parentNode) {
                cleanup();
            }
        }, 5000);
    }

    /**
     * Show status message in UI
     * WHY: Centralizes status message display
     */
    showStatusMessage(message, type) {
        if (this.progressDisplay && this.progressDisplay.isVisible) {
            // Use the correct methods that exist on ProgressDisplay
            if (type === 'error') {
                this.progressDisplay.showError(message);
            } else {
                // For info/success messages, use updateProgress with current or max percentage
                this.progressDisplay.updateProgress(100, message);
            }
        } else {
            // Fallback: log to console
            logInfo(`${type.toUpperCase()}: ${message}`);
        }
    }

    /**
     * Helper method to create delays for better UX
     * WHY: Creates artificial delays to make processing feel more substantial
     * 
     * @param {number} ms - Milliseconds to delay
     * @returns {Promise} - Promise that resolves after the delay
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Reset application state
     * WHY: Allows for multiple conversions in same session
     */
    reset() {
        this.convertedFiles = [];
        this.processedIds.clear();
        this.selectedDirectoryHandle = null;
        this.saveLocalButton = null;
        
        // Hide results
        const resultsDiv = document.getElementById('results');
        if (resultsDiv) {
            resultsDiv.style.display = 'none';
        }
    }
} 