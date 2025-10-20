/**
 * Progress Controller
 * Coordinates progress display components and accessibility announcements
 * Following AGENTS.md principle: layering DOM concerns behind focused services
 */

import { logInfo } from '../../utils/logger.js';

const noop = () => {};

/**
 * Lightweight wrapper around conversion/save progress displays
 * WHY: Centralizes DOM updates and accessibility messaging for progress state
 */
export class ProgressController {
    constructor({ conversionDisplay = null, saveDisplay = null, accessibility = null } = {}) {
        this.conversionDisplay = conversionDisplay;
        this.saveDisplay = saveDisplay;
        this.accessibility = accessibility;
        this.activeDisplay = null;
    }

    /**
     * Begin conversion progress sequence
     */
    startConversion() {
        if (this.conversionDisplay?.show) {
            this.conversionDisplay.show(false, false);
            this.activeDisplay = 'conversion';
        }
    }

    /**
     * Update conversion progress percentage and message
     */
    updateConversion(percent, message) {
        if (this.conversionDisplay?.updateProgress) {
            this.conversionDisplay.updateProgress(percent, message);
        }
        this.accessibility?.announceProgress?.(message, percent);
    }

    /**
     * Mark conversion as complete with final messaging
     */
    completeConversion(message) {
        this.updateConversion(100, message);
    }

    /**
     * Surface conversion failure details to the active display
     */
    failConversion(message) {
        this.conversionDisplay?.showError?.(message);
        this.accessibility?.announceStatus?.(message, 'error');
    }

    /**
     * Hide conversion progress display
     */
    hideConversion(delay = 0) {
        const hide = () => {
            this.conversionDisplay?.hide?.();
            if (this.activeDisplay === 'conversion') {
                this.activeDisplay = null;
            }
        };

        if (delay > 0) {
            setTimeout(hide, delay);
        } else {
            hide();
        }
    }

    /**
     * Prepare save progress UI, wiring cancellation callback
     */
    startSaveOperation(onCancel = noop) {
        if (this.saveDisplay?.setCancelCallback) {
            this.saveDisplay.setCancelCallback(onCancel);
        }
        this.saveDisplay?.show?.(true, true);
        this.activeDisplay = 'save';
    }

    /**
     * Update save progress percentage and message
     */
    updateSave(percent, message) {
        if (this.saveDisplay?.updateProgress) {
            this.saveDisplay.updateProgress(percent, message);
        }
        this.accessibility?.announceProgress?.(message, percent);
    }

    /**
     * Resolve save sequence with final status
     */
    completeSave(message) {
        if (message) {
            this.updateSave(100, message);
        }
        this.saveDisplay?.setCancelCallback?.(null);
    }

    /**
     * Present save failure details and close callbacks
     */
    failSave(message) {
        this.saveDisplay?.showError?.(message);
        this.saveDisplay?.setCancelCallback?.(null);
        this.accessibility?.announceStatus?.(message, 'error');
    }

    /**
     * Hide save progress display
     */
    hideSave(delay = 0) {
        const hide = () => {
            this.saveDisplay?.hide?.();
            if (this.activeDisplay === 'save') {
                this.activeDisplay = null;
            }
        };

        if (delay > 0) {
            setTimeout(hide, delay);
        } else {
            hide();
        }
    }

    /**
     * Forward status messages to whichever display is active
     */
    displayStatus(message, type) {
        const display = this.getActiveDisplay();
        if (display?.isVisible) {
            if (type === 'error') {
                display.showError?.(message);
            } else {
                display.updateProgress?.(100, message);
            }
        } else {
            logInfo(`${type?.toUpperCase?.() || 'INFO'}: ${message}`);
        }
        this.accessibility?.announceStatus?.(message, type);
    }

    /**
     * Determine the currently active progress display
     */
    getActiveDisplay() {
        if (this.activeDisplay === 'save') {
            return this.saveDisplay;
        }
        if (this.activeDisplay === 'conversion') {
            return this.conversionDisplay;
        }
        if (this.conversionDisplay?.isVisible) {
            return this.conversionDisplay;
        }
        if (this.saveDisplay?.isVisible) {
            return this.saveDisplay;
        }
        return null;
    }
}
