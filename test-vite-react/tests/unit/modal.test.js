/**
 * Modal Component Tests
 * Tests for the reusable modal dialog component
 * Following AGENTS.md principle: comprehensive testing for all components
 */

import { Modal, showConfirmModal } from '../../../src/components/Modal.js';

describe('Modal Component', () => {
    let modal;
    
    beforeEach(() => {
        // Clean up any existing modals
        const existingModals = document.querySelectorAll('.custom-modal');
        existingModals.forEach(modal => modal.remove());
        
        // Clean up any existing styles
        const existingStyles = document.getElementById('customModalStyles');
        if (existingStyles) {
            existingStyles.remove();
        }
    });
    
    afterEach(() => {
        if (modal) {
            modal.destroy();
            modal = null;
        }
    });

    describe('Modal Constructor', () => {
        test('should create modal with default options', () => {
            modal = new Modal();
            
            expect(modal.id).toMatch(/^modal-\d+$/);
            expect(modal.title).toBe('');
            expect(modal.content).toBe('');
            expect(modal.allowEscape).toBe(true);
            expect(modal.allowClickOutside).toBe(true);
            expect(modal.autoFocus).toBe(true);
        });

        test('should create modal with custom options', () => {
            modal = new Modal({
                id: 'test-modal',
                title: 'Test Title',
                content: 'Test Content',
                allowEscape: false,
                allowClickOutside: false,
                autoFocus: false
            });
            
            expect(modal.id).toBe('test-modal');
            expect(modal.title).toBe('Test Title');
            expect(modal.content).toBe('Test Content');
            expect(modal.allowEscape).toBe(false);
            expect(modal.allowClickOutside).toBe(false);
            expect(modal.autoFocus).toBe(false);
        });
    });

    describe('Modal Initialization', () => {
        test('should initialize modal structure', () => {
            modal = new Modal({
                title: 'Test Modal',
                content: '<p>Test content</p>'
            });
            
            modal.initialize();
            
            expect(modal.isInitialized).toBe(true);
            expect(modal.element).toBeTruthy();
            expect(modal.element.classList.contains('custom-modal')).toBe(true);
            expect(modal.element.getAttribute('role')).toBe('dialog');
            expect(modal.element.getAttribute('aria-modal')).toBe('true');
        });

        test('should add modal styles to document', () => {
            modal = new Modal();
            modal.initialize();
            
            const styles = document.getElementById('customModalStyles');
            expect(styles).toBeTruthy();
            expect(styles.textContent).toContain('.custom-modal');
        });

        test('should not reinitialize if already initialized', () => {
            modal = new Modal();
            modal.initialize();
            
            const initialElement = modal.element;
            modal.initialize();
            
            expect(modal.element).toBe(initialElement);
        });
    });

    describe('Modal Display', () => {
        test('should show modal', (done) => {
            modal = new Modal({
                title: 'Test Modal',
                content: '<p>Test content</p>'
            });
            
            modal.show();
            
            // Wait for animation to complete
            setTimeout(() => {
                expect(modal.isVisible).toBe(true);
                expect(modal.element.classList.contains('show')).toBe(true);
                expect(document.body.contains(modal.element)).toBe(true);
                done();
            }, 100);
        });

        test('should close modal', () => {
            modal = new Modal({
                title: 'Test Modal',
                content: '<p>Test content</p>'
            });
            
            modal.show();
            modal.close();
            
            expect(modal.isVisible).toBe(false);
            expect(modal.element.classList.contains('show')).toBe(false);
        });

        test('should call onClose callback when closed', (done) => {
            const onCloseMock = jest.fn();
            modal = new Modal({
                title: 'Test Modal',
                content: '<p>Test content</p>',
                onClose: onCloseMock
            });
            
            modal.show();
            
            // Wait for modal to be visible, then close
            setTimeout(() => {
                modal.close();
                
                // Wait for close animation and callback
                setTimeout(() => {
                    expect(onCloseMock).toHaveBeenCalled();
                    done();
                }, 400);
            }, 100);
        });
    });

    describe('Modal Icon', () => {
        test('should render modal with correct icon', () => {
            modal = new Modal({
                title: 'Test Modal',
                content: '<p>Test content</p>'
            });
            
            modal.initialize();
            
            const icon = modal.element.querySelector('.modal-icon');
            expect(icon).toBeTruthy();
            expect(icon.innerHTML).toContain('M12,2A10,10');
        });
    });

    describe('Modal Buttons', () => {
        test('should render custom buttons', () => {
            modal = new Modal({
                title: 'Test Modal',
                content: '<p>Test content</p>',
                buttons: [
                    {
                        text: 'Cancel',
                        action: 'cancel',
                        class: 'btn-secondary'
                    },
                    {
                        text: 'Confirm',
                        action: 'confirm',
                        primary: true
                    }
                ]
            });
            
            modal.initialize();
            
            const buttons = modal.element.querySelectorAll('.modal-footer .btn');
            expect(buttons).toHaveLength(2);
            expect(buttons[0].textContent.trim()).toBe('Cancel');
            expect(buttons[1].textContent.trim()).toBe('Confirm');
        });

        test('should handle button clicks', () => {
            const onConfirmMock = jest.fn();
            modal = new Modal({
                title: 'Test Modal',
                content: '<p>Test content</p>',
                buttons: [
                    {
                        text: 'Confirm',
                        action: 'confirm',
                        primary: true
                    }
                ],
                onConfirm: onConfirmMock
            });
            
            modal.initialize();
            modal.show();
            
            const confirmButton = modal.element.querySelector('[data-action="confirm"]');
            confirmButton.click();
            
            expect(onConfirmMock).toHaveBeenCalled();
        });
    });

    describe('Modal Accessibility', () => {
        test('should have proper ARIA attributes', () => {
            modal = new Modal({
                title: 'Test Modal',
                content: '<p>Test content</p>'
            });
            
            modal.initialize();
            
            expect(modal.element.getAttribute('role')).toBe('dialog');
            expect(modal.element.getAttribute('aria-modal')).toBe('true');
            expect(modal.element.getAttribute('aria-labelledby')).toBe(`${modal.id}-title`);
            expect(modal.element.getAttribute('aria-describedby')).toBe(`${modal.id}-content`);
        });

        test('should have proper title and content IDs', () => {
            modal = new Modal({
                title: 'Test Modal',
                content: '<p>Test content</p>'
            });
            
            modal.initialize();
            
            const title = modal.element.querySelector(`#${modal.id}-title`);
            const content = modal.element.querySelector(`#${modal.id}-content`);
            
            expect(title).toBeTruthy();
            expect(content).toBeTruthy();
            expect(title.textContent).toBe('Test Modal');
            expect(content.innerHTML.trim()).toBe('<p>Test content</p>');
        });
    });

    describe('Convenience Functions', () => {
        test('should show confirm modal and resolve correctly', async () => {
            const promise = showConfirmModal('Confirm Title', 'Confirm message');
            
            // Wait for modal to be created
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const modalElement = document.querySelector('.custom-modal');
            expect(modalElement).toBeTruthy();
            
            // Click confirm button
            const confirmButton = modalElement.querySelector('[data-action="confirm"]');
            confirmButton.click();
            
            const result = await promise;
            expect(result).toBe(true);
        });
    });

    describe('Modal Cleanup', () => {
        test('should clean up resources on destroy', () => {
            modal = new Modal({
                title: 'Test Modal',
                content: '<p>Test content</p>'
            });
            
            modal.initialize();
            modal.show();
            modal.destroy();
            
            expect(modal.isInitialized).toBe(false);
            expect(modal.isVisible).toBe(false);
            expect(document.body.contains(modal.element)).toBe(false);
        });
    });
}); 