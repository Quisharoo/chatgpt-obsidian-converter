/**
 * File Uploader Component
 * Accessible drag-and-drop file uploader with keyboard support
 * Following AGENTS.md principle: semantic HTML, ARIA attributes, keyboard navigation
 */

import { isValidJsonFile } from '../utils/helpers.js';
import { UI_CONFIG, ERROR_MESSAGES } from '../utils/constants.js';
import { logError } from '../utils/logger.js';

/**
 * File Uploader Component Class
 * WHY: Encapsulates file upload logic with full accessibility support
 */
export class FileUploader {
    constructor(uploadAreaId, fileInputId) {
        // Support both old and new dropzone IDs
        this.uploadArea = document.getElementById('dropzone') || document.getElementById(uploadAreaId);
        this.fileInput = document.getElementById(fileInputId);
        this.onFileSelected = null;
        this.isProcessing = false;
        
        this.validateElements();
        this.initializeAccessibility();
        this.attachEventListeners();
    }

    /**
     * Validate required DOM elements exist
     * WHY: Prevents runtime errors if elements are missing
     */
    validateElements() {
        if (!this.uploadArea) {
            throw new Error(`Upload area element with id 'uploadArea' not found`);
        }
        if (!this.fileInput) {
            throw new Error(`File input element with id 'fileInput' not found`);
        }
    }

    /**
     * Initialize accessibility features
     * WHY: Ensures component is usable by all users including keyboard and screen reader users
     */
    initializeAccessibility() {
        // Set up proper ARIA attributes
        this.uploadArea.setAttribute('tabindex', '0');
        this.uploadArea.setAttribute('role', 'button');
        this.uploadArea.setAttribute('aria-label', 'Upload area for ChatGPT conversations.json file');
        
        // Ensure file input is properly labeled
        if (!this.fileInput.getAttribute('aria-label')) {
            this.fileInput.setAttribute('aria-label', 'Select conversations.json or export ZIP file');
        }
        // Broaden accept to .json and .zip without changing index.html
        const accept = this.fileInput.getAttribute('accept');
        if (!accept || accept.indexOf('.zip') === -1) {
            this.fileInput.setAttribute('accept', '.json,.zip');
        }
    }

    /**
     * Attach all event listeners
     * WHY: Sets up user interaction handling for upload functionality
     */
    attachEventListeners() {
        // Click events
        this.uploadArea.addEventListener('click', this.handleUploadAreaClick.bind(this));
        
        // File input change
        this.fileInput.addEventListener('change', this.handleFileInputChange.bind(this));
        
        // Drag and drop events
        this.uploadArea.addEventListener('dragover', this.handleDragOver.bind(this));
        this.uploadArea.addEventListener('dragleave', this.handleDragLeave.bind(this));
        this.uploadArea.addEventListener('drop', this.handleDrop.bind(this));
        
        // Keyboard events for accessibility
        this.uploadArea.addEventListener('keydown', this.handleKeyDown.bind(this));
        
        // Prevent default drag behaviors on the window
        window.addEventListener('dragover', (e) => e.preventDefault());
        window.addEventListener('drop', (e) => e.preventDefault());
    }

    /**
     * Handle upload area click
     * WHY: Provides intuitive click-to-upload functionality
     */
    handleUploadAreaClick(event) {
        if (this.isProcessing) return;
        
        this.fileInput.click();
    }

    /**
     * Handle file input change
     * WHY: Processes selected files from input element
     */
    handleFileInputChange(event) {
        const files = event.target.files;
        if (files && files.length > 0) {
            this.processFile(files[0]);
        }
    }

    /**
     * Handle drag over event
     * WHY: Provides visual feedback during drag operations
     */
    handleDragOver(event) {
        event.preventDefault();
        event.stopPropagation();
        
        if (this.isProcessing) return;
        
        // Use new Tailwind active class instead of dragover
        this.uploadArea.classList.add('active');
        event.dataTransfer.dropEffect = 'copy';
    }

    /**
     * Handle drag leave event
     * WHY: Removes visual feedback when drag leaves area
     */
    handleDragLeave(event) {
        event.preventDefault();
        event.stopPropagation();
        
        // Only remove active class if actually leaving the upload area
        if (!this.uploadArea.contains(event.relatedTarget)) {
            this.uploadArea.classList.remove('active');
        }
    }

    /**
     * Handle drop event
     * WHY: Processes dropped files
     */
    handleDrop(event) {
        event.preventDefault();
        event.stopPropagation();
        
        this.uploadArea.classList.remove('active');
        
        if (this.isProcessing) return;
        
        const files = event.dataTransfer.files;
        if (files && files.length > 0) {
            this.processFile(files[0]);
        }
    }

