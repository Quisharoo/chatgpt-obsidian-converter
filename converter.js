/**
 * ChatGPT to Obsidian Converter - JavaScript Implementation
 * Converts ChatGPT conversation exports to Obsidian-friendly Markdown files
 */

// Global variables to track state
let convertedFiles = [];
let processedIds = new Set();
let selectedDirectoryHandle = null;

/**
 * Check if File System Access API is supported
 */
function isFileSystemAccessSupported() {
    return 'showDirectoryPicker' in window;
}

/**
 * Prompt user to select a directory for saving files
 */
async function selectSaveDirectory() {
    if (!isFileSystemAccessSupported()) {
        showStatus('File System Access API not supported. Files will be downloaded instead.', 'info');
        return null;
    }

    try {
        // Simplified directory picker options to avoid permission issues
        const directoryHandle = await window.showDirectoryPicker({
            mode: 'readwrite'
            // Removed startIn parameter as it can cause issues on some systems
        });
        
        selectedDirectoryHandle = directoryHandle;
        showStatus(`✅ Selected directory: ${directoryHandle.name}. Now click "Save to Local Folder" to save your files!`, 'success');
        
        // Update the UI to show the selected folder and next steps
        updateDirectorySelection(directoryHandle.name);
        
        return directoryHandle;
    } catch (error) {
        if (error.name === 'AbortError') {
            showStatus('Directory selection cancelled', 'info');
        } else if (error.name === 'NotAllowedError') {
            showStatus('❌ Permission denied. Try selecting a different folder or use downloads instead.', 'error');
        } else if (error.name === 'SecurityError') {
            showStatus('❌ Security restriction. Try a folder in your Documents or Desktop.', 'error');
        } else {
            console.error('Error selecting directory:', error);
            showStatus(`❌ Error: ${error.message}. Files will be downloaded instead.`, 'error');
        }
        return null;
    }
}

/**
 * Alternative simplified directory picker for problematic cases
 */
async function selectSaveDirectorySimple() {
    if (!isFileSystemAccessSupported()) {
        showStatus('File System Access API not supported. Files will be downloaded instead.', 'info');
        return null;
    }

    try {
        // Even more simplified approach - no options at all
        const directoryHandle = await window.showDirectoryPicker();
        
        selectedDirectoryHandle = directoryHandle;
        showStatus(`✅ Selected directory: ${directoryHandle.name}. Now click "Save to Local Folder" to save your files!`, 'success');
        
        // Update the UI to show the selected folder and next steps
        updateDirectorySelection(directoryHandle.name);
        
        return directoryHandle;
    } catch (error) {
        console.error('Simple directory picker failed:', error);
        showStatus('❌ Directory selection failed. Using download mode.', 'error');
        return null;
    }
}

/**
 * Save file to the selected directory
 */
