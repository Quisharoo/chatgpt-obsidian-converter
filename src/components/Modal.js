/**
 * Modal Component
 * Simple confirmation modal to replace system dialogs
 * Following AGENTS.md principle: clean separation of concerns and accessibility
 */

import { logInfo, logWarn } from '../utils/logger.js';

/**
 * Modal Component Class
 * WHY: Encapsulates modal dialog logic with full accessibility support
 */
export class Modal {
    constructor(options = {}) {
        this.id = options.id || `modal-${Date.now()}`;
        this.title = options.title || '';
        this.content = options.content || '';
        this.buttons = options.buttons || [];
        this.onClose = options.onClose || null;
        this.onConfirm = options.onConfirm || null;
        this.allowEscape = options.allowEscape !== false; // Default true
        this.allowClickOutside = options.allowClickOutside !== false; // Default true
        this.autoFocus = options.autoFocus !== false; // Default true
        
        this.element = null;
        this.overlay = null;
        this.contentElement = null;
        this.isVisible = false;
        this.isInitialized = false;
    }

    /**
     * Create modal DOM structure
     * WHY: Builds accessible modal with proper ARIA attributes
     */
    createModalElement() {
        const modal = document.createElement('div');
        modal.className = 'custom-modal';
        modal.id = this.id;
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', `${this.id}-title`);
        modal.setAttribute('aria-describedby', `${this.id}-content`);
        
        // Simple confirmation icon
        const icon = `<svg class="modal-icon" viewBox="0 0 24 24">
            <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M10,17L5,12L6.41,10.59L10,14.17L17.59,6.58L19,8L10,17Z"/>
        </svg>`;
        
        modal.innerHTML = `
            <div class="modal-overlay">
                <div class="modal-container">
                    <div class="modal-header">
                        <div class="modal-title-section">
                            ${icon}
                            <h2 class="modal-title" id="${this.id}-title">${this.title}</h2>
                        </div>
                        <button class="modal-close-btn" aria-label="Close dialog">
                            <svg viewBox="0 0 24 24">
                                <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                            </svg>
                        </button>
                    </div>
                    <div class="modal-content" id="${this.id}-content">
                        ${this.content}
                    </div>
                    <div class="modal-footer">
                        ${this.buttons.map((button, index) => `
                            <button class="btn ${button.class || 'btn-secondary'}" 
                                    data-action="${button.action || 'close'}"
                                    ${button.primary ? 'data-primary="true"' : ''}>
                                ${button.icon ? `<svg class="icon" viewBox="0 0 24 24">${button.icon}</svg>` : ''}
                                ${button.text}
                            </button>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
        
        return modal;
    }

