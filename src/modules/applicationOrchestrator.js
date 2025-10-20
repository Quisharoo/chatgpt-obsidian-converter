/**
 * Application Orchestrator
 * Main coordinator for the ChatGPT to Markdown converter application
 * Following AGENTS.md principle: clean architecture with separated concerns
 */

import { FileUploader } from '../components/FileUploader.js';
import { ProgressDisplay } from '../components/ProgressDisplay.js';
import UIBuilder from '../components/UIBuilder.js';
import { parseConversationsFile, convertConversations, readFileAsText, parseConversationsJson } from '../lib/conversionWorkflow.js';
import { 
    selectDirectory, 
    saveFilesChronologically, 
    validateDirectoryAccess,
    downloadFile,
    createDownloadBlob,
    isFileSystemAccessSupported,
    saveFileToDirectory,
    scanForExistingFiles,
    getFileSystemAccessInfo
} from './fileSystemManager.js';
import { ProgressController } from './ui/progressController.js';
import { ResultsView } from './ui/resultsView.js';
import { DialogService } from './ui/dialogService.js';
import { NotificationService } from './ui/notificationService.js';
import { DownloadService } from './ui/downloadService.js';
import { ERROR_MESSAGES, STATUS_MESSAGES } from '../utils/constants.js';
import { logInfo, logDebug, logWarn, logError } from '../utils/logger.js';
import { telemetry } from '../utils/telemetry.js';
import { 
    getString, 
    status, 
    error, 
    success, 
    info, 
    ui, 
    message, 
    formatFileSize 
} from '../utils/strings.js';
import { accessibilityManager } from '../utils/accessibility.js';
import { switchToComplete, switchToView, showResults, showFiles } from '../utils/navigation.js';

/**
 * ChatGPT to Markdown Application
 * WHY: Orchestrates the entire conversion workflow with proper error handling
 */
export class ChatGPTConverter {
    constructor() {
        this.fileUploader = null;
        this.progressDisplay = null;
        this.selectedDirectoryHandle = null;
        this.convertedFiles = [];
        this.processedIds = new Set();
        this.saveLocalButton = null;
        this.uiBuilder = new UIBuilder();
        this.progressController = null;
        this.resultsView = null;
        this.dialogService = new DialogService();
        this.notificationService = new NotificationService();
        this.downloadService = null;
        
        this.initializeComponents();
    }

    /**
     * Initialize all application components
     * WHY: Sets up the UI components and establishes connections
     */
    initializeComponents() {
        try {
            // Initialize components with new structure
            this.fileUploader = new FileUploader('dropzone', 'fileInput');
            this.progressDisplay = new ProgressDisplay('conversionProgressContainer');
            this.saveProgressDisplay = new ProgressDisplay('progressContainer');
            this.progressController = new ProgressController({
                conversionDisplay: this.progressDisplay,
                saveDisplay: this.saveProgressDisplay,
                accessibility: accessibilityManager
            });
            this.notificationService.setProgressController(this.progressController);
            this.downloadService = new DownloadService({
                createDownloadBlob,
                downloadFile,
                telemetry,
                accessibilityManager,
                notificationService: this.notificationService
            });
            this.resultsView = new ResultsView({
                uiBuilder: this.uiBuilder,
                handlers: {
                    onSelectDirectory: () => this.handleDirectorySelection(),
                    onSaveAll: () => this.handleLocalSave(),
                    onDownloadZip: () => this.downloadAllAsZip(),
                    onDownloadFile: (file) => this.downloadSingleFile(file),
                    onSaveFile: (file) => this.saveSingleFileToMarkdown(file)
                }
            });
            
            // Set up file upload handling
            this.fileUploader.setFileSelectedCallback(this.handleFileUpload.bind(this));
            
            // Mount privacy banner
            if (this.uiBuilder && typeof this.uiBuilder.mountPrivacyBanner === 'function') {
                this.uiBuilder.mountPrivacyBanner();
                if (typeof this.uiBuilder.exposePrivacyHelper === 'function') {
                    this.uiBuilder.exposePrivacyHelper();
                }
                // Theme toggle removed
            }

            // Initialize accessibility features
            accessibilityManager.initialize();
            
            const initMessage = message('INITIALIZING_CONVERTER');
            const apiMessage = isFileSystemAccessSupported() 
                ? message('FILE_SYSTEM_API_AVAILABLE')
                : message('FILE_SYSTEM_API_NOT_AVAILABLE');
                
            logInfo(`✅ ${initMessage}`);
            logInfo(`📁 ${apiMessage}`);
            
            // Announce initialization to screen readers
            accessibilityManager.announceStatus(initMessage, 'success');
            
        } catch (e) {
            logError('❌ Failed to initialize application:', e);
            const errorMessage = error('FAILED_TO_INITIALIZE');
            this.showError(errorMessage);
        }
    }