async function saveFileToDirectory(filename, content, directoryHandle) {
    try {
        // Sanitize filename to avoid issues
        const safeFilename = filename.replace(/[<>:"/\\|?*]/g, '_');
        if (safeFilename !== filename) {
            console.warn(`Sanitized filename: ${filename} → ${safeFilename}`);
        }
        
        // Create or get file handle
        const fileHandle = await directoryHandle.getFileHandle(safeFilename, {
            create: true
        });
        
        // Check if we can write to this file
        const permission = await fileHandle.requestPermission({ mode: 'readwrite' });
        if (permission !== 'granted') {
            console.error(`Permission denied for file: ${safeFilename}`);
            return false;
        }
        
        // Create writable stream
        const writable = await fileHandle.createWritable();
        
        // Write content
        await writable.write(content);
        
        // Close the stream
        await writable.close();
        
        return true;
    } catch (error) {
        console.error(`Error saving file ${filename}:`, error);
        
        // Provide specific error messages for common issues
        if (error.name === 'NotAllowedError') {
            console.error(`Permission denied for file: ${filename}`);
        } else if (error.name === 'QuotaExceededError') {
            console.error(`Storage quota exceeded when saving: ${filename}`);
        } else if (error.name === 'InvalidModificationError') {
            console.error(`File is being modified by another process: ${filename}`);
        }
        
        return false;
    }
}

/**
 * Save all files to local directory or download as fallback
 */
async function saveFilesLocally(files) {
    console.log('🚀 saveFilesLocally called with:', files.length, 'files');
    console.log('📁 Selected directory handle:', selectedDirectoryHandle);
    
    if (!selectedDirectoryHandle) {
        showStatus('ℹ️ Please select a folder first', 'info');
        console.warn('❌ No directory selected');
        return { successCount: 0, errorCount: 0 };
    }

    let successCount = 0;
    let errorCount = 0;

    // Verify directory handle is still valid
    try {
        await selectedDirectoryHandle.requestPermission({ mode: 'readwrite' });
    } catch (error) {
        console.error('Permission check failed:', error);
        showStatus('❌ Directory access lost. Please select folder again.', 'error');
        selectedDirectoryHandle = null;
        return { successCount: 0, errorCount: 0 };
    }

    // Create ChatGPT subdirectory
    let chatgptDirHandle;
    try {
        chatgptDirHandle = await selectedDirectoryHandle.getDirectoryHandle('ChatGPT', {
            create: true
        });
        console.log('✅ ChatGPT directory ready');
    } catch (error) {
        console.error('Error creating ChatGPT directory:', error);
        if (error.name === 'NotAllowedError') {
            showStatus('❌ Permission denied creating ChatGPT folder. Try a different directory.', 'error');
        } else {
            showStatus(`❌ Error creating ChatGPT directory: ${error.message}. Using downloads instead.`, 'error');
        }
        return downloadAllFiles(files);
    }

    // Show progress
    showStatus(`💾 Saving ${files.length} files to ChatGPT folder...`, 'info');
    console.log(`🔄 Starting save process: ${files.length} files to ${selectedDirectoryHandle.name}/ChatGPT/`);

    // Save each file
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
            const success = await saveFileToDirectory(file.filename, file.content, chatgptDirHandle);
            if (success) {
                successCount++;
                console.log(`✅ Saved: ${file.filename}`);
            } else {
                errorCount++;
                console.warn(`❌ Failed to save: ${file.filename}`);
            }
        } catch (error) {
            console.error(`❌ Error saving ${file.filename}:`, error);
            errorCount++;
        }
        
        // Update progress
        const progress = Math.round(((i + 1) / files.length) * 100);
        showStatus(`💾 Saving files... ${progress}% (${successCount + errorCount}/${files.length})`, 'info');
    }

    // Show final results
    if (successCount > 0) {
        const message = `✅ Saved ${successCount} files to ChatGPT folder${errorCount > 0 ? ` (${errorCount} errors)` : ''}`;
        showStatus(message, 'success');
        
        // Show helpful message about location
        const locationMsg = `📁 Files saved to: ${selectedDirectoryHandle.name}/ChatGPT/`;
        console.log(locationMsg);
        
        // Add a helpful message to the status
        setTimeout(() => {
            showStatus(`✅ SUCCESS! Check your ${selectedDirectoryHandle.name}/ChatGPT/ folder for the files`, 'success');
        }, 1000);
    } else {
        showStatus('❌ Failed to save any files. Check permissions or try downloading instead.', 'error');
    }

    return { successCount, errorCount };
}

/**
 * Update UI after directory selection to show next steps
 */
function updateDirectorySelection(directoryName) {
    // Find all save buttons and update their appearance
    const saveButtons = document.querySelectorAll('[onclick*="saveFilesLocally"]');
    saveButtons.forEach(button => {
        button.style.background = '#28a745';
        button.style.animation = 'pulse 2s infinite';
        button.textContent = `💾 Save ${convertedFiles.length} files to ${directoryName}/ChatGPT/`;
    });
    
    // Add CSS animation for the pulse effect
    if (!document.getElementById('pulseStyle')) {
        const style = document.createElement('style');
        style.id = 'pulseStyle';
        style.textContent = `
            @keyframes pulse {
                0% { box-shadow: 0 0 0 0 rgba(40, 167, 69, 0.7); }
                70% { box-shadow: 0 0 0 10px rgba(40, 167, 69, 0); }
                100% { box-shadow: 0 0 0 0 rgba(40, 167, 69, 0); }
            }
        `;
        document.head.appendChild(style);
    }
}

