/**
 * StudyFlow local homework import.
 *
 * Provides CSV and JSON parsing, validation, duplicate detection, and merge
 * (add-only) behavior for importing homework records from a local file.
 *
 * Security principles:
 * - All parsing happens in the browser; file contents are never transmitted.
 * - Imported text is never executed as HTML or code.
 * - Error messages never expose local file paths.
 * - Imported records are merged (added) into existing data; nothing is ever
 *   silently overwritten or replaced.
 */

import { parse as parseCsv } from 'papaparse';
import type { HomeworkItem, HomeworkPriority } from '@/types';
import { generateId, normalizeEstimatedMinutes, normalizeHomeworkPriority } from '@/types';

export const MAX_IMPORT_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
export const MAX_IMPORT_RECORDS = 1000;

export type HomeworkStatus = 'pending' | 'submitted' | 'completed' | 'overdue';

export const VALID_STATUSES: HomeworkStatus[] = ['pending', 'submitted', 'completed', 'overdue'];

export const DEFAULT_STATUS: HomeworkStatus = 'pending';

export interface RawImportRecord {
  [field: string]: string | undefined;
}

export interface ImportedRecord {
  title: string;
  subject: string;
  dueDate: string; // raw string; validated & normalized by the caller
  teacher?: string;
  group?: string;
  type?: string;
  description?: string;
  status?: HomeworkStatus;
  priority?: HomeworkPriority;
  estimatedMinutes?: number;
  source: 'file';
}

/** One validation problem found on a specific row/field. */
export interface ImportValidationError {
  row: number;
  field: string;
  message: string;
  value: unknown;
}

/** Preview of a parsed import file, ready for the UI to render. */
export interface ImportPreview {
  format: 'csv' | 'json';
  fileName: string;
  recordCount: number;
  records: ImportedRecord[];
  errors: ImportValidationError[];
  duplicates: ImportedRecord[];
  unique: ImportedRecord[];
  skipped: number;
}

/** Outcome of applying an import. */
export interface ImportOutcome {
  applied: number;
  skipped: number;
  duplicates: number;
  errors: ImportValidationError[];
}

/**
 * Field name aliases matched case-insensitively, ignoring spaces, underscores,
 * and hyphens. Keys are canonical fields; values are accepted spellings.
 */
export const FIELD_ALIASES: Record<string, string[]> = {
  title: ['title', 'name', 'task'],
  dueDate: ['duedate', 'due_date', 'deadline', 'due'],
  subject: ['subject', 'class'],
  description: ['description', 'notes'],
  teacher: ['teacher'],
  type: ['type', 'tasktype', 'task_type'],
  status: ['status'],
  priority: ['priority'],
  estimatedMinutes: ['estimatedminutes', 'estimated_minutes', 'estimate', 'minutes'],
  group: ['group'],
};

function normalizeKey(key: string): string {
  return key.trim().toLowerCase().replace(/[ _-]/g, '');
}

function mapField(rawKey: string): string | null {
  const normalized = normalizeKey(rawKey);
  for (const [canonical, aliases] of Object.entries(FIELD_ALIASES)) {
    if (aliases.some((a) => normalizeKey(a) === normalized)) {
      return canonical;
    }
  }
  return null;
}

/** Detect format from raw text. JSON starts with { or [ ; everything else is treated as CSV. */
export function detectFormat(text: string): 'csv' | 'json' | null {
  const trimmed = text.trimStart();
  if (trimmed.length === 0) return null;
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json';
  return 'csv';
}

/**
 * Parse CSV content using papaparse (handles quoted fields, escaped quotes,
 * commas inside quotes, and all common line endings). Never uses a naive split.
 */
function parseCsvRecords(text: string): { records: RawImportRecord[]; errors: string[] } {
  const errors: string[] = [];
  let result: { data?: Record<string, unknown>[]; errors?: { row?: number; message: string }[] };
  try {
    result = parseCsv(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h: string) => h.trim(),
    });
  } catch (e) {
    return {
      records: [],
      errors: [`CSV parse error: ${e instanceof Error ? e.message : String(e)}`],
    };
  }

  for (const e of result.errors ?? []) {
    errors.push(`CSV row ${e.row ?? '?'}: ${e.message}`);
  }

  const records: RawImportRecord[] = (result.data ?? []).map((row: Record<string, unknown>) => {
    const normalized: Record<string, string | undefined> = {};
    for (const [key, value] of Object.entries(row)) {
      if (key === undefined || key === null) continue;
      const canonical = mapField(key);
      if (!canonical) continue;
      const val =
        typeof value === 'string' ? value.trim() : value === undefined || value === null ? undefined : String(value).trim();
      if (val === undefined || val === '') {
        normalized[canonical] = undefined;
      } else if (normalized[canonical] === undefined) {
        normalized[canonical] = val;
      }
    }
    return normalized;
  });

  return { records, errors };
}