    /**
     * Handle file upload and processing
     * WHY: Coordinates the entire file processing workflow
     * 
     * @param {File} file - Uploaded file to process
     */
    async handleFileUpload(file) {
        // Programmatic breakpoint to inspect file upload handling and initial state
        /* istanbul ignore next */
        const startTime = Date.now();
        logInfo(message('PROCESSING_FILE', { fileName: file.name, fileSize: formatFileSize(file.size) }));
        
        // Track conversion start
        telemetry.trackConversionStarted(file.size, file.name);
        
        this.fileUploader.setProcessingState(true);
        if (this.progressController) {
            this.progressController.startConversion();
        }
        
        try {
            // Read and parse file (supports .json and .zip containing conversations.json)
            const readingMessage = status('READING_FILE');
            if (this.progressController) {
            this.progressController.updateConversion(0, readingMessage);
            }

            const conversations = await parseConversationsFile(file, {
                onProgress: (update) => {
                    if (!this.progressController) {
                        return;
                    }
                    const baseMessage = update.message || status('PARSING_JSON');
                    const percent = typeof update.percent === 'number' ? update.percent : 0;
                    const scaled = Math.min(35, Math.max(5, Math.round((percent / 100) * 35)));
                    this.progressController.updateConversion(scaled, baseMessage);
                }
            });

            await this.delay(200);

            const convertingMessage = status('CONVERTING');
            if (this.progressController) {
                this.progressController.updateConversion(40, convertingMessage);
            }
            const results = await convertConversations(conversations, this.processedIds, {
                concurrency: 8,
                onProgress: (update) => {
                    if (!this.progressController) {
                        return;
                    }
                    const percent = typeof update.percent === 'number' ? update.percent : 0;
                    const adjusted = Math.min(80, 40 + Math.floor((percent / 100) * 40));
                    const msg = update.message || convertingMessage;
                    this.progressController.updateConversion(adjusted, msg);
                }
            });
            
            // Add delay for conversion processing
            await this.delay(500);
            
            const finalizingMessage = status('FINALIZING');
            if (this.progressController) {
                this.progressController.updateConversion(85, finalizingMessage);
            }
            await this.delay(300);
            
            const completeMessage = status('COMPLETE');
            if (this.progressController) {
                this.progressController.completeConversion(completeMessage);
            }
            this.convertedFiles = results.files;
            
            // Track successful conversion
            const processingTime = Date.now() - startTime;
            telemetry.trackConversionCompleted(
                conversations.length, 
                results.files.length, 
                processingTime, 
                results.errors
            );
            
            // Add final delay before showing results
            await this.delay(800);
            
            // Display results with delay for smooth transition
            setTimeout(() => {
                this.displayResults(results);
                
                // Switch to complete section and show results
                switchToComplete();
                showResults();
                
                // Populate the Files view in the background
                setTimeout(() => {
                    if (results.files && results.files.length > 0) {
                        if (this.resultsView) {
                            this.resultsView.refreshTable();
                        }
                        showFiles();
                        logInfo(`✅ Files view populated with ${results.files.length} files`);
                    } else {
                        logWarn('⚠️ No files available to populate Files view');
                    }
                }, 100);
                
                // Hide progress after switching to results view
                setTimeout(() => {
                    if (this.progressController) {
                        this.progressController.hideConversion();
                    }
                }, 200);
            }, 500);
            
        } catch (error) {
            logError('❌ Error processing file:', error);
            
            // Track conversion failure with context
            const stage = error.message.includes('JSON') ? 'parsing' : 
                         error.message.includes('structure') ? 'parsing' : 'processing';
            telemetry.trackConversionFailed(error, stage);
            
            if (this.progressController) {
                this.progressController.failConversion(error.message);
            }
            this.showError(error.message);
        } finally {
            this.fileUploader.setProcessingState(false);
        }
    }

