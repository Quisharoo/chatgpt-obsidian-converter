import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import { ResultsView } from '../../../src/modules/ui/resultsView.js';

const createStubUiBuilder = () => ({
    createResultsSummaryCard: jest.fn(() => document.createElement('div')),
    createDirectoryCard: jest.fn(() => document.createElement('div')),
    createFileRow: jest.fn((file, callbacks = {}) => {
        const row = document.createElement('tr');
        row.dataset.title = file.title;
        row.dataset.filename = file.filename;
        row.textContent = file.title;
        if (callbacks.onDownload) {
            const downloadBtn = document.createElement('button');
            downloadBtn.className = 'download-file-btn';
            downloadBtn.addEventListener('click', () => callbacks.onDownload(file));
            row.appendChild(downloadBtn);
        }
        if (callbacks.onSave) {
            const saveBtn = document.createElement('button');
            saveBtn.className = 'save-file-btn';
            saveBtn.addEventListener('click', () => callbacks.onSave(file));
            row.appendChild(saveBtn);
        }
        return row;
    }),
    createPaginationButton: jest.fn((text, page, isActive, onClick) => {
        const button = document.createElement('button');
        button.textContent = text;
        button.dataset.page = page;
        button.disabled = !!isActive;
        if (onClick) {
            button.addEventListener('click', () => onClick(page));
        }
        return button;
    })
});

describe('ResultsView', () => {
    let uiBuilder;
    let view;
    const handlers = {
        onSelectDirectory: jest.fn(),
        onSaveAll: jest.fn(),
        onDownloadZip: jest.fn(),
        onDownloadFile: jest.fn(),
        onSaveFile: jest.fn()
    };

    beforeEach(() => {
        document.body.innerHTML = `
            <div id="results" class="hidden"></div>
            <div id="downloadList"></div>
            <div id="filesContainer" class="hidden">
                <div class="card-content">
                    <table>
                        <tbody id="fileTableBody"></tbody>
                    </table>
                </div>
            </div>
            <div id="resultsInfo"></div>
            <div id="paginationContainer"></div>
            <table>
                <thead>
                    <tr>
                        <th id="titleHeader">Title <span class="sort-indicator"></span></th>
                        <th id="dateHeader">Date <span class="sort-indicator"></span></th>
                    </tr>
                </thead>
            </table>
        `;

        uiBuilder = createStubUiBuilder();
        view = new ResultsView({ uiBuilder, handlers });
    });

    test('show renders summary and directory cards', () => {
        view.show({ processed: 2, errors: 0, files: [{ title: 'A', filename: 'a.md' }] });

        const resultsContainer = document.getElementById('results');
        const downloadList = document.getElementById('downloadList');

        expect(resultsContainer.classList.contains('hidden')).toBe(false);
        expect(downloadList.children.length).toBe(2);
        expect(uiBuilder.createResultsSummaryCard).toHaveBeenCalled();
        expect(uiBuilder.createDirectoryCard).toHaveBeenCalled();
    });

    test('refreshTable sorts files by title ascending', () => {
        const files = [
            { title: 'Chat 10', filename: 'chat10.md', createTime: 2 },
            { title: 'Chat 2', filename: 'chat2.md', createTime: 3 },
            { title: 'Chat 1', filename: 'chat1.md', createTime: 1 }
        ];

        view.show({ files, processed: 3, errors: 0 });
        view.columnSortingSetup = true; // skip attaching listeners in tests
        view.currentSort = 'title';
        view.sortDirection = 'asc';
        view.refreshTable();

        const titles = Array.from(document.getElementById('fileTableBody').children).map((row) => row.dataset.title);
        expect(titles).toEqual(['Chat 1', 'Chat 2', 'Chat 10']);
    });

    test('refreshTable sorts by date descending by default', () => {
        const files = [
            { title: 'Oldest', filename: 'old.md', createTime: 1 },
            { title: 'Newest', filename: 'new.md', createTime: 100 },
            { title: 'Middle', filename: 'mid.md', createTime: 50 }
        ];

        view.show({ files, processed: 3, errors: 0 });
        view.columnSortingSetup = true;
        view.refreshTable();

        const titles = Array.from(document.getElementById('fileTableBody').children).map((row) => row.dataset.title);
        expect(titles).toEqual(['Newest', 'Middle', 'Oldest']);
    });

    test('refreshTable updates pagination controls', () => {
        const files = Array.from({ length: 12 }, (_, index) => ({
            title: `File ${index + 1}`,
            filename: `file-${index + 1}.md`,
            createTime: index + 1
        }));

        view.show({ files, processed: 12, errors: 0 });
        view.columnSortingSetup = true;
        view.currentPage = 2;
        view.refreshTable();

        const buttons = Array.from(document.getElementById('paginationContainer').children).map((btn) => btn.textContent);
        expect(buttons).toContain('«');
        expect(buttons).toContain('‹');
    });

    test('sort indicators reflect active sort state', () => {
        const files = [
            { title: 'A', filename: 'a.md', createTime: 1 },
            { title: 'B', filename: 'b.md', createTime: 2 }
        ];

        view.show({ files, processed: 2, errors: 0 });
        view.columnSortingSetup = true;
        view.currentSort = 'date';
        view.sortDirection = 'desc';
        view.refreshTable();

        const titleIndicator = document.querySelector('#titleHeader .sort-indicator');
        const dateIndicator = document.querySelector('#dateHeader .sort-indicator');

        expect(titleIndicator.textContent).toBe('');
        expect(dateIndicator.textContent).toBe('▼');
    });
});
