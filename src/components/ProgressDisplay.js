/**
 * Progress Display Component
 * Accessible progress indicator with status messaging
 * Following AGENTS.md principle: semantic HTML and ARIA attributes
 */

import { STATUS_MESSAGES } from '../utils/constants.js';

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
            console.warn(`Progress container '${containerId}' not found`);
        }
    }

    /**
     * Initialize progress display elements
     * WHY: Sets up accessible DOM structure with ARIA attributes
     */
    initialize() {
        if (!this.container) return;

        this.container.innerHTML = `
            <div class="progress-bar" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">
                <div class="progress-fill" id="progressFill"></div>
            </div>
            <div class="status info" id="statusText" aria-live="polite" aria-atomic="true">
                ${STATUS_MESSAGES.PROCESSING}
            </div>
        `;

        this.progressBar = this.container.querySelector('.progress-bar');
        this.progressFill = this.container.querySelector('.progress-fill');
        this.statusText = this.container.querySelector('#statusText');
    }

    /**
     * Show progress display with accessibility announcements
     * WHY: Makes progress visible to all users including screen reader users
     */
    show() {
        if (!this.container) return;
        
        if (!this.progressBar) {
            this.initialize();
        }
        
        this.container.style.display = 'block';
        this.isVisible = true;
        
        // Announce to screen readers
        this.updateStatus(STATUS_MESSAGES.PROCESSING, 'info');
    }

    /**
     * Hide progress display
     * WHY: Clean up UI when processing complete
     */
    hide() {
        if (!this.container) return;
        
        this.container.style.display = 'none';
        this.isVisible = false;
    }

    /**
     * Update progress with accessibility support
     * WHY: Provides real-time feedback to all users
     * 
     * @param {number} percentage - Progress percentage (0-100)
     * @param {string} message - Status message
     */
    updateProgress(percentage, message) {
        if (!this.isVisible || !this.progressFill || !this.progressBar) return;

        // Clamp percentage to valid range
        const clampedPercent = Math.min(100, Math.max(0, percentage));
        
        // Update visual progress
        this.progressFill.style.width = `${clampedPercent}%`;
        
        // Update ARIA attributes for screen readers
        this.progressBar.setAttribute('aria-valuenow', clampedPercent);
        this.progressBar.setAttribute('aria-valuetext', `${clampedPercent}% complete`);
        
        // Update status message
        if (message) {
            this.updateStatus(message, 'info');
        }
    }

    /**
     * Update status message with appropriate styling
     * WHY: Provides contextual feedback with visual and semantic meaning
     * 
     * @param {string} message - Status message to display
     * @param {string} type - Message type: 'info', 'success', 'error'
     */
    updateStatus(message, type = 'info') {
        if (!this.statusText) return;

        this.statusText.textContent = message;
        this.statusText.className = `status ${type}`;
        
        // Update ARIA role based on message type
        switch (type) {
            case 'error':
                this.statusText.setAttribute('role', 'alert');
                break;
            case 'success':
                this.statusText.setAttribute('role', 'status');
                break;
            default:
                this.statusText.setAttribute('role', 'status');
        }
    }

    /**
     * Complete progress with success message
     * WHY: Provides clear completion feedback
     */
    complete() {
        this.updateProgress(100, STATUS_MESSAGES.COMPLETE);
        this.updateStatus(STATUS_MESSAGES.COMPLETE, 'success');
    }

    /**
     * Show error state
     * WHY: Provides clear error feedback with accessibility support
     * 
     * @param {string} errorMessage - Error message to display
     */
    showError(errorMessage) {
        this.updateStatus(errorMessage, 'error');
    }
} 