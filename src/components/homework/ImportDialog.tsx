import { useCallback, useRef, useState } from 'react';
import { Upload, AlertCircle, CheckCircle, FileText } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge, Card } from '@/components/ui';
import { Modal } from '@/components/ui/Modal';
import type { HomeworkItem, Subject } from '@/types';
import {
  parseImportFile,
  type ImportPreview,
  applyImport,
} from '@/utils/import';
import { cn } from '@/utils/cn';

const ACCEPTED_EXTENSIONS = '.csv,.json';

const SAMPLE_ROWS_TO_SHOW = 8;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusColor(status: string): string {
  switch (status) {
    case 'overdue': return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';
    case 'completed': return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300';
    case 'submitted': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
    default: return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
  }
}

interface ImportResultSectionProps {
  applied: { applied: number; skipped: number };
  onDone: () => void;
}

function ImportResultSection({ applied, onDone }: ImportResultSectionProps) {
  return (
    <Card variant="elevated" className="p-6 text-center">
      <CheckCircle className="h-10 w-10 text-emerald-600 dark:text-emerald-400 mx-auto mb-3" aria-hidden="true" />
      <Badge variant="success" size="sm" className="mb-3">
        Import complete
      </Badge>
      <p className="text-sm text-emerald-700 dark:text-emerald-300 mb-4">
        {applied.applied} homework item{applied.applied === 1 ? '' : 's'} imported and added to your list.
        {applied.skipped > 0 && ` ${applied.skipped} record{applied.skipped === 1 ? '' : 's'} skipped.`}
      </p>
      <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-6">
        Records are stored locally in your browser. Export your data anytime from the Homework view to back it up.
      </p>
      <Button onClick={onDone} className="gap-2">
        Done
      </Button>
    </Card>
  );
}

interface ImportFileStepProps {
  file: File | null;
  preview: ImportPreview | null;
  parseError: string | null;
  applying: boolean;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
}

function ImportFileStep({
  file,
  preview,
  parseError,
  applying,
  onFileChange,
  fileInputRef,
}: ImportFileStepProps) {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <Upload className="h-5 w-5 text-brand-600 dark:text-brand-400" aria-hidden="true" />
        <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">Select a file</h3>
      </div>
      <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
        Choose a <strong>.csv</strong> or <strong>.json</strong> file containing homework records.
        Imported records are <strong>added</strong> to your existing homework — nothing is
        overwritten or replaced.
      </p>

      <label className="block w-full cursor-pointer">
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          onChange={onFileChange}
          className="sr-only"
          aria-label="Choose CSV or JSON file"
        />
        <Button
          variant="outline"
          className="w-full md:w-auto"
          disabled={applying}
        >
          {file ? <FileText className="h-4 w-4 mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
          {file ? file.name : 'Choose file'}
        </Button>
      </label>

      {file && !preview && !parseError && (
        <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
          {formatFileSize(file.size)} • {file.type || 'application/octet-stream'}
        </p>
      )}

      {parseError && (
        <div className="mt-4 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-400" role="alert">
          <AlertCircle className="h-4 w-4 mr-2" aria-hidden="true" />
          {parseError}
        </div>
      )}
    </Card>
  );
}

interface ImportPreviewStepProps {
  preview: ImportPreview;
  hasErrors: boolean;
  canApply: boolean;
  applying: boolean;
  onReset: () => void;
  onApply: () => void;
}

