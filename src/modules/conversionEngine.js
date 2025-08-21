/**
 * Conversation Conversion Engine
 * Handles parsing ChatGPT conversations and converting to Markdown
 * Following AGENTS.md principle: focused, single-responsibility modules
 */

import { 
    generateUniqueFilename, 
    formatTimestamp, 
    sortConversationsChronologically,
    buildObsidianFilename,
    formatLondonCreatedHuman,
    formatLondonHHmm,
    splitByCodeFences,
    ensureClosedFences,
    linkifyText,
    normalizeText
} from '../utils/helpers.js';
import { logInfo, logDebug } from '../utils/logger.js';

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
    const createTime = message.create_time || null;
    
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
        content: textContent.trim(),
        createTime
    };
}

/**
 * Format message content as blockquotes while preserving line breaks
 * WHY: Blockquotes provide better visual distinction for message content
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
 * WHY: Markdown requires consistent formatting for proper rendering
 * 
 * @param {Object} conversation - ChatGPT conversation object
 * @returns {string} - Formatted Markdown content
 */
export function convertConversationToMarkdown(conversation) {
    const title = conversation.title || 'Untitled Conversation';
    const createTime = conversation.create_time || 0;
    const mapping = conversation.mapping || {};
    
    const messages = extractMessagesFromMapping(mapping);
    // Frontmatter (Obsidian-optimized)
    const baseDate = new Date(createTime * 1000);
    const createdHuman = formatLondonCreatedHuman(baseDate);
    const fm = [
        '---',
        `created: ${createdHuman}`,
        'tags: [chatgpt]',
        conversation?.url ? `url: ${conversation.url}` : null,
        '---',
        ''
    ].filter(Boolean).join('\n');

    const lines = [fm];

    // Per-message callouts (Obsidian-friendly, collapse rules by role)
    messages.forEach((m, idx) => {
        const isUser = m.author === 'user';
        const icon = isUser ? '🧑‍💬' : '🤖';
        const label = isUser ? 'User' : 'Assistant';
        const msgDate = m.createTime ? new Date(m.createTime * 1000) : null;
        const timeLabel = msgDate ? formatLondonHHmm(msgDate) : `#${idx + 1}`;

        // Split content to avoid cleaning inside code
        const segments = splitByCodeFences(m.content || '');
        const processed = segments.map(seg => {
            if (seg.type === 'code') return seg.content; // preserve as-is
            // outside code: cleanup
            const withLinks = linkifyText(seg.content);
            return normalizeText(withLinks);
        }).join('');

        const safe = ensureClosedFences(processed).trim();

        // Callout header: User open by default, Assistant collapsed by default
        const calloutHeader = isUser
            ? `> [!note] ${icon} ${label} — ${timeLabel}`
            : `> [!info]- ${icon} ${label} — ${timeLabel}`;
        lines.push(calloutHeader);

        // Callout content must be quoted with a single blockquote level
        const quotedContent = formatAsBlockquote(safe);
        lines.push(quotedContent);

        // Blank line to separate callouts (not part of the callout block)
        lines.push('');
    });

    const content = lines.join('\n');
    // Clean broken citation artifacts (e.g., citeturn0search12.)
    // Unicode range \uE000-\uF8FF is Private Use Area, covers these weird chars
    const cleanedContent = cleanCitationArtifacts(content);
    return cleanedContent;
}

/**
 * Clean citation artifacts using multi-pass approach
 * WHY: Different citation patterns require different regex strategies for complete removal
 * 
 * @param {string} content - Raw content that may contain citation artifacts
 * @returns {string} - Content with all citation artifacts removed
 */
function cleanCitationArtifacts(content) {
    let cleaned = content;
    
    // Pattern 1: Remove complex citation patterns with Unicode characters
    cleaned = cleaned.replace(/[\uE000-\uF8FF]*(?:cite|navlist)[\uE000-\uF8FF]*.*?turn\d+(?:search|news)\d+[\uE000-\uF8FF]*\.?/g, '');
    
    // Pattern 2: Remove simple turn patterns with Unicode
    cleaned = cleaned.replace(/turn\d+(?:search|news)\d+[\uE000-\uF8FF]*\.?/g, '');
    
    // Pattern 3: Remove any remaining turn patterns without Unicode
    cleaned = cleaned.replace(/turn\d+(?:search|news)\d+\.?/g, '');
    
    // Pattern 4: Remove any remaining Unicode citation artifacts
    cleaned = cleaned.replace(/[\uE000-\uF8FF]+/g, '');
    
    return cleaned;
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
    logInfo(`📅 Processing ${sortedConversations.length} conversations in chronological order (oldest first)`);
    logDebug(`🕐 This ensures consistent chronological ordering of conversations`);
    
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
        logDebug(`Skipping: ${conversation.title || 'Untitled'} (already processed)`);
        return { skipped: true };
    }
    
    // Convert to Markdown
    const markdownContent = convertConversationToMarkdown(conversation);
    
    // Generate obsidian-optimized filename
    let filename = buildObsidianFilename(conversation);
    // Ensure uniqueness in session
    let counter = 2;
    while (usedFilenames.includes(filename)) {
        const dot = filename.lastIndexOf('.');
        const base = filename.slice(0, dot);
        const ext = filename.slice(dot);
        filename = `${base} (${counter})${ext}`;
        counter++;
    }
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