    /**
     * Handle keyboard navigation
     * WHY: Ensures keyboard accessibility for the upload area
     */
    handleKeyDown(event) {
        if (this.isProcessing) return;
        
        // Activate on Enter or Space
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            this.fileInput.click();
        }
    }

    /**
     * Process selected file
     * WHY: Validates and handles file processing with proper feedback
     * 
     * @param {File} file - Selected file to process
     */
    processFile(file) {
        try {
            // Validate file type and content
            // Accept .json and .zip (validated downstream)
            const lowerName = (file.name || '').toLowerCase();
            const isJson = lowerName.endsWith('.json');
            const isZip = lowerName.endsWith('.zip');
            if (!isJson && !isZip && !isValidJsonFile(file)) {
                this.showFileError(ERROR_MESSAGES.INVALID_FILE_TYPE);
                return;
            }
            
            // Clear any previous errors
            this.clearFileError();
            
            // Update UI state
            this.setProcessingState(true);
            
            // Call the callback if set
            if (this.onFileSelected && typeof this.onFileSelected === 'function') {
                this.onFileSelected(file);
            }
            
        } catch (error) {
            logError('Error processing file:', error);
            this.showFileError(ERROR_MESSAGES.FILE_PROCESSING_ERROR);
            this.setProcessingState(false);
        }
    }

    /**
     * Set file selected callback
     * WHY: Allows parent component to handle file processing
     * 
     * @param {Function} callback - Function to call when file is selected
     */
    setFileSelectedCallback(callback) {
        this.onFileSelected = callback;
    }

    /**
     * Set processing state
     * WHY: Updates UI to reflect current processing status
     * 
     * @param {boolean} isProcessing - Whether file is currently being processed
     */
    setProcessingState(isProcessing) {
        this.isProcessing = isProcessing;
        
        // Update button state
        // Removed chooseButton.disabled = isProcessing;
        
        // Update upload area state
        if (isProcessing) {
            this.uploadArea.classList.add('processing');
            this.uploadArea.setAttribute('aria-busy', 'true');
        } else {
            this.uploadArea.classList.remove('processing');
            this.uploadArea.setAttribute('aria-busy', 'false');
        }
        
        // Update visual feedback
        this.updateUploadAreaText(isProcessing);
    }

    /**
     * Update upload area text based on state
     * WHY: Provides contextual feedback to users
     * 
     * @param {boolean} isProcessing - Current processing state
     */
    updateUploadAreaText(isProcessing) {
        // Find text elements using the new structure
        const uploadText = this.uploadArea.querySelector('p.text-lg');
        const uploadSubtext = this.uploadArea.querySelector('p.text-gray-500');
        
        if (uploadText && uploadSubtext) {
            if (isProcessing) {
                uploadText.textContent = 'Processing your file...';
                uploadSubtext.textContent = 'Please wait while we convert your conversations';
            } else {
                uploadText.textContent = 'Drop your conversations.json file here';
                uploadSubtext.textContent = 'or';
            }
        }
    }

    /**
     * Show file error message
     * WHY: Provides clear feedback when file validation fails
     * 
     * @param {string} message - Error message to display
     */
    showFileError(message) {
        // Remove any existing error
        this.clearFileError();
        
        // Create error element with Tailwind styling
        const errorDiv = document.createElement('div');
        errorDiv.className = 'bg-red-50 border-l-4 border-red-500 p-4 mt-4';
        errorDiv.id = 'uploadError';
        errorDiv.setAttribute('role', 'alert');
        
        errorDiv.innerHTML = `
            <div class="flex">
                <div class="flex-shrink-0">
                    <i class="fas fa-exclamation-triangle text-red-500"></i>
                </div>
                <div class="ml-3">
                    <p class="text-sm text-red-700">${message}</p>
                </div>
            </div>
        `;
        
        // Insert after upload area in the upload section
        const uploadSection = document.getElementById('upload-section');
        if (uploadSection) {
            // Find the dropzone and insert the error after it
            const dropzone = uploadSection.querySelector('#dropzone');
            if (dropzone && dropzone.parentNode) {
                dropzone.parentNode.insertBefore(errorDiv, dropzone.nextSibling);
            }
        }
        
        // Reset file input
        this.fileInput.value = '';
    }

    /**
     * Clear file error message
     * WHY: Removes error when user selects a new file
     */
    clearFileError() {
        const existingError = document.getElementById('uploadError');
        if (existingError) {
            existingError.remove();
        }
    }
} 