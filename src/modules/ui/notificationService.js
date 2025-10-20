/**
 * Notification Service
 * Centralizes status messaging for the orchestrator.
 * Following AGENTS.md, keeps DOM/UI concerns separated from workflow logic.
 */

import { logInfo } from '../../utils/logger.js';

export class NotificationService {
    constructor({ progressController = null, logger = logInfo } = {}) {
        this.progressController = progressController;
        this.logger = logger;
    }

    setProgressController(progressController) {
        this.progressController = progressController;
    }

    show(message, type = 'info') {
        if (this.progressController) {
            this.progressController.displayStatus(message, type);
        } else {
            this.logger(`${type?.toUpperCase?.() || 'INFO'}: ${message}`);
        }
    }

    showSuccess(message) {
        this.show(message, 'success');
    }

    showInfo(message) {
        this.show(message, 'info');
    }

    showError(message) {
        this.show(message, 'error');
    }
}

export default NotificationService;