/**
 * Download all files individually (fallback method)
 */
function downloadAllFiles(files) {
    let downloadCount = 0;
    
    for (const file of files) {
        try {
            const blob = createDownloadBlob(file.content);
            downloadFile(blob, file.filename);
            downloadCount++;
        } catch (error) {
            console.error(`Error downloading ${file.filename}:`, error);
        }
    }
    
    showStatus(`📥 Downloaded ${downloadCount} files`, 'success');
    return { successCount: downloadCount, errorCount: 0 };
}

/**
 * Convert text to a URL-safe slug suitable for filenames
 */
function slugify(text) {
    return text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '') // Remove special characters
        .replace(/[-\s]+/g, '-')   // Replace spaces and multiple hyphens with single hyphen
        .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Convert UNIX timestamp to YYYY-MM-DD format
 */
function formatTimestamp(timestamp) {
    return new Date(timestamp * 1000).toISOString().split('T')[0];
}

/**
 * Extract and order messages from the ChatGPT mapping structure
 */
function extractMessages(mapping) {
    const messages = [];
    
    // Find the root message (usually has no parent)
    let rootId = null;
    for (const [msgId, msgData] of Object.entries(mapping)) {
        if (msgData.parent === null && msgData.message) {
            rootId = msgId;
            break;
        }
    }
    
    if (!rootId) {
        // Fallback: use first message with content
        for (const [msgId, msgData] of Object.entries(mapping)) {
            if (msgData.message && msgData.message.content) {
                rootId = msgId;
                break;
            }
        }
    }
    
    if (!rootId) {
        return messages;
    }
    
    // Traverse the conversation tree starting from root
    let currentId = rootId;
    const visited = new Set();
    
    while (currentId && !visited.has(currentId)) {
        visited.add(currentId);
        const msgData = mapping[currentId] || {};
        const message = msgData.message || {};
        
        if (message && message.content) {
            const author = message.author?.role || 'unknown';
            const content = message.content || {};
            
            // Handle different content structures
            let textContent = '';
            if (typeof content === 'object' && content.parts) {
                textContent = content.parts.join('');
            } else if (typeof content === 'string') {
                textContent = content;
            }
            
            if (textContent.trim()) {
                messages.push({
                    author: author,
                    content: textContent.trim()
                });
            }
        }
        
        // Find the next message in the conversation
        const children = msgData.children || [];
        currentId = children.length > 0 ? children[0] : null;
    }
    
    return messages;
}

/**
 * Convert a single conversation to Markdown format
 */
function convertConversationToMarkdown(conversation) {
    const title = conversation.title || 'Untitled Conversation';
    const createTime = conversation.create_time || 0;
    const mapping = conversation.mapping || {};
    
    // Extract and format messages
    const messages = extractMessages(mapping);
    
    // Build Markdown content
    const contentLines = [
        `# ${title}`,
        '',
        `**Created:** ${new Date(createTime * 1000).toLocaleString()}`,
        '',
        '---',
        ''
    ];
    
    for (const message of messages) {
        const author = message.author;
        const text = message.content;
        
        // Format author name
        const authorDisplay = author === 'user' ? '**User:**' : '**Assistant:**';
        
        contentLines.push(authorDisplay);
        contentLines.push('');
        contentLines.push(text);
        contentLines.push('');
    }
    
    return contentLines.join('\n');
}

/**
 * Generate filename in format: {date}_{slugified-title}_{conversation-id}.md
 */
function generateFilename(conversation) {
    const conversationId = conversation.id || 'unknown';
    const title = conversation.title || 'untitled';
    const createTime = conversation.create_time || 0;
    
    const dateStr = formatTimestamp(createTime);
    let titleSlug = slugify(title);
    
    // Truncate title slug if too long to keep filename reasonable
    if (titleSlug.length > 50) {
        titleSlug = titleSlug.substring(0, 50).replace(/-$/, '');
    }
    
    return `${dateStr}_${titleSlug}_${conversationId}.md`;
}

