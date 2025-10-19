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
    normalizeText,
    demoteHeadings,
    avoidSetextFromHyphens,
    getPreference,
    buildFilenameFromPreset
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
    if (typeof content === 'object' && Array.isArray(content.parts)) {
        const parts = content.parts;
        const mapped = parts.map(part => {
            if (typeof part === 'string') return part;
            // Placeholder for non-text parts (images, citations, etc.)
            return '_Image omitted_';
        });
        textContent = mapped.join('');
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
    // Programmatic breakpoint to inspect conversation objects and message extraction
    /* istanbul ignore next */
    const title = conversation.title || 'Untitled Conversation';
    const createTime = conversation.create_time || 0;
    const mapping = conversation.mapping || {};
    
    const messages = extractMessagesFromMapping(mapping);
    // Frontmatter (configurable)
    const baseDate = new Date(createTime * 1000);
    const createdHuman = formatLondonCreatedHuman(baseDate);
    const convUrl = conversation?.id ? `https://chat.openai.com/c/${conversation.id}` : null;
    const frontmatterEnabled = getPreference('frontmatterEnabled', true);
    const includeParticipants = getPreference('includeParticipants', true);
    const includeSource = getPreference('includeSource', true);
    const fmLines = [];
    if (frontmatterEnabled) {
        fmLines.push('---');
        fmLines.push(`created: ${createdHuman}`);
        fmLines.push('tags: [chatgpt]');
        if (includeParticipants) {
            fmLines.push('participants: [user, assistant]');
        }
        if (includeSource && convUrl) {
            fmLines.push(`source: chatgpt`);
            fmLines.push(`url: ${convUrl}`);
        }
        fmLines.push('---');
        fmLines.push('');
    }

    const lines = frontmatterEnabled ? fmLines : [];

    // Per-message sections rendered as headings (foldable in Obsidian)
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
            // Demote inner headings so the H2 wrapper folds everything beneath
            const normalized = normalizeText(withLinks);
            const demoted = demoteHeadings(normalized, 2);
            return demoted;
        }).join('');

        // Avoid Setext H2 from '---' lines and ensure fences closed
        const safe = ensureClosedFences(avoidSetextFromHyphens(processed)).trim();

        // Heading style for foldable sections in Obsidian Reading/Edit modes
        const heading = `## ${icon} ${label} — ${timeLabel}`;
        lines.push(heading);
        lines.push('');
        lines.push(safe);
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
    
    // Remove sequences that match the known artifact shapes only, avoid generic PUA wipes first
    cleaned = cleaned.replace(/[\uE000-\uF8FF]*(?:cite|navlist)[\uE000-\uF8FF]*.*?turn\d+(?:search|news)\d+[\uE000-\uF8FF]*\.?/g, '');
    cleaned = cleaned.replace(/turn\d+(?:search|news)\d+[\uE000-\uF8FF]*\.?/g, '');
    cleaned = cleaned.replace(/turn\d+(?:search|news)\d+\.?/g, '');
    
    // Only remove leftover contiguous PUA runs that are isolated (surrounded by whitespace or punctuation)
    // Avoid lookbehind for Safari compatibility by capturing the prefix/suffix
    cleaned = cleaned.replace(/(^|\s|[.,;:!?])[\uE000-\uF8FF]+(\s|[.,;:!?]|$)/g, '$1$2');
    
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
 * Progressively process conversations with progress callbacks and UI-friendly yielding
 * WHY: Enables real-time progress bar updates during long conversions without blocking the UI
 *
 * @param {Array} conversations - Array of ChatGPT conversation objects
 * @param {Set} processedIds - Already processed conversation IDs
 * @param {Function} onProgress - Callback receiving { percent, completed, total, message }
 * @param {number} yieldEvery - Yield to event loop every N items (default 10)
 * @returns {Promise<Object>} - Same shape as processConversations
 */
export async function processConversationsProgressive(
    conversations,
    processedIds = new Set(),
    onProgress = () => {},
    yieldEvery = 10
) {
    const results = {
        processed: 0,
        skipped: 0,
        errors: 0,
        files: []
    };

    const microYield = () => new Promise((r) => setTimeout(r, 0));

    // Sort chronologically for proper file creation order
    const sortedConversations = sortConversationsChronologically(conversations);
    const total = sortedConversations.length;

    onProgress({ percent: 0, completed: 0, total, message: 'Starting conversion…' });

    const usedFilenames = [];
    let index = 0;
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

        index++;
        const completed = results.processed + results.skipped + results.errors;
        const percent = total > 0 ? Math.min(100, Math.floor((completed / total) * 100)) : 100;
        const msgTitle = conversation?.title || 'Untitled';
        onProgress({ percent, completed, total, message: `Converting: ${msgTitle}` });

        if (index % yieldEvery === 0) {
            await microYield();
        }
    }

    onProgress({ percent: 100, completed: total, total, message: 'Conversion complete' });
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
    
    // Generate filename based on preset
    let filename = buildFilenameFromPreset(conversation);
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