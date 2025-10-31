import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';
import { ArrowUpDown, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils.js';
import { message } from '@/utils/strings.js';
import { useConverter } from './useConverter.js';
import { buildPageList, getPaginatedFiles, sortFiles, SORT_FIELDS } from './resultsTableUtils.js';
import { HoverPreview } from '@/components/ui/hover-preview.jsx';

const ITEMS_PER_PAGE = 25;

function UploadCard({ onFileSelect, onLoadDemo }) {
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);
  const fileInputId = useId();

  const handleFiles = useCallback(
    (files) => {
      if (files && files.length > 0) {
        onFileSelect(files[0]);
      }
    },
    [onFileSelect],
  );

  const onDragOver = (event) => {
    event.preventDefault();
    setDragActive(true);
  };

  const onDragLeave = (event) => {
    event.preventDefault();
    setDragActive(false);
  };

  const onDrop = (event) => {
    event.preventDefault();
    setDragActive(false);
    handleFiles(event.dataTransfer.files);
  };

  const onChange = (event) => {
    handleFiles(event.target.files);
    event.target.value = '';
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-col gap-2">
        <CardTitle className="text-2xl font-semibold">Upload Conversations</CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          Drag and drop the exported <code>conversations.json</code> or ZIP file from ChatGPT.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={cn(
            'rounded-lg border border-dashed border-muted-foreground/40 p-8 text-center transition-colors',
            dragActive ? 'border-primary bg-primary/10' : 'hover:border-primary/60',
          )}
        >
          <div className="flex flex-col items-center gap-3">
            <Badge variant="secondary" className="px-3 py-1">
              conversations.json / ZIP
            </Badge>
            <p className="text-muted-foreground text-sm">
              Drop your export here or click the button below.
            </p>
            <input
              id={fileInputId}
              ref={fileInputRef}
              type="file"
              accept=".json,.zip"
              onChange={onChange}
              className="sr-only"
            />
            <label htmlFor={fileInputId} className="sr-only">
              Upload conversations export
            </label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="default"
                onClick={() => fileInputRef.current?.click()}
                aria-controls={fileInputId}
              >
                Browse files
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={onLoadDemo}
                className="gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Try Demo
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DemoModeIndicator() {
  return (
    <Alert className="border-primary/50 bg-primary/5">
      <Sparkles className="h-4 w-4" />
      <AlertTitle>Demo Mode</AlertTitle>
      <AlertDescription>
        You're viewing sample data. Upload your own ChatGPT export to convert your conversations.
      </AlertDescription>
    </Alert>
  );
}

function ProgressCard({ progress, status }) {
  if (!progress.active && status !== 'saving') return null;

  const message = progress.message || (status === 'saving' ? 'Saving files…' : 'Processing…');
  const percent = Number.isFinite(progress.percent) ? progress.percent : 0;

  return (
    <Card className="border border-primary/20 shadow-sm">
      <CardHeader className="py-3">
        <CardTitle className="text-base">{status === 'saving' ? 'Saving files' : 'Converting conversations'}</CardTitle>
        <CardDescription>{message}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <Progress value={percent} className="h-2" />
      </CardContent>
    </Card>
  );
}

function SummaryCard({ summary, fileCount }) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-col gap-2">
        <CardTitle className="text-2xl font-semibold">Conversion Summary</CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          Overview of the processed conversations.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <Badge variant="secondary" className="px-3 py-1">
            Converted
            <span className="ml-2 rounded bg-primary/20 px-2 py-0.5 text-primary">{summary.processed}</span>
          </Badge>
          <Badge variant={summary.errors ? 'destructive' : 'secondary'} className="px-3 py-1">
            Errors
            <span className="ml-2 rounded bg-muted px-2 py-0.5 text-foreground">{summary.errors}</span>
          </Badge>
          <Badge variant="secondary" className="px-3 py-1">
            Skipped
            <span className="ml-2 rounded bg-muted px-2 py-0.5 text-foreground">{summary.skipped}</span>
          </Badge>
          <Badge variant="secondary" className="px-3 py-1">
            Files ready
            <span className="ml-2 rounded bg-muted px-2 py-0.5 text-foreground">{fileCount}</span>
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function DirectoryPanel({ directory, fileCount, onSelect, onSaveAll, onDownloadZip, onDownloadAll }) {
  const hasDirectory = Boolean(directory.name);

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-col gap-2">
        <CardTitle className="text-2xl font-semibold">Save &amp; Export</CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          Choose a folder or download the converted Markdown files.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {directory.supported ? (
          <Alert variant={hasDirectory ? 'default' : 'secondary'}>
            <AlertTitle className="text-sm font-semibold">
              {hasDirectory ? 'Folder selected' : 'Select a destination folder'}
            </AlertTitle>
            <AlertDescription className="text-sm text-muted-foreground">
              {hasDirectory
                ? message('READY_TO_SAVE_DESCRIPTION', { folderName: directory.name })
                : message('SELECT_DESTINATION')}
            </AlertDescription>
          </Alert>
        ) : (
          <Alert variant="destructive">
            <AlertTitle className="text-sm font-semibold">{message('MOBILE_BROWSER_DETECTED')}</AlertTitle>
            <AlertDescription className="text-sm">
              {message('MOBILE_SAVE_INFO')} {directory.apiInfo?.ios ? message('IOS_SAVE_INFO') : message('MOBILE_DOWNLOAD_INFO')}
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-wrap gap-3">
          {directory.supported && (
            <Button onClick={onSelect} variant="outline">
              {hasDirectory ? `Change folder (current: ${directory.name})` : 'Choose folder'}
            </Button>
          )}

          {directory.supported && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={onSaveAll} disabled={!fileCount || !hasDirectory}>
                    {`Save ${fileCount || ''} files`}
                  </Button>
                </TooltipTrigger>
                {!fileCount && (
                  <TooltipContent>
                    <span>Run a conversion before saving files.</span>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          )}

          <Button onClick={onDownloadZip} variant="outline" disabled={!fileCount}>
            Download ZIP
          </Button>
          <Button onClick={onDownloadAll} variant="ghost" disabled={!fileCount}>
            Download individually
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ResultsTable({ files, onDownloadSingle }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState(SORT_FIELDS.CREATED);
  const [sortDirection, setSortDirection] = useState('desc');

  if (!files.length) {
    return (
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl">Generated files</CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Run a conversion to see the Markdown output here.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const handleSort = (field) => {
    setCurrentPage(1);
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortField(field);
    setSortDirection(field === SORT_FIELDS.CREATED ? 'desc' : 'asc');
  };

  const sortedFiles = useMemo(
    () => sortFiles(files, sortField, sortDirection),
    [files, sortField, sortDirection],
  );

  const totalPages = Math.max(1, Math.ceil(sortedFiles.length / ITEMS_PER_PAGE));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [files]);

  const currentFiles = useMemo(
    () => getPaginatedFiles(sortedFiles, currentPage, ITEMS_PER_PAGE),
    [sortedFiles, currentPage],
  );

  const pageNumbers = useMemo(
    () => buildPageList(currentPage, totalPages),
    [currentPage, totalPages],
  );

  const sortIconForField = (field) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 text-muted-foreground/60" />;
    }
    return sortDirection === 'asc' ? (
      <ChevronUp className="h-4 w-4" />
    ) : (
      <ChevronDown className="h-4 w-4" />
    );
  };

  const ariaSortForField = (field) => {
    if (sortField !== field) return 'none';
    return sortDirection === 'asc' ? 'ascending' : 'descending';
  };

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl">Generated files</CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          {files.length} files ready. Click a row to download individually.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm table-fixed">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th 
                scope="col"
                className="py-2 pr-3 font-medium w-[60%]"
                aria-sort={ariaSortForField(SORT_FIELDS.TITLE)}
              >
                <button
                  type="button"
                  onClick={() => handleSort(SORT_FIELDS.TITLE)}
                  className="flex w-full items-center gap-1 text-left font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <span>Title</span>
                  {sortIconForField(SORT_FIELDS.TITLE)}
                </button>
              </th>
              <th
                scope="col"
                className="py-2 pr-3 font-medium w-[20%]"
                aria-sort={ariaSortForField(SORT_FIELDS.CREATED)}
              >
                <button
                  type="button"
                  onClick={() => handleSort(SORT_FIELDS.CREATED)}
                  className="flex w-full items-center gap-1 text-left font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <span>Created</span>
                  {sortIconForField(SORT_FIELDS.CREATED)}
                </button>
              </th>
              <th className="py-2 pr-3 font-medium text-right w-[15%]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {currentFiles.map((file) => (
              <HoverPreview
                key={file.filename}
                markdownContent={file.content}
                title={file.title}
                delay={900}
              >
                <tr className="hover:bg-muted/40">
                  <td className="py-2 pr-3 font-medium text-foreground truncate max-w-0" title={file.title}>{file.title}</td>
                  <td className="py-2 pr-3 text-muted-foreground whitespace-nowrap">{file.createdDate}</td>
                  <td className="py-2 pr-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => onDownloadSingle(file)}>
                      Download
                    </Button>
                  </td>
                </tr>
              </HoverPreview>
            ))}
          </tbody>
        </table>
        
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-1 mt-4">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
            >
              First
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Prev
            </Button>

            {pageNumbers.map((page, idx) =>
              page === '...' ? (
                <span key={`ellipsis-${idx}`} className="px-2 text-muted-foreground">
                  ...
                </span>
              ) : (
                <Button
                  key={page}
                  size="sm"
                  variant={currentPage === page ? 'default' : 'outline'}
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </Button>
              ),
            )}

            <Button
              size="sm"
              variant="outline"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
            >
              Last
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function App() {
  const {
    status,
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
  } = useConverter();

  const hasStartedProcessing = status !== 'idle';
  const hasGeneratedFiles = files.length > 0;
  const showSummary = hasStartedProcessing;
  const showExportPanel = hasGeneratedFiles;
  const showResults = hasGeneratedFiles;

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-12">
          <section className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">ChatGPT to Markdown Converter</h1>
            <p className="text-muted-foreground">
              Convert your ChatGPT export into tidy Markdown notes without leaving the browser.
            </p>
          </section>
          <UploadCard onFileSelect={convertFile} onLoadDemo={loadDemoData} />
          {isDemoMode && <DemoModeIndicator />}
          <ProgressCard progress={progress} status={status} />
          {showSummary && <SummaryCard summary={summary} fileCount={files.length} />}
          {showExportPanel && (
            <DirectoryPanel
              directory={directory}
              fileCount={files.length}
              onSelect={selectDirectoryHandle}
              onSaveAll={saveAllToDirectory}
              onDownloadZip={downloadZip}
              onDownloadAll={downloadAll}
            />
          )}
          {showResults && <ResultsTable files={files} onDownloadSingle={downloadSingle} />}
          <Separator />
          <footer className="text-sm text-muted-foreground">
            <p>React + shadcn UI powered entirely client-side. Converted files never leave your browser.</p>
          </footer>
        </main>
        <Toaster />
      </div>
    </TooltipProvider>
  );
}

export default App;
