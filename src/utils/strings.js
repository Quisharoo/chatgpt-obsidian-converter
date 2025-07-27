/**
 * Internationalization Strings Module
 * Centralizes all user-facing text for translation and localization
 * Following AGENTS.md principle: clean organization for maintainable i18n
 */

/**
 * Default language strings (English)
 * WHY: Centralized string management enables easy translation and consistent messaging
 */
export const STRINGS = {
    // Application Status Messages
    STATUS: {
        READING_FILE: 'Reading file...',
        PARSING_JSON: 'Parsing conversations...',
        CONVERTING: 'Converting to Markdown...',
        FINALIZING: 'Finalizing conversion...',
        COMPLETE: 'Conversion complete!',
        PREPARING_SAVE: 'Preparing to save files...',
        SAVING_FILES: 'Saving files...',
        CREATING_ZIP: 'Creating ZIP archive...'
    },

    // Error Messages
    ERRORS: {
        INVALID_JSON: 'Invalid JSON file. Please upload a valid ChatGPT export.',
        INVALID_STRUCTURE: 'Invalid file structure. Expected an array of conversations.',
        NO_DIRECTORY: 'Please select a directory first.',
        DIRECTORY_ACCESS_LOST: 'Directory access lost. Please select folder again.',
        FAILED_TO_READ_FILE: 'Failed to read file',
        FAILED_TO_INITIALIZE: 'Failed to initialize application. Please refresh the page.',
        SAVE_FAILED: 'Save failed',
        DOWNLOAD_FAILED: 'Failed to download',
        ZIP_CREATION_FAILED: 'Failed to create ZIP archive. Trying individual downloads...',
        BROWSER_NOT_SUPPORTED: "Your browser doesn't support direct file saving. Use download instead.",
        NO_FILES_TO_SAVE: 'No files available to save'
    },

    // Success Messages
    SUCCESS: {
        CONVERSION_COMPLETE: 'Conversion completed successfully!',
        FILES_SAVED: 'files saved',
        FILES_DOWNLOADED: 'Downloaded',
        DIRECTORY_SELECTED: 'Selected directory',
        READY_TO_SAVE: 'Now click "Save to Local Folder" to save your files!',
        FILE_SAVED_SUCCESS: 'File Saved Successfully!',
        CHECK_FOLDER: 'SUCCESS! Check your {folderName} folder for the files',
        NEW_FILES_SAVED: 'SUCCESS! {count} new files saved. {duplicates} existing files left unchanged.',
        ALL_FILES_SAVED: 'SUCCESS! All {count} files saved. {duplicates} files were overwritten.'
    },

    // Information Messages
    INFO: {
        SELECT_FOLDER_FIRST: 'Select folder first',
        SAVE_CANCELLED: 'File save cancelled',
        SAVE_OPERATION_CANCELLED: 'Save operation cancelled',
        ALL_FILES_EXISTED: 'All files already existed and were skipped. No new files to save.',
        ALL_SAVES_CANCELLED: 'All {count} file saves were cancelled',
        CHOOSE_SAVE_LOCATION: 'Choose where to save "{filename}"',
        PREPARING_FILES: 'Preparing to save {count} files to {folderName} folder...',
        ZIP_NOT_AVAILABLE: 'ZIP download not available. Downloading files individually...'
    },

    // UI Labels and Buttons
    UI: {
        // Buttons
        CHOOSE_FOLDER: 'Choose Folder',
        CHANGE_DIRECTORY: 'Change Directory (Current: {folderName})',
        SAVE_TO_LOCAL_FOLDER: 'Save to Local Folder',
        SAVE_FILES_TO_FOLDER: 'Save {count} files to selected folder',
        DOWNLOAD_ALL_ZIP: 'Download All as ZIP',
        DOWNLOAD_INDIVIDUAL: 'Download files individually',
        OK: 'OK',
        
        // Headers and Titles
        CONVERSION_SUMMARY: 'Conversion Summary',
        SAVE_LOCATION: 'Save Location',
        DOWNLOAD_OPTIONS: 'Download Options',
        
        // Table Headers
        FILE_TITLE: 'Title',
        DATE_CREATED: 'Date Created',
        ACTIONS: 'Actions',
        
        // Status and Progress
        SHOWING_FILES: 'Showing {start}-{end} of {total} files',
        NO_FILES_AVAILABLE: 'No files available',
        
        // Icons and Visual Elements
        LOADING: 'Loading...',
        PROCESSING: 'Processing...',
        
        // Accessibility
        SORT_ASCENDING: 'Sort ascending',
        SORT_DESCENDING: 'Sort descending',
        CURRENT_SORT: 'Currently sorted by {column} {direction}'
    },

    // Detailed Messages and Descriptions
    MESSAGES: {
        CONVERSION_DESCRIPTION: 'Your ChatGPT conversations have been successfully converted',
        CHOOSE_SAVE_LOCATION: 'Choose where to save your converted files',
        READY_TO_SAVE_DESCRIPTION: 'Selected folder: {folderName}. Click "Save to Local Folder" to save all files directly to your chosen location.',
        SELECT_DESTINATION: 'Select your destination folder. Choose where you want to save your converted Markdown files.',
        
        // Mobile/Browser Compatibility
        MOBILE_BROWSER_DETECTED: 'Mobile Browser Detected',
        MOBILE_SAVE_INFO: 'Your browser doesn\'t support direct folder saving.',
        MOBILE_DOWNLOAD_INFO: 'On mobile devices, use the download options below to save your files.',
        IOS_SAVE_INFO: 'On iOS devices, use the download options below to save your files. You can then move them to your preferred folder using the Files app.',
        MOBILE_TIP: 'Mobile Tip:',
        MOBILE_TIP_DESCRIPTION: 'Download all files as a ZIP archive for easier file management on your device.',
        ZIP_ARCHIVE_INFO: 'Download all converted files as a single ZIP archive for easy file management.',
        
        // File Save Confirmation
        FILE_SAVED_TO_FOLDER: '{fileTitle} has been saved to the {folderName} folder.',
        FILENAME_LABEL: 'Filename:',
        
        // Processing Messages
        INITIALIZING_CONVERTER: 'ChatGPT to Markdown Converter initialized',
        FILE_SYSTEM_API_AVAILABLE: 'File System Access API: Available',
        FILE_SYSTEM_API_NOT_AVAILABLE: 'File System Access API: Not available',
        PROCESSING_FILE: 'Processing file: {fileName} ({fileSize} bytes)',
        FILES_VIEW_POPULATED: 'Files view populated with {count} files',
        FILES_TABLE_RENDERED: 'Files table rendered: {count} files on page {page} of {totalPages}'
    },

    // Telemetry and Analytics
    TELEMETRY: {
        SESSION_INITIALIZED: 'Telemetry collector initialized',
        EVENT_TRACKED: 'Event tracked: {eventName}',
        SIGNIFICANT_EVENT: 'Significant event: {eventName}'
    },

    // Accessibility
    ACCESSIBILITY: {
        STATUS_REGION_LABEL: 'Application status updates',
        PROGRESS_REGION_LABEL: 'Conversion progress updates',
        RESULTS_REGION_LABEL: 'Conversion results',
        TABLE_SORT_INFO: 'Click column headers to sort',
        FILE_ACTIONS_INFO: 'Use Save button to choose location or Download for immediate download'
    }
};

