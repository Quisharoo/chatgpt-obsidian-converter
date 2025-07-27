/**
 * Telemetry Module
 * Tracks user interactions and conversion metrics for analytics
 * Following AGENTS.md principle: clean, minimal implementation without large dependencies
 */

import { logInfo, logDebug, logWarn } from './logger.js';

/**
 * Telemetry Events Configuration
 * WHY: Central definition of all trackable events
 */
const TELEMETRY_EVENTS = {
    // Conversion Events
    CONVERSION_STARTED: 'conversion_started',
    CONVERSION_COMPLETED: 'conversion_completed', 
    CONVERSION_FAILED: 'conversion_failed',
    
    // File Events
    FILE_UPLOADED: 'file_uploaded',
    FILES_SAVED_LOCAL: 'files_saved_local',
    FILES_DOWNLOADED_ZIP: 'files_downloaded_zip',
    FILE_DOWNLOADED_INDIVIDUAL: 'file_downloaded_individual',
    FILE_SAVED_INDIVIDUAL: 'file_saved_individual',
    
    // User Actions
    DIRECTORY_SELECTED: 'directory_selected',
    SAVE_CANCELLED: 'save_cancelled',
    
    // Errors
    PARSE_ERROR: 'parse_error',
    SAVE_ERROR: 'save_error',
    FILESYSTEM_ERROR: 'filesystem_error',
    
    // Performance
    CONVERSION_TIME: 'conversion_time',
    SAVE_TIME: 'save_time'
};

/**
 * Simple telemetry collector
 * WHY: Tracks user interactions and performance metrics for product improvement
 */
class TelemetryCollector {
    constructor() {
        this.sessionId = this.generateSessionId();
        this.events = [];
        this.sessionStartTime = Date.now();
        
        // Track session metadata
        this.sessionMetadata = {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            timestamp: new Date().toISOString(),
            fileSystemApiSupported: 'showDirectoryPicker' in window
        };
        
        logDebug('📊 Telemetry collector initialized', { sessionId: this.sessionId });
    }
    
    /**
     * Generate unique session ID
     * WHY: Track user sessions for analytics aggregation
     */
    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    /**
     * Track an event with optional data
     * WHY: Central method for all event tracking
     * 
     * @param {string} eventName - Event name from TELEMETRY_EVENTS
     * @param {Object} data - Optional event data
     */
    track(eventName, data = {}) {
        const event = {
            sessionId: this.sessionId,
            event: eventName,
            timestamp: Date.now(),
            data: { ...data },
            sessionTime: Date.now() - this.sessionStartTime
        };
        
        this.events.push(event);
        logDebug(`📊 Event tracked: ${eventName}`, event);
        
        // Send to analytics service if configured
        this.sendToAnalytics(event);
    }
    
    /**
     * Track conversion metrics
     * WHY: Measure conversion success rates and performance
     */
    trackConversionStarted(fileSize, fileName) {
        this.track(TELEMETRY_EVENTS.CONVERSION_STARTED, {
            fileSize,
            fileName: fileName ? fileName.replace(/[^a-zA-Z0-9.]/g, '') : 'unknown', // Sanitize
            fileSizeCategory: this.getFileSizeCategory(fileSize)
        });
    }
    
    trackConversionCompleted(conversationsCount, filesCount, processingTime, errorsCount = 0) {
        this.track(TELEMETRY_EVENTS.CONVERSION_COMPLETED, {
            conversationsCount,
            filesCount,
            processingTime,
            errorsCount,
            successRate: errorsCount > 0 ? (conversationsCount - errorsCount) / conversationsCount : 1,
            performanceCategory: this.getPerformanceCategory(processingTime)
        });
    }
    
    trackConversionFailed(error, stage) {
        this.track(TELEMETRY_EVENTS.CONVERSION_FAILED, {
            error: error.message,
            errorType: error.name,
            stage, // 'parsing', 'conversion', 'processing'
            stack: error.stack ? error.stack.substring(0, 500) : null // Truncate for privacy
        });
    }
    
    /**
     * Track file operations
     * WHY: Understand user preferences and success rates for different save methods
     */
    trackFilesSaved(method, count, successCount, processingTime) {
        const eventName = method === 'local' ? TELEMETRY_EVENTS.FILES_SAVED_LOCAL : TELEMETRY_EVENTS.FILES_DOWNLOADED_ZIP;
        this.track(eventName, {
            totalFiles: count,
            successfulFiles: successCount,
            failedFiles: count - successCount,
            processingTime,
            successRate: successCount / count
        });
    }
    