    /**
     * Handle directory selection for local saving
     * WHY: Provides user control over save location
     */
    async handleDirectorySelection() {
        try {
            const directoryHandle = await selectDirectory();
            this.selectedDirectoryHandle = directoryHandle;
            this.uiBuilder.setDirectoryHandle(directoryHandle);
            
            // Track directory selection
            telemetry.trackDirectorySelected();
            
            const successMessage = `✅ ${success('DIRECTORY_SELECTED')}: ${directoryHandle.name}. ${success('READY_TO_SAVE')}`;
            this.showSuccess(successMessage);
            
            this.updateSaveButtonState();
            
            // Re-render the files table to show Save buttons
            if (this.allFiles && this.allFiles.length > 0) {
                this.renderFilesTable();
            }
            
        } catch (error) {
            console.error('Directory selection error:', error);
            this.showError(error.message);
        }
    }



    /**
     * Save files to local directory
     * WHY: Orchestrates the file saving process with progress feedback
     */
    async handleLocalSave() {
        const saveStartTime = Date.now();
        
        if (!this.selectedDirectoryHandle) {
            const errorMessage = error('NO_DIRECTORY');
            this.showError(errorMessage);
            return;
        }

        // Validate directory is still accessible
        const isValid = await validateDirectoryAccess(this.selectedDirectoryHandle);
        if (!isValid) {
            const errorMessage = error('DIRECTORY_ACCESS_LOST');
            this.showError(`❌ ${errorMessage}`);
            this.selectedDirectoryHandle = null;
            this.uiBuilder.setDirectoryHandle(null);
            this.updateSaveButtonState();
            return;
        }

        logInfo(`💾 Starting save operation for ${this.convertedFiles.length} files to ${this.selectedDirectoryHandle.name}`);
        
        // Switch to Files view first, then show progress
        switchToView('files');
        logInfo('✅ Switched to Files view for save operation');
        
        // Set up cancellation flag
        let isCancelled = false;
        
        if (this.progressController) {
            this.progressController.startSaveOperation(() => {
                isCancelled = true;
                logInfo('🛑 User requested cancellation of save operation');
            });
        }
        
        const preparingMessage = info('PREPARING_FILES', { 
            count: this.convertedFiles.length, 
            folderName: this.selectedDirectoryHandle.name 
        });
        this.showInfo(`💾 ${preparingMessage}`);

        try {
            const progressCallback = (arg1, arg2, arg3, arg4) => {
                let percent, completed, total, message;
                if (typeof arg1 === 'object' && arg1 !== null) {
                    ({ percent, completed, total, message } = arg1);
                } else {
                    percent = arg1;
                    completed = arg2;
                    total = arg3;
                    message = arg4;
                }
                const msg = message || `💾 ${status('SAVING_FILES')} ${percent}% (${completed}/${total})`;
                logInfo(`📊 Progress update: ${percent}% - ${msg}`);
                if (this.progressController) {
                    this.progressController.updateSave(percent, msg);
                }
            };

            const cancellationCallback = () => isCancelled;

            const results = await saveFilesChronologically(
                this.convertedFiles, 
                this.selectedDirectoryHandle, 
                progressCallback,
                cancellationCallback
            );

            // Track save operation results
            const saveTime = Date.now() - saveStartTime;
            telemetry.trackFilesSaved('local', this.convertedFiles.length, results.successCount, saveTime);

            logInfo(`✅ Save operation completed: ${results.successCount} saved, ${results.cancelledCount} cancelled, ${results.errorCount} errors`);

            if (this.progressController) {
                this.progressController.completeSave('Save operation completed');
            }

            // Handle different outcomes based on user choice and results
            if (results.userCancelled) {
                this.showInfo('📂 Save operation cancelled');
                return;
            }

            // Build detailed success message
            let message = '';
            const parts = [];
            
            if (results.successCount > 0) {
                parts.push(`✅ Saved ${results.successCount} files`);
            }
            
            if (results.cancelledCount > 0) {
                if (results.userChoice === 'skip') {
                    parts.push(`📂 Skipped ${results.cancelledCount} existing files`);
                } else {
                    parts.push(`📂 ${results.cancelledCount} cancelled`);
                }
            }
            
            if (results.errorCount > 0) {
                parts.push(`❌ ${results.errorCount} errors`);
            }
            
            message = parts.join(', ');
            
            // Show appropriate message based on results
            if (results.successCount > 0) {
                this.showSuccess(`${message} in ${this.selectedDirectoryHandle.name}`);
                
                // Show additional context about user choice
                if (results.duplicatesFound > 0) {
                    setTimeout(() => {
                        if (results.userChoice === 'skip') {
                            this.showSuccess(`✅ SUCCESS! ${results.successCount} new files saved. ${results.duplicatesFound} existing files left unchanged.`);
                        } else if (results.userChoice === 'overwrite') {
                            this.showSuccess(`✅ SUCCESS! All ${results.successCount} files saved. ${results.duplicatesFound} files were overwritten.`);
                        }
                    }, 1000);
                } else {
                    setTimeout(() => {
                        this.showSuccess(`✅ SUCCESS! Check your ${this.selectedDirectoryHandle.name} folder for the files`);
                    }, 1000);
                }
            } else if (results.cancelledCount > 0 && results.errorCount === 0) {
                if (results.userChoice === 'skip') {
                    this.showInfo(`📂 All files already existed and were skipped. No new files to save.`);
                } else {
                    this.showInfo(`📂 All ${results.cancelledCount} file saves were cancelled`);
                }
            } else {
                this.showError(`❌ Failed to save any files. ${results.errorCount} errors occurred. Check permissions or try downloading instead.`);
            }

        } catch (error) {
            console.error('❌ Error during save:', error);
            telemetry.trackError('save', error, { 
                fileCount: this.convertedFiles.length,
                directoryName: this.selectedDirectoryHandle?.name 
            });
            
            const errorMessage = `${error('SAVE_FAILED')}: ${error.message}`;
            if (this.progressController) {
                this.progressController.failSave(errorMessage);
            }
            this.showError(errorMessage);
        } finally {
            if (this.progressController) {
                this.progressController.hideSave(1000);
            } else {
                this.saveProgressDisplay.setCancelCallback(null);
                setTimeout(() => this.saveProgressDisplay.hide(), 1000);
            }
        }
    }