function ImportPreviewStep({
  preview,
  hasErrors,
  canApply,
  applying,
  onReset,
  onApply,
}: ImportPreviewStepProps) {
  // Build a set of row indices that have validation errors
  const errorRows = new Set(
    preview.errors
      .filter((e) => e.field !== 'file')
      .map((e) => e.row - 1)
  );

  return (
    <Card variant="elevated" className="p-6">
      <Card.Header>
        <Card.Title>Preview: {preview.fileName}</Card.Title>
        <Card.Description>
          {preview.format.toUpperCase()} • {preview.recordCount} record{preview.recordCount === 1 ? '' : 's'} detected
        </Card.Description>
      </Card.Header>
      <Card.Body className="pt-0">
        <Badge
          variant={preview.duplicates.length > 0 ? 'warning' : 'success'}
          size="sm"
          className="mb-3"
        >
          {preview.duplicates.length > 0
            ? `${preview.duplicates.length} likely duplicate${preview.duplicates.length === 1 ? '' : 's'} will be skipped`
            : 'No likely duplicates detected'}
        </Badge>

        {hasErrors && (
          <div className="mb-4 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 px-4 py-3" role="alert">
            <div className="flex items-start gap-2 mb-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-600 dark:text-red-400" aria-hidden="true" />
              <span className="text-sm font-medium text-red-700 dark:text-red-400">
                {preview.errors.length} validation issue{preview.errors.length === 1 ? '' : 's'}
              </span>
            </div>
            <ul className="list-disc list-inside text-xs text-red-600 dark:text-red-400 space-y-1 max-h-32 overflow-y-auto">
              {preview.errors.slice(0, 10).map((e, i) => (
                <li key={i}>
                  {e.field === 'file' ? '' : `Row ${e.row}: `}{e.message}
                </li>
              ))}
              {preview.errors.length > 10 && (
                <li className="italic">…and {preview.errors.length - 10} more</li>
              )}
            </ul>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800">
                <th className="pt-3 pb-3 text-left text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Title</th>
                <th className="pt-3 pb-3 text-left text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Subject</th>
                <th className="pt-3 pb-3 text-left text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Due</th>
                <th className="pt-3 pb-3 text-left text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Status</th>
                <th className="pt-3 pb-3 text-left text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Teacher</th>
              </tr>
            </thead>
            <tbody>
              {preview.records.slice(0, SAMPLE_ROWS_TO_SHOW).map((r, i) => {
                const hasError = errorRows.has(i);
                return (
                  <tr
                    key={i}
                    className={cn(
                      'border-b border-neutral-100 dark:border-neutral-800/60',
                      hasError && 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40',
                    )}
                  >
                    <td className={cn('pt-2.5 pb-2.5 text-neutral-900 dark:text-neutral-100 truncate max-w-[200px]', hasError && 'text-red-700 dark:text-red-400 font-medium')}>
                      {r.title}
                    </td>
                    <td className="pt-2.5 pb-2.5 text-neutral-600 dark:text-neutral-300">{r.subject}</td>
                    <td className="pt-2.5 pb-2.5 text-neutral-600 dark:text-neutral-300">{r.dueDate}</td>
                    <td className="pt-2.5 pb-2.5">
                      <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', statusColor(r.status ?? 'pending'))}>
                        {r.status ?? 'pending'}
                      </span>
                    </td>
                    <td className="pt-2.5 pb-2.5 text-neutral-600 dark:text-neutral-300 truncate max-w-[120px]">{r.teacher ?? '—'}</td>
                  </tr>
                );
              })}
              {preview.recordCount > SAMPLE_ROWS_TO_SHOW && (
                <tr>
                  <td colSpan={5} className="pt-2.5 pb-2.5 text-center text-xs text-neutral-500 dark:text-neutral-400 italic">
                    …and {preview.recordCount - SAMPLE_ROWS_TO_SHOW} more record{preview.recordCount - SAMPLE_ROWS_TO_SHOW === 1 ? '' : 's'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </Card.Body>

      {preview.duplicates.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/40 px-4 py-3">
          <div className="flex items-start gap-2 mb-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
              Likely duplicates (skipped)
            </span>
          </div>
          <ul className="list-disc list-inside text-xs text-amber-600 dark:text-amber-400 space-y-1 max-h-32 overflow-y-auto">
            {preview.duplicates.slice(0, 10).map((r, i) => (
              <li key={i}>{`${r.title} (${r.subject}) — due ${r.dueDate}`}</li>
            ))}
            {preview.duplicates.length > 10 && (
              <li className="italic">…and {preview.duplicates.length - 10} more</li>
            )}
          </ul>
          <p className="mt-2 text-xs text-amber-500 dark:text-amber-400">
            A record is treated as a likely duplicate when its title, subject,
            and due date all match an existing homework item. Duplicates are
            skipped by default so nothing is imported twice.
          </p>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between gap-3">
        <Button variant="secondary" onClick={onReset} disabled={applying}>
          Choose another file
        </Button>
        <Button
          onClick={onApply}
          disabled={!canApply || applying}
          className="gap-2"
        >
          {applying ? 'Importing…' : `Import ${preview.unique.length} record${preview.unique.length === 1 ? '' : 's'}`}
        </Button>
      </div>
    </Card>
  );
}

interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  homework: HomeworkItem[];
  onImported: (homework: HomeworkItem[]) => void;
  subjects?: Subject[];
}

export function ImportDialog({
  isOpen,
  onClose,
  homework,
  onImported,
}: ImportDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState<{ applied: number; skipped: number } | null>(null);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0] ?? null;
      if (!f) return;
      setFile(f);
      setPreview(null);
      setParseError(null);
      setApplied(null);

      if (f.size > 5 * 1024 * 1024) {
        setParseError('File is too large. Maximum size is 5 MB.');
        setFile(null);
        return;
      }

      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        const { preview: p, error } = parseImportFile(text, f.name, homework);
        if (error) {
          setParseError(error);
          setFile(null);
          return;
        }
        setPreview(p);
      };
      reader.onerror = () => {
        setParseError('Could not read the file. Please try again.');
        setFile(null);
      };
      reader.readAsText(f);
    },
    [homework],
  );

  const handleApply = useCallback(() => {
    if (!preview || !preview.unique.length) return;
    setApplying(true);
    try {
      const { merged, applied: appliedCount, skipped } = applyImport(preview.unique, homework);
      onImported(merged);
      setApplied({ applied: appliedCount, skipped });
    } finally {
      setApplying(false);
    }
  }, [preview, homework, onImported]);

  const handleReset = useCallback(() => {
    setFile(null);
    setPreview(null);
    setParseError(null);
    setApplied(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleDone = useCallback(() => {
    handleReset();
    onClose();
  }, [handleReset, onClose]);

  if (!isOpen) return null;

  const hasErrors = preview ? preview.errors.length > 0 : parseError !== null;
  const canApply = preview ? preview.unique.length > 0 : false;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Import Homework" size="lg" showCloseButton>
      <div className="space-y-5">
        {applied ? (
          <ImportResultSection applied={applied} onDone={handleDone} />
        ) : (
          <>
            <ImportFileStep
              file={file}
              preview={preview}
              parseError={parseError}
              applying={applying}
              onFileChange={handleFileChange}
              fileInputRef={fileInputRef}
            />
            {preview && (
              <ImportPreviewStep
                preview={preview}
                hasErrors={hasErrors}
                canApply={canApply}
                applying={applying}
                onReset={handleReset}
                onApply={handleApply}
              />
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