/**
 * Parse JSON content. Accepts an array of record objects, or an object with a
 * `homework` or `tasks` array. Unknown object shapes are rejected.
 */
function parseJsonRecords(text: string): { records: RawImportRecord[]; errors: string[] } {
  const errors: string[] = [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return {
      records: [],
      errors: [`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`],
    };
  }

  let array: unknown[];
  if (Array.isArray(parsed)) {
    array = parsed;
  } else if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.homework)) array = obj.homework;
    else if (Array.isArray(obj.tasks)) array = obj.tasks;
    else {
      return {
        records: [],
        errors: ['JSON must be an array of records, or an object with a "homework" or "tasks" array.'],
      };
    }
  } else {
    return { records: [], errors: ['JSON must be an array of records, or an object with a "homework" or "tasks" array.'] };
  }

  const records: RawImportRecord[] = array.map((item) => {
    const normalized: Record<string, string | undefined> = {};
    if (item && typeof item === 'object') {
      for (const [key, value] of Object.entries(item as Record<string, unknown>)) {
        const canonical = mapField(key);
        if (!canonical) continue;
        let str: string | undefined;
        if (value === null || value === undefined) {
          str = undefined;
        } else if (typeof value === 'string') {
          str = value.trim();
        } else {
          str = String(value);
        }
        normalized[canonical] = str === '' ? undefined : str;
      }
    }
    return normalized;
  });

  return { records, errors };
}

/**
 * Validate and normalize a single raw record into an ImportedRecord.
 * Returns the valid record (or null if invalid) plus any field errors.
 */
function validateRecord(
  raw: RawImportRecord,
  row: number,
): { valid: ImportedRecord | null; errors: ImportValidationError[] } {
  const errors: ImportValidationError[] = [];
  const fieldError = (field: string, message: string, value: unknown) => {
    errors.push({ row, field, message, value });
  };

  const title = raw.title ? raw.title.trim() : undefined;
  if (!title) fieldError('title', 'Title is required', raw.title);
  const subject = raw.subject ? raw.subject.trim() : undefined;
  if (!subject) fieldError('subject', 'Subject is required', raw.subject);

  const dueRaw = raw.dueDate ? raw.dueDate.trim() : undefined;
  let dueDate: string | undefined;
  if (!dueRaw) {
    fieldError('dueDate', 'Due date is required', raw.dueDate);
  } else {
    // Accept YYYY-MM-DD or any parseable date; normalize to YYYY-MM-DD.
    const parsed = new Date(dueRaw);
    if (Number.isNaN(parsed.getTime())) {
      fieldError('dueDate', 'Invalid due date', dueRaw);
    } else {
      dueDate = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
    }
  }

  const teacher = raw.teacher ? raw.teacher.trim() : undefined;
  const group = raw.group ? raw.group.trim() : undefined;
  const type = raw.type ? raw.type.trim() : 'Homework';
  const description = raw.description ? raw.description.trim() : undefined;

  let status: HomeworkStatus | undefined;
  if (raw.status) {
    const s = raw.status.trim().toLowerCase();
    if (VALID_STATUSES.includes(s as HomeworkStatus)) {
      status = s as HomeworkStatus;
    } else {
      fieldError('status', `Status must be one of: ${VALID_STATUSES.join(', ')}`, raw.status);
      status = DEFAULT_STATUS;
    }
  } else {
    status = DEFAULT_STATUS;
  }

  let priority: HomeworkPriority | undefined;
  if (raw.priority) {
    priority = normalizeHomeworkPriority(raw.priority.trim());
    if (priority !== raw.priority.trim() && raw.priority.trim() !== '') {
      // normalizeHomeworkPriority falls back to 'medium' for unknown values;
      // flag it only if the original wasn't already empty/undefined.
      if (!['low', 'medium', 'high', 'urgent'].includes(raw.priority.trim().toLowerCase())) {
        fieldError('priority', `Priority must be one of: low, medium, high, urgent`, raw.priority);
      }
    }
  }

  let estimatedMinutes: number | undefined;
  if (raw.estimatedMinutes !== undefined && raw.estimatedMinutes !== '') {
    const n = Number(raw.estimatedMinutes);
    if (!Number.isFinite(n) || !Number.isInteger(n)) {
      fieldError('estimatedMinutes', 'Estimated minutes must be a whole number', raw.estimatedMinutes);
    } else {
      estimatedMinutes = normalizeEstimatedMinutes(n);
      if (estimatedMinutes === undefined) {
        fieldError(
          'estimatedMinutes',
          `Estimated minutes must be between 5 and 1440`,
          raw.estimatedMinutes,
        );
      }
    }
  }

  if (errors.length > 0) {
    return { valid: null, errors };
  }

  return {
    valid: {
      title: title!,
      subject: subject!,
      dueDate: dueDate!,
      teacher,
      group,
      type,
      description,
      status,
      priority,
      estimatedMinutes,
      source: 'file',
    },
    errors: [],
  };
}

