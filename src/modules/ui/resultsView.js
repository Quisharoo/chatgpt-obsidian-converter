/**
 * Results View
 * Encapsulates rendering of conversion results, file table, and pagination controls.
 * Following AGENTS.md guidance by isolating DOM-heavy UI logic from application orchestration.
 */

import { logDebug, logInfo, logWarn } from '../../utils/logger.js';

const DEFAULT_SELECTORS = {
    resultsContainer: 'results',
    downloadList: 'downloadList',
    filesContainer: 'filesContainer',
    fileTableBody: 'fileTableBody',
    resultsInfo: 'resultsInfo',
    sortSelect: 'sortSelect',
    paginationContainer: 'paginationContainer',
    titleHeader: 'titleHeader',
    dateHeader: 'dateHeader',
    titleIndicator: '#titleHeader .sort-indicator',
    dateIndicator: '#dateHeader .sort-indicator'
};

const DEFAULT_PAGINATION = {
    filesPerPage: 10
};

export class ResultsView {
    constructor({ uiBuilder = null, selectors = {}, pagination = {}, handlers = {} } = {}) {
        this.uiBuilder = uiBuilder;
        this.selectors = { ...DEFAULT_SELECTORS, ...selectors };
        this.pagination = { ...DEFAULT_PAGINATION, ...pagination };
        this.handlers = handlers;

        this.files = [];
        this.currentPage = 1;
        this.currentSort = 'date';
        this.sortDirection = 'desc';
        this.columnSortingSetup = false;

        this._titleSortHandler = null;
        this._dateSortHandler = null;
        this._titleMouseEnterHandler = null;
        this._titleMouseLeaveHandler = null;
        this._dateMouseEnterHandler = null;
        this._dateMouseLeaveHandler = null;
    }

    /**
     * Render results summary and directory card, then populate file table.
     */
    show(results) {
        const safeResults = results || { files: [], processed: 0, errors: 0 };
        const resultsContainer = this.#getElement(this.selectors.resultsContainer);
        const downloadList = this.#getElement(this.selectors.downloadList);

        if (!resultsContainer || !downloadList) {
            logWarn('⚠️ ResultsView: required result container elements missing');
            return;
        }

        resultsContainer.classList.remove('hidden');
        downloadList.innerHTML = '';

        if (this.uiBuilder) {
            const summaryCard = this.uiBuilder.createResultsSummaryCard(safeResults);
            downloadList.appendChild(summaryCard);

            if (safeResults.files?.length) {
                const directoryCard = this.uiBuilder.createDirectoryCard(safeResults, {
                    onDirectorySelect: this.handlers.onSelectDirectory,
                    onSave: this.handlers.onSaveAll,
                    onDownloadZip: this.handlers.onDownloadZip
                });
                downloadList.appendChild(directoryCard);
            }
        }

        if (safeResults.files?.length) {
            this.setFiles(safeResults.files);
            this.#renderFilesView();
        } else {
            this.clearFiles();
        }

        try {
            window.dispatchEvent(
                new CustomEvent('converter:results-updated', {
                    detail: {
                        processed: safeResults.processed || 0,
                        errors: safeResults.errors || 0,
                        files: safeResults.files || []
                    }
                })
            );
        } catch (_) {}
    }

    /**
     * Update internal file collection and reset pagination.
     */
    setFiles(files = []) {
        this.files = Array.isArray(files) ? [...files] : [];
        this.currentPage = 1;
    }

    /**
     * Clear file view when no files remain.
     */
    clearFiles() {
        const filesContainer = this.#getElement(this.selectors.filesContainer);
        const fileTableBody = this.#getElement(this.selectors.fileTableBody);
        const resultsInfo = this.#getElement(this.selectors.resultsInfo);
        const paginationContainer = this.#getElement(this.selectors.paginationContainer);

        if (filesContainer) {
            filesContainer.classList.add('hidden');
        }
        if (fileTableBody) {
            fileTableBody.innerHTML = '';
        }
        if (resultsInfo) {
            resultsInfo.textContent = '';
        }
        if (paginationContainer) {
            paginationContainer.innerHTML = '';
        }

        try {
            window.dispatchEvent(
                new CustomEvent('converter:results-cleared')
            );
        } catch (_) {}
    }

    /**
     * Trigger a table re-render with current sort/pagination state.
     */
    refreshTable() {
        if (!this.files.length) {
            this.clearFiles();
            return;
        }
        this.#renderFilesView();
    }

