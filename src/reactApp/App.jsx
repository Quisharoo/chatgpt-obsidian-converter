import React, { useCallback, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';
import { useConverter } from './useConverter.js';
import { cn } from '@/lib/utils.js';
import { message } from '@/utils/strings.js';

function UploadCard({ onFileSelect }) {
  const [dragActive, setDragActive] = useState(false);

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
    <Card className="bg-card/80 backdrop-blur">
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
            <label className="relative inline-flex cursor-pointer items-center justify-center">
              <input
                type="file"
                accept=".json,.zip"
                onChange={onChange}
                className="sr-only"
              />
              <Button type="button" variant="secondary">
                Browse files
              </Button>
            </label>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProgressCard({ progress, status }) {
  if (!progress.active && status !== 'saving') return null;

  const message = progress.message || (status === 'saving' ? 'Saving files…' : 'Processing…');
  const percent = progress.percent || (status === 'saving' ? 30 : 0);

  return (
    <Card className="border-primary/30 bg-card/80">
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

function SummaryCard({ summary, files }) {
  const fileCount = files.length;
  return (
    <Card className="bg-card/80 backdrop-blur">
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
    <Card className="bg-card/80 backdrop-blur">
      <CardHeader className="flex flex-col gap-2">
        <CardTitle className="text-2xl font-semibold">Save &amp; Export</CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          Choose a folder or download the converted Markdown files.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {directory.supported ? (
          <Alert variant={hasDirectory ? 'default' : 'secondary'} className="bg-muted/40">
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
          <Alert variant="destructive" className="bg-destructive/10 text-foreground">
            <AlertTitle className="text-sm font-semibold">{message('MOBILE_BROWSER_DETECTED')}</AlertTitle>
            <AlertDescription className="text-sm">
              {message('MOBILE_SAVE_INFO')} {directory.apiInfo?.ios ? message('IOS_SAVE_INFO') : message('MOBILE_DOWNLOAD_INFO')}
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-wrap gap-3">
          {directory.supported && (
            <Button onClick={onSelect} variant="secondary">
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
  if (!files.length) {
    return (
      <Card className="bg-card/80 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-xl">Generated files</CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Run a conversion to see the Markdown output here.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="bg-card/80 backdrop-blur">
      <CardHeader>
        <CardTitle className="text-xl">Generated files</CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          {files.length} files ready. Click a row to download individually.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="py-2 pr-3 font-medium">Title</th>
              <th className="py-2 pr-3 font-medium">Filename</th>
              <th className="py-2 pr-3 font-medium">Created</th>
              <th className="py-2 pr-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {files.map((file) => (
              <tr key={file.filename} className="hover:bg-muted/40">
                <td className="py-2 pr-3 font-medium text-foreground">{file.title}</td>
                <td className="py-2 pr-3 text-muted-foreground">{file.filename}</td>
                <td className="py-2 pr-3 text-muted-foreground">{file.createdDate}</td>
                <td className="py-2 pr-3">
                  <Button size="sm" variant="ghost" onClick={() => onDownloadSingle(file)}>
                    Download
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
    convertFile,
    selectDirectoryHandle,
    saveAllToDirectory,
    downloadZip,
    downloadAll,
    downloadSingle,
  } = useConverter();

  return (
    <TooltipProvider>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-6">
        <UploadCard onFileSelect={convertFile} />
        <ProgressCard progress={progress} status={status} />
        <SummaryCard summary={summary} files={files} />
        <DirectoryPanel
          directory={directory}
          fileCount={files.length}
          onSelect={selectDirectoryHandle}
          onSaveAll={saveAllToDirectory}
          onDownloadZip={downloadZip}
          onDownloadAll={downloadAll}
        />
        <ResultsTable files={files} onDownloadSingle={downloadSingle} />
        <Separator className="my-4" />
        <footer className="text-xs text-muted-foreground">
          <p>
            React + shadcn UI powered entirely client-side. Converted files never leave your browser.
          </p>
        </footer>
        <Toaster />
      </div>
    </TooltipProvider>
  );
}

export default App;
