/**
 * Application Constants
 * Centralized configuration values for the ChatGPT to Obsidian converter
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

// UI constants
export const UI_CONFIG = {
    PULSE_ANIMATION_DURATION_MS: 2000,
    STATUS_DISPLAY_DELAY_MS: 1000,
    DRAG_HOVER_CLASS: 'dragover'
};

// API capabilities
export const API_SUPPORT = {
    FILE_SYSTEM_ACCESS: 'showDirectoryPicker' in window
};

// Error messages - centralized for consistency
export const ERROR_MESSAGES = {
    INVALID_JSON: 'Invalid JSON format. Please ensure you uploaded a valid conversations.json file.',
    INVALID_STRUCTURE: 'Expected an array of conversations. Please check your file format.',
    NO_DIRECTORY: 'Please select a folder first',
    PERMISSION_DENIED: 'Permission denied. Try selecting a different folder or use downloads instead.',
    SECURITY_RESTRICTION: 'Security restriction. Try a folder in your Documents or Desktop.',
    FILE_SYSTEM_UNSUPPORTED: 'File System Access API not supported. Files will be downloaded instead.'
};

// Status messages - centralized for consistency
export const STATUS_MESSAGES = {
    PROCESSING: 'Processing conversations...',
    READING_FILE: 'Reading file...',
    PARSING_JSON: 'Parsing JSON...',
    CONVERTING: 'Converting conversations...',
    COMPLETE: 'Conversion complete!',
    SAVING: 'Saving files...',
    CANCELLED: 'Directory selection cancelled'
}; 