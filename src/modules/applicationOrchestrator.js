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
            
            // Display results
            setTimeout(() => {
                this.displayResults(results);
                this.progressDisplay.hide();
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
                this.saveLocalButton.textContent = `💾 Save ${this.convertedFiles.length} files to ${this.selectedDirectoryHandle.name}/`;
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
        
        // Add summary
        const summary = this.createResultsSummary(results);
        downloadList.appendChild(summary);
        
        if (results.files.length > 0) {
            // Add directory selection and save options
            const directorySection = this.createDirectorySection(results);
            downloadList.appendChild(directorySection);
            
            // Add individual download options
            const downloadSection = this.createDownloadSection(results);
            downloadList.appendChild(downloadSection);
        }
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
     * Create directory selection section
     * WHY: Provides local save options with clear instructions
     */
    createDirectorySection(results) {
        const section = document.createElement('div');
        section.style.marginBottom = '20px';
        section.style.padding = '15px';
        section.style.background = '#f8f9fa';
        section.style.borderRadius = '8px';
        section.style.border = '1px solid #dee2e6';
        
        const title = document.createElement('h4');
        title.textContent = '📁 Save Location:';
        section.appendChild(title);
        
        if (isFileSystemAccessSupported()) {
            // Main directory button
            const selectBtn = this.createDirectoryButton();
            section.appendChild(selectBtn);
            
            // Simple directory button
            const simpleBtn = this.createSimpleDirectoryButton();
            section.appendChild(simpleBtn);
            
            // Save button
            const saveBtn = this.createSaveButton(results);
            section.appendChild(saveBtn);
            
            // Instructions
            const instructions = this.createInstructions();
            section.appendChild(instructions);
            
        } else {
            const warning = this.createUnsupportedWarning();
            section.appendChild(warning);
        }
        
        return section;
    }

    /**
     * Create download section with individual file links
     * WHY: Provides paginated, sortable download options with creation date display
     */
    createDownloadSection(results) {
        const section = document.createElement('div');
        
        const title = document.createElement('h4');
        title.textContent = '📁 Individual File Options:';
        section.appendChild(title);
        
        // Add explanation
        const explanation = document.createElement('p');
        explanation.style.fontSize = '0.9rem';
        explanation.style.color = '#666';
        explanation.style.marginBottom = '15px';
        explanation.innerHTML = `
            💡 <strong>Save individually:</strong> Each file prompts for location (useful for organizing into different folders)<br>
            📥 <strong>Download:</strong> Traditional download to your Downloads folder
        `;
        section.appendChild(explanation);
        
        // Add sorting and pagination controls
        const controlsContainer = this.createFileSortingControls(results);
        section.appendChild(controlsContainer);
        
        // Add file list container (will be populated by updateFileList)
        const fileListContainer = document.createElement('div');
        fileListContainer.id = 'fileListContainer';
        section.appendChild(fileListContainer);
        
        // Initialize pagination state
        this.currentPage = 1;
        this.filesPerPage = 10;
        this.currentSort = 'name';
        this.sortDirection = 'asc';
        this.allFiles = results.files;
        
        // Initial display
        this.updateFileList();
        
        return section;
    }

    /**
     * Create sorting controls for file list
     * WHY: Provides user control over file organization and display
     */
    createFileSortingControls(results) {
        const container = document.createElement('div');
        container.style.marginBottom = '15px';
        container.style.padding = '10px';
        container.style.background = '#f8f9fa';
        container.style.borderRadius = '5px';
        container.style.border = '1px solid #dee2e6';
        
        // Sort controls
        const sortContainer = document.createElement('div');
        sortContainer.style.display = 'flex';
        sortContainer.style.alignItems = 'center';
        sortContainer.style.gap = '10px';
        sortContainer.style.marginBottom = '10px';
        
        const sortLabel = document.createElement('label');
        sortLabel.textContent = '🔄 Sort by:';
        sortLabel.style.fontWeight = '500';
        
        const sortSelect = document.createElement('select');
        sortSelect.id = 'sortSelect';
        sortSelect.style.padding = '5px';
        sortSelect.style.borderRadius = '3px';
        sortSelect.innerHTML = `
            <option value="name">Name (A-Z)</option>
            <option value="date">Date Created</option>
        `;
        sortSelect.addEventListener('change', () => {
            const [sortBy, direction] = sortSelect.value === 'name' ? ['name', 'asc'] : ['date', 'desc'];
            this.setSortOrder(sortBy, direction);
        });
        
        const directionBtn = document.createElement('button');
        directionBtn.id = 'sortDirectionBtn';
        directionBtn.textContent = '⬆️ Asc';
        directionBtn.style.padding = '5px 10px';
        directionBtn.style.borderRadius = '3px';
        directionBtn.style.border = '1px solid #ccc';
        directionBtn.style.background = 'white';
        directionBtn.style.cursor = 'pointer';
        directionBtn.addEventListener('click', () => this.toggleSortDirection());
        
        sortContainer.appendChild(sortLabel);
        sortContainer.appendChild(sortSelect);
        sortContainer.appendChild(directionBtn);
        
        // Results info and pagination controls
        const infoContainer = document.createElement('div');
        infoContainer.style.display = 'flex';
        infoContainer.style.justifyContent = 'space-between';
        infoContainer.style.alignItems = 'center';
        
        const resultsInfo = document.createElement('span');
        resultsInfo.id = 'resultsInfo';
        resultsInfo.style.fontSize = '0.9rem';
        resultsInfo.style.color = '#666';
        
        const paginationContainer = document.createElement('div');
        paginationContainer.id = 'paginationControls';
        paginationContainer.style.display = 'flex';
        paginationContainer.style.gap = '5px';
        
        infoContainer.appendChild(resultsInfo);
        infoContainer.appendChild(paginationContainer);
        
        container.appendChild(sortContainer);
        container.appendChild(infoContainer);
        
        return container;
    }

    /**
     * Set sort order and update display
     * WHY: Allows users to organize files by preference
     */
    setSortOrder(sortBy, direction) {
        this.currentSort = sortBy;
        this.sortDirection = direction;
        this.currentPage = 1; // Reset to first page
        this.updateFileList();
        this.updateSortControls();
    }

    /**
     * Toggle sort direction
     * WHY: Provides easy way to reverse sort order
     */
    toggleSortDirection() {
        this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        this.updateFileList();
        this.updateSortControls();
    }

    /**
     * Update sort control displays
     * WHY: Provides visual feedback of current sort state
     */
    updateSortControls() {
        const directionBtn = document.getElementById('sortDirectionBtn');
        if (directionBtn) {
            directionBtn.textContent = this.sortDirection === 'asc' ? '⬆️ Asc' : '⬇️ Desc';
        }
    }

    /**
     * Sort files based on current criteria
     * WHY: Organizes files according to user preference
     */
    getSortedFiles() {
        const sorted = [...this.allFiles];
        
        sorted.sort((a, b) => {
            let compareValue = 0;
            
            if (this.currentSort === 'name') {
                compareValue = (a.title || a.filename).localeCompare(b.title || b.filename);
            } else if (this.currentSort === 'date') {
                compareValue = (a.createTime || 0) - (b.createTime || 0);
            }
            
            return this.sortDirection === 'desc' ? -compareValue : compareValue;
        });
        
        return sorted;
    }

    /**
     * Update file list display with pagination
     * WHY: Provides clean, organized view of files with navigation
     */
    updateFileList() {
        const container = document.getElementById('fileListContainer');
        if (!container) return;
        
        const sortedFiles = this.getSortedFiles();
        const totalFiles = sortedFiles.length;
        const startIndex = (this.currentPage - 1) * this.filesPerPage;
        const endIndex = Math.min(startIndex + this.filesPerPage, totalFiles);
        const currentPageFiles = sortedFiles.slice(startIndex, endIndex);
        
        // Clear container
        container.innerHTML = '';
        
        // Add files for current page
        currentPageFiles.forEach(file => {
            const item = this.createFileItem(file);
            container.appendChild(item);
        });
        
        // Update results info
        this.updateResultsInfo(startIndex + 1, endIndex, totalFiles);
        
        // Update pagination controls
        this.updatePaginationControls(totalFiles);
    }

    /**
     * Create individual file item with enhanced display
     * WHY: Shows file info with creation date and action buttons
     */
    createFileItem(file) {
        const item = document.createElement('div');
        item.className = 'download-item';
        item.style.display = 'flex';
        item.style.alignItems = 'center';
        item.style.marginBottom = '10px';
        item.style.padding = '12px';
        item.style.background = '#f8f9fa';
        item.style.borderRadius = '5px';
        item.style.border = '1px solid #dee2e6';
        
        // File info container
        const infoContainer = document.createElement('div');
        infoContainer.style.flex = '1';
        infoContainer.style.marginRight = '10px';
        
        const titleSpan = document.createElement('div');
        titleSpan.textContent = file.title || file.filename;
        titleSpan.style.fontWeight = '500';
        titleSpan.style.marginBottom = '2px';
        
        const dateSpan = document.createElement('div');
        dateSpan.textContent = `📅 Created: ${file.createdDate || 'Unknown'}`;
        dateSpan.style.fontSize = '0.8rem';
        dateSpan.style.color = '#666';
        
        infoContainer.appendChild(titleSpan);
        infoContainer.appendChild(dateSpan);
        
        // Action buttons container
        const buttonsContainer = document.createElement('div');
        buttonsContainer.style.display = 'flex';
        buttonsContainer.style.gap = '8px';
        
        // Save to Obsidian button (primary action)
        if (isFileSystemAccessSupported()) {
            const saveBtn = document.createElement('button');
            saveBtn.className = 'btn';
            saveBtn.textContent = '📁 Save to Obsidian';
            saveBtn.style.background = '#007bff';
            saveBtn.style.color = 'white';
            saveBtn.style.fontSize = '0.9rem';
            saveBtn.style.padding = '6px 12px';
            saveBtn.title = 'Save directly to a folder of your choice using the same logic as bulk save';
            saveBtn.onclick = () => this.saveSingleFileToObsidian(file);
            buttonsContainer.appendChild(saveBtn);
        }
        
        // Download button (fallback)
        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'btn';
        downloadBtn.textContent = '📥 Download';
        downloadBtn.style.background = '#6c757d';
        downloadBtn.style.color = 'white';
        downloadBtn.style.fontSize = '0.9rem';
        downloadBtn.style.padding = '6px 12px';
        downloadBtn.title = 'Download to your Downloads folder';
        downloadBtn.onclick = () => this.downloadSingleFile(file);
        buttonsContainer.appendChild(downloadBtn);
        
        item.appendChild(infoContainer);
        item.appendChild(buttonsContainer);
        
        return item;
    }

    /**
     * Update results information display
     * WHY: Shows current pagination status to users
     */
    updateResultsInfo(start, end, total) {
        const resultsInfo = document.getElementById('resultsInfo');
        if (resultsInfo) {
            resultsInfo.textContent = `Showing ${start}-${end} of ${total} conversations`;
        }
    }

    /**
     * Update pagination controls
     * WHY: Provides navigation between pages
     */
    updatePaginationControls(totalFiles) {
        const container = document.getElementById('paginationControls');
        if (!container) return;
        
        container.innerHTML = '';
        
        const totalPages = Math.ceil(totalFiles / this.filesPerPage);
        
        if (totalPages <= 1) return; // No pagination needed
        
        // Previous button
        const prevBtn = document.createElement('button');
        prevBtn.textContent = '« Prev';
        prevBtn.style.padding = '5px 10px';
        prevBtn.style.fontSize = '0.8rem';
        prevBtn.style.border = '1px solid #ccc';
        prevBtn.style.borderRadius = '3px';
        prevBtn.style.background = this.currentPage === 1 ? '#f0f0f0' : 'white';
        prevBtn.style.cursor = this.currentPage === 1 ? 'not-allowed' : 'pointer';
        prevBtn.disabled = this.currentPage === 1;
        prevBtn.onclick = () => this.goToPage(this.currentPage - 1);
        container.appendChild(prevBtn);
        
        // Page numbers (show current, prev, next, first, last)
        const pagesToShow = this.getPageNumbers(this.currentPage, totalPages);
        pagesToShow.forEach(pageNum => {
            if (pageNum === '...') {
                const ellipsis = document.createElement('span');
                ellipsis.textContent = '...';
                ellipsis.style.padding = '5px';
                container.appendChild(ellipsis);
            } else {
                const pageBtn = document.createElement('button');
                pageBtn.textContent = pageNum;
                pageBtn.style.padding = '5px 10px';
                pageBtn.style.fontSize = '0.8rem';
                pageBtn.style.border = '1px solid #ccc';
                pageBtn.style.borderRadius = '3px';
                pageBtn.style.background = pageNum === this.currentPage ? '#007bff' : 'white';
                pageBtn.style.color = pageNum === this.currentPage ? 'white' : 'black';
                pageBtn.style.cursor = 'pointer';
                pageBtn.onclick = () => this.goToPage(pageNum);
                container.appendChild(pageBtn);
            }
        });
        
        // Next button
        const nextBtn = document.createElement('button');
        nextBtn.textContent = 'Next »';
        nextBtn.style.padding = '5px 10px';
        nextBtn.style.fontSize = '0.8rem';
        nextBtn.style.border = '1px solid #ccc';
        nextBtn.style.borderRadius = '3px';
        nextBtn.style.background = this.currentPage === totalPages ? '#f0f0f0' : 'white';
        nextBtn.style.cursor = this.currentPage === totalPages ? 'not-allowed' : 'pointer';
        nextBtn.disabled = this.currentPage === totalPages;
        nextBtn.onclick = () => this.goToPage(this.currentPage + 1);
        container.appendChild(nextBtn);
    }

    /**
     * Get page numbers to display in pagination
     * WHY: Shows relevant page numbers with ellipsis for large page counts
     */
    getPageNumbers(currentPage, totalPages) {
        const pages = [];
        
        if (totalPages <= 7) {
            // Show all pages if 7 or fewer
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            // Always show first page
            pages.push(1);
            
            if (currentPage > 3) {
                pages.push('...');
            }
            
            // Show pages around current page
            const start = Math.max(2, currentPage - 1);
            const end = Math.min(totalPages - 1, currentPage + 1);
            
            for (let i = start; i <= end; i++) {
                pages.push(i);
            }
            
            if (currentPage < totalPages - 2) {
                pages.push('...');
            }
            
            // Always show last page
            if (totalPages > 1) {
                pages.push(totalPages);
            }
        }
        
        return pages;
    }

    /**
     * Navigate to specific page
     * WHY: Handles pagination navigation
     */
    goToPage(pageNumber) {
        if (pageNumber < 1 || pageNumber > Math.ceil(this.allFiles.length / this.filesPerPage)) {
            return;
        }
        
        this.currentPage = pageNumber;
        this.updateFileList();
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
            `💾 Save ${results.files.length} files to ${this.selectedDirectoryHandle.name}/` : 
            '💾 Save to Local Folder (Select folder first)';
        btn.disabled = !this.selectedDirectoryHandle;
        btn.onclick = () => this.handleLocalSave();
        
        // Store reference for updates
        this.saveLocalButton = btn;
        
        return btn;
    }

    /**
     * Create instructions element
     * WHY: Guides users through the process
     */
    createInstructions() {
        const instructions = document.createElement('p');
        instructions.style.marginTop = '10px';
        instructions.style.fontSize = '0.9rem';
        instructions.style.color = '#666';
        instructions.innerHTML = `
            💡 <strong>Step-by-Step Process:</strong><br>
            <div style="margin-left: 15px; margin-top: 8px;">
                ✅ <strong>1. Upload conversations.json</strong> - Done!<br>
                ${this.selectedDirectoryHandle ? '✅' : '⏳'} <strong>2. Choose your Obsidian folder</strong> ${this.selectedDirectoryHandle ? `- Selected: ${this.selectedDirectoryHandle.name}` : '- Click button above'}<br>
                ${this.selectedDirectoryHandle ? '⏳' : '⬜'} <strong>3. Click "Save to Local Folder"</strong> ${this.selectedDirectoryHandle ? '- Ready to save!' : '- Select folder first'}<br>
                ⬜ <strong>4. Files appear directly in your selected folder</strong>
            </div>
        `;
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
            this.progressDisplay.updateStatus(message, type);
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