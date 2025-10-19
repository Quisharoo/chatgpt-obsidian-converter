import { useCallback, useMemo, useRef, useState } from 'react';
import { useToast } from '@/components/hooks/use-toast.js';
import { processConversationsProgressive } from '@/modules/conversionEngine.js';
import {
  isFileSystemAccessSupported,
  getFileSystemAccessInfo,
  selectDirectory,
  saveFileToDirectory,
  createDownloadBlob,
  downloadFile,
} from '@/modules/fileSystemManager.js';
import { message, status, success as successString, error as errorString } from '@/utils/strings.js';
import { logError } from '@/utils/logger.js';

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(e);
    reader.readAsText(file);
  });
}

async function parseZipFile(file, setProgress) {
  if (typeof JSZip === 'undefined') {
    throw new Error('ZIP support unavailable. Please upload conversations.json directly or enable JSZip.');
  }
  setProgress({ active: true, percent: 5, message: 'Scanning ZIP archive…' });
  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);
  const candidatePaths = [
    'conversations.json',
    'conversations/conversations.json',
    'data/conversations.json',
  ];
  let entry = null;

  for (const path of candidatePaths) {
    if (zip.file(path)) {
      entry = zip.file(path);
      break;
    }
  }

  if (!entry) {
    // fallback: search any conversations.json
    const matches = Object.keys(zip.files).filter((name) => /conversations\.json$/i.test(name));
    if (matches.length > 0) {
      entry = zip.file(matches[0]);
    }
  }

  if (!entry) {
    throw new Error('Could not find conversations.json in the ZIP export.');
  }

  setProgress({ active: true, percent: 15, message: 'Extracting conversations.json…' });
  const jsonText = await entry.async('text');
  return jsonText;
}

async function parseConversationsFile(file, setProgress) {
  const lowerName = (file.name || '').toLowerCase();
  let jsonText;

  if (lowerName.endsWith('.zip')) {
    jsonText = await parseZipFile(file, setProgress);
  } else {
    setProgress({ active: true, percent: 5, message: 'Reading file…' });
    jsonText = await readFileAsText(file);
  }

  setProgress({ active: true, percent: 20, message: status('PARSING_JSON') });
  const conversations = JSON.parse(jsonText);
  if (!Array.isArray(conversations)) {
    throw new Error(errorString('INVALID_STRUCTURE'));
  }

  return conversations;
}

async function saveFilesSequentially(files, directoryHandle, onProgress) {
  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  for (let index = 0; index < files.length; index++) {
    const file = files[index];
    if (onProgress) {
      const percent = Math.floor(((index + 1) / files.length) * 100);
      onProgress({
        active: true,
        percent,
        message: `Saving ${file.filename} (${index + 1}/${files.length})`,
      });
    }

    try {
      const result = await saveFileToDirectory(file.filename, file.content, directoryHandle, true, 'version');
      if (result.success) {
        successCount++;
      } else if (result.cancelled) {
        skippedCount++;
      } else {
        errorCount++;
      }
    } catch (error) {
      errorCount++;
      logError(`Error saving ${file.filename}:`, error);
    }
  }

  return { successCount, errorCount, skippedCount };
}

async function createZipBlob(files) {
  if (typeof JSZip === 'undefined') {
    return null;
  }
  const zip = new JSZip();
  files.forEach((file) => {
    zip.file(file.filename, file.content);
  });
  return zip.generateAsync({ type: 'blob' });
}

