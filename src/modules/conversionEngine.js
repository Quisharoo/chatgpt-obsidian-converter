/**
 * Conversation Conversion Engine
 * Handles parsing ChatGPT conversations and converting to Markdown
 * Following AGENTS.md principle: focused, single-responsibility modules
 */

import { generateUniqueFilename, formatTimestamp, sortConversationsChronologically } from '../utils/helpers.js';

/**
 * Extract and order messages from ChatGPT mapping structure
 * WHY: ChatGPT exports use a complex mapping structure that needs flattening
 * 
 * @param {Object} mapping - ChatGPT conversation mapping object
 * @returns {Array} - Ordered array of message objects
 */
function extractMessagesFromMapping(mapping) {
    const messages = [];
    
    // Find root message (conversation start point)
    let rootId = findRootMessage(mapping);
    if (!rootId) return messages;
    
    // Traverse conversation tree to build ordered message list
    const visited = new Set();
    let currentId = rootId;
    
    while (currentId && !visited.has(currentId)) {
        visited.add(currentId);
        const messageData = mapping[currentId] || {};
        const message = messageData.message || {};
        
        if (message?.content) {
            const processedMessage = extractMessageContent(message);
            if (processedMessage.content.trim()) {
                messages.push(processedMessage);
            }
        }
        
        // Move to next message in conversation thread
        const children = messageData.children || [];
        currentId = children.length > 0 ? children[0] : null;
    }
    
    return messages;
}

/**
 * Find the root message in a conversation mapping
 * WHY: Conversations need a starting point for chronological ordering
 * 
 * @param {Object} mapping - ChatGPT conversation mapping
 * @returns {string|null} - Root message ID or null if not found
 */
function findRootMessage(mapping) {
    // Look for message with no parent
    for (const [msgId, msgData] of Object.entries(mapping)) {
        if (msgData.parent === null && msgData.message) {
            return msgId;
        }
    }
    
    // Fallback: find first message with content
    for (const [msgId, msgData] of Object.entries(mapping)) {
        if (msgData.message?.content) {
            return msgId;
        }
    }
    
    return null;
}

/**
 * Extract content from message object, handling different content structures
 * WHY: ChatGPT exports have varying content formats that need normalization
 * 
 * @param {Object} message - Raw message object from ChatGPT export
 * @returns {Object} - Normalized message with author and content
 */
function extractMessageContent(message) {
    const author = message.author?.role || 'unknown';
    const content = message.content || {};
    
    let textContent = '';
    if (typeof content === 'object' && content.parts) {
        // Filter out non-string parts (citations, web search results, etc.)
        // to prevent garbled text like "citeturn0search2turn0search0"
        const textParts = content.parts.filter(part => typeof part === 'string');
        textContent = textParts.join('');
    } else if (typeof content === 'string') {
        textContent = content;
    }
    
    return {
        author: author,
        content: textContent.trim()
    };
}

/**
 * Format message content as blockquotes while preserving line breaks
 * WHY: Obsidian blockquotes provide better visual distinction for message content
 * 
 * @param {string} content - Raw message content
 * @returns {string} - Content formatted as blockquotes
 */
function formatAsBlockquote(content) {
    if (!content || typeof content !== 'string') {
        return '';
    }
    
    // Split by line breaks and prefix each non-empty line with '> '
    return content
        .split('\n')
        .map(line => line.trim() === '' ? '>' : `> ${line}`)
        .join('\n');
}

/**
 * Convert a single conversation to Markdown format
 * WHY: Obsidian uses Markdown, so we need consistent formatting
 * 
 * @param {Object} conversation - ChatGPT conversation object
 * @returns {string} - Formatted Markdown content
 */
