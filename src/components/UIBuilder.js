/**
 * UI Builder Module
 * Handles creation of complex UI components and cards
 * Following AGENTS.md principle: separated concerns for maintainable UI code
 */

import { getString, ui, message, success, error, info } from '../utils/strings.js';
import { getFileSystemAccessInfo, isFileSystemAccessSupported } from '../modules/fileSystemManager.js';
import { getPreferences, setPreferences } from '../utils/helpers.js';
import { Modal } from './Modal.js';

/**
 * UI Builder class for creating complex UI components
 * WHY: Separates UI creation logic from business logic for better maintainability
 */
export class UIBuilder {
    constructor() {
        // Store references for dynamic updates
        this.saveLocalButton = null;
        this.selectedDirectoryHandle = null;
        this.privacyBanner = null;
        this.transparencyModal = null;
    }

    /**
     * Mount a persistent privacy banner at the top of the container
     * WHY: Clearly communicates client-side processing and builds trust
     */
    mountPrivacyBanner() {
        if (this.privacyBanner) return this.privacyBanner;
        // Respect dismissal (persistent) and session visibility rules
        try {
            const dismissed = typeof localStorage !== 'undefined' && localStorage.getItem('privacyBannerDismissed') === '1';
            const shownSession = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('privacyBannerShown') === '1';
            if (dismissed || shownSession) return null;
        } catch (_) {}
        const container = document.querySelector('.container');
        if (!container) return null;

        const banner = document.createElement('div');
        banner.className = 'bg-green-900/30 border border-green-700 rounded-lg p-3 mb-4 flex items-start gap-3';
        banner.setAttribute('role', 'region');
        banner.setAttribute('aria-label', 'Privacy information');
        banner.innerHTML = `
            <div class="flex-shrink-0"><i class="fas fa-shield-alt text-green-400"></i></div>
            <div class="text-green-100 text-sm">
                <strong>All processing happens in your browser.</strong> No files or data are uploaded to any server.
                <button id="privacy-transparency-btn" class="ml-2 underline text-green-200 hover:text-green-100" type="button" aria-haspopup="dialog">Learn more</button>
            </div>
            <div class="ml-auto">
                <button id="privacy-dismiss-btn" class="text-green-200 hover:text-green-100" type="button" aria-label="Dismiss privacy information" title="Dismiss">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        // Insert banner at top of main content
        const main = document.querySelector('main');
        if (main && main.parentNode) {
            main.parentNode.insertBefore(banner, main);
        } else {
            container.insertBefore(banner, container.firstChild);
        }

        // Hook up modal trigger
        const trigger = banner.querySelector('#privacy-transparency-btn');
        if (trigger) {
            trigger.addEventListener('click', () => this.showTransparencyModal());
        }
        // Hook up dismiss to persist suppression
        const dismiss = banner.querySelector('#privacy-dismiss-btn');
        if (dismiss) {
            dismiss.addEventListener('click', () => {
                try { if (typeof localStorage !== 'undefined') localStorage.setItem('privacyBannerDismissed', '1'); } catch (_) {}
                if (banner.parentNode) banner.parentNode.removeChild(banner);
            });
        }

        this.privacyBanner = banner;
        // Mark as shown for this session so it won't re-appear on reload within the same session
        try { if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('privacyBannerShown', '1'); } catch (_) {}
        return banner;
    }

    /**
     * Show a lightweight transparency modal explaining client-side behavior
     */
    showTransparencyModal() {
        // Use shared Modal component for consistent, accessible UI
        if (!this.transparencyModal) {
            this.transparencyModal = new Modal({
                title: 'Client-side Processing',
                content: `
                    <p>All conversion happens locally in your browser using JavaScript. No network requests are made to upload your data.</p>
                    <p>Optional libraries are loaded from CDNs for UI and ZIP creation. If unavailable, the app falls back gracefully.</p>
                    <p>You can inspect the source modules under <code>src/</code> to verify behavior.</p>
                `,
                buttons: [
                    { text: 'Close', action: 'cancel' }
                ]
            });
        }
        this.transparencyModal.show();
    }
    
    /**
     * Set directory handle for UI updates
     * WHY: Allows UI to reflect current directory selection state
     */
    setDirectoryHandle(directoryHandle) {
        this.selectedDirectoryHandle = directoryHandle;
    }

    /**
     * Create results summary card
     * WHY: Displays conversion statistics in a clean card format
     */
    createResultsSummaryCard(results) {
        const card = document.createElement('div');
        card.className = 'bg-gray-900 border border-gray-700 rounded-xl shadow-md p-6 mb-8';
        
        const header = document.createElement('div');
        header.className = 'mb-4';
        
        const title = document.createElement('h3');
        title.className = 'text-xl font-medium text-gray-100 flex items-center mb-2';
        title.innerHTML = `
            <i class="fas fa-check-circle mr-3 text-green-500"></i>
            ${ui('CONVERSION_SUMMARY')}
        `;
        
        const description = document.createElement('p');
        description.className = 'text-gray-300';
        description.textContent = message('CONVERSION_DESCRIPTION');
        
        header.appendChild(title);
        header.appendChild(description);
        
        const content = document.createElement('div');
        content.className = '';
        
        const stats = document.createElement('div');
        stats.className = 'flex justify-center gap-4';
        
        // Create stat items - simplified to show only the main conversion result
        const statItems = [
            { 
                label: 'Conversations Converted', 
                value: results.processed, 
                icon: 'fas fa-comments text-indigo-500'
            }
        ];
        
        // Only show errors if there were any
        if (results.errors > 0) {
            statItems.push({ 
                label: 'Errors', 
                value: results.errors, 
                icon: 'fas fa-exclamation-triangle text-red-500'
            });
        }
        if (typeof results.skipped === 'number' && results.skipped > 0) {
            statItems.push({
                label: 'Skipped',
                value: results.skipped,
                icon: 'fas fa-forward text-yellow-400'
            });
        }
        
        statItems.forEach(item => {
            const statCard = document.createElement('div');
            statCard.className = 'bg-gray-800 border border-gray-700 p-6 rounded-lg text-center min-w-[200px]';
            
            statCard.innerHTML = `
                <i class="${item.icon} text-3xl mb-3 block"></i>
                <div class="text-2xl font-bold text-gray-100 mb-2">${item.value}</div>
                <div class="text-base text-gray-300">${item.label}</div>
            `;
            
            stats.appendChild(statCard);
        });
        
        content.appendChild(stats);
        card.appendChild(header);
        card.appendChild(content);
        
        return card;
    }

    /**
     * Create directory selection card
     * WHY: Provides local save options with clear instructions in card format
     */
    createDirectoryCard(results, callbacks = {}) {
        const card = document.createElement('div');
        card.className = 'bg-gray-900 border border-gray-700 rounded-xl shadow-md p-6 mb-8';
        
        const header = document.createElement('div');
        header.className = 'mb-4';
        
        const title = document.createElement('h3');
        title.className = 'text-xl font-medium text-gray-100 flex items-center mb-2';
        title.innerHTML = `
            <i class="fas fa-folder mr-3 text-indigo-500"></i>
            ${ui('SAVE_LOCATION')}
        `;
        
        const description = document.createElement('p');
        description.className = 'text-gray-300';
        description.textContent = message('CHOOSE_SAVE_LOCATION');
        
        header.appendChild(title);
        header.appendChild(description);
        
        const content = document.createElement('div');
        content.className = '';
        
        if (isFileSystemAccessSupported()) {
            // Directory selection buttons
            const buttonGroup = document.createElement('div');
            buttonGroup.className = 'flex flex-col gap-3 mb-4';
            
            const selectBtn = this.createDirectoryButton(callbacks.onDirectorySelect);
            const saveBtn = this.createSaveButton(results, callbacks.onSave);
            
            buttonGroup.appendChild(selectBtn);
            buttonGroup.appendChild(saveBtn);
            content.appendChild(buttonGroup);
            
            // Instructions
            const instructions = this.createInstructions();
            content.appendChild(instructions);
            
        } else {
            const apiInfo = getFileSystemAccessInfo();
            const warning = this.createUnsupportedWarning();
            content.appendChild(warning);
            
            // Add prominent download button for mobile users
            if (apiInfo.mobile) {
                const downloadSection = this.createMobileDownloadSection(callbacks.onDownloadZip);
                content.appendChild(downloadSection);
            }
        }
        
        card.appendChild(header);
        card.appendChild(content);
        
        return card;
    }

    /**
     * Create directory selection button
     * WHY: Primary directory selection interface
     */
    createDirectoryButton(onDirectorySelect) {
        const btn = document.createElement('button');
        btn.className = 'bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center';
        
        if (this.selectedDirectoryHandle) {
            btn.innerHTML = `<i class="fas fa-folder-open mr-2"></i>${ui('CHANGE_DIRECTORY', { folderName: this.selectedDirectoryHandle.name })}`;
        } else {
            btn.innerHTML = `<i class="fas fa-folder mr-2"></i>${ui('CHOOSE_FOLDER')}`;
        }
        
        if (onDirectorySelect) {
            btn.onclick = onDirectorySelect;
        }
        
        return btn;
    }

    /**
     * Create save to local folder button
     * WHY: Main save action with visual feedback
     */
    createSaveButton(results, onSave) {
        const btn = document.createElement('button');
        
        if (this.selectedDirectoryHandle) {
            btn.className = 'bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center';
            btn.innerHTML = `<i class="fas fa-save mr-2"></i>${ui('SAVE_FILES_TO_FOLDER', { count: results.files.length })}`;
            btn.disabled = false;
        } else {
            btn.className = 'bg-gray-800 text-gray-500 font-medium py-3 px-6 rounded-lg cursor-not-allowed flex items-center justify-center';
            btn.innerHTML = `<i class="fas fa-save mr-2"></i>${ui('SAVE_TO_LOCAL_FOLDER')} (${info('SELECT_FOLDER_FIRST')})`;
            btn.disabled = true;
        }
        
        if (onSave) {
            btn.onclick = onSave;
        }
        
        // Store reference for updates
        this.saveLocalButton = btn;
        
        return btn;
    }

    /**
     * Create instructions element
     * WHY: Provides clear guidance for saving files
     */
    createInstructions() {
        const instructions = document.createElement('div');
        instructions.className = 'mt-3 text-sm text-gray-300 leading-normal';
        
        if (this.selectedDirectoryHandle) {
            instructions.innerHTML = `
                <div class="bg-green-900/30 border-l-4 border-green-500 p-3 rounded">
                    <div class="flex">
                        <div class="flex-shrink-0">
                            <i class="fas fa-check-circle text-green-500"></i>
                        </div>
                        <div class="ml-3">
                            <p class="text-sm text-green-300">
                                <strong>Ready to save</strong><br>
                                ${message('READY_TO_SAVE_DESCRIPTION', { folderName: this.selectedDirectoryHandle.name })}
                            </p>
                        </div>
                    </div>
                </div>
            `;
        } else {
            instructions.innerHTML = `
                <div class="bg-blue-900/30 border-l-4 border-blue-500 p-3 rounded">
                    <div class="flex">
                        <div class="flex-shrink-0">
                            <i class="fas fa-info-circle text-blue-500"></i>
                        </div>
                        <div class="ml-3">
                            <p class="text-sm text-blue-300">
                                <strong>Select your destination folder</strong><br>
                                ${message('SELECT_DESTINATION')}
                            </p>
                        </div>
                    </div>
                </div>
            `;
        }
        
        return instructions;
    }

    /**
     * Create unsupported API warning
     * WHY: Informs users when File System Access API is unavailable
     */
    createUnsupportedWarning() {
        const apiInfo = getFileSystemAccessInfo();
        const warning = document.createElement('div');
        warning.className = 'bg-yellow-900/30 border-l-4 border-yellow-500 p-4 rounded mb-4';
        
        let messageText = message('MOBILE_SAVE_INFO') + ' ';
        
        if (apiInfo.mobile) {
            if (apiInfo.ios) {
                messageText += message('IOS_SAVE_INFO');
            } else {
                messageText += message('MOBILE_DOWNLOAD_INFO');
            }
        } else {
            messageText += message('MOBILE_DOWNLOAD_INFO');
        }
        
        warning.innerHTML = `
            <div class="flex items-start space-x-3">
                <div class="flex-shrink-0">
                    <i class="fas fa-exclamation-triangle text-yellow-500 mt-1"></i>
                </div>
                <div>
                    <strong class="block mb-2 text-yellow-200">${message('MOBILE_BROWSER_DETECTED')}</strong>
                    <p class="text-yellow-200 leading-normal mb-0">${messageText}</p>
                    ${apiInfo.mobile ? `
                        <div class="mt-3 p-3 bg-blue-900/30 border border-blue-700 rounded">
                            <strong class="block mb-1 text-blue-200"><i class="fas fa-lightbulb mr-1"></i>${message('MOBILE_TIP')}</strong>
                            <p class="text-blue-200 text-sm mb-0">${message('MOBILE_TIP_DESCRIPTION')}</p>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
        
        return warning;
    }

    /**
     * Create mobile download section
     * WHY: Provides download options optimized for mobile devices
     */
    createMobileDownloadSection(onDownloadZip) {
        const downloadSection = document.createElement('div');
        downloadSection.className = 'mt-4';
        
            const downloadTitle = document.createElement('h4');
            downloadTitle.className = 'text-lg font-medium text-gray-100 mb-3 flex items-center';
        downloadTitle.innerHTML = `
            <i class="fas fa-download mr-2 text-indigo-500"></i>
            ${ui('DOWNLOAD_OPTIONS')}
        `;
        
        const downloadButton = document.createElement('button');
        downloadButton.className = 'bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-4 px-6 rounded-lg transition-colors w-full mb-3 flex items-center justify-center';
        downloadButton.innerHTML = `
            <i class="fas fa-download mr-3"></i>
            ${ui('DOWNLOAD_ALL_ZIP')}
        `;
        if (onDownloadZip) {
            downloadButton.onclick = onDownloadZip;
        }
        
        const downloadInfo = document.createElement('p');
        downloadInfo.className = 'text-sm text-gray-300 mb-3';
        downloadInfo.textContent = message('ZIP_ARCHIVE_INFO');
        
        downloadSection.appendChild(downloadTitle);
        downloadSection.appendChild(downloadInfo);
        downloadSection.appendChild(downloadButton);
        
        return downloadSection;
    }

    /**
     * Create file table row
     * WHY: Extracted method for cleaner code and better maintainability
     */
    createFileRow(file, callbacks = {}) {
        const row = document.createElement('tr');
        row.className = 'border-b border-gray-200 hover:bg-gray-50 transition-colors';
        
        // Fix date extraction - use multiple possible properties
        const dateCreated = this.getFileDate(file);
        
        // Title column with filename shown as subtitle - FIXED WIDTH to prevent layout shifts
        const titleCell = document.createElement('td');
        titleCell.className = 'px-4 py-3 text-gray-800 font-medium align-top';
        titleCell.style.width = '65%'; // Match header width
        
        const titleContainer = document.createElement('div');
        const titleSpan = document.createElement('div');
        titleSpan.textContent = file.title;
        titleSpan.style.wordBreak = 'break-word'; // Prevent overflow
        
        titleContainer.appendChild(titleSpan);
        titleCell.appendChild(titleContainer);
        
        // Date column - FIXED WIDTH to prevent layout shifts
        const dateCell = document.createElement('td');
        dateCell.className = 'px-4 py-3 text-gray-600 text-sm align-top whitespace-nowrap';
        dateCell.style.width = '20%'; // Match header width
        dateCell.textContent = dateCreated;
        
        // Actions column - FIXED WIDTH to prevent layout shifts
        const actionsCell = document.createElement('td');
        actionsCell.className = 'px-4 py-3 text-right align-top whitespace-nowrap';
        actionsCell.style.width = '15%'; // Match header width
        
        const actionsContainer = document.createElement('div');
        actionsContainer.className = 'flex gap-2 justify-end';
        
        // Always create Save button first, then Download button
        // This maintains consistent layout and allows individual file saving
        const saveBtn = document.createElement('button');
        saveBtn.className = 'bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-1 rounded text-xs flex-shrink-0 transition-colors save-file-btn';
        saveBtn.setAttribute('data-filename', file.filename);
        saveBtn.setAttribute('data-content', encodeURIComponent(file.content));
        saveBtn.setAttribute('data-title', file.title);
        saveBtn.innerHTML = `
            <svg class="icon" style="width: 16px; height: 16px;" viewBox="0 0 24 24">
                <path d="M15,9H5V5H15M12,19A3,3 0 0,1 9,16A3,3 0 0,1 12,13A3,3 0 0,1 15,16A3,3 0 0,1 12,19M17,3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V7L17,3Z"/>
            </svg>
        `;
        actionsContainer.appendChild(saveBtn);
        
        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'bg-gray-500 hover:bg-gray-600 text-white px-2 py-1 rounded text-xs flex-shrink-0 transition-colors download-file-btn';
        downloadBtn.setAttribute('data-filename', file.filename);
        downloadBtn.setAttribute('data-content', encodeURIComponent(file.content));
        downloadBtn.innerHTML = `
            <svg class="icon" style="width: 16px; height: 16px;" viewBox="0 0 24 24">
                <path d="M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z"/>
            </svg>
        `;
        
        actionsContainer.appendChild(downloadBtn);
        
        actionsCell.appendChild(actionsContainer);
        
        row.appendChild(titleCell);
        row.appendChild(dateCell);
        row.appendChild(actionsCell);
        
        return row;
    }

    /**
     * Create pagination button
     * WHY: Creates consistent pagination button styling and behavior
     */
    createPaginationButton(text, page, isActive = false, onClick) {
        const button = document.createElement('button');
        button.textContent = text;
        button.className = `btn ${isActive ? 'btn-primary' : 'btn-secondary'}`;
        button.style.padding = 'var(--space-2) var(--space-3)';
        button.style.fontSize = 'var(--font-size-sm)';
        button.style.minWidth = '40px';
        
        if (!isActive && onClick) {
            button.addEventListener('click', () => onClick(page));
        }
        
        return button;
    }

    /**
     * Create file save confirmation dialog
     * WHY: Provides clear visual confirmation when individual files are saved
     */
    createFileSaveConfirmationDialog(fileTitle, folderName, filename) {
        // Create confirmation dialog
        const dialog = document.createElement('div');
        dialog.className = 'file-save-confirmation-dialog';
        dialog.innerHTML = `
            <div class="dialog-overlay">
                <div class="dialog-content">
                    <div class="success-icon">✅</div>
                    <h3>${success('FILE_SAVED_SUCCESS')}</h3>
                    <p><strong>${fileTitle}</strong> ${message('FILE_SAVED_TO_FOLDER', { fileTitle, folderName })}</p>
                    <p class="filename">${message('FILENAME_LABEL')} <code>${filename}</code></p>
                    <div class="dialog-buttons">
                        <button class="btn btn-primary ok-btn">${ui('OK')}</button>
                    </div>
                </div>
            </div>
        `;
        
        return dialog;
    }

    /**
     * Create preferences panel
     * WHY: Allows users to control naming preset and frontmatter options
     */
    createPreferencesPanel(onChange) {
        const panel = document.createElement('div');
        panel.className = 'bg-gray-900 border border-gray-700 rounded-xl p-4 mb-6';

        const title = document.createElement('h3');
        title.className = 'text-lg font-medium text-gray-100 mb-3';
        title.textContent = 'Preferences';

        const content = document.createElement('div');
        content.className = 'grid grid-cols-1 md:grid-cols-2 gap-4';

        // Naming preset
        const presetGroup = document.createElement('div');
        presetGroup.innerHTML = `
            <label class="block text-sm text-gray-300 mb-1">Naming preset</label>
            <select id="pref-filename-preset" class="bg-gray-800 text-gray-100 rounded px-3 py-2 w-full">
                <option value="obsidian">Obsidian Mode</option>
                <option value="date">Date-based</option>
                <option value="zettel">Zettelkasten</option>
            </select>
        `;

        // Frontmatter toggle
        const fmGroup = document.createElement('div');
        fmGroup.innerHTML = `
            <label class="block text-sm text-gray-300 mb-1">Frontmatter</label>
            <div class="flex items-center gap-4 text-gray-200">
                <label class="inline-flex items-center gap-2"><input type="checkbox" id="pref-frontmatter-enabled" class="form-checkbox"> Enable</label>
                <label class="inline-flex items-center gap-2"><input type="checkbox" id="pref-frontmatter-participants" class="form-checkbox"> Participants</label>
                <label class="inline-flex items-center gap-2"><input type="checkbox" id="pref-frontmatter-source" class="form-checkbox"> Source + URL</label>
            </div>
        `;

        content.appendChild(presetGroup);
        content.appendChild(fmGroup);

        panel.appendChild(title);
        panel.appendChild(content);

        // Initialize from stored prefs
        try {
            const prefs = getPreferences();
            const presetSel = panel.querySelector('#pref-filename-preset');
            const fmEnabled = panel.querySelector('#pref-frontmatter-enabled');
            const fmParticipants = panel.querySelector('#pref-frontmatter-participants');
            const fmSource = panel.querySelector('#pref-frontmatter-source');
            if (presetSel) presetSel.value = prefs.filenamePreset || 'obsidian';
            if (fmEnabled) fmEnabled.checked = !!prefs.frontmatterEnabled;
            if (fmParticipants) fmParticipants.checked = !!prefs.includeParticipants;
            if (fmSource) fmSource.checked = !!prefs.includeSource;

            const commit = () => {
                const next = setPreferences({
                    filenamePreset: presetSel ? presetSel.value : 'obsidian',
                    frontmatterEnabled: fmEnabled ? fmEnabled.checked : true,
                    includeParticipants: fmParticipants ? fmParticipants.checked : true,
                    includeSource: fmSource ? fmSource.checked : true
                });
                if (onChange) onChange(next);
            };

            [presetSel, fmEnabled, fmParticipants, fmSource].forEach((el) => {
                if (el) el.addEventListener('change', commit);
            });
        } catch (_) {
            // no-op if helpers not available in test env
        }

        return panel;
    }

    // Theme toggle removed by request; intentionally no-op

    /**
     * Show preview modal for a file's content (first N lines)
     */
    showPreview(file, maxLines = 50) {
        const lines = (file.content || '').split('\n').slice(0, maxLines).join('\n');
        const dialog = document.createElement('div');
        dialog.className = 'file-preview-dialog';
        dialog.innerHTML = `
            <div class="dialog-overlay">
                <div class="dialog-content" style="max-width: 800px;">
                    <h3 class="mb-2">Preview — ${file.title}</h3>
                    <pre style="white-space: pre-wrap; max-height: 60vh; overflow: auto; background:#111; color:#ddd; padding:12px; border:1px solid #333;">${this.escapeHtml(lines)}</pre>
                    <div class="dialog-buttons" style="display:flex; gap:8px; justify-content:flex-end; margin-top:12px;">
                        <button class="btn btn-secondary close-btn">Close</button>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(dialog);
        const close = () => { if (dialog && dialog.parentNode) dialog.parentNode.removeChild(dialog); };
        dialog.querySelector('.close-btn')?.addEventListener('click', close);
        dialog.addEventListener('click', (e) => { if (e.target && e.target.classList.contains('dialog-overlay')) close(); });
        setTimeout(() => dialog.querySelector('.close-btn')?.focus(), 50);
    }

    escapeHtml(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    /**
     * Get properly formatted date from file object
     * WHY: Handles different date property names and formats consistently
     */
    getFileDate(file) {
        if (!file || typeof file !== 'object') {
            return 'Unknown';
        }
        
        // Try different possible date properties
        const createTime = file.createTime || file.create_time;
        
        if (createTime && !isNaN(createTime) && createTime > 0) {
            try {
                const date = new Date(createTime * 1000);
                // Check if date is valid
                if (!isNaN(date.getTime())) {
                    return date.toLocaleDateString();
                }
            } catch (error) {
                console.warn('Error formatting date:', error);
            }
        }
        
        // Fallback to createdDate if available
        if (file.createdDate && file.createdDate !== 'Unknown' && typeof file.createdDate === 'string') {
            return file.createdDate;
        }
        
        return 'Unknown';
    }

    /**
     * Update save button state based on directory selection
     * WHY: Provides visual feedback about readiness to save
     */
    updateSaveButtonState(convertedFiles) {
        if (this.saveLocalButton) {
            this.saveLocalButton.disabled = !this.selectedDirectoryHandle;
            
            if (this.selectedDirectoryHandle) {
                this.saveLocalButton.className = 'bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center';
                this.saveLocalButton.innerHTML = `<i class="fas fa-save mr-2"></i>${ui('SAVE_FILES_TO_FOLDER', { count: convertedFiles.length })}`;
                this.saveLocalButton.style.animation = 'pulse 2s infinite';
            } else {
                this.saveLocalButton.className = 'bg-gray-300 text-gray-500 font-medium py-3 px-6 rounded-lg cursor-not-allowed flex items-center justify-center';
                this.saveLocalButton.innerHTML = `<i class="fas fa-save mr-2"></i>${ui('SAVE_TO_LOCAL_FOLDER')} (${info('SELECT_FOLDER_FIRST')})`;
                this.saveLocalButton.style.animation = 'none';
            }
        }
    }
}

export default UIBuilder; 