export function useConverter() {
  const { toast } = useToast();
  const [statusState, setStatusState] = useState('idle');
  const [progress, setProgress] = useState({ active: false, percent: 0, message: 'Idle' });
  const [summary, setSummary] = useState({ processed: 0, skipped: 0, errors: 0 });
  const [files, setFiles] = useState([]);
  const [directory, setDirectory] = useState({
    name: null,
    handle: null,
    supported: isFileSystemAccessSupported(),
    apiInfo: getFileSystemAccessInfo(),
  });
  const processedIdsRef = useRef(new Set());

  const resetProgress = useCallback(() => {
    setProgress({ active: false, percent: 0, message: 'Idle' });
  }, []);

  const convertFile = useCallback(
    async (file) => {
      try {
        setStatusState('processing');
        setProgress({ active: true, percent: 0, message: status('READING_FILE') });

        const conversations = await parseConversationsFile(file, setProgress);
        const results = await processConversationsProgressive(
          conversations,
          processedIdsRef.current,
          ({ percent, message }) => {
            setProgress({ active: true, percent, message });
          },
          8,
        );

        setFiles(results.files);
        setSummary({ processed: results.processed, skipped: results.skipped, errors: results.errors });
        setStatusState('complete');
        setProgress({ active: false, percent: 100, message: status('COMPLETE') });
        toast({ title: 'Conversion complete', description: `${results.processed} files ready.` });
      } catch (error) {
        logError('Conversion failed:', error);
        setStatusState('error');
        setProgress({ active: false, percent: 0, message: errorString('FAILED_TO_PROCESS') });
        toast({ title: 'Conversion failed', description: error.message, variant: 'destructive' });
      }
    },
    [toast],
  );

  const selectDirectoryHandle = useCallback(async () => {
    if (!directory.supported) {
      toast({ title: 'Not supported', description: message('MOBILE_SAVE_INFO'), variant: 'destructive' });
      return;
    }

    try {
      const handle = await selectDirectory();
      setDirectory((prev) => ({ ...prev, handle, name: handle.name }));
      toast({ title: 'Folder selected', description: `${handle.name}` });
    } catch (error) {
      toast({ title: 'Directory selection failed', description: error.message, variant: 'destructive' });
    }
  }, [directory.supported, toast]);

  const saveAllToDirectory = useCallback(async () => {
    if (!files.length) {
      toast({ title: 'Nothing to save', description: 'Run a conversion first.' });
      return;
    }
    if (!directory.handle) {
      toast({ title: 'Select a folder', description: 'Choose a destination folder before saving.' });
      return;
    }

    setStatusState('saving');
    const { successCount, errorCount, skippedCount } = await saveFilesSequentially(
      files,
      directory.handle,
      setProgress,
    );
    resetProgress();
    setStatusState('complete');

    toast({
      title: 'Save completed',
      description: `${successCount} saved, ${skippedCount} skipped, ${errorCount} errors`,
      variant: errorCount ? 'destructive' : undefined,
    });
  }, [directory.handle, files, resetProgress, toast]);

  const downloadZip = useCallback(async () => {
    if (!files.length) {
      toast({ title: 'Nothing to download', description: 'Run a conversion first.' });
      return;
    }

    const zipBlob = await createZipBlob(files);
    if (!zipBlob) {
      toast({
        title: 'ZIP unavailable',
        description: 'JSZip is missing, downloading individually instead.',
      });
      files.forEach((file) => {
        const blob = createDownloadBlob(file.content);
        downloadFile(blob, file.filename);
      });
      return;
    }

    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `chatgpt-conversations-${new Date().toISOString().split('T')[0]}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: 'Download started', description: 'ZIP file is downloading.' });
  }, [files, toast]);

  const downloadAll = useCallback(() => {
    if (!files.length) {
      toast({ title: 'Nothing to download', description: 'Run a conversion first.' });
      return;
    }

    files.forEach((file) => {
      const blob = createDownloadBlob(file.content);
      downloadFile(blob, file.filename);
    });
    toast({ title: 'Downloads started', description: 'Files are downloading individually.' });
  }, [files, toast]);

  const downloadSingle = useCallback((file) => {
    const blob = createDownloadBlob(file.content);
    downloadFile(blob, file.filename);
  }, []);

  return {
    status: statusState,
    progress,
    summary,
    files,
    directory,
    convertFile,
    selectDirectoryHandle,
    saveAllToDirectory,
    downloadZip,
    downloadAll,
    downloadSingle,
  };
}