/** Build a stable duplicate key from title + subject + due date. */
function duplicateKey(r: { title: string; subject: string; dueDate: string }): string {
  return `${r.title.trim().toLowerCase()}|${r.subject.trim().toLowerCase()}|${r.dueDate}`;
}

/**
 * Split parsed records into unique and duplicates against existing homework.
 * A duplicate matches on title (case-insensitive) + subject (case-insensitive) +
 * due date.
 */
export function detectDuplicates(
  records: ImportedRecord[],
  existing: HomeworkItem[],
): { duplicates: ImportedRecord[]; unique: ImportedRecord[] } {
  const existingKeys = new Set(
    existing.map((e) => duplicateKey({ title: e.title, subject: e.subject, dueDate: e.dueDate.toISOString().slice(0, 10) })),
  );
  const duplicates: ImportedRecord[] = [];
  const unique: ImportedRecord[] = [];
  for (const r of records) {
    if (existingKeys.has(duplicateKey(r))) {
      duplicates.push(r);
    } else {
      unique.push(r);
    }
  }
  return { duplicates, unique };
}

/**
 * Parse raw file text into an ImportPreview. Handles format detection, CSV/JSON
 * parsing, per-record validation, and duplicate detection against existing
 * homework. Invalid rows are collected as errors; valid rows proceed to preview.
 */
export function parseImportFile(
  text: string,
  fileName: string,
  existing: HomeworkItem[],
): { preview: ImportPreview | null; error: string | null } {
  const format = detectFormat(text);
  if (!format) {
    return { preview: null, error: 'Unable to detect file format. Please provide a .csv or .json file.' };
  }

  let parseErrors: string[] = [];
  let rawRecords: RawImportRecord[] = [];

  if (format === 'csv') {
    const parsed = parseCsvRecords(text);
    rawRecords = parsed.records;
    parseErrors = parsed.errors;
  } else {
    const parsed = parseJsonRecords(text);
    rawRecords = parsed.records;
    parseErrors = parsed.errors;
  }

  if (rawRecords.length === 0) {
    return {
      preview: null,
      error: parseErrors.length > 0 ? parseErrors[0] : 'No records found in the file.',
    };
  }

  if (rawRecords.length > MAX_IMPORT_RECORDS) {
    return {
      preview: null,
      error: `File contains ${rawRecords.length} records; maximum allowed is ${MAX_IMPORT_RECORDS}.`,
    };
  }

  const validated: ImportedRecord[] = [];
  const errors: ImportValidationError[] = [...parseErrors.map((msg, i) => ({ row: i + 1, field: 'file', message: msg, value: undefined }))];

  rawRecords.forEach((raw, i) => {
    const row = i + 1;
    const { valid, errors: fieldErrors } = validateRecord(raw, row);
    errors.push(...fieldErrors);
    if (valid) validated.push(valid);
  });

  const { duplicates, unique } = detectDuplicates(validated, existing);

  const preview: ImportPreview = {
    format,
    fileName,
    recordCount: rawRecords.length,
    records: validated,
    errors,
    duplicates,
    unique,
    skipped: duplicates.length,
  };

  return { preview, error: null };
}

/**
 * Apply validated, unique import records to the existing homework list.
 * Records are added (merged); existing records are never modified or removed.
 * Returns the merged array plus an outcome summary.
 */
export function applyImport(
  records: ImportedRecord[],
  existing: HomeworkItem[],
  now: Date = new Date(),
): { merged: HomeworkItem[] } & ImportOutcome {
  const toAdd: HomeworkItem[] = [];
  let skipped = 0;
  const errors: ImportValidationError[] = [];

  for (const r of records) {
    if (!r.title || !r.subject || !r.dueDate) {
      skipped += 1;
      errors.push({ row: 0, field: 'record', message: 'Record missing required fields; skipped.', value: r });
      continue;
    }
    toAdd.push({
      id: generateId(),
      title: r.title.trim(),
      subject: r.subject.trim(),
      teacher: r.teacher ?? '',
      group: r.group ?? '',
      type: r.type ?? 'Homework',
      dueDate: new Date(`${r.dueDate}T00:00:00`),
      status: r.status ?? DEFAULT_STATUS,
      submissionType: null,
      hide: false,
      source: 'file',
      description: r.description,
      priority: r.priority,
      estimatedMinutes: r.estimatedMinutes,
      completedAt:
        r.status === 'completed' || r.status === 'submitted' ? now.toISOString() : null,
    });
  }

  return {
    merged: [...existing, ...toAdd],
    applied: toAdd.length,
    skipped,
    duplicates: 0, // duplicates are filtered before applyImport is called
    errors,
  };
}

/**
 * Convenience: extract just the merged homework array from an apply result.
 */
export function mergedHomework(result: { merged: HomeworkItem[] }): HomeworkItem[] {
  return result.merged;
}
