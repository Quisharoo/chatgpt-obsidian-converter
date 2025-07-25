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
        this.progressBar = null;
        this.statusText = null;
        this.isVisible = false;
        
        if (!this.container) {
            logWarn(`Progress container '${containerId}' not found`);
        }
    }

    /**
     * Initialize progress display elements
     * WHY: Sets up accessible DOM structure with ARIA attributes for dark theme
     */
    initialize() {
        if (!this.container) return;

        this.container.innerHTML = `
            <div class="progress-bar" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">
                <div class="progress-fill" id="progressFill"></div>
            </div>
            <div style="margin-top: 12px;"></div>
            <div class="status info" id="statusText" aria-live="polite" aria-atomic="true">
                ${STATUS_MESSAGES.PROCESSING}
            </div>
        `;

        this.progressBar = this.container.querySelector('.progress-bar');
        this.progressFill = this.container.querySelector('.progress-fill');
        this.statusText = this.container.querySelector('#statusText');
    }

    /**
     * Show progress display
     * WHY: Makes progress visible to user with proper styling
     */
    show() {
        if (!this.container) {
            logWarn('Progress container not found, cannot show progress');
            return;
        }
        
        this.initialize();
        this.container.style.display = 'block';
        this.isVisible = true;
        
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
        if (!this.progressFill || !this.statusText) {
            logWarn('⚠️ Progress elements not initialized, reinitializing...');
            this.initialize();
            if (!this.progressFill || !this.statusText) {
                logWarn('⚠️ Still cannot find progress elements');
                return;
            }
        }
        
        // Update progress bar
        this.progressFill.style.width = `${Math.max(0, Math.min(100, percentage))}%`;
        this.progressBar.setAttribute('aria-valuenow', percentage);
        
        // Update status message with appropriate styling
        this.statusText.textContent = message;
        this.statusText.className = 'status info'; // Reset to info style
        
        // Add completion styling if at 100%
        if (percentage >= 100) {
            this.statusText.className = 'status success';
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