/**
 * String interpolation helper
 * WHY: Enables dynamic content in translated strings
 * 
 * @param {string} template - String template with {placeholder} syntax
 * @param {Object} values - Object with placeholder values
 * @returns {string} - Interpolated string
 */
export function interpolate(template, values = {}) {
    if (!template || typeof template !== 'string') {
        return template;
    }
    
    return template.replace(/\{(\w+)\}/g, (match, key) => {
        return values.hasOwnProperty(key) ? values[key] : match;
    });
}

/**
 * Get localized string with optional interpolation
 * WHY: Central function for all string retrieval with future localization support
 * 
 * @param {string} key - Dot-notation key (e.g., 'STATUS.READING_FILE')
 * @param {Object} values - Optional interpolation values
 * @returns {string} - Localized string
 */
export function getString(key, values = {}) {
    const keys = key.split('.');
    let result = STRINGS;
    
    for (const k of keys) {
        if (result && typeof result === 'object' && k in result) {
            result = result[k];
        } else {
            console.warn(`String key not found: ${key}`);
            return key; // Return key as fallback
        }
    }
    
    if (typeof result !== 'string') {
        console.warn(`String key does not point to a string: ${key}`);
        return key;
    }
    
    return interpolate(result, values);
}

/**
 * Pluralization helper
 * WHY: Handle singular/plural forms for different languages
 * 
 * @param {number} count - Number for pluralization
 * @param {string} singular - Singular form
 * @param {string} plural - Plural form (optional, defaults to singular + 's')
 * @returns {string} - Correctly pluralized string
 */
export function pluralize(count, singular, plural = null) {
    if (count === 1) {
        return singular;
    }
    return plural || (singular + 's');
}

/**
 * Format file size for display
 * WHY: Consistent file size formatting with localization support
 * 
 * @param {number} bytes - File size in bytes
 * @returns {string} - Formatted file size
 */
export function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format numbers with locale-aware formatting
 * WHY: Consistent number formatting across the application
 * 
 * @param {number} number - Number to format
 * @param {string} locale - Locale for formatting (defaults to browser locale)
 * @returns {string} - Formatted number
 */
export function formatNumber(number, locale = navigator.language) {
    return new Intl.NumberFormat(locale).format(number);
}

/**
 * Future: Load locale-specific strings
 * WHY: Enable runtime language switching
 * 
 * @param {string} locale - Locale code (e.g., 'es', 'fr', 'de')
 * @returns {Promise<Object>} - Locale-specific strings
 */
export async function loadLocale(locale) {
    // Placeholder for future locale loading
    // Could load from JSON files, API endpoints, etc.
    console.log(`Loading locale: ${locale} (not implemented yet)`);
    return STRINGS; // Return default for now
}

// Export commonly used string getters for convenience
export const status = (key, values) => getString(`STATUS.${key}`, values);
export const error = (key, values) => getString(`ERRORS.${key}`, values);
export const success = (key, values) => getString(`SUCCESS.${key}`, values);
export const info = (key, values) => getString(`INFO.${key}`, values);
export const ui = (key, values) => getString(`UI.${key}`, values);
export const message = (key, values) => getString(`MESSAGES.${key}`, values);

export default STRINGS; 