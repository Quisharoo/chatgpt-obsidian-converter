/**
 * Utility Functions
 * Pure functions for common operations without side effects
 * Following AGENTS.md principle: small, focused modules
 */

import { FILE_SYSTEM, PROCESSING_CONFIG } from './constants.js';

/**
 * Get ordinal suffix for a day of month
 * @param {number} day
 * @returns {string}
 */
function getOrdinalSuffix(day) {
    const j = day % 10, k = day % 100;
    if (j === 1 && k !== 11) return 'st';
    if (j === 2 && k !== 12) return 'nd';
    if (j === 3 && k !== 13) return 'rd';
    return 'th';
}

/**
 * Format a Date to London timezone parts
 * @param {Date} date
 * @returns {{weekday:string, month:string, day:number, year:number, hour12:number, minute:number, ampm:string}}
 */
export function getLondonParts(date) {
    const tz = 'Europe/London';
    const dateFormatter = new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const timeFormatter = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true });
    const dParts = dateFormatter.formatToParts(date);
    const tParts = timeFormatter.formatToParts(date);
    const mapParts = (parts) => Object.fromEntries(parts.map(p => [p.type, p.value]));
    const d = mapParts(dParts);
    const t = mapParts(tParts);
    const hour12 = parseInt(t.hour || '0', 10);
    const minute = parseInt((t.minute || '0').padStart(2, '0'), 10);
    const ampm = (t.dayPeriod || '').toLowerCase();
    return { weekday: d.weekday, month: d.month, day: parseInt(d.day || '0', 10), year: parseInt(d.year || '0', 10), hour12, minute, ampm };
}

/**
 * Format human-readable London date with ordinals, e.g., Monday, August 18th 2025
 */
export function formatLondonHumanDate(date) {
    const p = getLondonParts(date);
    return `${p.weekday}, ${p.month} ${p.day}${getOrdinalSuffix(p.day)} ${p.year}`;
}

/**
 * Format London time HH:mm (24-hour)
 */
export function formatLondonHHmm(date) {
    const tz = 'Europe/London';
    const f = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
    return f.format(date);
}

/**
 * Format London time human-readable: h:mm am/pm (lowercase)
 */
export function formatLondonTimeHuman(date) {
    const p = getLondonParts(date);
    return `${p.hour12}:${String(p.minute).padStart(2, '0')} ${p.ampm}`;
}

/**
 * Format London time for filenames: HH.mm (24-hour)
 */
export function formatLondonTimeFile(date) {
    const tz = 'Europe/London';
    const f = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
    return f.format(date).replace(':', '.');
}

/**
 * Format London created string for frontmatter: Monday, August 18th 2025, 1:23 pm
 */
export function formatLondonCreatedHuman(date) {
    const p = getLondonParts(date);
    return `${p.weekday}, ${p.month} ${p.day}${getOrdinalSuffix(p.day)} ${p.year}, ${p.hour12}:${String(p.minute).padStart(2, '0')} ${p.ampm}`;
}

/**
 * Build Obsidian filename: <HumanTitle> — ChatGPT — YYYY-MM-DD HH.mm.md
 * HumanTitle is the London human date with ordinals
 */
export function buildObsidianFilename(conversation) {
    const timestampSec = conversation.create_time || 0;
    const date = new Date(timestampSec * 1000);
    const humanDate = formatLondonHumanDate(date);
    const hm = formatLondonTimeFile(date);
    const rawTitle = conversation.title || 'Untitled Conversation';
    const safeTitle = cleanFilename(rawTitle) || 'Untitled Conversation';
    const filename = `${safeTitle} — ${humanDate} — ${hm}.md`;
    return filename;
}

/**
 * Build Date-based filename: YYYY-MM-DD — Title — HH.mm.md
 */
export function buildDateBasedFilename(conversation) {
    const timestampSec = conversation.create_time || 0;
    const date = new Date(timestampSec * 1000);
    const dateStr = date.toISOString().split('T')[0];
    const hm = formatLondonTimeFile(date);
    const rawTitle = conversation.title || 'Untitled Conversation';
    const safeTitle = cleanFilename(rawTitle) || 'Untitled Conversation';
    return `${dateStr} — ${safeTitle} — ${hm}.md`;
}

/**
 * Build Zettelkasten filename: yyyymmddHHmm Title.md
 */
export function buildZettelFilename(conversation) {
    const timestampSec = conversation.create_time || 0;
    const d = new Date(timestampSec * 1000);
    const pad = (n, w=2) => String(n).padStart(w, '0');
    const id = `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}`;
    const rawTitle = conversation.title || 'Untitled Conversation';
    const safeTitle = cleanFilename(rawTitle) || 'Untitled Conversation';
    return `${id} ${safeTitle}.md`;
}

/**
 * Preferences storage helpers (localStorage)
 */
const PREFS_KEY = 'chatgpt_md_prefs';

export function getPreferences() {
    try {
        const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(PREFS_KEY) : null;
        const parsed = raw ? JSON.parse(raw) : {};
        return {
            filenamePreset: 'obsidian',
            frontmatterEnabled: true,
            includeParticipants: true,
            includeSource: true,
            generateIndex: true,
            theme: 'dark',
            ...parsed
        };
    } catch (_) {
        return { filenamePreset: 'obsidian', frontmatterEnabled: true, includeParticipants: true, includeSource: true, generateIndex: true, theme: 'dark' };
    }
}