export function convertConversationToMarkdown(conversation) {
    const title = conversation.title || 'Untitled Conversation';
    const createTime = conversation.create_time || 0;
    const mapping = conversation.mapping || {};
    
    const messages = extractMessagesFromMapping(mapping);
    
    // Build Markdown with Obsidian-optimized structure
    // Format timestamp as YYYY-MM-DD, HH:mm:ss for consistency
    const timestamp = new Date(createTime * 1000);
    const formattedTimestamp = `${timestamp.getFullYear()}-${String(timestamp.getMonth() + 1).padStart(2, '0')}-${String(timestamp.getDate()).padStart(2, '0')}, ${String(timestamp.getHours()).padStart(2, '0')}:${String(timestamp.getMinutes()).padStart(2, '0')}:${String(timestamp.getSeconds()).padStart(2, '0')}`;
    
    const contentLines = [
        `**Created:** ${formattedTimestamp}`,
        '',
        '---',
        ''
    ];
    
    // Add formatted messages with clean Obsidian styling
    for (const message of messages) {
        const authorDisplay = message.author === 'user' 
            ? '**🧑‍💬 User**' 
            : '**🤖 Assistant**';
        
        contentLines.push(authorDisplay);
        contentLines.push('');
        
        // Format content as blockquotes while preserving original formatting
        const blockquotedContent = formatAsBlockquote(message.content);
        contentLines.push(blockquotedContent);
        contentLines.push('');
    }
    
    return contentLines.join('\n');
}

/**
 * Process array of conversations and convert to file objects
 * WHY: Batch processing with error handling and progress tracking
 * 
 * @param {Array} conversations - Array of ChatGPT conversation objects
 * @param {Set} processedIds - Already processed conversation IDs
 * @returns {Object} - Processing results with files array and statistics
 */
export function processConversations(conversations, processedIds = new Set()) {
    const results = {
        processed: 0,
        skipped: 0,
        errors: 0,
        files: []
    };
    
    // Sort chronologically for proper file creation order
    const sortedConversations = sortConversationsChronologically(conversations);
    console.log(`📅 Processing ${sortedConversations.length} conversations in chronological order (oldest first)`);
    console.log(`🕐 This ensures newest conversations appear at top when sorted by creation date in Obsidian`);
    
    const usedFilenames = [];
    
    for (const conversation of sortedConversations) {
        try {
            const result = processSingleConversation(conversation, processedIds, usedFilenames);
            
            if (result.skipped) {
                results.skipped++;
            } else if (result.file) {
                results.files.push(result.file);
                results.processed++;
                processedIds.add(conversation.id);
            }
        } catch (error) {
            console.error(`Error processing conversation '${conversation.title || 'Unknown'}':`, error);
            results.errors++;
        }
    }
    
    return results;
}

/**
 * Process a single conversation with validation and error handling
 * WHY: Isolates single conversation processing for better error containment
 * 
 * @param {Object} conversation - Individual conversation object
 * @param {Set} processedIds - Already processed conversation IDs  
 * @param {Array} usedFilenames - Already used filenames for duplicate prevention
 * @returns {Object} - Processing result for single conversation
 */
function processSingleConversation(conversation, processedIds, usedFilenames) {
    const conversationId = conversation.id;
    
    if (!conversationId) {
        throw new Error('Conversation without ID found');
    }
    
    // Skip duplicates
    if (processedIds.has(conversationId)) {
        console.log(`Skipping: ${conversation.title || 'Untitled'} (already processed)`);
        return { skipped: true };
    }
    
    // Convert to Markdown
    const markdownContent = convertConversationToMarkdown(conversation);
    
    // Generate unique filename
    const filename = generateUniqueFilename(conversation, usedFilenames);
    usedFilenames.push(filename);
    
    return {
        file: {
            filename: filename,
            content: markdownContent,
            title: conversation.title || 'Untitled',
            conversationId: conversationId,
            createTime: conversation.create_time || 0, // Add creation time for sorting and display
            createdDate: new Date((conversation.create_time || 0) * 1000).toLocaleDateString() // Formatted date for display
        }
    };
} 