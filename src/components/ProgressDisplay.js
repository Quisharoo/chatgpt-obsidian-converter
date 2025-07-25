/**
 * Progress Display Component
 * Accessible progress indicator with status messaging
 * Following AGENTS.md principle: semantic HTML and ARIA attributes
 */

import { STATUS_MESSAGES } from '../utils/constants.js';
import { logWarn, logInfo } from '../utils/logger.js';

/**
 * Progress Display Component Class
 * WHY: Encapsulates progress UI logic with accessibility features
 */
export class ProgressDisplay {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.statusText = null;
        this.cancelButton = null;
        this.isVisible = false;
        this.isInitialized = false;
        this.onCancelCallback = null;
        
        if (!this.container) {
            logWarn(`Progress container '${containerId}' not found`);
        }
    }

    /**
     * Initialize progress display elements (only once)
     * WHY: Sets up accessible DOM structure with ARIA attributes for dark theme
     */
    initialize() {
        if (!this.container || this.isInitialized) return;

        this.container.innerHTML = `
            <div class="status info" id="statusText" aria-live="polite" aria-atomic="true" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">
                ${STATUS_MESSAGES.PROCESSING}
            </div>
            <button id="cancelButton" class="btn btn-secondary cancel-btn" style="display: none; margin-top: var(--space-3);">
                <svg class="icon" viewBox="0 0 24 24" style="width: 16px; height: 16px; margin-right: var(--space-2);">
                    <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                </svg>
                Cancel Save
            </button>
        `;

        this.statusText = this.container.querySelector('#statusText');
        this.cancelButton = this.container.querySelector('#cancelButton');
        
        // Set up cancel button event listener
        if (this.cancelButton) {
            this.cancelButton.addEventListener('click', () => {
                this.handleCancel();
            });
        }
        
        this.isInitialized = true;
        logInfo('✅ Progress display initialized');
    }

    /**
     * Handle cancel button click
     * WHY: Triggers cancellation callback when user wants to stop the operation
     */
    handleCancel() {
        logInfo('🛑 Cancel button clicked');
        if (this.onCancelCallback) {
            this.onCancelCallback();
        }
        // Disable the button to prevent multiple clicks
        if (this.cancelButton) {
            this.cancelButton.disabled = true;
            this.cancelButton.textContent = 'Cancelling...';
        }
    }

    /**
     * Set cancel callback function
     * WHY: Allows external components to handle cancellation
     * 
     * @param {Function} callback - Function to call when cancel is clicked
     */
    setCancelCallback(callback) {
        this.onCancelCallback = callback;
    }

    /**
     * Show progress display with optional cancel button
     * WHY: Makes progress visible to user with proper styling
     * 
     * @param {boolean} showCancelButton - Whether to show the cancel button
     */
    show(showCancelButton = false) {
        if (!this.container) {
            logWarn('Progress container not found, cannot show progress');
            return;
        }
        
        // Initialize only if not already done
        if (!this.isInitialized) {
            this.initialize();
        }
        
        this.container.style.display = 'block';
        this.isVisible = true;
        
        // Show/hide cancel button based on parameter
        if (this.cancelButton) {
            if (showCancelButton) {
                this.cancelButton.style.display = 'inline-flex';
                this.cancelButton.disabled = false;
                this.cancelButton.innerHTML = `
                    <svg class="icon" viewBox="0 0 24 24" style="width: 16px; height: 16px; margin-right: var(--space-2);">
                        <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                    </svg>
                    Cancel Save
                `;
            } else {
                this.cancelButton.style.display = 'none';
            }
        }
        
        // Ensure the progress card is visible in the Files section
        const progressCard = document.getElementById('progressCard');
        if (progressCard) {
            progressCard.style.display = 'block';
            logInfo('✅ Progress card made visible in Files view');
        } else {
            logWarn('⚠️ Progress card element not found');
        }
        
        // Also ensure the container itself is visible
        this.container.style.display = 'block';
        logInfo('✅ Progress display shown');
        
        // Ensure we're on the Files view when showing progress
        if (window.switchToView) {
            window.switchToView('files');
            logInfo('✅ Switched to Files view for progress display');
        }
        
        // Force a small delay to ensure DOM updates are complete
        setTimeout(() => {
            if (this.container) {
                this.container.style.display = 'block';
            }
            if (progressCard) {
                progressCard.style.display = 'block';
            }
        }, 50);
    }

    /**
     * Hide progress display
     * WHY: Clears progress when conversion is complete
     */
    hide() {
        if (!this.container) return;
        
        this.container.style.display = 'none';
        this.isVisible = false;
        
        // Hide the progress card in the upload section
        const progressCard = document.getElementById('progressCard');
        if (progressCard) {
            progressCard.style.display = 'none';
            logInfo('✅ Progress card hidden');
        }
    }

    /**
     * Update progress value and status message
     * WHY: Provides real-time feedback with accessibility support
     * 
     * @param {number} percentage - Progress percentage (0-100)
     * @param {string} message - Status message to display
     */
    updateProgress(percentage, message) {
        // Ensure initialization if not done yet
        if (!this.isInitialized) {
            this.initialize();
        }
        
        if (!this.statusText) {
            logWarn('⚠️ Status text element not found, reinitializing...');
            this.initialize();
            if (!this.statusText) {
                logWarn('⚠️ Still cannot find status text element');
                return;
            }
        }
        
        // Update progress bar
        this.statusText.setAttribute('aria-valuenow', percentage);
        
        // Update status message with appropriate styling
        this.statusText.textContent = message;
        this.statusText.className = 'status info'; // Reset to info style
        
        // Create visual progress bar effect with background gradient
        const clampedPercentage = Math.max(0, Math.min(100, percentage));
        this.statusText.style.background = `linear-gradient(90deg, var(--accent-primary) ${clampedPercentage}%, var(--accent-light) ${clampedPercentage}%)`;
        this.statusText.style.backgroundSize = '100% 100%';
        this.statusText.style.transition = 'background 0.3s ease';
        
        // Ensure text is always readable with white color
        this.statusText.style.color = 'white';
        
        // Add completion styling if at 100%
        if (percentage >= 100) {
            this.statusText.className = 'status success';
            this.statusText.style.background = 'var(--success-bg)';
            this.statusText.style.color = 'var(--success)';
        }
        
        // Log progress for debugging
        logInfo(`📊 Progress: ${percentage}% - ${message}`);
    }

    /**
     * Display error message
     * WHY: Provides clear error feedback with appropriate styling
     * 
     * @param {string} errorMessage - Error message to display
     */
    showError(errorMessage) {
        // Ensure initialization if not done yet
        if (!this.isInitialized) {
            this.initialize();
        }
        
        if (!this.statusText) {
            logWarn('⚠️ Status text element not found, cannot show error');
            return;
        }
        
        this.statusText.textContent = errorMessage;
        this.statusText.className = 'status error';
        this.statusText.setAttribute('role', 'alert');
        
        logInfo(`❌ Error displayed: ${errorMessage}`);
    }
} 