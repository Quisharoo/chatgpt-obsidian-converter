/**
 * Utility Functions
 * Pure functions for common operations without side effects
 * Following AGENTS.md principle: small, focused modules
 */

import { FILE_SYSTEM, PROCESSING_CONFIG } from './constants.js';

/**
 * Clean text for safe filename usage while maintaining readability
 * WHY: Filenames must be filesystem-compatible but remain human-readable
 * 
 * @param {string} text - Raw text to clean
 * @returns {string} - Filesystem-safe, readable filename
 */
export function cleanFilename(text) {
    return text
        .replace(/[<>:"/\\|?*]/g, '') // Remove invalid filename characters
        .replace(/[^\w\s.-]/g, '')    // Keep only letters, numbers, spaces, dots, hyphens
        .replace(/\s+/g, ' ')         // Collapse multiple spaces
        .trim()                       // Remove leading/trailing spaces
        .substring(0, PROCESSING_CONFIG.MAX_FILENAME_LENGTH); // Limit length for compatibility
}

/**
 * Generate unique filename with duplicate handling
 * WHY: Prevents file overwrites while maintaining readable names
 * 
 * @param {Object} conversation - Conversation object with title
 * @param {string[]} existingFilenames - Already used filenames
 * @returns {string} - Unique filename with .md extension
 */
export function generateUniqueFilename(conversation, existingFilenames = []) {
    const title = conversation.title || FILE_SYSTEM.DEFAULT_FILENAME;
    const baseFilename = cleanFilename(title) || FILE_SYSTEM.DEFAULT_FILENAME;
    
    let filename = `${baseFilename}${FILE_SYSTEM.OUTPUT_EXTENSION}`;
    let counter = 2;
    
    // Add numeric suffix for duplicates
    while (existingFilenames.includes(filename)) {
        filename = `${baseFilename} (${counter})${FILE_SYSTEM.OUTPUT_EXTENSION}`;
        counter++;
    }
    
    return filename;
}

/**
 * Format Unix timestamp to readable date string
 * WHY: Provides consistent date formatting across the application
 * 
 * @param {number} timestamp - Unix timestamp in seconds
 * @returns {string} - Formatted date string
 */
export function formatTimestamp(timestamp) {
    return new Date(timestamp * 1000).toISOString().split('T')[0];
}

/**
 * Create delay promise for timing control
 * WHY: Ensures proper file creation timestamps for chronological ordering
 * 
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise} - Promise that resolves after delay
 */
export function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Validate file type for upload
 * WHY: Prevents processing of invalid files early in the pipeline
 * 
 * @param {File} file - File object to validate
 * @returns {boolean} - Whether file is valid JSON
 */
export function isValidJsonFile(file) {
    return FILE_SYSTEM.SUPPORTED_MIME_TYPES.includes(file.type) || 
           FILE_SYSTEM.SUPPORTED_EXTENSIONS.some(ext => file.name.toLowerCase().endsWith(ext));
}

/**
 * Sort conversations chronologically for proper file creation order
 * WHY: Oldest-first creation ensures consistent chronological ordering
 * 
 * @param {Array} conversations - Array of conversation objects
 * @returns {Array} - Sorted conversations (oldest first)
 */
export function sortConversationsChronologically(conversations) {
    return conversations
        .filter(conv => conv && typeof conv === 'object')
        .sort((a, b) => {
            const timeA = a.create_time || 0;
            const timeB = b.create_time || 0;
            return timeA - timeB; // Ascending order (oldest first)
        });
} 