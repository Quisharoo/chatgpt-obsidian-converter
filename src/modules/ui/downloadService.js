/**
 * Download Service
 * Handles single-file and bulk downloads, including ZIP packaging.
 * Keeps the application orchestrator free of DOM/file-handling logic.
 */

import { logError } from '../../utils/logger.js';
import { success, info, error as errorString, status } from '../../utils/strings.js';

export class DownloadService {
    constructor({
        createDownloadBlob,
        downloadFile,
        telemetry,
        accessibilityManager,
        notificationService
    }) {
        this.createDownloadBlob = createDownloadBlob;
        this.downloadFile = downloadFile;
        this.telemetry = telemetry;
        this.accessibilityManager = accessibilityManager;
        this.notificationService = notificationService;
    }

    downloadSingleFile(file) {
        if (!file) return;

        try {
            const blob = this.createDownloadBlob(file.content);
            this.downloadFile(blob, file.filename);

            this.telemetry?.trackIndividualFileAction?.('download', true);
            this.accessibilityManager?.announceFileOperation?.('download', true, file.filename);
        } catch (err) {
            logError(`Error downloading ${file.filename}:`, err);
            this.telemetry?.trackIndividualFileAction?.('download', false, err);
            this.notificationService?.showError?.(`${errorString('DOWNLOAD_FAILED')} ${file.filename}`);
            this.accessibilityManager?.announceFileOperation?.('download', false, file.filename);
        }
    }

    downloadAllFiles(files = []) {
        let successCount = 0;

        for (const file of files) {
            try {
                this.downloadSingleFile(file);
                successCount++;
            } catch (err) {
                logError(`Error downloading ${file.filename}:`, err);
            }
        }

        this.notificationService?.showSuccess?.(`📥 Downloaded ${successCount} files`);
    }

    async downloadAllAsZip(files = []) {
        const zipStartTime = Date.now();

        try {
            if (typeof JSZip === 'undefined') {
                const fallbackMessage = info('ZIP_NOT_AVAILABLE');
                this.notificationService?.showInfo?.(`📦 ${fallbackMessage}`);
                this.downloadAllFiles(files);
                return;
            }

            const creatingMessage = status('CREATING_ZIP');
            this.notificationService?.showInfo?.(`📦 ${creatingMessage}`);

            const zip = new JSZip();
            for (const file of files) {
                zip.file(file.filename, file.content);
            }

            const zipBlob = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(zipBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `chatgpt-conversations-${new Date().toISOString().split('T')[0]}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            const zipTime = Date.now() - zipStartTime;
            this.telemetry?.trackFilesSaved?.('zip', files.length, files.length, zipTime);

            const successMessage = `📦 ${success('FILES_DOWNLOADED')} ${files.length} files as ZIP archive`;
            this.notificationService?.showSuccess?.(successMessage);
        } catch (err) {
            logError('Error creating ZIP archive:', err);
            this.telemetry?.trackError?.('save', err, { type: 'zip_creation', fileCount: files.length });

            const errorMessage = errorString('ZIP_CREATION_FAILED');
            this.notificationService?.showError?.(errorMessage);
            this.downloadAllFiles(files);
        }
    }
}

export default DownloadService;
