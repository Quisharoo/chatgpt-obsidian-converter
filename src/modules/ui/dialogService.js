/**
 * Dialog Service
 * Handles user-facing confirmation dialogs.
 * Following AGENTS.md guidance by isolating DOM-heavy UI code.
 */

import { logWarn } from '../../utils/logger.js';

export class DialogService {
    /**
     * Show a confirmation dialog indicating a file was saved.
     *
     * @param {Object} params
     * @param {string} params.fileTitle - Human-friendly conversation title
     * @param {string} params.folderName - Selected folder name
     * @param {string} params.filename - Saved filename
     */
    showFileSaveConfirmation({ fileTitle, folderName, filename }) {
        const dialog = document.createElement('div');
        dialog.className = 'file-save-confirmation-dialog';
        dialog.innerHTML = `
            <div class="dialog-overlay">
                <div class="dialog-content">
                    <div class="success-icon">✅</div>
                    <h3>File Saved Successfully!</h3>
                    <p><strong>${fileTitle}</strong> has been saved to the <strong>${folderName}</strong> folder.</p>
                    <p class="filename">Filename: <code>${filename}</code></p>
                    <div class="dialog-buttons">
                        <button class="btn btn-primary ok-btn">OK</button>
                    </div>
                </div>
            </div>
        `;

        const style = document.createElement('style');
        style.textContent = `
            .file-save-confirmation-dialog .dialog-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                backdrop-filter: blur(2px);
            }
            .file-save-confirmation-dialog .dialog-content {
                background: #2a2a2a;
                border: 1px solid #444;
                border-radius: 12px;
                padding: 32px;
                max-width: 450px;
                width: 90%;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
                position: relative;
                text-align: center;
            }
            .file-save-confirmation-dialog .success-icon {
                font-size: 48px;
                margin-bottom: 16px;
                animation: bounce 0.6s ease-in-out;
            }
            .file-save-confirmation-dialog h3 {
                margin: 0 0 20px 0;
                color: #ffffff;
                font-size: 20px;
                font-weight: 600;
            }
            .file-save-confirmation-dialog p {
                margin: 0 0 16px 0;
                color: #cccccc;
                line-height: 1.6;
                font-size: 15px;
            }
            .file-save-confirmation-dialog .filename {
                background: #1a1a1a;
                border: 1px solid #333;
                border-radius: 6px;
                padding: 12px;
                margin: 16px 0;
                font-family: monospace;
                font-size: 13px;
            }
            .file-save-confirmation-dialog .filename code {
                color: #4CAF50;
                background: #1a1a1a;
                padding: 2px 6px;
                border-radius: 3px;
            }
            .file-save-confirmation-dialog .dialog-buttons {
                display: flex;
                justify-content: center;
                margin-top: 24px;
            }
            .file-save-confirmation-dialog .btn {
                padding: 12px 24px;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
                transition: all 0.2s ease;
                min-width: 80px;
            }
            .file-save-confirmation-dialog .btn-primary {
                background: #007acc;
                color: #ffffff;
            }
            .file-save-confirmation-dialog .btn-primary:hover {
                background: #0066aa;
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(0, 122, 204, 0.3);
            }
            @keyframes bounce {
                0%, 20%, 50%, 80%, 100% {
                    transform: translateY(0);
                }
                40% {
                    transform: translateY(-10px);
                }
                60% {
                    transform: translateY(-5px);
                }
            }
        `;

        document.head.appendChild(style);
        document.body.appendChild(dialog);

        const okBtn = dialog.querySelector('.ok-btn');
        const cleanup = () => {
            try {
                if (dialog.parentNode) {
                    document.body.removeChild(dialog);
                }
                if (style.parentNode) {
                    document.head.removeChild(style);
                }
            } catch (error) {
                logWarn('Error cleaning up confirmation dialog:', error);
            }
        };

        if (okBtn) {
            okBtn.addEventListener('click', cleanup);
            setTimeout(() => okBtn.focus(), 100);
        }

        const handleKeyDown = (event) => {
            if (event.key === 'Escape' || event.key === 'Enter') {
                document.removeEventListener('keydown', handleKeyDown);
                cleanup();
            }
        };
        document.addEventListener('keydown', handleKeyDown);

        setTimeout(() => {
            document.removeEventListener('keydown', handleKeyDown);
            cleanup();
        }, 5000);
    }
}

export default DialogService;
