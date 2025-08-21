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
            <div class="mb-3">
                <div id="statusText" class="text-sm text-blue-700 mb-2 font-medium" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100" aria-live="polite" aria-atomic="true">
                    ${STATUS_MESSAGES.PROCESSING}
                </div>
                <div id="progressBar" class="progress-bar">
                    <div id="progressFill" class="progress-fill"></div>
                </div>
            </div>
            <button id="cancelButton" class="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm hidden mt-3 flex items-center transition-colors">
                <i class="fas fa-times mr-2"></i>
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
                <i class="fas fa-spinner fa-spin mr-2"></i>
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
                this.cancelButton.classList.remove('hidden');
                this.cancelButton.disabled = false;
                this.cancelButton.innerHTML = `
                    <i class="fas fa-times mr-2"></i>
                    Cancel Save
                `;
            } else {
                this.cancelButton.classList.add('hidden');
            }
        }
        
        // Ensure the appropriate progress card is visible
        let progressCard = null;
        if (switchToFilesView) {
            // For file saving operations, show the Files view progress card
            progressCard = document.getElementById('progressCard');
            if (progressCard) {
                progressCard.classList.remove('hidden');
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
                conversionProgressCard.classList.remove && conversionProgressCard.classList.remove('hidden');
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
            progressCard.classList.add && progressCard.classList.add('hidden');
            progressCard.style.display = 'none';
            logInfo('✅ Progress card hidden');
        }
        
        const conversionProgressCard = document.getElementById('conversionProgressCard');
        if (conversionProgressCard) {
            conversionProgressCard.classList.add && conversionProgressCard.classList.add('hidden');
            conversionProgressCard.style.display = 'none';
            logInfo('✅ Conversion progress card hidden');
        }

        // Show upload card again when hiding conversion progress
        const uploadCard = document.getElementById('uploadCard');
        if (uploadCard) {
            uploadCard.style.display = 'block';
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