/**
 * Accessibility Module
 * Manages accessibility features including aria-live regions for status updates
 * Following AGENTS.md principle: inclusive design and web accessibility standards
 */

import { getString } from './strings.js';

/**
 * Accessibility Manager
 * WHY: Centralized accessibility features for screen readers and assistive technologies
 */
class AccessibilityManager {
    constructor() {
        this.statusRegion = null;
        this.progressRegion = null;
        this.resultsRegion = null;
        this.initialized = false;
    }

    /**
     * Initialize accessibility features
     * WHY: Sets up aria-live regions and other a11y enhancements
     */
    initialize() {
        if (this.initialized) return;

        this.createAriaLiveRegions();
        this.enhanceExistingElements();
        this.initialized = true;
        
        console.log('♿ Accessibility features initialized');
    }

    /**
     * Create aria-live regions for dynamic content announcements
     * WHY: Screen readers need live regions to announce status changes
     */
    createAriaLiveRegions() {
        // Status region for general application status
        this.statusRegion = this.createLiveRegion('accessibility-status', 'polite');
        this.statusRegion.setAttribute('aria-label', getString('ACCESSIBILITY.STATUS_REGION_LABEL'));

        // Progress region for conversion progress updates
        this.progressRegion = this.createLiveRegion('accessibility-progress', 'polite');
        this.progressRegion.setAttribute('aria-label', getString('ACCESSIBILITY.PROGRESS_REGION_LABEL'));

        // Results region for conversion results
        this.resultsRegion = this.createLiveRegion('accessibility-results', 'polite');
        this.resultsRegion.setAttribute('aria-label', getString('ACCESSIBILITY.RESULTS_REGION_LABEL'));

        // Add to document
        document.body.appendChild(this.statusRegion);
        document.body.appendChild(this.progressRegion);
        document.body.appendChild(this.resultsRegion);
    }

    /**
     * Create a single aria-live region element
     * WHY: Reusable method for creating consistent live regions
     */
    createLiveRegion(id, politeness = 'polite') {
        const region = document.createElement('div');
        region.id = id;
        region.setAttribute('aria-live', politeness);
        region.setAttribute('aria-atomic', 'true');
        region.className = 'sr-only'; // Screen reader only
        region.style.position = 'absolute';
        region.style.left = '-10000px';
        region.style.width = '1px';
        region.style.height = '1px';
        region.style.overflow = 'hidden';
        
        return region;
    }

    /**
     * Announce status message to screen readers
     * WHY: Provides audio feedback for status changes
     */
    announceStatus(message, level = 'info') {
        if (!this.statusRegion) return;

        // Clear previous message to ensure it's announced again
        this.statusRegion.textContent = '';
        
        // Add slight delay to ensure screen readers pick up the change
        setTimeout(() => {
            const prefix = this.getAnnouncementPrefix(level);
            this.statusRegion.textContent = prefix + message;
        }, 100);
    }

    /**
     * Announce progress updates to screen readers
     * WHY: Keeps users informed of long-running operations
     */
    announceProgress(message, progress = null) {
        if (!this.progressRegion) return;

        this.progressRegion.textContent = '';
        
        setTimeout(() => {
            let announcement = message;
            if (progress !== null) {
                announcement = `${Math.round(progress)}% complete. ${message}`;
            }
            this.progressRegion.textContent = announcement;
        }, 100);
    }

    /**
     * Announce conversion results to screen readers
     * WHY: Provides completion feedback and results summary
     */
    announceResults(message) {
        if (!this.resultsRegion) return;

        this.resultsRegion.textContent = '';
        
        setTimeout(() => {
            this.resultsRegion.textContent = message;
        }, 100);
    }

    /**
     * Get appropriate prefix for announcements based on message level
     * WHY: Provides context for different types of messages
     */
    getAnnouncementPrefix(level) {
        switch (level) {
            case 'error':
                return 'Error: ';
            case 'success':
                return 'Success: ';
            case 'warning':
                return 'Warning: ';
            case 'info':
            default:
                return '';
        }
    }

    /**
     * Enhance existing elements with accessibility attributes
     * WHY: Improves navigation and usability for assistive technologies
     */
    enhanceExistingElements() {
        // Enhance file table if it exists
        this.enhanceFileTable();
        
        // Enhance sort controls
        this.enhanceSortControls();
        
        // Enhance buttons and interactive elements
        this.enhanceButtons();
        
        // Enhance form controls
        this.enhanceFormControls();
    }

    /**
     * Enhance file table with accessibility attributes
     * WHY: Makes table navigation easier for screen readers
     */
    enhanceFileTable() {
        const fileTable = document.getElementById('fileTable');
        if (fileTable) {
            // Add table caption if not present
            if (!fileTable.querySelector('caption')) {
                const caption = document.createElement('caption');
                caption.className = 'sr-only';
                caption.textContent = 'Converted files list with actions';
                fileTable.insertBefore(caption, fileTable.firstChild);
            }

            // Enhance column headers with sort info
            const titleHeader = document.getElementById('titleHeader');
            const dateHeader = document.getElementById('dateHeader');
            
            if (titleHeader) {
                titleHeader.setAttribute('tabindex', '0');
                titleHeader.setAttribute('role', 'button');
                titleHeader.setAttribute('aria-label', 'Sort by title. Click to change sort order.');
            }
            
            if (dateHeader) {
                dateHeader.setAttribute('tabindex', '0');
                dateHeader.setAttribute('role', 'button');
                dateHeader.setAttribute('aria-label', 'Sort by date created. Click to change sort order.');
            }

            // Add instructions for table usage
            const tableContainer = fileTable.closest('.card-content');
            if (tableContainer && !tableContainer.querySelector('.table-instructions')) {
                const instructions = document.createElement('div');
                instructions.className = 'sr-only table-instructions';
                instructions.textContent = getString('ACCESSIBILITY.TABLE_SORT_INFO') + '. ' + getString('ACCESSIBILITY.FILE_ACTIONS_INFO');
                tableContainer.insertBefore(instructions, fileTable);
            }
        }
    }

