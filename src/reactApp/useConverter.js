import { useCallback, useMemo, useRef, useState } from 'react';
import { useToast } from '@/components/hooks/use-toast.js';
import {
  parseConversationsFile,
  convertConversations,
  saveFilesSequentially,
  createZipBlob,
} from '@/lib/conversionWorkflow.js';
import {
  isFileSystemAccessSupported,
  getFileSystemAccessInfo,
  selectDirectory,
  createDownloadBlob,
  downloadFile,
} from '@/modules/fileSystemManager.js';
import { message, status, success as successString, error as errorString } from '@/utils/strings.js';
import { logError } from '@/utils/logger.js';
import demoConversations from '@/data/demoConversations.json';

export function useConverter() {
  const { toast } = useToast();
  const [statusState, setStatusState] = useState('idle');
  const [progress, setProgress] = useState({ active: false, percent: 0, message: 'Idle' });
  const [summary, setSummary] = useState({ processed: 0, skipped: 0, errors: 0 });
  const [files, setFiles] = useState([]);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [directory, setDirectory] = useState({
    name: null,
    handle: null,
    supported: isFileSystemAccessSupported(),
    apiInfo: getFileSystemAccessInfo(),
  });
  const processedIdsRef = useRef(new Set());
  const isProcessingRef = useRef(false);

  const resetProgress = useCallback(() => {
    setProgress({ active: false, percent: 0, message: 'Idle' });
  }, []);

  const pushProgress = useCallback(
    (update, fallbackMessage) => {
      setProgress({
        active: true,
        percent: typeof update?.percent === 'number' ? update.percent : 0,
        message: update?.message ?? fallbackMessage,
      });
    },
    [setProgress],
  );

  const convertFile = useCallback(
    async (file) => {
      if (isProcessingRef.current) {
        toast({
          title: 'Operation in progress',
          description: 'Please wait for the current operation to complete.',
          variant: 'destructive'
        });
        return;
      }

      try {
        isProcessingRef.current = true;
        setStatusState('processing');
        setIsDemoMode(false); // Exit demo mode when uploading real file
        pushProgress({ percent: 0 }, status('READING_FILE'));
        processedIdsRef.current = new Set();

        const conversations = await parseConversationsFile(file, {
          onProgress: (update) => pushProgress(update, status('READING_FILE')),
        });

        const results = await convertConversations(conversations, processedIdsRef.current, {
          onProgress: (update) => pushProgress(update, status('CONVERTING')),
          concurrency: 8,
        });

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
      } finally {
        isProcessingRef.current = false;
      }
    },
    [pushProgress, toast],
  );

  const loadDemoData = useCallback(
    async () => {
      if (isProcessingRef.current) {
        toast({
          title: 'Operation in progress',
          description: 'Please wait for the current operation to complete.',
          variant: 'destructive'
        });
        return;
      }

      try {
        isProcessingRef.current = true;
        setStatusState('processing');
        setIsDemoMode(true);
        pushProgress({ percent: 0 }, 'Loading demo data...');
        processedIdsRef.current = new Set();

        // Simulate loading delay for better UX
        await new Promise(resolve => setTimeout(resolve, 300));
        pushProgress({ percent: 30 }, 'Processing demo conversations...');

        const results = await convertConversations(demoConversations, processedIdsRef.current, {
          onProgress: (update) => pushProgress(update, 'Converting demo conversations...'),
          concurrency: 8,
        });

        setFiles(results.files);
        setSummary({ processed: results.processed, skipped: results.skipped, errors: results.errors });
        setStatusState('complete');
        setProgress({ active: false, percent: 100, message: 'Demo data loaded' });
        toast({
          title: 'Demo mode activated',
          description: `${results.processed} sample conversations loaded. Try all features!`
        });
      } catch (error) {
        logError('Demo data loading failed:', error);
        setStatusState('error');
        setProgress({ active: false, percent: 0, message: 'Failed to load demo data' });
        toast({ title: 'Demo loading failed', description: error.message, variant: 'destructive' });
      } finally {
        isProcessingRef.current = false;
      }
    },
    [pushProgress, toast],
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
    pushProgress({ percent: 0 }, 'Saving files…');
    const { successCount, errorCount, skippedCount } = await saveFilesSequentially(
      files,
      directory.handle,
      {
        onProgress: (update) => pushProgress(update, 'Saving files…'),
      },
    );
    resetProgress();
    setStatusState('complete');

    toast({
      title: 'Save completed',
      description: `${successCount} saved, ${skippedCount} skipped, ${errorCount} errors`,
      variant: errorCount ? 'destructive' : undefined,
    });
  }, [directory.handle, files, pushProgress, resetProgress, toast]);

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
    setTimeout(() => {
      if (link.parentNode) {
        link.parentNode.removeChild(link);
      }
      URL.revokeObjectURL(url);
    }, 100);
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
    isDemoMode,
    convertFile,
    loadDemoData,
    selectDirectoryHandle,
    saveAllToDirectory,
    downloadZip,
    downloadAll,
    downloadSingle,
  };
}
