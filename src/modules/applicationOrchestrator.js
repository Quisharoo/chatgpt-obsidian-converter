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
     * WHY: Provides fallback download options
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
        
        // Individual file options
        for (const file of results.files) {
            const item = document.createElement('div');
            item.className = 'download-item';
            item.style.display = 'flex';
            item.style.alignItems = 'center';
            item.style.marginBottom = '10px';
            item.style.padding = '10px';
            item.style.background = '#f8f9fa';
            item.style.borderRadius = '5px';
            item.style.border = '1px solid #dee2e6';
            
            const info = document.createElement('span');
            info.textContent = file.title || file.filename;
            info.style.flex = '1';
            info.style.marginRight = '10px';
            info.style.fontWeight = '500';
            
            // Save to Obsidian button (primary action)
            if (isFileSystemAccessSupported()) {
                const saveBtn = document.createElement('button');
                saveBtn.className = 'btn';
                saveBtn.textContent = '📁 Save to Obsidian';
                saveBtn.style.background = '#007bff';
                saveBtn.style.color = 'white';
                saveBtn.style.marginRight = '8px';
                saveBtn.style.fontSize = '0.9rem';
                saveBtn.title = 'Save directly to a folder of your choice using the same logic as bulk save';
                saveBtn.onclick = () => this.saveSingleFileToObsidian(file);
                item.appendChild(saveBtn);
            }
            
            // Download button (fallback)
            const downloadBtn = document.createElement('button');
            downloadBtn.className = 'btn';
            downloadBtn.textContent = '📥 Download';
            downloadBtn.style.background = '#6c757d';
            downloadBtn.style.color = 'white';
            downloadBtn.style.fontSize = '0.9rem';
            downloadBtn.title = 'Download to your Downloads folder';
            downloadBtn.onclick = () => this.downloadSingleFile(file);
            
            item.appendChild(info);
            item.appendChild(downloadBtn);
            section.appendChild(item);
        }
        
        return section;
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