    /**
     * Enhance sort controls with accessibility
     * WHY: Makes sorting functionality accessible to keyboard and screen reader users
     */
    enhanceSortControls() {
        // Add keyboard navigation for column headers
        document.addEventListener('keydown', (event) => {
            if (event.target.id === 'titleHeader' || event.target.id === 'dateHeader') {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    event.target.click();
                }
            }
        });
    }

    /**
     * Enhance buttons with proper accessibility attributes
     * WHY: Ensures buttons are properly labeled and accessible
     */
    enhanceButtons() {
        // Add accessible names and states to buttons that may be missing them
        const buttons = document.querySelectorAll('button');
        buttons.forEach(button => {
            // Add role if not present
            if (!button.getAttribute('role') && button.tagName.toLowerCase() === 'button') {
                // Button elements don't need explicit role="button"
            }
            
            // Ensure buttons have accessible names
            if (!button.getAttribute('aria-label') && !button.textContent.trim() && !button.querySelector('span:not(.sr-only)')) {
                console.warn('Button without accessible name found:', button);
            }
        });
    }

    /**
     * Enhance form controls with labels and descriptions
     * WHY: Associates labels and help text with form controls
     */
    enhanceFormControls() {
        // Enhance file input
        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            fileInput.setAttribute('aria-describedby', 'file-input-help');
            
            // Add help text if not present
            if (!document.getElementById('file-input-help')) {
                const helpText = document.createElement('div');
                helpText.id = 'file-input-help';
                helpText.className = 'sr-only';
                helpText.textContent = 'Upload your ChatGPT export JSON file for conversion to Markdown format.';
                fileInput.parentNode.appendChild(helpText);
            }
        }
    }

    /**
     * Update sort indicators with accessibility announcements
     * WHY: Informs screen reader users of current sort state
     */
    updateSortAnnouncement(column, direction) {
        const message = getString('UI.CURRENT_SORT', { 
            column: column === 'title' ? 'title' : 'date', 
            direction: direction === 'asc' ? 'ascending' : 'descending' 
        });
        
        this.announceStatus(message);
    }

    /**
     * Announce file operation results
     * WHY: Provides feedback for file save/download operations
     */
    announceFileOperation(operation, success, filename = '') {
        const verb = operation === 'save' ? 'saved' : 'downloaded';
        const message = success 
            ? `File ${filename} ${verb} successfully`
            : `Failed to ${operation.slice(0, -1)} file ${filename}`;
        
        this.announceStatus(message, success ? 'success' : 'error');
    }

    /**
     * Add skip link for keyboard navigation
     * WHY: Allows keyboard users to skip to main content
     */
    addSkipLink() {
        const skipLink = document.createElement('a');
        skipLink.href = '#main-content';
        skipLink.className = 'skip-link sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 focus:z-50 focus:p-4 focus:bg-indigo-600 focus:text-white focus:underline';
        skipLink.textContent = 'Skip to main content';
        
        document.body.insertBefore(skipLink, document.body.firstChild);
        
        // Ensure main content has the ID
        const mainContent = document.querySelector('main') || document.querySelector('.main-content');
        if (mainContent && !mainContent.id) {
            mainContent.id = 'main-content';
        }
    }

    /**
     * Focus management for modal dialogs
     * WHY: Traps focus within modals for keyboard accessibility
     */
    trapFocus(container) {
        const focusableElements = container.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        
        if (focusableElements.length === 0) return;
        
        const firstFocusable = focusableElements[0];
        const lastFocusable = focusableElements[focusableElements.length - 1];
        
        // Focus first element
        firstFocusable.focus();
        
        // Handle tab navigation
        container.addEventListener('keydown', (event) => {
            if (event.key === 'Tab') {
                if (event.shiftKey) {
                    // Shift + Tab
                    if (document.activeElement === firstFocusable) {
                        event.preventDefault();
                        lastFocusable.focus();
                    }
                } else {
                    // Tab
                    if (document.activeElement === lastFocusable) {
                        event.preventDefault();
                        firstFocusable.focus();
                    }
                }
            }
            
            // Close on Escape
            if (event.key === 'Escape') {
                const closeButton = container.querySelector('.ok-btn') || container.querySelector('[data-dismiss]');
                if (closeButton) {
                    closeButton.click();
                }
            }
        });
    }

    /**
     * Clean up accessibility features
     * WHY: Removes event listeners and elements when no longer needed
     */
    cleanup() {
        if (this.statusRegion) {
            document.body.removeChild(this.statusRegion);
            this.statusRegion = null;
        }
        
        if (this.progressRegion) {
            document.body.removeChild(this.progressRegion);
            this.progressRegion = null;
        }
        
        if (this.resultsRegion) {
            document.body.removeChild(this.resultsRegion);
            this.resultsRegion = null;
        }
        
        this.initialized = false;
    }
}

// Create singleton instance
const accessibilityManager = new AccessibilityManager();

// Export the instance and initialize on module load
export { accessibilityManager };
export default accessibilityManager;

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        accessibilityManager.initialize();
    });
} else {
    accessibilityManager.initialize();
} 