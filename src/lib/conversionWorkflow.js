import { processConversationsProgressive } from '../modules/conversionEngine.js';
import { saveFileToDirectory } from '../modules/fileSystemManager.js';
import { status, error as errorString, message as messageString } from '../utils/strings.js';
import { logError } from '../utils/logger.js';

const DEFAULT_CONCURRENCY = 8;

export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(event.target?.result ?? '');
    reader.onerror = (event) => reject(event instanceof Error ? event : new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

async function parseZipFile(file, onProgress) {
  if (typeof JSZip === 'undefined') {
    throw new Error('ZIP support unavailable. Please upload conversations.json directly or enable JSZip.');
  }

  onProgress?.({ percent: 5, message: 'Scanning ZIP archive…' });

  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);
  const candidatePaths = [
    'conversations.json',
    'conversations/conversations.json',
    'data/conversations.json'
  ];

  let entry = null;
  for (const path of candidatePaths) {
    if (zip.file(path)) {
      entry = zip.file(path);
      break;
    }
  }

  if (!entry) {
    const matches = Object.keys(zip.files).filter((name) => /conversations\.json$/i.test(name));
    if (matches.length > 0) {
      entry = zip.file(matches[0]);
    }
  }

  if (!entry) {
    throw new Error('Could not find conversations.json in the ZIP export.');
  }

  onProgress?.({ percent: 15, message: 'Extracting conversations.json…' });
  return entry.async('text');
}

export async function parseConversationsFile(file, { onProgress } = {}) {
  const lowerName = (file?.name || '').toLowerCase();
  let jsonText;

  if (lowerName.endsWith('.zip')) {
    jsonText = await parseZipFile(file, onProgress);
  } else {
    onProgress?.({ percent: 5, message: 'Reading file…' });
    jsonText = await readFileAsText(file);
  }

  onProgress?.({ percent: 20, message: status('PARSING_JSON') });

  return parseConversationsJson(jsonText);
}

export function parseConversationsJson(jsonText) {
  let conversations;
  try {
    conversations = JSON.parse(jsonText);
  } catch (error) {
    throw new Error(errorString('INVALID_JSON'));
  }

  if (!Array.isArray(conversations)) {
    throw new Error(errorString('INVALID_STRUCTURE'));
  }

  return conversations;
}

export async function convertConversations(conversations, processedIds, {
  onProgress,
  concurrency = DEFAULT_CONCURRENCY
} = {}) {
  const safeProcessedIds = processedIds instanceof Set ? processedIds : new Set();

  const results = await processConversationsProgressive(
    conversations,
    safeProcessedIds,
    ({ percent, message }) => {
      onProgress?.({
        percent,
        message: message ?? status('CONVERTING')
      });
    },
    concurrency
  );

  return results;
}

export async function saveFilesSequentially(files, directoryHandle, { onProgress } = {}) {
  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  for (let index = 0; index < files.length; index++) {
    const file = files[index];

    onProgress?.({
      percent: Math.floor(((index + 1) / files.length) * 100),
      message: `Saving ${file.filename} (${index + 1}/${files.length})`
    });

    try {
      const result = await saveFileToDirectory(file.filename, file.content, directoryHandle, true, 'version');
      if (result.success) {
        successCount++;
      } else if (result.cancelled) {
        skippedCount++;
      } else {
        errorCount++;
        logError(`Save failed for ${file.filename}: ${result.message}`);
      }
    } catch (error) {
      errorCount++;
      logError(`Error saving ${file.filename}:`, error);
    }
  }

  return { successCount, errorCount, skippedCount };
}

export async function createZipBlob(files) {
  if (typeof JSZip === 'undefined') {
    return null;
  }

  const zip = new JSZip();
  files.forEach((file) => {
    zip.file(file.filename, file.content);
  });
  return zip.generateAsync({ type: 'blob' });
}

export function describeSelectionState(directoryHandle) {
  if (!directoryHandle) {
    return messageString('SELECT_DESTINATION');
  }
  return messageString('READY_TO_SAVE_DESCRIPTION', { folderName: directoryHandle.name });
}
