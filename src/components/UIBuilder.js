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
            const params = new URLSearchParams((typeof location !== 'undefined' && location.search) || '');
            const forceShow = params.get('privacy') === '1';
            const dismissed = typeof localStorage !== 'undefined' && localStorage.getItem('privacyBannerDismissed') === '1';
            const shownSession = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('privacyBannerShown') === '1';
            if (!forceShow && (dismissed || shownSession)) {
                // When suppressed, still provide a quick access link to the modal
                this.mountPrivacyQuickLink();
                return null;
            }
        } catch (_) {}
        const container = document.querySelector('.container');
        if (!container) return null;

        const banner = document.createElement('div');
        // Neutral dark theme card with subtle accent, avoid saturated greens
        banner.className = 'bg-gray-900/40 border border-gray-700 rounded-lg p-3 mb-4 flex items-start gap-3';
        banner.setAttribute('role', 'region');
        banner.setAttribute('aria-label', 'Privacy information');
        banner.innerHTML = `
            <div class="flex-shrink-0"><i class="fas fa-shield-alt text-indigo-400"></i></div>
            <div class="text-gray-200 text-sm">
                <strong>All processing happens in your browser.</strong> No files or data are uploaded to any server.
                <button id="privacy-transparency-btn" class="ml-2 underline text-indigo-300 hover:text-indigo-200" type="button" aria-haspopup="dialog">Learn more</button>
            </div>
            <div class="ml-auto">
                <button id="privacy-dismiss-btn" class="text-gray-300 hover:text-gray-100" type="button" aria-label="Dismiss privacy information" title="Dismiss">
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
     * Mount a subtle, always-available privacy link when banner is suppressed
     */
    mountPrivacyQuickLink() {
        if (document.getElementById('privacyQuickLink')) return;
        const container = document.querySelector('.container');
        if (!container) return;
        // Ensure container can host absolutely positioned children without layout shift
        if (!container.style.position) {
            container.style.position = 'relative';
        }
        const link = document.createElement('button');
        link.id = 'privacyQuickLink';
        link.type = 'button';
        link.className = 'text-indigo-300 hover:text-indigo-200 underline text-xs absolute top-2 right-3';
        link.setAttribute('aria-haspopup', 'dialog');
        link.textContent = 'Privacy';
        link.addEventListener('click', () => this.showTransparencyModal());
        container.appendChild(link);
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
     * Expose helper to open privacy modal programmatically
     */
    exposePrivacyHelper() {
        try {
            window.openPrivacyInfo = () => this.showTransparencyModal();
        } catch (_) {}
    }
    
    /**
     * Set directory handle for UI updates
     * WHY: Allows UI to reflect current directory selection state
     */
    setDirectoryHandle(directoryHandle) {
        this.selectedDirectoryHandle = directoryHandle;
        try {
            window.dispatchEvent(
                new CustomEvent('converter:directory-changed', {
                    detail: {
                        name: directoryHandle?.name || null
                    }
                })
            );
        } catch (_) {}
    }

    /**
     * Create results summary card
     * WHY: Displays conversion statistics in a clean card format
     */
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
        if (callbacks.onSave) {
            saveBtn.addEventListener('click', (event) => {
                event.preventDefault();
                callbacks.onSave(file);
            });
        }
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
        if (callbacks.onDownload) {
            downloadBtn.addEventListener('click', (event) => {
                event.preventDefault();
                callbacks.onDownload(file);
            });
        }

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