    /**
     * Download individual file
     * WHY: Provides fallback download option
     * 
     * @param {Object} file - File object to download
     */
    downloadSingleFile(file) {
        this.downloadService?.downloadSingleFile(file);
    }

    readFileContent(file) {
        return readFileAsText(file);
    }

    parseConversations(fileContent) {
        return parseConversationsJson(fileContent);
    }

    /**
     * Save individual file to chosen directory
     * WHY: Reuses the same File System Access API logic as bulk save for consistency
     * 
     * @param {Object} file - File object to save
     */
    async saveSingleFileToMarkdown(file) {
        try {
            // Check if File System Access API is supported
            if (!isFileSystemAccessSupported()) {
                const errorMessage = error('BROWSER_NOT_SUPPORTED');
                this.showError(errorMessage);
                return;
            }

            const chooseMessage = info('CHOOSE_SAVE_LOCATION', { filename: file.title || file.filename });
            this.showInfo(`📁 ${chooseMessage}`);
            
            // Let user select directory for this specific file
            const directoryHandle = await selectDirectory();
            
            if (!directoryHandle) {
                const cancelMessage = info('SAVE_CANCELLED');
                this.showInfo(`📂 ${cancelMessage}`);
                return;
            }

            this.showInfo(`💾 Saving "${file.filename}" to ${directoryHandle.name}...`);

            // Use the updated save logic with detailed response
            const result = await saveFileToDirectory(file.filename, file.content, directoryHandle);
            
            if (result.success) {
                // Track successful individual file save
                telemetry.trackIndividualFileAction('save', true);
                
                // Show prominent success confirmation
                if (this.dialogService) {
                    this.dialogService.showFileSaveConfirmation({
                        fileTitle: file.title || file.filename,
                        folderName: directoryHandle.name,
                        filename: result.filename
                    });
                }
                logInfo(`✅ Individual file saved: ${result.filename} → ${directoryHandle.name}/`);
                accessibilityManager.announceFileOperation('save', true, file.filename);
            } else if (result.cancelled) {
                this.showInfo(`📂 ${result.message}`);
                logInfo(`📂 Save cancelled by user: ${result.filename}`);
            } else {
                telemetry.trackIndividualFileAction('save', false, new Error(result.message));
                this.showError(`❌ ${result.message}`);
                logError(`❌ Save failed: ${result.filename} - ${result.message}`);
                accessibilityManager.announceFileOperation('save', false, file.filename);
            }

        } catch (saveError) {
            logError(`Error saving individual file ${file.filename}:`, saveError);
            telemetry.trackError('save', saveError, { type: 'individual_file', filename: file.filename });
            
            // Provide specific error messages
            if (saveError.message.includes('cancelled')) {
                const cancelMessage = info('SAVE_CANCELLED');
                this.showInfo(`📂 ${cancelMessage}`);
            } else {
                const errorMessage = `${error('SAVE_FAILED')} "${file.filename}": ${saveError.message}`;
                this.showError(errorMessage);
            }
        }
    }

