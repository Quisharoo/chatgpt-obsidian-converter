/**
 * Application Orchestrator
 * Main coordinator for the ChatGPT to Markdown converter application
 * Following AGENTS.md principle: clean architecture with separated concerns
 */

import { FileUploader } from '../components/FileUploader.js';
import { ProgressDisplay } from '../components/ProgressDisplay.js';
import { processConversations } from './conversionEngine.js';
import { 
    selectDirectory, 
    saveFilesChronologically, 
    validateDirectoryAccess,
    downloadFile,
    createDownloadBlob,
    isFileSystemAccessSupported,
    saveFileToDirectory,
    scanForExistingFiles
} from './fileSystemManager.js';
import { ERROR_MESSAGES, STATUS_MESSAGES } from '../utils/constants.js';
import { logInfo, logDebug, logWarn, logError } from '../utils/logger.js';

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
        
        this.initializeComponents();
    }

    /**
     * Initialize all application components
     * WHY: Sets up the UI components and establishes connections
     */
    initializeComponents() {
        try {
            // Initialize components
            this.fileUploader = new FileUploader('uploadArea', 'fileInput');
            this.progressDisplay = new ProgressDisplay('conversionProgressContainer');
            this.saveProgressDisplay = new ProgressDisplay('progressContainer');
            
            // Set up file upload handling
            this.fileUploader.setFileSelectedCallback(this.handleFileUpload.bind(this));
            
            logInfo('✅ ChatGPT to Markdown Converter initialized');
            logInfo(`📁 File System Access API: ${isFileSystemAccessSupported() ? 'Available' : 'Not available'}`);
            
        } catch (error) {
            logError('❌ Failed to initialize application:', error);
            this.showError('Failed to initialize application. Please refresh the page.');
        }
    }

    /**
     * Handle file upload and processing
     * WHY: Coordinates the entire file processing workflow
     * 
     * @param {File} file - Uploaded file to process
     */
    async handleFileUpload(file) {
        logInfo(`🔄 Processing file: ${file.name} (${file.size} bytes)`);
        
        this.fileUploader.setProcessingState(true);
        this.progressDisplay.show(false, false); // Don't switch to Files view for conversion
        
        try {
            // Read and parse file
            this.progressDisplay.updateProgress(0, STATUS_MESSAGES.READING_FILE);
            const fileContent = await this.readFileContent(file);
            
            // Add a small delay to make reading feel more substantial
            await this.delay(300);
            
            this.progressDisplay.updateProgress(20, STATUS_MESSAGES.PARSING_JSON);
            const conversations = this.parseConversations(fileContent);
            
            // Add delay for parsing
            await this.delay(400);
            
            // Convert conversations with more granular progress
            this.progressDisplay.updateProgress(40, STATUS_MESSAGES.CONVERTING);
            const results = processConversations(conversations, this.processedIds);
            
            // Add delay for conversion processing
            await this.delay(500);
            
            this.progressDisplay.updateProgress(80, STATUS_MESSAGES.FINALIZING);
            await this.delay(300);
            
            this.progressDisplay.updateProgress(100, STATUS_MESSAGES.COMPLETE);
            this.convertedFiles = results.files;
            
            // Add final delay before showing results
            await this.delay(800);
            
            // Display results with delay for smooth transition
            setTimeout(() => {
                this.displayResults(results);
                
                // Switch to results view and stay there
                if (window.switchToView) {
                    window.switchToView('results');
                    
                    // Populate the Files view in the background but don't switch to it automatically
                    // Ensure files are available before populating
                    setTimeout(() => {
                        if (results.files && results.files.length > 0) {
                            this.populateFilesView(results);
                            logInfo(`✅ Files view populated with ${results.files.length} files`);
                        } else {
                            logWarn('⚠️ No files available to populate Files view');
                        }
                    }, 100);
                }
                
                // Hide progress after switching to results view
                setTimeout(() => {
                    this.progressDisplay.hide();
                }, 200);
            }, 500);
            
        } catch (error) {
            logError('❌ Error processing file:', error);
            this.progressDisplay.showError(error.message);
            this.showError(error.message);
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
        } catch (error) {
            throw new Error(ERROR_MESSAGES.INVALID_JSON);
        }
        
        if (!Array.isArray(conversations)) {
            throw new Error(ERROR_MESSAGES.INVALID_STRUCTURE);
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
            
            this.showSuccess(`✅ Selected directory: ${directoryHandle.name}. Now click "Save to Local Folder" to save your files!`);
            this.updateSaveButtonState();
            
            // Re-render the files table to show Save buttons
            if (this.allFiles && this.allFiles.length > 0) {
                this.renderFilesTable();
            }
            
        } catch (error) {
            console.error('Directory selection error:', error);
            this.showError(error.message);
        }
    }



    /**
     * Save files to local directory
     * WHY: Orchestrates the file saving process with progress feedback
     */
    async handleLocalSave() {
        if (!this.selectedDirectoryHandle) {
            this.showError(ERROR_MESSAGES.NO_DIRECTORY);
            return;
        }

        // Validate directory is still accessible
        const isValid = await validateDirectoryAccess(this.selectedDirectoryHandle);
        if (!isValid) {
            this.showError('❌ Directory access lost. Please select folder again.');
            this.selectedDirectoryHandle = null;
            this.updateSaveButtonState();
            return;
        }

        logInfo(`💾 Starting save operation for ${this.convertedFiles.length} files to ${this.selectedDirectoryHandle.name}`);
        
        // Switch to Files view first, then show progress
        if (window.switchToView) {
            window.switchToView('files');
            logInfo('✅ Switched to Files view for save operation');
        }
        
        // Set up cancellation flag
        let isCancelled = false;
        
        // Show progress display with cancel button and switch to Files view
        this.saveProgressDisplay.show(true, true);
        this.saveProgressDisplay.setCancelCallback(() => {
            isCancelled = true;
            logInfo('🛑 User requested cancellation of save operation');
        });
        
        this.showInfo(`💾 Preparing to save ${this.convertedFiles.length} files to ${this.selectedDirectoryHandle.name} folder...`);

        try {
            const progressCallback = (progress, completed, total, statusMessage) => {
                const message = statusMessage || `💾 Saving files... ${progress}% (${completed}/${total})`;
                logInfo(`📊 Progress update: ${progress}% - ${message}`);
                this.saveProgressDisplay.updateProgress(progress, message);
            };

            const cancellationCallback = () => isCancelled;

            const results = await saveFilesChronologically(
                this.convertedFiles, 
                this.selectedDirectoryHandle, 
                progressCallback,
                cancellationCallback
            );

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
            this.showError(`Save failed: ${error.message}`);
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
        } catch (error) {
            console.error(`Error downloading ${file.filename}:`, error);
            this.showError(`Failed to download ${file.filename}`);
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
                this.showError('Your browser doesn\'t support direct file saving. Use download instead.');
                return;
            }

            this.showInfo(`📁 Choose where to save "${file.title || file.filename}"`);
            
            // Let user select directory for this specific file
            const directoryHandle = await selectDirectory();
            
            if (!directoryHandle) {
                this.showInfo('📂 File save cancelled');
                return;
            }

            this.showInfo(`💾 Saving "${file.filename}" to ${directoryHandle.name}...`);

            // Use the updated save logic with detailed response
            const result = await saveFileToDirectory(file.filename, file.content, directoryHandle);
            
            if (result.success) {
                this.showSuccess(`✅ ${result.message}`);
                logInfo(`✅ Individual file saved: ${result.filename} → ${directoryHandle.name}/`);
            } else if (result.cancelled) {
                this.showInfo(`📂 ${result.message}`);
                logInfo(`📂 Save cancelled by user: ${result.filename}`);
            } else {
                this.showError(`❌ ${result.message}`);
                logError(`❌ Save failed: ${result.filename} - ${result.message}`);
            }

        } catch (error) {
            logError(`Error saving individual file ${file.filename}:`, error);
            
            // Provide specific error messages
            if (error.message.includes('cancelled')) {
                this.showInfo('📂 File save cancelled');
            } else {
                this.showError(`Failed to save "${file.filename}": ${error.message}`);
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
     * Update save button state based on directory selection
     * WHY: Provides visual feedback about readiness to save
     */
    updateSaveButtonState() {
        if (this.saveLocalButton) {
            this.saveLocalButton.disabled = !this.selectedDirectoryHandle;
            
            if (this.selectedDirectoryHandle) {
                this.saveLocalButton.className = 'btn btn-primary';
                this.saveLocalButton.textContent = `💾 Save ${this.convertedFiles.length} files to selected folder`;
                this.saveLocalButton.style.animation = 'pulse 2s infinite';
            } else {
                this.saveLocalButton.className = 'btn';
                this.saveLocalButton.textContent = '💾 Save to Local Folder (Select folder first)';
                this.saveLocalButton.style.animation = 'none';
            }
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
        
        resultsDiv.style.display = 'block';
        downloadList.innerHTML = '';
        
        // Add summary card
        const summaryCard = this.createResultsSummaryCard(results);
        downloadList.appendChild(summaryCard);
        
        if (results.files.length > 0) {
            // Add directory selection card
            const directoryCard = this.createDirectoryCard(results);
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
        filesContainer.style.display = 'block';
        
        // Store files data for pagination/sorting
        this.allFiles = results.files;
        this.currentPage = 1;
        this.filesPerPage = 10;
        
        // Initialize sort state if not already set
        if (!this.currentSort) {
            this.currentSort = 'title';
            this.sortDirection = 'asc';
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
        row.style.borderBottom = '1px solid var(--border-primary)';
        
        // Fix date extraction - use multiple possible properties
        const dateCreated = this.getFileDate(file);
        
        // Title column with filename shown as subtitle - FIXED WIDTH to prevent layout shifts
        const titleCell = document.createElement('td');
        titleCell.style.padding = 'var(--space-3) var(--space-4)';
        titleCell.style.color = 'var(--text-primary)';
        titleCell.style.fontWeight = 'var(--font-weight-medium)';
        titleCell.style.width = '65%'; // Match header width
        titleCell.style.verticalAlign = 'top';
        
        const titleContainer = document.createElement('div');
        const titleSpan = document.createElement('div');
        titleSpan.textContent = file.title;
        titleSpan.style.marginBottom = '2px';
        titleSpan.style.wordBreak = 'break-word'; // Prevent overflow
        
        const filenameSpan = document.createElement('div');
        filenameSpan.textContent = file.filename;
        filenameSpan.style.fontSize = '0.8rem';
        filenameSpan.style.color = 'var(--text-secondary)';
        filenameSpan.style.fontFamily = 'monospace';
        filenameSpan.style.wordBreak = 'break-all'; // Prevent overflow
        
        titleContainer.appendChild(titleSpan);
        titleContainer.appendChild(filenameSpan);
        titleCell.appendChild(titleContainer);
        
        // Date column - FIXED WIDTH to prevent layout shifts
        const dateCell = document.createElement('td');
        dateCell.style.padding = 'var(--space-3) var(--space-4)';
        dateCell.style.color = 'var(--text-secondary)';
        dateCell.style.fontSize = 'var(--font-size-sm)';
        dateCell.style.width = '20%'; // Match header width
        dateCell.style.verticalAlign = 'top';
        dateCell.style.whiteSpace = 'nowrap'; // Prevent date wrapping
        dateCell.textContent = dateCreated;
        
        // Actions column - FIXED WIDTH to prevent layout shifts
        const actionsCell = document.createElement('td');
        actionsCell.style.padding = 'var(--space-3) var(--space-4)';
        actionsCell.style.textAlign = 'right';
        actionsCell.style.width = '15%'; // Match header width
        actionsCell.style.verticalAlign = 'top';
        actionsCell.style.whiteSpace = 'nowrap'; // Prevent button wrapping
        
        const actionsContainer = document.createElement('div');
        actionsContainer.style.display = 'flex';
        actionsContainer.style.gap = 'var(--space-2)';
        actionsContainer.style.justifyContent = 'flex-end';
        actionsContainer.style.flexWrap = 'nowrap'; // Prevent wrapping
        
        // Always create Save button first, then Download button
        // This maintains consistent layout and allows individual file saving
        const saveBtn = document.createElement('button');
        saveBtn.className = 'btn btn-primary save-file-btn';
        saveBtn.style.padding = 'var(--space-2) var(--space-3)';
        saveBtn.style.fontSize = 'var(--font-size-xs)';
        saveBtn.style.flexShrink = '0'; // Prevent button shrinking
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
        downloadBtn.className = 'btn btn-secondary download-file-btn';
        downloadBtn.style.padding = 'var(--space-2) var(--space-3)';
        downloadBtn.style.fontSize = 'var(--font-size-xs)';
        downloadBtn.style.flexShrink = '0'; // Prevent button shrinking
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
            const row = this.createFileRow(file);
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
                titleHeader.style.backgroundColor = 'var(--bg-secondary)';
            };
            this._titleMouseLeaveHandler = () => {
                titleHeader.style.backgroundColor = '';
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
                dateHeader.style.backgroundColor = 'var(--bg-secondary)';
            };
            this._dateMouseLeaveHandler = () => {
                dateHeader.style.backgroundColor = '';
            };
            
            dateHeader.addEventListener('click', this._dateSortHandler);
            dateHeader.style.transition = 'background-color 0.2s ease';
            dateHeader.addEventListener('mouseenter', this._dateMouseEnterHandler);
            dateHeader.addEventListener('mouseleave', this._dateMouseLeaveHandler);
            logDebug('✅ Date header click listener attached');
        }
        
        // Initial sort state - set title as default ascending (only if not already set)
        if (!this.currentSort) {
            this.currentSort = 'title';
            this.sortDirection = 'asc';
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
        titleIndicator.style.color = '#ccc';
        dateIndicator.style.color = '#ccc';
        titleIndicator.textContent = '';
        dateIndicator.textContent = '';
        
        // Set active indicator with correct direction
        const activeIndicator = this.currentSort === 'title' ? titleIndicator : dateIndicator;
        activeIndicator.style.color = '#007bff';
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
            <p>✅ Processed: ${results.processed} conversations</p>
            <p>⏭️ Skipped: ${results.skipped} conversations</p>
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
        card.className = 'card';
        card.style.marginBottom = 'var(--space-6)';
        
        const header = document.createElement('div');
        header.className = 'card-header';
        
        const title = document.createElement('h3');
        title.className = 'card-title';
        title.innerHTML = `
            <svg class="icon" style="margin-right: var(--space-2);" viewBox="0 0 24 24">
                <path d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z"/>
            </svg>
            Conversion Summary
        `;
        
        const description = document.createElement('p');
        description.className = 'card-description';
        description.textContent = 'Your ChatGPT conversations have been successfully converted';
        
        header.appendChild(title);
        header.appendChild(description);
        
        const content = document.createElement('div');
        content.className = 'card-content';
        
        const stats = document.createElement('div');
        stats.style.display = 'grid';
        stats.style.gridTemplateColumns = 'repeat(auto-fit, minmax(150px, 1fr))';
        stats.style.gap = 'var(--space-4)';
        
        // Create stat items
        const statItems = [
            { label: 'Files Created', value: results.files.length, icon: 'M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z' },
            { label: 'Conversations', value: results.processed, icon: 'M12,3C6.5,3 2,6.58 2,11A7.18,7.18 0 0,0 2.24,12.65C2.09,13.6 2,14.62 2,15.68C2,17.68 2.5,19.5 3.5,21L12,12.5C12,12.33 12,12.17 12,12A1,1 0 0,1 13,11A1,1 0 0,1 14,12C14,12.17 14,12.33 14,12.5L22.5,21C23.5,19.5 24,17.68 24,15.68C24,14.62 23.91,13.6 23.76,12.65A7.18,7.18 0 0,0 24,11C24,6.58 19.5,3 14,3H12Z' },
            { label: 'Duplicates Skipped', value: results.duplicatesFound || 0, icon: 'M19,7H22V9H19V12H17V9H14V7H17V4H19V7M17,19H2V17S2,10 9,10C13.5,10 16.24,11.69 17,15.5V19Z' }
        ];
        
        if (results.errors > 0) {
            statItems.push({ label: 'Errors', value: results.errors, icon: 'M13,14H11V10H13M13,18H11V16H13M1,21H23L12,2L1,21Z' });
        }
        
        statItems.forEach(item => {
            const statCard = document.createElement('div');
            statCard.style.padding = 'var(--space-4)';
            statCard.style.backgroundColor = 'var(--bg-tertiary)';
            statCard.style.borderRadius = 'var(--radius-md)';
            statCard.style.textAlign = 'center';
            
            statCard.innerHTML = `
                <svg class="icon" style="color: var(--accent-primary); margin-bottom: var(--space-2);" viewBox="0 0 24 24">
                    <path d="${item.icon}"/>
                </svg>
                <div style="font-size: var(--font-size-xl); font-weight: var(--font-weight-semibold); color: var(--text-primary); margin-bottom: var(--space-1);">${item.value}</div>
                <div style="font-size: var(--font-size-sm); color: var(--text-secondary);">${item.label}</div>
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
        card.className = 'card';
        card.style.marginBottom = 'var(--space-6)';
        
        const header = document.createElement('div');
        header.className = 'card-header';
        
        const title = document.createElement('h3');
        title.className = 'card-title';
        title.innerHTML = `
            <svg class="icon" style="margin-right: var(--space-2);" viewBox="0 0 24 24">
                <path d="M10,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V8C22,6.89 21.1,6 20,6H12L10,4Z"/>
            </svg>
            Save Location
        `;
        
        const description = document.createElement('p');
        description.className = 'card-description';
        description.textContent = 'Choose where to save your converted files';
        
        header.appendChild(title);
        header.appendChild(description);
        
        const content = document.createElement('div');
        content.className = 'card-content';
        
        if (isFileSystemAccessSupported()) {
            // Directory selection buttons
            const buttonGroup = document.createElement('div');
            buttonGroup.style.display = 'flex';
            buttonGroup.style.flexDirection = 'column';
            buttonGroup.style.gap = 'var(--space-3)';
            buttonGroup.style.marginBottom = 'var(--space-4)';
            
            const selectBtn = this.createDirectoryButton();
            const saveBtn = this.createSaveButton(results);
            
            buttonGroup.appendChild(selectBtn);
            buttonGroup.appendChild(saveBtn);
            content.appendChild(buttonGroup);
            
            // Instructions
            const instructions = this.createInstructions();
            content.appendChild(instructions);
            
        } else {
            const warning = this.createUnsupportedWarning();
            content.appendChild(warning);
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
        btn.className = 'btn';
        btn.textContent = this.selectedDirectoryHandle ? 
            `📂 Change Directory (Current: ${this.selectedDirectoryHandle.name})` : 
            '📂 Choose Folder';
        btn.onclick = () => this.handleDirectorySelection();
        btn.style.marginRight = '10px';
        return btn;
    }



    /**
     * Create save to local folder button
     * WHY: Main save action with visual feedback
     */
    createSaveButton(results) {
        const btn = document.createElement('button');
        btn.className = 'btn';
        btn.textContent = this.selectedDirectoryHandle ? 
            `💾 Save ${results.files.length} files to selected folder` : 
            '💾 Save to Local Folder (Select folder first)';
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
        const instructions = document.createElement('p');
        instructions.style.marginTop = 'var(--space-3)';
        instructions.style.fontSize = 'var(--font-size-sm)';
        instructions.style.color = 'var(--text-secondary)';
        instructions.style.lineHeight = 'var(--line-height-normal)';
        
        if (this.selectedDirectoryHandle) {
            instructions.innerHTML = `
                <strong style="color: var(--success);">✓ Ready to save</strong><br>
                Selected folder: <strong>${this.selectedDirectoryHandle.name}</strong><br>
                Click "Save to Local Folder" to save all files directly to your chosen location.
            `;
        } else {
            instructions.innerHTML = `
                <strong>Select your destination folder</strong><br>
                Choose where you want to save your converted Markdown files.
            `;
        }
        
        return instructions;
    }

    /**
     * Create unsupported API warning
     * WHY: Informs users when File System Access API is unavailable
     */
    createUnsupportedWarning() {
        const warning = document.createElement('p');
        warning.style.color = '#856404';
        warning.style.background = '#fff3cd';
        warning.style.padding = '10px';
        warning.style.borderRadius = '5px';
        warning.style.border = '1px solid #ffeaa7';
        warning.textContent = '⚠️ Your browser doesn\'t support direct folder saving. Use download options below.';
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