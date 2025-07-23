/**
 * File Uploader Component
 * Accessible drag-and-drop file uploader with keyboard support
 * Following AGENTS.md principle: semantic HTML, ARIA attributes, keyboard navigation
 */

import { isValidJsonFile } from '../utils/helpers.js';
import { UI_CONFIG, ERROR_MESSAGES } from '../utils/constants.js';

/**
 * File Uploader Component Class
 * WHY: Encapsulates file upload logic with full accessibility support
 */
export class FileUploader {
    constructor(uploadAreaId, fileInputId, chooseButtonId) {
        this.uploadArea = document.getElementById(uploadAreaId);
        this.fileInput = document.getElementById(fileInputId);
        this.chooseButton = document.getElementById(chooseButtonId);
        this.onFileSelected = null;
        this.isProcessing = false;
        
        this.validateElements();
        this.initializeAccessibility();
        this.attachEventListeners();
    }

    /**
     * Validate required DOM elements exist
     * WHY: Fail early if required elements are missing
     */
    validateElements() {
        if (!this.uploadArea) {
            throw new Error('Upload area element not found');
        }
        if (!this.fileInput) {
            throw new Error('File input element not found');
        }
        if (!this.chooseButton) {
            throw new Error('Choose button element not found');
        }
    }

    /**
     * Initialize accessibility attributes
     * WHY: Ensures component is accessible to all users
     */
    initializeAccessibility() {
        // Make upload area focusable and keyboard accessible
        this.uploadArea.setAttribute('tabindex', '0');
        this.uploadArea.setAttribute('role', 'button');
        this.uploadArea.setAttribute('aria-label', 'Upload conversations.json file or click to browse');
        this.uploadArea.setAttribute('aria-describedby', 'upload-instructions');
        
        // Add instructions for screen readers
        const instructions = document.createElement('div');
        instructions.id = 'upload-instructions';
        instructions.className = 'sr-only';
        instructions.textContent = 'Drag and drop your conversations.json file here, or press Enter or Space to open file browser';
        this.uploadArea.appendChild(instructions);
        
        // Ensure button has proper labeling
        if (!this.chooseButton.getAttribute('aria-label')) {
            this.chooseButton.setAttribute('aria-label', 'Choose conversations.json file to upload');
        }
    }

    /**
     * Attach all event listeners for interaction
     * WHY: Handles mouse, keyboard, and drag interactions
     */
    attachEventListeners() {
        // Drag and drop events
        this.uploadArea.addEventListener('dragover', this.handleDragOver.bind(this));
        this.uploadArea.addEventListener('dragleave', this.handleDragLeave.bind(this));
        this.uploadArea.addEventListener('drop', this.handleDrop.bind(this));
        
        // Click events (avoiding duplicate triggers)
        this.uploadArea.addEventListener('click', this.handleUploadAreaClick.bind(this));
        this.chooseButton.addEventListener('click', this.handleChooseButtonClick.bind(this));
        
        // Keyboard accessibility
        this.uploadArea.addEventListener('keydown', this.handleKeyDown.bind(this));
        
        // File input change
        this.fileInput.addEventListener('change', this.handleFileInputChange.bind(this));
    }

    /**
     * Handle drag over event with visual feedback
     * WHY: Provides visual feedback during drag operations
     */
    handleDragOver(event) {
        event.preventDefault();
        this.uploadArea.classList.add(UI_CONFIG.DRAG_HOVER_CLASS);
        
        // Update ARIA state
        this.uploadArea.setAttribute('aria-describedby', 'upload-instructions drop-feedback');
        
        // Add drop feedback for screen readers
        if (!document.getElementById('drop-feedback')) {
            const feedback = document.createElement('div');
            feedback.id = 'drop-feedback';
            feedback.className = 'sr-only';
            feedback.setAttribute('aria-live', 'polite');
            feedback.textContent = 'File ready to drop';
            this.uploadArea.appendChild(feedback);
        }
    }

    /**
     * Handle drag leave event
     * WHY: Removes visual feedback when drag leaves area
     */
    handleDragLeave(event) {
        event.preventDefault();
        this.uploadArea.classList.remove(UI_CONFIG.DRAG_HOVER_CLASS);
        
        // Clean up drop feedback
        const feedback = document.getElementById('drop-feedback');
        if (feedback) {
            feedback.remove();
        }
        
        this.uploadArea.setAttribute('aria-describedby', 'upload-instructions');
    }