    /**
     * Download all files individually
     * WHY: Batch download fallback when local saving fails
     */
    downloadAllFiles() {
        if (!this.convertedFiles || this.convertedFiles.length === 0) return;
        this.downloadService?.downloadAllFiles(this.convertedFiles);
    }

    /**
     * Download all files as a ZIP archive
     * WHY: Provides a single download option for mobile users
     */
    async downloadAllAsZip() {
        if (!this.convertedFiles || this.convertedFiles.length === 0) return;
        await this.downloadService?.downloadAllAsZip(this.convertedFiles);
    }

    /**
     * Update save button state based on directory selection
     * WHY: Provides visual feedback about readiness to save
     */
    updateSaveButtonState() {
        if (this.uiBuilder) {
            this.uiBuilder.updateSaveButtonState(this.convertedFiles);
        }
    }

    /**
     * Display conversion results with UI
     * WHY: Shows results and provides download/save options
     * 
     * @param {Object} results - Conversion results
     */
    displayResults(results) {
        if (this.resultsView) {
            this.resultsView.show(results);
        }
    }








    /**
     * Show success message
     * WHY: Provides positive feedback
     */
    showSuccess(message) {
        if (this.notificationService) {
            this.notificationService.showSuccess(message);
            return;
        }
        this.showStatusMessage(message, 'success');
    }

    /**
     * Show info message
     * WHY: Provides informational feedback
     */
    showInfo(message) {
        if (this.notificationService) {
            this.notificationService.showInfo(message);
            return;
        }
        this.showStatusMessage(message, 'info');
    }

    /**
     * Show error message
     * WHY: Provides error feedback
     */
    showError(message) {
        if (this.notificationService) {
            this.notificationService.showError(message);
            return;
        }
        this.showStatusMessage(message, 'error');
    }

    /**
     * Show status message in UI
     * WHY: Centralizes status message display
     */
    showStatusMessage(message, type) {
        if (this.notificationService) {
            this.notificationService.show(message, type);
            return;
        }

        if (this.progressDisplay && this.progressDisplay.isVisible) {
            if (type === 'error') {
                this.progressDisplay.showError(message);
            } else {
                this.progressDisplay.updateProgress(100, message);
            }
        } else {
            logInfo(`${type.toUpperCase()}: ${message}`);
        }
    }

    /**
     * Helper method to create delays for better UX
     * WHY: Creates artificial delays to make processing feel more substantial
     * 
     * @param {number} ms - Milliseconds to delay
     * @returns {Promise} - Promise that resolves after the delay
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Reset application state
     * WHY: Allows for multiple conversions in same session
     */
    reset() {
        this.convertedFiles = [];
        this.processedIds.clear();
        this.selectedDirectoryHandle = null;
        this.saveLocalButton = null;
        
        // Hide results
        const resultsDiv = document.getElementById('results');
        if (resultsDiv) {
            resultsDiv.style.display = 'none';
        }
    }
} 
