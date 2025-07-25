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
        this.progressBar = null;
        this.progressFill = null;
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
            <div class="progress-section">
                <div class="progress-text" id="statusText" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100" aria-live="polite" aria-atomic="true">
                    ${STATUS_MESSAGES.PROCESSING}
                </div>
                <div class="progress-bar" id="progressBar">
                    <div class="progress-fill" id="progressFill"></div>
                </div>
            </div>
            <button id="cancelButton" class="btn btn-secondary cancel-btn" style="display: none; margin-top: var(--space-3);">
                <svg class="icon" viewBox="0 0 24 24" style="width: 16px; height: 16px; margin-right: var(--space-2);">
                    <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                </svg>
                Cancel Save
            </button>
        `;

        this.statusText = this.container.querySelector('#statusText');
        this.progressBar = this.container.querySelector('#progressBar');
        this.progressFill = this.container.querySelector('#progressFill');
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
     * WHY: Provides user feedback and calls cancellation callback
     */
    handleCancel() {
        if (this.cancelButton) {
            this.cancelButton.disabled = true;
            this.cancelButton.innerHTML = `
                <svg class="icon" viewBox="0 0 24 24" style="width: 16px; height: 16px; margin-right: var(--space-2);">
                    <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                </svg>
                Cancelling...
            `;
        }
        
        if (this.onCancelCallback && typeof this.onCancelCallback === 'function') {
            this.onCancelCallback();
        }
    }

    /**
     * Set cancel callback function
     * WHY: Allows parent components to handle cancellation
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
     * @param {boolean} switchToFilesView - Whether to switch to Files view (default: false)
     */
    show(showCancelButton = false, switchToFilesView = false) {
        if (!this.container) {
            logWarn('Progress container not found, cannot show progress');
            return;
        }
        
        // Initialize only if not already done
        if (!this.isInitialized) {
            this.initialize();
        }
        
        // FIRST: Hide all other progress bars before showing this one
        const allProgressCards = [
            document.getElementById('progressCard'),
            document.getElementById('conversionProgressCard')
        ];
        
        allProgressCards.forEach(card => {
            if (card) {
                card.style.display = 'none';
            }
        });
        
        // Also hide all progress containers
        const allProgressContainers = [
            document.getElementById('progressContainer'),
            document.getElementById('conversionProgressContainer')
        ];
        
        allProgressContainers.forEach(container => {
            if (container) {
                container.style.display = 'none';
            }
        });
        
        // Hide the upload card when showing progress (for conversion operations)
        if (!switchToFilesView) {
            const uploadCard = document.getElementById('uploadCard');
            if (uploadCard) {
                uploadCard.style.display = 'none';
                logInfo('✅ Upload card hidden during conversion');
            }
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
        
        // Ensure the appropriate progress card is visible
        let progressCard = null;
        if (switchToFilesView) {
            // For file saving operations, show the Files view progress card
            progressCard = document.getElementById('progressCard');
            if (progressCard) {
                progressCard.style.display = 'block';
                logInfo('✅ Progress card made visible in Files view');
            } else {
                logWarn('⚠️ Progress card element not found');
            }
            
            // Ensure we're on the Files view when showing progress
            if (window.switchToView) {
                window.switchToView('files');
                logInfo('✅ Switched to Files view for progress display');
            }
        } else {
            // For conversion operations, show the Upload view progress card
            const conversionProgressCard = document.getElementById('conversionProgressCard');
            if (conversionProgressCard) {
                conversionProgressCard.style.display = 'block';
                logInfo('✅ Conversion progress card made visible in Upload view');
            } else {
                logWarn('⚠️ Conversion progress card element not found');
            }
        }
        
        logInfo('✅ Progress display shown');
        
        // Force a small delay to ensure DOM updates are complete
        setTimeout(() => {
            // Ensure the specific progress card is visible if it was set
            if (progressCard) {
                progressCard.style.display = 'block';
            }
            // Ensure the container itself is visible (this is the actual progress bar container)
            if (this.container) {
                this.container.style.display = 'block';
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
        
        // Hide both progress cards
        const progressCard = document.getElementById('progressCard');
        if (progressCard) {
            progressCard.style.display = 'none';
            logInfo('✅ Progress card hidden');
        }
        
        const conversionProgressCard = document.getElementById('conversionProgressCard');
        if (conversionProgressCard) {
            conversionProgressCard.style.display = 'none';
            logInfo('✅ Conversion progress card hidden');
        }
        
        // Show the upload card again when progress is hidden (for conversion operations)
        const uploadCard = document.getElementById('uploadCard');
        if (uploadCard) {
            uploadCard.style.display = 'block';
            logInfo('✅ Upload card shown again after conversion');
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
        
        if (!this.statusText || !this.progressBar || !this.progressFill) {
            logWarn('⚠️ Progress elements not found, reinitializing...');
            this.initialize();
            if (!this.statusText || !this.progressBar || !this.progressFill) {
                logWarn('⚠️ Still cannot find progress elements');
                return;
            }
        }
        
        // Update progress bar ARIA attributes on statusText (as expected by tests)
        this.statusText.setAttribute('aria-valuenow', percentage);
        
        // Update status message
        this.statusText.textContent = message;
        this.statusText.className = 'progress-text'; // Reset to default style
        
        // Update progress fill width
        const clampedPercentage = Math.max(0, Math.min(100, percentage));
        this.progressFill.style.width = `${clampedPercentage}%`;
        
        // Add completion styling if at 100%
        if (percentage >= 100) {
            this.statusText.className = 'progress-text success';
            this.progressFill.style.background = 'var(--success)';
        } else {
            this.progressFill.style.background = 'var(--accent-primary)';
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
        this.statusText.className = 'progress-text error';
        this.statusText.setAttribute('role', 'alert');
        
        // Reset progress bar to 0
        if (this.progressFill) {
            this.progressFill.style.width = '0%';
            this.progressFill.style.background = 'var(--accent-primary)';
        }
        
        logInfo(`❌ Error displayed: ${errorMessage}`);
    }
} 