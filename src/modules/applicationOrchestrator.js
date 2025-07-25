/**
 * Application Orchestrator
 * Main coordinator for the ChatGPT to Obsidian converter application
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
    saveFileToDirectory
} from './fileSystemManager.js';
import { ERROR_MESSAGES, STATUS_MESSAGES } from '../utils/constants.js';

/**
 * ChatGPT to Obsidian Application
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
            this.fileUploader = new FileUploader('uploadArea', 'fileInput', 'chooseFileBtn');
            this.progressDisplay = new ProgressDisplay('progressContainer');
            
            // Set up file upload handling
            this.fileUploader.setFileSelectedCallback(this.handleFileUpload.bind(this));
            
            console.log('✅ ChatGPT to Obsidian Converter initialized');
            console.log(`📁 File System Access API: ${isFileSystemAccessSupported() ? 'Available' : 'Not available'}`);
            
        } catch (error) {
            console.error('❌ Failed to initialize application:', error);
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
        console.log(`🔄 Processing file: ${file.name} (${file.size} bytes)`);
        
        this.fileUploader.setProcessingState(true);
        this.progressDisplay.show();
        
        try {
            // Read and parse file
            this.progressDisplay.updateProgress(0, STATUS_MESSAGES.READING_FILE);
            const fileContent = await this.readFileContent(file);
            
            this.progressDisplay.updateProgress(25, STATUS_MESSAGES.PARSING_JSON);
            const conversations = this.parseConversations(fileContent);
            
            // Convert conversations
            this.progressDisplay.updateProgress(50, STATUS_MESSAGES.CONVERTING);
            const results = processConversations(conversations, this.processedIds);
            
            this.progressDisplay.updateProgress(100, STATUS_MESSAGES.COMPLETE);
            this.convertedFiles = results.files;
            
            // Display results with delay for smooth transition
            setTimeout(() => {
                this.displayResults(results);
                this.progressDisplay.hide();
                
                // Switch to results view and stay there
                if (window.switchToView) {
                    window.switchToView('results');
                    
                    // Populate the Files view in the background but don't switch to it automatically
                    setTimeout(() => {
                        this.populateFilesView(results);
                    }, 100);
                }
            }, 500);
            
        } catch (error) {
            console.error('❌ Error processing file:', error);
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
     * Handle simplified directory selection
     * WHY: Provides fallback option when main picker fails
     */
    async handleSimpleDirectorySelection() {
        try {
            const directoryHandle = await selectDirectory({});
            this.selectedDirectoryHandle = directoryHandle;
            
            this.showSuccess(`✅ Selected directory: ${directoryHandle.name}. Ready to save files!`);
            this.updateSaveButtonState();
            
            // Re-render the files table to show Save buttons
            if (this.allFiles && this.allFiles.length > 0) {
                this.renderFilesTable();
            }
            
        } catch (error) {
            console.error('Simple directory selection error:', error);
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

        this.progressDisplay.show();
        this.showInfo(`💾 Saving ${this.convertedFiles.length} files to ${this.selectedDirectoryHandle.name} folder...`);

        try {
            const progressCallback = (progress, completed, total) => {
                this.progressDisplay.updateProgress(
                    progress, 
                    `💾 Saving files... ${progress}% (${completed}/${total})`
                );
            };

            const results = await saveFilesChronologically(
                this.convertedFiles, 
                this.selectedDirectoryHandle, 
                progressCallback
            );

            // Show results
            if (results.successCount > 0) {
                const message = `✅ Saved ${results.successCount} files to ${this.selectedDirectoryHandle.name}${results.errorCount > 0 ? ` (${results.errorCount} errors)` : ''}`;
                this.showSuccess(message);
                
                setTimeout(() => {
                    this.showSuccess(`✅ SUCCESS! Check your ${this.selectedDirectoryHandle.name} folder for the files`);
                }, 1000);
            } else {
                this.showError('❌ Failed to save any files. Check permissions or try downloading instead.');
            }

        } catch (error) {
            console.error('❌ Error during save:', error);
            this.showError(`Save failed: ${error.message}`);
        } finally {
            setTimeout(() => this.progressDisplay.hide(), 1000);
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
     * Save individual file to Obsidian directory
     * WHY: Reuses the same File System Access API logic as bulk save for consistency
     * 
     * @param {Object} file - File object to save
     */
    async saveSingleFileToObsidian(file) {
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

            // Use the same save logic as bulk save
            const success = await saveFileToDirectory(file.filename, file.content, directoryHandle);
            
            if (success) {
                this.showSuccess(`✅ Saved "${file.filename}" to ${directoryHandle.name}/ folder!`);
                console.log(`✅ Individual file saved: ${file.filename} → ${directoryHandle.name}/`);
            } else {
                this.showError(`❌ Failed to save "${file.filename}". Check permissions or try download instead.`);
            }

        } catch (error) {
            console.error(`Error saving individual file ${file.filename}:`, error);
            
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
                console.error(`Error downloading ${file.filename}:`, error);
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
            this.saveLocalButton.style.background = this.selectedDirectoryHandle ? '#28a745' : '#6c757d';
            
            if (this.selectedDirectoryHandle) {
                this.saveLocalButton.textContent = `💾 Save ${this.convertedFiles.length} files to selected folder`;
                this.saveLocalButton.style.animation = 'pulse 2s infinite';
            } else {
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
        
        // Always create Save button first (when available), then Download button
        // This maintains consistent layout and prevents shifts when directory is selected
        if (this.selectedDirectoryHandle) {
            const saveBtn = document.createElement('button');
            saveBtn.className = 'btn btn-primary save-file-btn';
            saveBtn.style.padding = 'var(--space-2) var(--space-3)';
            saveBtn.style.fontSize = 'var(--font-size-xs)';
            saveBtn.style.flexShrink = '0'; // Prevent button shrinking
            saveBtn.setAttribute('data-filename', file.filename);
            saveBtn.setAttribute('data-content', encodeURIComponent(file.content));
            saveBtn.innerHTML = `
                <svg class="icon" style="width: 16px; height: 16px;" viewBox="0 0 24 24">
                    <path d="M15,9H5V5H15M12,19A3,3 0 0,1 9,16A3,3 0 0,1 12,13A3,3 0 0,1 15,16A3,3 0 0,1 12,19M17,3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V7L17,3Z"/>
                </svg>
            `;
            actionsContainer.appendChild(saveBtn);
        }
        
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
     * Render files table with current sorting and pagination
     * WHY: Displays files with proper sorting and pagination controls
     */
    renderFilesTable() {
        const fileTableBody = document.getElementById('fileTableBody');
        const resultsInfo = document.getElementById('resultsInfo');
        const paginationContainer = document.getElementById('paginationContainer');
        
        if (!fileTableBody || !this.allFiles) return;
        
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
    }

    /**
     * Set up column header click handlers for sorting
     * WHY: Provides natural table sorting interface
     */
    setupColumnSorting() {
        const titleHeader = document.getElementById('titleHeader');
        const dateHeader = document.getElementById('dateHeader');
        
        console.log('🔧 Setting up column sorting...', { titleHeader: !!titleHeader, dateHeader: !!dateHeader });
        
        if (titleHeader) {
            titleHeader.addEventListener('click', () => this.handleColumnSort('title'));
            titleHeader.style.transition = 'background-color 0.2s ease';
            titleHeader.addEventListener('mouseenter', () => {
                titleHeader.style.backgroundColor = 'var(--bg-secondary)';
            });
            titleHeader.addEventListener('mouseleave', () => {
                titleHeader.style.backgroundColor = '';
            });
            console.log('✅ Title header click listener attached');
        }
        
        if (dateHeader) {
            dateHeader.addEventListener('click', () => this.handleColumnSort('date'));
            dateHeader.style.transition = 'background-color 0.2s ease';
            dateHeader.addEventListener('mouseenter', () => {
                dateHeader.style.backgroundColor = 'var(--bg-secondary)';
            });
            dateHeader.addEventListener('mouseleave', () => {
                dateHeader.style.backgroundColor = '';
            });
            console.log('✅ Date header click listener attached');
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
        console.log(`🔄 Column sort clicked: ${column}, current: ${this.currentSort}, direction: ${this.sortDirection}`);
        
        const previousColumn = this.currentSort;
        
        if (this.currentSort === column) {
            // Same column - toggle direction
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
            console.log(`↕️ Toggling sort direction for ${column}: ${this.sortDirection}`);
        } else {
            // Different column - set new sort and default to ascending
            this.currentSort = column;
            this.sortDirection = 'asc';
            console.log(`🔄 Switching to new column ${column}: ${this.sortDirection}`);
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
        
        console.log('🎨 Updating sort indicators...', { 
            currentSort: this.currentSort, 
            sortDirection: this.sortDirection,
            titleIndicator: !!titleIndicator,
            dateIndicator: !!dateIndicator 
        });
        
        if (!titleIndicator || !dateIndicator) {
            console.warn('⚠️ Sort indicators not found in DOM');
            return;
        }
        
        // Reset all indicators to inactive state
        titleIndicator.style.color = '#ccc';
        dateIndicator.style.color = '#ccc';
        titleIndicator.textContent = '▲';
        dateIndicator.textContent = '▲';
        
        // Set active indicator with correct direction
        const activeIndicator = this.currentSort === 'title' ? titleIndicator : dateIndicator;
        activeIndicator.style.color = '#007bff';
        activeIndicator.textContent = this.sortDirection === 'asc' ? '▲' : '▼';
        
        console.log(`✨ Active sort: ${this.currentSort} ${this.sortDirection === 'asc' ? '(ascending)' : '(descending)'}`);
    }

    /**
     * Get properly formatted date from file object
     * WHY: Handles different date property names and formats consistently
     */
    getFileDate(file) {
        // Try different possible date properties
        const createTime = file.createTime || file.create_time;
        
        if (createTime) {
            return new Date(createTime * 1000).toLocaleDateString();
        }
        
        // Fallback to createdDate if available
        if (file.createdDate && file.createdDate !== 'Unknown') {
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
                aValue = a.createTime || a.create_time || 0;
                bValue = b.createTime || b.create_time || 0;
                
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
                downloadFile(filename, content);
            });
        });

        // Save buttons
        document.querySelectorAll('.save-file-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const filename = btn.dataset.filename;
                const content = decodeURIComponent(btn.dataset.content);
                if (this.selectedDirectoryHandle) {
                    try {
                        await saveFileToDirectory(filename, content, this.selectedDirectoryHandle);
                        this.showSuccess(`File saved: ${filename}`);
                    } catch (error) {
                        console.error('Error saving file:', error);
                        this.showError(`Failed to save ${filename}: ${error.message}`);
                    }
                }
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
            { label: 'Duplicates Skipped', value: results.duplicates, icon: 'M19,7H22V9H19V12H17V9H14V7H17V4H19V7M17,19H2V17S2,10 9,10C13.5,10 16.24,11.69 17,15.5V19Z' }
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
            buttonGroup.style.gap = 'var(--space-3)';
            buttonGroup.style.marginBottom = 'var(--space-4)';
            
            const selectBtn = this.createDirectoryButton();
            const simpleBtn = this.createSimpleDirectoryButton();
            
            buttonGroup.appendChild(selectBtn);
            buttonGroup.appendChild(simpleBtn);
            content.appendChild(buttonGroup);
            
            // Instructions
            const instructions = this.createInstructions();
            content.appendChild(instructions);
            
        } else {
            const warning = this.createUnsupportedWarning();
            content.appendChild(warning);
        }
        
        const actions = document.createElement('div');
        actions.className = 'card-actions';
        
        if (isFileSystemAccessSupported()) {
            const saveBtn = this.createSaveButton(results);
            actions.appendChild(saveBtn);
        }
        
        card.appendChild(header);
        card.appendChild(content);
        if (actions.children.length > 0) {
            card.appendChild(actions);
        }
        
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
            '📂 Choose Obsidian Folder';
        btn.onclick = () => this.handleDirectorySelection();
        btn.style.marginRight = '10px';
        return btn;
    }

    /**
     * Create simple directory selection button
     * WHY: Fallback for when main picker fails
     */
    createSimpleDirectoryButton() {
        const btn = document.createElement('button');
        btn.className = 'btn';
        btn.textContent = '📁 Simple Folder Picker';
        btn.onclick = () => this.handleSimpleDirectorySelection();
        btn.style.marginRight = '10px';
        btn.style.background = '#6c757d';
        btn.title = 'Try this if the main folder picker doesn\'t work';
        return btn;
    }

    /**
     * Create save to local folder button
     * WHY: Main save action with visual feedback
     */
    createSaveButton(results) {
        const btn = document.createElement('button');
        btn.className = 'btn';
        btn.style.background = this.selectedDirectoryHandle ? '#28a745' : '#6c757d';
        btn.style.fontSize = '1.1rem';
        btn.style.padding = '12px 24px';
        btn.style.fontWeight = 'bold';
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
                <strong>Select your Obsidian vault folder</strong><br>
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
            console.log(`${type.toUpperCase()}: ${message}`);
        }
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