/**
 * Process conversations and convert to Markdown
 */
function processConversations(conversations) {
    const results = {
        processed: 0,
        skipped: 0,
        errors: 0,
        files: []
    };
    
    for (const conversation of conversations) {
        const conversationId = conversation.id;
        
        if (!conversationId) {
            console.warn('Warning: Conversation without ID found, skipping');
            results.errors++;
            continue;
        }
        
        // Skip if already processed in this session
        if (processedIds.has(conversationId)) {
            console.log(`Skipping: ${conversation.title || 'Untitled'} (already processed)`);
            results.skipped++;
            continue;
        }
        
        try {
            // Convert conversation to Markdown
            const markdownContent = convertConversationToMarkdown(conversation);
            
            // Generate filename
            const filename = generateFilename(conversation);
            
            // Create file object
            const fileData = {
                filename: filename,
                content: markdownContent,
                title: conversation.title || 'Untitled',
                conversationId: conversationId
            };
            
            results.files.push(fileData);
            processedIds.add(conversationId);
            results.processed++;
            
        } catch (error) {
            console.error(`Error processing conversation '${conversation.title || 'Unknown'}':`, error);
            results.errors++;
        }
    }
    
    return results;
}

/**
 * Create a downloadable blob from text content
 */
function createDownloadBlob(content, mimeType = 'text/markdown') {
    return new Blob([content], { type: mimeType });
}

/**
 * Trigger download of a file
 */