    /**
     * Handle file drop with validation
     * WHY: Processes dropped files with proper error handling
     */
    handleDrop(event) {
        event.preventDefault();
        this.uploadArea.classList.remove(UI_CONFIG.DRAG_HOVER_CLASS);
        
        // Clean up drop feedback
        const feedback = document.getElementById('drop-feedback');
        if (feedback) {
            feedback.remove();
        }
        
        const files = event.dataTransfer.files;
        if (files.length > 0) {
            this.processFile(files[0]);
        }
    }

    /**
     * Handle upload area click (excluding button clicks)
     * WHY: Allows area click to trigger file selection without duplicate events
     */
    handleUploadAreaClick(event) {
        // Don't trigger if the click was on the button
        if (event.target === this.chooseButton || event.target.closest('#' + this.chooseButton.id)) {
            return;
        }
        
        console.log('📂 Upload area clicked - opening file picker');
        this.fileInput.click();
    }

    /**
     * Handle choose button click
     * WHY: Provides explicit button interaction for file selection
     */
    handleChooseButtonClick(event) {
        event.stopPropagation();
        console.log('🖱️ Choose File button clicked');
        this.fileInput.click();
    }

    /**
     * Handle keyboard navigation
     * WHY: Ensures component is fully keyboard accessible
     */
    handleKeyDown(event) {
        // Enter or Space to activate file picker
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            this.fileInput.click();
        }
    }

    /**
     * Handle file input change
     * WHY: Processes selected files from file input
     */
    handleFileInputChange(event) {
        const file = event.target.files[0];
        if (file) {
            this.processFile(file);
            // Clear input so same file can be selected again
            event.target.value = '';
        }
    }

    /**
     * Process selected file with validation
     * WHY: Validates file before processing and provides user feedback
     * 
     * @param {File} file - Selected file to process
     */
    processFile(file) {
        if (this.isProcessing) {
            console.log('⚠️ File processing already in progress');
            return;
        }

        // Validate file type
        if (!isValidJsonFile(file)) {
            this.showError('Please upload a JSON file (.json)');
            return;
        }

        // Announce file selection to screen readers
        this.announceFileSelection(file.name);

        // Process file if callback is set
        if (this.onFileSelected) {
            this.onFileSelected(file);
        }
    }

    /**
     * Set callback for file selection
     * WHY: Allows external handling of file processing
     * 
     * @param {Function} callback - Function to call when file is selected
     */
    setFileSelectedCallback(callback) {
        this.onFileSelected = callback;
    }

    /**
     * Set processing state
     * WHY: Prevents multiple simultaneous uploads
     * 
     * @param {boolean} processing - Whether processing is active
     */
    setProcessingState(processing) {
        this.isProcessing = processing;
        
        // Update UI state
        this.uploadArea.style.pointerEvents = processing ? 'none' : 'auto';
        this.chooseButton.disabled = processing;
        
        // Update ARIA state
        this.uploadArea.setAttribute('aria-busy', processing.toString());
        
        if (processing) {
            this.uploadArea.setAttribute('aria-label', 'Processing file upload...');
        } else {
            this.uploadArea.setAttribute('aria-label', 'Upload conversations.json file or click to browse');
        }
    }

    /**
     * Show error message
     * WHY: Provides accessible error feedback
     * 
     * @param {string} message - Error message to display
     */
    showError(message) {
        // Create or update error display
        let errorElement = document.getElementById('upload-error');
        if (!errorElement) {
            errorElement = document.createElement('div');
            errorElement.id = 'upload-error';
            errorElement.className = 'status error';
            errorElement.setAttribute('role', 'alert');
            errorElement.setAttribute('aria-live', 'assertive');
            this.uploadArea.appendChild(errorElement);
        }
        
        errorElement.textContent = message;
        
        // Auto-remove error after delay
        setTimeout(() => {
            if (errorElement && errorElement.parentNode) {
                errorElement.remove();
            }
        }, 5000);
    }

    /**
     * Announce file selection to screen readers
     * WHY: Provides feedback about successful file selection
     * 
     * @param {string} filename - Name of selected file
     */
    announceFileSelection(filename) {
        const announcement = document.createElement('div');
        announcement.className = 'sr-only';
        announcement.setAttribute('aria-live', 'polite');
        announcement.textContent = `File selected: ${filename}. Processing...`;
        
        document.body.appendChild(announcement);
        
        // Remove announcement after screen readers process it
        setTimeout(() => {
            if (announcement.parentNode) {
                announcement.remove();
            }
        }, 2000);
    }
} 