    /**
     * Add modal styles to document
     * WHY: Ensures consistent styling across all modals
     */
    addModalStyles() {
        if (document.getElementById('customModalStyles')) return;
        
        const style = document.createElement('style');
        style.id = 'customModalStyles';
        style.textContent = `
            .custom-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 100000;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                visibility: hidden;
                transition: all 0.3s ease;
            }
            
            .custom-modal.show {
                opacity: 1;
                visibility: visible;
            }
            
            .custom-modal .modal-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                backdrop-filter: blur(3px);
                display: flex;
                align-items: center;
                justify-content: center;
                padding: var(--space-4);
            }
            
            .custom-modal .modal-container {
                background: var(--bg-card);
                border: 1px solid var(--border-primary);
                border-radius: var(--radius-lg);
                box-shadow: var(--shadow-lg);
                max-width: 500px;
                width: 100%;
                max-height: 80vh;
                overflow: hidden;
                transform: scale(0.9) translateY(-20px);
                transition: transform 0.3s ease;
                animation: modalSlideIn 0.3s ease-out;
            }
            
            .custom-modal.show .modal-container {
                transform: scale(1) translateY(0);
            }
            
            @keyframes modalSlideIn {
                from {
                    opacity: 0;
                    transform: scale(0.9) translateY(-20px);
                }
                to {
                    opacity: 1;
                    transform: scale(1) translateY(0);
                }
            }
            
            .custom-modal .modal-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: var(--space-5) var(--space-6);
                border-bottom: 1px solid var(--border-primary);
            }
            
            .custom-modal .modal-title-section {
                display: flex;
                align-items: center;
                gap: var(--space-3);
            }
            
            .custom-modal .modal-icon {
                width: 24px;
                height: 24px;
                flex-shrink: 0;
                color: var(--accent-primary);
            }
            

            
            .custom-modal .modal-title {
                font-size: var(--font-size-lg);
                font-weight: var(--font-weight-semibold);
                color: var(--text-primary);
                margin: 0;
            }
            
            .custom-modal .modal-close-btn {
                background: transparent;
                border: none;
                color: var(--text-secondary);
                cursor: pointer;
                padding: var(--space-2);
                border-radius: var(--radius-sm);
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .custom-modal .modal-close-btn:hover {
                background: var(--bg-tertiary);
                color: var(--text-primary);
            }
            
            .custom-modal .modal-close-btn svg {
                width: 20px;
                height: 20px;
            }
            
            .custom-modal .modal-content {
                padding: var(--space-6);
                color: var(--text-primary);
                line-height: var(--line-height-normal);
                overflow-y: auto;
                max-height: 60vh;
            }
            
            .custom-modal .modal-content p {
                margin: 0 0 var(--space-3) 0;
            }
            
            .custom-modal .modal-content p:last-child {
                margin-bottom: 0;
            }
            
            .custom-modal .modal-footer {
                display: flex;
                gap: var(--space-3);
                justify-content: flex-end;
                padding: var(--space-5) var(--space-6);
                border-top: 1px solid var(--border-primary);
                background: var(--bg-secondary);
            }
            
            .custom-modal .modal-footer .btn {
                min-width: 80px;
                justify-content: center;
            }
            
            .custom-modal .modal-footer .btn[data-primary="true"] {
                order: -1;
            }
            
            /* Responsive design */
            @media (max-width: 768px) {
                .custom-modal .modal-overlay {
                    padding: var(--space-3);
                }
                
                .custom-modal .modal-container {
                    max-width: none;
                    margin: var(--space-2);
                }
                
                .custom-modal .modal-header,
                .custom-modal .modal-content,
                .custom-modal .modal-footer {
                    padding: var(--space-4);
                }
                
                .custom-modal .modal-footer {
                    flex-direction: column;
                }
                
                .custom-modal .modal-footer .btn {
                    width: 100%;
                }
            }
            
            /* Reduced motion support */
            @media (prefers-reduced-motion: reduce) {
                .custom-modal,
                .custom-modal .modal-container {
                    transition: none;
                    animation: none;
                }
            }
        `;
        
        document.head.appendChild(style);
    }

    /**
     * Initialize modal
     * WHY: Sets up modal structure and event listeners
     */
    initialize() {
        if (this.isInitialized) return;
        
        this.addModalStyles();
        this.element = this.createModalElement();
        this.overlay = this.element.querySelector('.modal-overlay');
        this.contentElement = this.element.querySelector('.modal-content');
        
        this.attachEventListeners();
        this.isInitialized = true;
        
        logInfo(`✅ Modal '${this.id}' initialized`);
    }

    /**
     * Attach event listeners
     * WHY: Handles user interactions and accessibility
     */
    attachEventListeners() {
        // Close button
        const closeBtn = this.element.querySelector('.modal-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close());
        }
        
        // Overlay click
        if (this.allowClickOutside && this.overlay) {
            this.overlay.addEventListener('click', (e) => {
                if (e.target === this.overlay) {
                    this.close();
                }
            });
        }
        
        // Escape key
        if (this.allowEscape) {
            const handleKeyDown = (e) => {
                if (e.key === 'Escape' && this.isVisible) {
                    e.preventDefault();
                    this.close();
                }
            };
            document.addEventListener('keydown', handleKeyDown);
            
            // Store reference for cleanup
            this._keyDownHandler = handleKeyDown;
        }
        
        // Button clicks
        const buttons = this.element.querySelectorAll('.modal-footer .btn');
        buttons.forEach(button => {
            button.addEventListener('click', (e) => {
                const action = button.dataset.action;
                this.handleButtonClick(action, e);
            });
        });
    }