function downloadFile(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Create and download a ZIP file containing all converted files
 */
async function createZipDownload(files) {
    // For this we'll use a simple implementation without external libraries
    // In a production environment, you might want to use JSZip library
    
    // Simple ZIP creation (basic implementation)
    // For now, we'll create a text file with all conversations
    let combinedContent = '';
    
    for (const file of files) {
        combinedContent += `\n\n${'='.repeat(80)}\n`;
        combinedContent += `FILE: ${file.filename}\n`;
        combinedContent += `${'='.repeat(80)}\n\n`;
        combinedContent += file.content;
    }
    
    const blob = createDownloadBlob(combinedContent, 'text/plain');
    downloadFile(blob, 'chatgpt-conversations-all.txt');
}

/**
 * Update progress bar
 */
function updateProgress(percentage, message) {
    const progressFill = document.getElementById('progressFill');
    const statusText = document.getElementById('statusText');
    
    if (progressFill) {
        progressFill.style.width = `${percentage}%`;
    }
    
    if (statusText) {
        statusText.textContent = message;
    }
}

/**
 * Show status message
 */
function showStatus(message, type = 'info') {
    const statusElement = document.getElementById('statusText');
    if (statusElement) {
        statusElement.textContent = message;
        statusElement.className = `status ${type}`;
    }
}

/**
 * Display results and download options
 */
function displayResults(results) {
    const resultsDiv = document.getElementById('results');
    const downloadList = document.getElementById('downloadList');
    const progressContainer = document.getElementById('progressContainer');
    
    if (!resultsDiv || !downloadList) return;
    
    // Hide progress, show results
    if (progressContainer) {
        progressContainer.style.display = 'none';
    }
    resultsDiv.style.display = 'block';
    
    // Clear previous results
    downloadList.innerHTML = '';
    
    // Add summary
    const summary = document.createElement('div');
    summary.innerHTML = `
        <h4>📊 Conversion Summary</h4>
        <p>✅ Processed: ${results.processed} conversations</p>
        <p>⏭️ Skipped: ${results.skipped} conversations</p>
        ${results.errors > 0 ? `<p>❌ Errors: ${results.errors} conversations</p>` : ''}
    `;
    summary.style.marginBottom = '20px';
    downloadList.appendChild(summary);
    
    // Add directory selection and save options
    if (results.files.length > 0) {
        // Directory selection section
        const directorySection = document.createElement('div');
        directorySection.style.marginBottom = '20px';
        directorySection.style.padding = '15px';
        directorySection.style.background = '#f8f9fa';
        directorySection.style.borderRadius = '8px';
        directorySection.style.border = '1px solid #dee2e6';
        
        const directoryTitle = document.createElement('h4');
        directoryTitle.textContent = '📁 Save Location:';
        directorySection.appendChild(directoryTitle);
        
        if (isFileSystemAccessSupported()) {
            const selectDirBtn = document.createElement('button');
            selectDirBtn.className = 'btn';
            selectDirBtn.textContent = selectedDirectoryHandle ? 
                `📂 Change Directory (Current: ${selectedDirectoryHandle.name})` : 
                '📂 Choose Obsidian Folder';
            selectDirBtn.onclick = selectSaveDirectory;
            selectDirBtn.style.marginRight = '10px';
            directorySection.appendChild(selectDirBtn);
            
            // Add simple directory picker as fallback
            const simpleDirBtn = document.createElement('button');
            simpleDirBtn.className = 'btn';
            simpleDirBtn.textContent = '📁 Simple Folder Picker';
            simpleDirBtn.onclick = selectSaveDirectorySimple;
            simpleDirBtn.style.marginRight = '10px';
            simpleDirBtn.style.background = '#6c757d';
            simpleDirBtn.title = 'Try this if the main folder picker doesn\'t work';
            directorySection.appendChild(simpleDirBtn);
            
            const saveLocalBtn = document.createElement('button');
            saveLocalBtn.className = 'btn';
            saveLocalBtn.style.background = selectedDirectoryHandle ? '#28a745' : '#6c757d';
            saveLocalBtn.style.fontSize = '1.1rem';
            saveLocalBtn.style.padding = '12px 24px';
            saveLocalBtn.style.fontWeight = 'bold';
            saveLocalBtn.textContent = selectedDirectoryHandle ? 
                `💾 Save ${results.files.length} files to ${selectedDirectoryHandle.name}/ChatGPT/` : 
                '💾 Save to Local Folder (Select folder first)';
            saveLocalBtn.disabled = !selectedDirectoryHandle;
            saveLocalBtn.onclick = () => {
                console.log('🖱️ Save button clicked!');
                saveFilesLocally(results.files);
            };
            directorySection.appendChild(saveLocalBtn);
            
            const note = document.createElement('p');
            note.style.marginTop = '10px';
            note.style.fontSize = '0.9rem';
            note.style.color = '#666';
            note.innerHTML = `
                💡 <strong>Step-by-Step Process:</strong><br>
                <div style="margin-left: 15px; margin-top: 8px;">
                    ✅ <strong>1. Upload conversations.json</strong> - Done!<br>
                    ${selectedDirectoryHandle ? '✅' : '⏳'} <strong>2. Choose your Obsidian folder</strong> ${selectedDirectoryHandle ? `- Selected: ${selectedDirectoryHandle.name}` : '- Click button above'}<br>
                    ${selectedDirectoryHandle ? '⏳' : '⬜'} <strong>3. Click "Save to Local Folder"</strong> ${selectedDirectoryHandle ? '- Ready to save!' : '- Select folder first'}<br>
                    ⬜ <strong>4. Files appear in YourFolder/ChatGPT/</strong>
                </div>
            `;
            directorySection.appendChild(note);
            
            // Add troubleshooting info
            const troubleshoot = document.createElement('details');
            troubleshoot.style.marginTop = '10px';
            troubleshoot.style.fontSize = '0.85rem';
            troubleshoot.style.color = '#666';
            
            const summary = document.createElement('summary');
            summary.textContent = '🔧 Troubleshooting greyed-out "Open" button';
            summary.style.cursor = 'pointer';
            troubleshoot.appendChild(summary);
            
            const troubleshootContent = document.createElement('div');
            troubleshootContent.style.marginTop = '5px';
            troubleshootContent.innerHTML = `
                • <strong>System folders:</strong> Avoid selecting protected folders (System, Applications)<br>
                • <strong>Try these locations:</strong> Desktop, Documents, Downloads, or your user folder<br>
                • <strong>Browser restrictions:</strong> Some browsers restrict access to certain folders<br>
                • <strong>Alternative:</strong> Use the "Simple Folder Picker" or download files instead
            `;
            troubleshoot.appendChild(troubleshootContent);
            
            directorySection.appendChild(troubleshoot);
        } else {
            const warning = document.createElement('p');
            warning.style.color = '#856404';
            warning.style.background = '#fff3cd';
            warning.style.padding = '10px';
            warning.style.borderRadius = '5px';
            warning.style.border = '1px solid #ffeaa7';
            warning.textContent = '⚠️ Your browser doesn\'t support direct folder saving. Use download options below.';
            directorySection.appendChild(warning);
        }
        
        downloadList.appendChild(directorySection);
        
        // Individual download links
        const listTitle = document.createElement('h4');
        listTitle.textContent = '📥 Download Options:';
        downloadList.appendChild(listTitle);
        
        for (const file of results.files) {
            const downloadItem = document.createElement('div');
            downloadItem.className = 'download-item';
            
            const fileInfo = document.createElement('span');
            fileInfo.textContent = file.title || file.filename;
            
            const downloadBtn = document.createElement('button');
            downloadBtn.className = 'download-btn';
            downloadBtn.textContent = 'Download';
            downloadBtn.onclick = () => {
                const blob = createDownloadBlob(file.content);
                downloadFile(blob, file.filename);
            };
            
            downloadItem.appendChild(fileInfo);
            downloadItem.appendChild(downloadBtn);
            downloadList.appendChild(downloadItem);
        }
        
        // Store files globally for ZIP download
        convertedFiles = results.files;
        
        // Enable ZIP download button
        const zipBtn = document.getElementById('downloadZip');
        if (zipBtn) {
            zipBtn.onclick = () => createZipDownload(convertedFiles);
            zipBtn.disabled = false;
        }
    }
}

/**
 * Handle file processing
 */
async function handleFileUpload(file) {
    try {
        // Show progress
        const progressContainer = document.getElementById('progressContainer');
        const resultsDiv = document.getElementById('results');
        
        if (progressContainer) progressContainer.style.display = 'block';
        if (resultsDiv) resultsDiv.style.display = 'none';
        
        updateProgress(0, 'Reading file...');
        
        // Read file content
        const fileContent = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsText(file);
        });
        
        updateProgress(25, 'Parsing JSON...');
        
        // Parse JSON
        let conversations;
        try {
            conversations = JSON.parse(fileContent);
        } catch (error) {
            throw new Error('Invalid JSON format. Please ensure you uploaded a valid conversations.json file.');
        }
        
        if (!Array.isArray(conversations)) {
            throw new Error('Expected an array of conversations. Please check your file format.');
        }
        
        updateProgress(50, 'Converting conversations...');
        
        // Process conversations
        const results = processConversations(conversations);
        
        updateProgress(100, 'Conversion complete!');
        
        // Show results
        setTimeout(() => {
            displayResults(results);
        }, 500);
        
    } catch (error) {
        console.error('Error processing file:', error);
        showStatus(`Error: ${error.message}`, 'error');
    }
}

/**
 * Initialize drag and drop functionality
 */
function initializeDragAndDrop() {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    
    if (!uploadArea || !fileInput) return;
    
    // Handle drag and drop
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });
    
    uploadArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            if (file.type === 'application/json' || file.name.endsWith('.json')) {
                handleFileUpload(file);
            } else {
                showStatus('Please upload a JSON file (.json)', 'error');
            }
        }
    });
    
    // Handle click to upload
    uploadArea.addEventListener('click', () => {
        fileInput.click();
    });
    
    // Handle file input change
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            handleFileUpload(file);
        }
    });
}

/**
 * Initialize the converter
 */
function initializeConverter() {
    initializeDragAndDrop();
    
    // Reset state
    convertedFiles = [];
    processedIds.clear();
    selectedDirectoryHandle = null;
    
    // Check File System Access API support
    if (isFileSystemAccessSupported()) {
        console.log('✅ File System Access API supported - local saving available');
    } else {
        console.log('⚠️ File System Access API not supported - download-only mode');
    }
    
    console.log('ChatGPT to Obsidian Converter initialized');
} 