export function setPreferences(nextPrefs) {
    try {
        const current = getPreferences();
        const merged = { ...current, ...nextPrefs };
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(PREFS_KEY, JSON.stringify(merged));
        }
        return merged;
    } catch (_) {
        return nextPrefs;
    }
}

export function getPreference(key, fallback) {
    const prefs = getPreferences();
    return Object.prototype.hasOwnProperty.call(prefs, key) ? prefs[key] : fallback;
}

/**
 * Choose filename builder based on preferences
 */
export function buildFilenameFromPreset(conversation) {
    const preset = getPreference('filenamePreset', 'obsidian');
    if (preset === 'date') return buildDateBasedFilename(conversation);
    if (preset === 'zettel') return buildZettelFilename(conversation);
    return buildObsidianFilename(conversation);
}

/**
 * Build an index note linking all converted files
 */
export function buildIndexNote(files) {
    const sorted = [...files].sort((a, b) => (a.createTime || 0) - (b.createTime || 0));
    const lines = ['# ChatGPT Index', ''];
    for (const f of sorted) {
        const date = f.createdDate || '';
        lines.push(`- [${f.title}](${f.filename})${date ? ` — ${date}` : ''}`);
    }
    return {
        filename: 'ChatGPT Index.md',
        content: lines.join('\n'),
        title: 'ChatGPT Index',
        conversationId: 'index',
        createTime: Date.now() / 1000,
        createdDate: new Date().toLocaleDateString()
    };
}

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

/**
 * Split content into alternating text/code segments using fenced blocks
 * Returns array of { type: 'text'|'code', fence?: string, content: string }
 */
export function splitByCodeFences(content) {
    const segments = [];
    const fenceRegex = /```([a-zA-Z0-9_-]*)\n[\s\S]*?```/g;
    let lastIndex = 0;
    let match;
    while ((match = fenceRegex.exec(content)) !== null) {
        const start = match.index;
        if (start > lastIndex) {
            segments.push({ type: 'text', content: content.slice(lastIndex, start) });
        }
        const lang = match[1] || '';
        const fenceBlock = match[0];
        segments.push({ type: 'code', fence: lang || 'txt', content: fenceBlock });
        lastIndex = start + fenceBlock.length;
    }
    if (lastIndex < content.length) {
        segments.push({ type: 'text', content: content.slice(lastIndex) });
    }
    return segments;
}

/**
 * Ensure all code fences are closed; if odd number, append closing ```txt
 */
export function ensureClosedFences(markdown) {
    const count = (markdown.match(/```/g) || []).length;
    if (count % 2 === 1) {
        return markdown + '\n```\n';
    }
    return markdown;
}

/**
 * Linkify bare URLs in plain text segments
 */
export function linkifyText(text) {
    const urlRegex = /(?<!\]\()\b(https?:\/\/[\w.-]+(?:\/[\w\-._~:/?#[\]@!$&'()*+,;=%]*)?)/g;
    return text.replace(urlRegex, (url) => `[${url}](${url})`);
}

/**
 * Normalize whitespace and basic punctuation (outside code)
 */
export function normalizeText(text) {
    let t = text.replace(/[\u00A0\t]+/g, ' ');
    // Trim trailing spaces on each line
    t = t.split('\n').map(line => line.replace(/\s+$/g, '')).join('\n');
    // Collapse excessive blank lines (keep at most two)
    t = t.replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
    // Smart punctuation normalization (outside code)
    // Curly quotes → straight
    t = t
        .replace(/[\u2018\u2019\u201B]/g, "'")
        .replace(/[\u201C\u201D\u201F]/g, '"');
    // Em/en dashes → hyphen
    t = t.replace(/[\u2013\u2014]/g, '-');
    return t;
}

/**
 * Demote heading levels in plain text (outside code blocks).
 * Ensures outer H2 message headings remain the highest level within the message.
 * Example: '## Title' -> '### Title' when minLevel = 2
 */
export function demoteHeadings(text, minLevel = 2) {
    // Process line-by-line; only adjust lines that start with heading hashes
    return text
        .split('\n')
        .map(line => {
            const match = line.match(/^(#{1,6})\s+(.*)$/);
            if (!match) return line;
            const level = match[1].length;
            if (level >= minLevel) {
                const newLevel = Math.min(level + 1, 6);
                return `${'#'.repeat(newLevel)} ${match[2]}`;
            }
            return line;
        })
        .join('\n');
}

/**
 * Prevent unintended Setext H2 headings from '---' lines under text.
 * Convert standalone '---' lines to '***' so they render as horizontal rules
 * without turning the previous line into a Setext heading in Obsidian/CommonMark.
 * Applies only to plain text (not code fences) at message level.
 */
export function avoidSetextFromHyphens(text) {
    return text
        .split('\n')
        .map(line => (/^\s{0,3}-{3,}\s*$/.test(line) ? '***' : line))
        .join('\n');
}