    trackIndividualFileAction(action, success = true, error = null) {
        const eventName = action === 'save' ? TELEMETRY_EVENTS.FILE_SAVED_INDIVIDUAL : TELEMETRY_EVENTS.FILE_DOWNLOADED_INDIVIDUAL;
        this.track(eventName, {
            success,
            error: error ? error.message : null
        });
    }
    
    /**
     * Track user actions
     * WHY: Understand user behavior and workflow patterns
     */
    trackDirectorySelected() {
        this.track(TELEMETRY_EVENTS.DIRECTORY_SELECTED);
    }
    
    trackSaveCancelled(stage, progress) {
        this.track(TELEMETRY_EVENTS.SAVE_CANCELLED, {
            stage, // 'selection', 'progress'
            progress // percentage when cancelled
        });
    }
    
    /**
     * Track errors for debugging and improvement
     * WHY: Identify common failure points and improve user experience
     */
    trackError(errorType, error, context = {}) {
        let eventName;
        switch (errorType) {
            case 'parse':
                eventName = TELEMETRY_EVENTS.PARSE_ERROR;
                break;
            case 'save':
                eventName = TELEMETRY_EVENTS.SAVE_ERROR;
                break;
            case 'filesystem':
                eventName = TELEMETRY_EVENTS.FILESYSTEM_ERROR;
                break;
            default:
                eventName = 'unknown_error';
        }
        
        this.track(eventName, {
            error: error.message,
            errorType: error.name,
            context,
            stack: error.stack ? error.stack.substring(0, 500) : null
        });
    }
    
    /**
     * Get file size category for analytics grouping
     * WHY: Understand performance patterns across different file sizes
     */
    getFileSizeCategory(size) {
        if (size < 1024 * 100) return 'small'; // < 100KB
        if (size < 1024 * 1024) return 'medium'; // < 1MB
        if (size < 1024 * 1024 * 10) return 'large'; // < 10MB
        return 'xlarge'; // >= 10MB
    }
    
    /**
     * Get performance category for analytics grouping
     * WHY: Understand performance characteristics
     */
    getPerformanceCategory(timeMs) {
        if (timeMs < 1000) return 'fast'; // < 1s
        if (timeMs < 5000) return 'normal'; // < 5s
        if (timeMs < 15000) return 'slow'; // < 15s
        return 'very_slow'; // >= 15s
    }
    
    /**
     * Send event to analytics service
     * WHY: Enable real analytics collection when service is configured
     */
    sendToAnalytics(event) {
        // Placeholder for analytics service integration
        // Could integrate with Google Analytics, Mixpanel, custom endpoint, etc.
        
        // For now, just log significant events
        if (this.isSignificantEvent(event.event)) {
            logInfo(`📊 Significant event: ${event.event}`, event.data);
        }
    }
    
    /**
     * Check if event is significant for logging
     * WHY: Reduce noise while tracking important events
     */
    isSignificantEvent(eventName) {
        return [
            TELEMETRY_EVENTS.CONVERSION_COMPLETED,
            TELEMETRY_EVENTS.CONVERSION_FAILED,
            TELEMETRY_EVENTS.FILES_SAVED_LOCAL,
            TELEMETRY_EVENTS.FILES_DOWNLOADED_ZIP,
            TELEMETRY_EVENTS.PARSE_ERROR,
            TELEMETRY_EVENTS.SAVE_ERROR
        ].includes(eventName);
    }
    
    /**
     * Get session summary for debugging
     * WHY: Provide session overview for troubleshooting
     */
    getSessionSummary() {
        const summary = {
            sessionId: this.sessionId,
            duration: Date.now() - this.sessionStartTime,
            eventCount: this.events.length,
            metadata: this.sessionMetadata,
            eventsByType: {}
        };
        
        // Count events by type
        this.events.forEach(event => {
            summary.eventsByType[event.event] = (summary.eventsByType[event.event] || 0) + 1;
        });
        
        return summary;
    }
    
    /**
     * Export events for analytics (if needed)
     * WHY: Allow data export for external analytics tools
     */
    exportEvents() {
        return {
            session: this.sessionMetadata,
            events: this.events,
            summary: this.getSessionSummary()
        };
    }
}

// Create singleton instance
const telemetry = new TelemetryCollector();

// Export telemetry instance and events constants
export { telemetry, TELEMETRY_EVENTS };
export default telemetry; 