    /**
     * Move to a different page and refresh table.
     */
    goToPage(pageNumber) {
        if (typeof pageNumber !== 'number') return;
        this.currentPage = pageNumber;
        this.refreshTable();
    }

    /**
     * Render the files view (table, pagination, sorting hooks).
     */
    #renderFilesView() {
        const filesContainer = this.#getElement(this.selectors.filesContainer);
        const fileTableBody = this.#getElement(this.selectors.fileTableBody);
        const resultsInfo = this.#getElement(this.selectors.resultsInfo);
        const paginationContainer = this.#getElement(this.selectors.paginationContainer);

        if (!filesContainer || !fileTableBody || !resultsInfo) {
            logWarn('⚠️ ResultsView: file table elements missing');
            return;
        }

        filesContainer.classList.remove('hidden');

        this.#setupColumnSorting();
        this.#renderFilesTable(fileTableBody, resultsInfo, paginationContainer);
    }

    #renderFilesTable(fileTableBody, resultsInfo, paginationContainer) {
        if (!this.files.length) {
            fileTableBody.innerHTML = '';
            if (resultsInfo) {
                resultsInfo.textContent = 'No files available';
            }
            if (paginationContainer) {
                paginationContainer.innerHTML = '';
            }
            return;
        }

        const sortedFiles = this.#sortFiles([...this.files]);
        const totalFiles = sortedFiles.length;
        const perPage = this.pagination.filesPerPage;
        const totalPages = Math.max(1, Math.ceil(totalFiles / perPage));

        if (this.currentPage > totalPages) {
            this.currentPage = totalPages;
        }

        const startIndex = (this.currentPage - 1) * perPage;
        const endIndex = Math.min(startIndex + perPage, totalFiles);
        const currentFiles = sortedFiles.slice(startIndex, endIndex);

        if (resultsInfo) {
            resultsInfo.textContent = `Showing ${startIndex + 1}-${endIndex} of ${totalFiles} files`;
        }

        const container = fileTableBody.closest('.card-content');
        const scrollTop = container ? container.scrollTop : 0;

        fileTableBody.innerHTML = '';
        currentFiles.forEach((file) => {
            const row = this.uiBuilder
                ? this.uiBuilder.createFileRow(file, {
                    onDownload: this.handlers.onDownloadFile,
                    onSave: this.handlers.onSaveFile
                })
                : null;
            if (row) {
                fileTableBody.appendChild(row);
            }
        });

        if (container) {
            container.scrollTop = scrollTop;
        }

        this.#updateSortIndicators();
        this.#renderPaginationControls(totalPages, paginationContainer);
        logInfo(`✅ Files table rendered: ${currentFiles.length} files on page ${this.currentPage} of ${totalPages}`);
    }

    #renderPaginationControls(totalPages, paginationContainer) {
        if (!paginationContainer) return;

        paginationContainer.innerHTML = '';
        if (totalPages <= 1) return;

        const buttons = [];

        if (this.currentPage > 1) {
            buttons.push({ text: '«', page: 1 });
            buttons.push({ text: '‹', page: this.currentPage - 1 });
        }

        const range = this.#calculatePageRange(totalPages);
        for (let page = range.start; page <= range.end; page++) {
            buttons.push({ text: page.toString(), page, active: page === this.currentPage });
        }

        if (this.currentPage < totalPages) {
            buttons.push({ text: '›', page: this.currentPage + 1 });
            buttons.push({ text: '»', page: totalPages });
        }

        buttons.forEach(({ text, page, active }) => {
            const button = this.uiBuilder
                ? this.uiBuilder.createPaginationButton(text, page, active, (targetPage) => this.goToPage(targetPage))
                : null;
            if (button) {
                paginationContainer.appendChild(button);
            }
        });
    }

    #calculatePageRange(totalPages) {
        const maxVisible = 5;
        if (totalPages <= maxVisible) {
            return { start: 1, end: totalPages };
        }

        let start = Math.max(1, this.currentPage - 2);
        let end = start + maxVisible - 1;

        if (end > totalPages) {
            end = totalPages;
            start = end - maxVisible + 1;
        }

        return { start, end };
    }

    #setupColumnSorting() {
        if (this.columnSortingSetup) return;

        const titleHeader = this.#getElement(this.selectors.titleHeader);
        const dateHeader = this.#getElement(this.selectors.dateHeader);

        if (!titleHeader && !dateHeader) {
            logWarn('⚠️ ResultsView: sort headers not found');
            return;
        }

        logDebug('🔧 Setting up column sorting...', { titleHeader: !!titleHeader, dateHeader: !!dateHeader });

        if (titleHeader) {
            this._titleSortHandler = () => this.#handleColumnSort('title');
            this._titleMouseEnterHandler = () => titleHeader.classList.add('bg-gray-100');
            this._titleMouseLeaveHandler = () => titleHeader.classList.remove('bg-gray-100');

            titleHeader.addEventListener('click', this._titleSortHandler);
            titleHeader.addEventListener('mouseenter', this._titleMouseEnterHandler);
            titleHeader.addEventListener('mouseleave', this._titleMouseLeaveHandler);
            titleHeader.style.transition = 'background-color 0.2s ease';
        }

        if (dateHeader) {
            this._dateSortHandler = () => this.#handleColumnSort('date');
            this._dateMouseEnterHandler = () => dateHeader.classList.add('bg-gray-100');
            this._dateMouseLeaveHandler = () => dateHeader.classList.remove('bg-gray-100');

            dateHeader.addEventListener('click', this._dateSortHandler);
            dateHeader.addEventListener('mouseenter', this._dateMouseEnterHandler);
            dateHeader.addEventListener('mouseleave', this._dateMouseLeaveHandler);
            dateHeader.style.transition = 'background-color 0.2s ease';
        }

        this.columnSortingSetup = true;
        this.#updateSortIndicators();
    }

    #handleColumnSort(column) {
        if (!column) return;

        logDebug(`🔄 Column sort clicked: ${column}, current: ${this.currentSort}, direction: ${this.sortDirection}`);

        const previousColumn = this.currentSort;

        if (this.currentSort === column) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
            logDebug(`↕️ Toggling sort direction for ${column}: ${this.sortDirection}`);
        } else {
            this.currentSort = column;
            this.sortDirection = 'asc';
            logDebug(`🔄 Switching to new column ${column}: ${this.sortDirection}`);
        }

        if (previousColumn !== column) {
            this.currentPage = 1;
        }

        this.refreshTable();
    }

    #sortFiles(files) {
        if (!files.length) return files;

        const direction = this.sortDirection === 'asc' ? 1 : -1;

        if (this.currentSort === 'title') {
            return files.sort((a, b) => {
                const titleA = (a.title || a.filename || '').toString();
                const titleB = (b.title || b.filename || '').toString();
                return titleA.localeCompare(titleB, undefined, { numeric: true }) * direction;
            });
        }

        // Default to date sorting
        return files.sort((a, b) => {
            const dateA = this.#getValidTimestamp(a);
            const dateB = this.#getValidTimestamp(b);
            if (dateA === dateB) return 0;
            return (dateA < dateB ? -1 : 1) * direction;
        });
    }

    #getValidTimestamp(file) {
        const timestamp = file?.createTime ?? file?.create_time ?? file?.timestamp;
        if (typeof timestamp === 'number' && Number.isFinite(timestamp) && timestamp > 0) {
            return timestamp;
        }
        return 0;
    }

    #updateSortIndicators() {
        const titleIndicator = document.querySelector(this.selectors.titleIndicator);
        const dateIndicator = document.querySelector(this.selectors.dateIndicator);

        if (!titleIndicator || !dateIndicator) {
            logWarn('⚠️ ResultsView: sort indicators not found in DOM');
            return;
        }

        titleIndicator.className = 'text-gray-400 sort-indicator';
        dateIndicator.className = 'text-gray-400 sort-indicator';

        const activeIndicator = this.currentSort === 'title' ? titleIndicator : dateIndicator;
        const inactiveIndicator = this.currentSort === 'title' ? dateIndicator : titleIndicator;

        inactiveIndicator.textContent = '';
        activeIndicator.textContent = this.sortDirection === 'asc' ? '▲' : '▼';
        activeIndicator.classList.remove('text-gray-400');
        activeIndicator.classList.add('text-indigo-600');

        logDebug(`✨ Active sort: ${this.currentSort} ${this.sortDirection === 'asc' ? '(ascending)' : '(descending)'}`);
    }

    #getElement(idOrSelector) {
        if (!idOrSelector) return null;
        if (idOrSelector.startsWith('#') || idOrSelector.includes(' ')) {
            return document.querySelector(idOrSelector);
        }
        return document.getElementById(idOrSelector);
    }
}

export default ResultsView;
