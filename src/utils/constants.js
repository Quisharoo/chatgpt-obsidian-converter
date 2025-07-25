/**
 * Application Constants
 * Centralized configuration values for the ChatGPT to Markdown converter
 */

// File processing constants
export const PROCESSING_CONFIG = {
    DELAY_BETWEEN_FILES_MS: 100, // Delay ensures chronological file timestamps
    MAX_FILENAME_LENGTH: 100,   // Filesystem compatibility limit
    PROGRESS_UPDATE_INTERVAL: 50 // UI responsiveness balance
};

// File system constants
export const FILE_SYSTEM = {
    SUPPORTED_MIME_TYPES: ['application/json'],
    SUPPORTED_EXTENSIONS: ['.json'],
    OUTPUT_EXTENSION: '.md',
    DEFAULT_FILENAME: 'Conversation'
};

// UI configuration constants
export const UI_CONFIG = {
    FILES_PER_PAGE: 10,          // Default number of files to show per page
    MAX_PAGINATION_BUTTONS: 7,   // Maximum number of pagination buttons to display
    SORT_OPTIONS: {
        NAME: 'name',
        DATE: 'date'
    },
    SORT_DIRECTIONS: {
        ASC: 'asc',
        DESC: 'desc'
    }
};

// API capabilities - using function for dynamic checking
export const API_SUPPORT = {
    get FILE_SYSTEM_ACCESS() {
        // More robust File System Access API detection
        return (
            'showDirectoryPicker' in window &&
            typeof window.showDirectoryPicker === 'function' &&
            window.isSecureContext && // Must be in secure context (HTTPS or localhost)
            (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')
        );
    }
};

// Error messages - centralized for consistency
export const ERROR_MESSAGES = {
    INVALID_JSON: 'Invalid JSON format. Please ensure you uploaded a valid conversations.json file.',
    INVALID_STRUCTURE: 'Expected an array of conversations. Please check your file format.',
    NO_DIRECTORY: 'Please select a folder first',
    PERMISSION_DENIED: 'Permission denied. Try selecting a different folder or use downloads instead.',
    SECURITY_RESTRICTION: 'Security restriction. Try a folder in your Documents or Desktop.',
    FILE_SYSTEM_UNSUPPORTED: 'File System Access API not supported. Files will be downloaded instead.',
    FILE_EXISTS: 'File already exists. Do you want to overwrite it?',
    CANCELLED: 'Operation cancelled by user'
};

// Status messages - centralized for consistency
export const STATUS_MESSAGES = {
    PROCESSING: 'Processing conversations...',
    READING_FILE: 'Reading file...',
    PARSING_JSON: 'Parsing JSON...',
    CONVERTING: 'Converting conversations...',
    FINALIZING: 'Finalizing conversion...',
    COMPLETE: 'Conversion complete!',
    SAVING: 'Saving files...',
    CANCELLED: 'Directory selection cancelled',
    FILE_EXISTS_CHECK: 'Checking for existing files...'
};

// Logging configuration
export const LOGGING_CONFIG = {
    DEFAULT_LEVEL: 'INFO',
    DEBUG_MODE: false,
    ENABLE_EXTERNAL_LOGGING: false
}; 