    /**
     * Handle button click
     * WHY: Processes user actions and calls appropriate callbacks
     * 
     * @param {string} action - Button action
     * @param {Event} event - Click event
     */
    handleButtonClick(action, event) {
        event.preventDefault();
        
        switch (action) {
            case 'confirm':
                if (this.onConfirm && typeof this.onConfirm === 'function') {
                    this.onConfirm();
                }
                this.close();
                break;
            case 'cancel':
                this.close();
                break;
            default:
                this.close();
                break;
        }
    }

    /**
     * Show modal
     * WHY: Displays modal with proper focus management
     */
    show() {
        if (!this.isInitialized) {
            this.initialize();
        }
        
        // Add to document
        document.body.appendChild(this.element);
        
        // Show modal
        requestAnimationFrame(() => {
            this.element.classList.add('show');
            this.isVisible = true;
            
            // Focus management
            if (this.autoFocus) {
                const primaryButton = this.element.querySelector('.btn[data-primary="true"]');
                const firstButton = this.element.querySelector('.modal-footer .btn');
                const focusTarget = primaryButton || firstButton;
                
                if (focusTarget) {
                    setTimeout(() => focusTarget.focus(), 100);
                }
            }
            
            // Trap focus within modal
            this.trapFocus();
        });
        
        logInfo(`✅ Modal '${this.id}' shown`);
    }

    /**
     * Close modal
     * WHY: Hides modal and cleans up resources
     */
    close() {
        if (!this.isVisible) return;
        
        this.element.classList.remove('show');
        this.isVisible = false;
        
        // Remove from document after animation
        setTimeout(() => {
            if (this.element.parentNode) {
                this.element.parentNode.removeChild(this.element);
            }
            
            // Restore focus to previous element
            if (this._previousFocusElement) {
                this._previousFocusElement.focus();
            }
            
            // Call onClose callback
            if (this.onClose && typeof this.onClose === 'function') {
                this.onClose();
            }
        }, 300);
        
        logInfo(`✅ Modal '${this.id}' closed`);
    }

    /**
     * Trap focus within modal
     * WHY: Ensures keyboard navigation stays within modal
     */
    trapFocus() {
        const focusableElements = this.element.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        
        if (focusableElements.length === 0) return;
        
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        
        // Store current focus for restoration
        this._previousFocusElement = document.activeElement;
        
        const handleTabKey = (e) => {
            if (e.key === 'Tab') {
                if (e.shiftKey) {
                    if (document.activeElement === firstElement) {
                        e.preventDefault();
                        lastElement.focus();
                    }
                } else {
                    if (document.activeElement === lastElement) {
                        e.preventDefault();
                        firstElement.focus();
                    }
                }
            }
        };
        
        this.element.addEventListener('keydown', handleTabKey);
        this._tabKeyHandler = handleTabKey;
    }

    /**
     * Update modal content
     * WHY: Allows dynamic content updates
     * 
     * @param {string} content - New content HTML
     */
    updateContent(content) {
        this.content = content;
        if (this.contentElement) {
            this.contentElement.innerHTML = content;
        }
    }

    /**
     * Clean up modal resources
     * WHY: Prevents memory leaks
     */
    destroy() {
        if (this._keyDownHandler) {
            document.removeEventListener('keydown', this._keyDownHandler);
        }
        if (this._tabKeyHandler) {
            this.element.removeEventListener('keydown', this._tabKeyHandler);
        }
        
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        
        this.isInitialized = false;
        this.isVisible = false;
        
        logInfo(`✅ Modal '${this.id}' destroyed`);
    }
}

/**
 * Show confirmation modal
 * WHY: Provides easy way to get user confirmation
 * 
 * @param {string} title - Modal title
 * @param {string} message - Modal message
 * @param {Object} options - Additional options
 * @returns {Promise<boolean>} - Resolves to true if confirmed, false if cancelled
 */
export function showConfirmModal(title, message, options = {}) {
    return new Promise((resolve) => {
        const modal = new Modal({
            title,
            content: `<p>${message}</p>`,
            buttons: [
                {
                    text: options.cancelText || 'Cancel',
                    action: 'cancel',
                    class: 'btn-secondary'
                },
                {
                    text: options.confirmText || 'Confirm',
                    action: 'confirm',
                    primary: true
                }
            ],
            onConfirm: () => resolve(true),
            onClose: () => resolve(false)
        });
        
        modal.show();
    });
} 