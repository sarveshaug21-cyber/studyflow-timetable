import { describe, it, expect, vi } from 'vitest';
import type { HomeworkItem, TimetableState } from '@/types';
import {
  parseImportFile,
  detectDuplicates,
  applyImport,
  detectFormat,
  type ImportedRecord,
} from '@/utils/import';
import { timetableStateToJSON } from '@/context/timetableStorage';

// A minimal existing homework item for duplicate detection.
const existingHomework: HomeworkItem[] = [
  {
    id: 'existing-1',
    title: 'Maths Homework',
    subject: 'Mathematics',
    teacher: 'Mr. Smith',
    group: '9A',
    type: 'Homework',
    dueDate: new Date('2026-10-20T00:00:00.000Z'),
    status: 'pending',
    submissionType: 'online',
    hide: false,
    source: 'manual',
  },
  {
    id: 'existing-2',
    title: 'History Essay',
    subject: 'History',
    teacher: 'Ms. Jones',
    group: '10B',
    type: 'Essay',
    dueDate: new Date('2026-10-25T00:00:00.000Z'),
    status: 'completed',
    submissionType: 'paper',
    hide: false,
    source: 'manual',
  },
];

function baseHomework(overrides: Partial<HomeworkItem> = {}): HomeworkItem {
  return {
    id: 'hw-new',
    title: 'New Homework',
    subject: 'Science',
    teacher: 'Dr. Lee',
    group: '11C',
    type: 'Assignment',
    dueDate: new Date('2026-11-01T00:00:00.000Z'),
    status: 'pending',
    submissionType: 'online',
    hide: false,
    source: 'manual',
    ...overrides,
  };
}

describe('detectFormat', () => {
  it('returns json for an array', () => {
    expect(detectFormat('[{}]')).toBe('json');
  });
  it('returns json for an object', () => {
    expect(detectFormat('{"homework":[]}')).toBe('json');
  });
  it('returns csv for plain text', () => {
    expect(detectFormat('title,subject\nMath,Science')).toBe('csv');
  });
  it('returns null for empty text', () => {
    expect(detectFormat('')).toBeNull();
    expect(detectFormat('   ')).toBeNull();
  });
});

describe('parseImportFile — CSV', () => {
  it('parses a valid CSV with header row', () => {
    const csv = `title,subject,dueDate,teacher,type,status
Chapter 3 Exercises,Mathematics,2026-10-20,Mr. Smith,Homework,pending
Essay: Climate Change,Geography,2026-10-15,Ms. Jones,Essay,overdue`;
    const { preview, error } = parseImportFile(csv, 'homework.csv', []);
    expect(error).toBeNull();
    expect(preview).not.toBeNull();
    expect(preview!.format).toBe('csv');
    expect(preview!.fileName).toBe('homework.csv');
    expect(preview!.recordCount).toBe(2);
    expect(preview!.records[0].title).toBe('Chapter 3 Exercises');
    expect(preview!.records[0].subject).toBe('Mathematics');
    expect(preview!.records[0].dueDate).toBe('2026-10-20');
    expect(preview!.records[0].teacher).toBe('Mr. Smith');
    expect(preview!.records[0].status).toBe('pending');
    expect(preview!.errors).toHaveLength(0);
  });

  it('handles quoted fields containing commas', () => {
    const csv = `title,subject,dueDate,teacher
"Chapter 3, Part 2",Mathematics,2026-10-20,"Smith, John"`;
    const { preview, error } = parseImportFile(csv, 'quoted.csv', []);
    expect(error).toBeNull();
    expect(preview!.records[0].title).toBe('Chapter 3, Part 2');
    expect(preview!.records[0].teacher).toBe('Smith, John');
  });

  it('handles escaped quotes inside quoted fields', () => {
    const csv = `title,subject,dueDate
"He said ""hello""",Mathematics,2026-10-20`;
    const { preview, error } = parseImportFile(csv, 'escaped.csv', []);
    expect(error).toBeNull();
    expect(preview!.records[0].title).toBe('He said "hello"');
  });

  it('reports an error for an empty CSV', () => {
    const { preview, error } = parseImportFile('', 'empty.csv', []);
    expect(preview).toBeNull();
    expect(error).toBe('Unable to detect file format. Please provide a .csv or .json file.');
  });

  it('reports an error for a CSV with only headers (no records)', () => {
    const { preview, error } = parseImportFile('title,subject,dueDate\n', 'headers.csv', []);
    expect(preview).toBeNull();
    expect(error).toBe('No records found in the file.');
  });

  it('validates required fields and invalid dates per row', () => {
    const csv = `title,subject,dueDate
Valid Task,Math,2026-10-20
,Math,2026-10-20
Valid Task 2,,2026-10-20
Valid Task 3,Math,not-a-date`;
    const { preview, error } = parseImportFile(csv, 'mixed.csv', []);
    expect(error).toBeNull();
    expect(preview!.recordCount).toBe(4);
    // Only the first row is fully valid.
    expect(preview!.records).toHaveLength(1);
    expect(preview!.records[0].title).toBe('Valid Task');
    expect(preview!.errors.length).toBeGreaterThan(0);
    // Row 2: missing title
    expect(preview!.errors.some((e) => e.row === 2 && e.field === 'title')).toBe(true);
    // Row 3: missing subject
    expect(preview!.errors.some((e) => e.row === 3 && e.field === 'subject')).toBe(true);
    // Row 4: invalid date
    expect(preview!.errors.some((e) => e.row === 4 && e.field === 'dueDate')).toBe(true);
  });

  it('detects duplicates against existing homework', () => {
    const csv = `title,subject,dueDate
Maths Homework,Mathematics,2026-10-20
New Task,Science,2026-11-01`;
    const { preview } = parseImportFile(csv, 'dup.csv', existingHomework);
    expect(preview!.duplicates).toHaveLength(1);
    expect(preview!.duplicates[0].title).toBe('Maths Homework');
    expect(preview!.unique).toHaveLength(1);
    expect(preview!.unique[0].title).toBe('New Task');
    expect(preview!.skipped).toBe(1);
  });

  it('matches duplicates case-insensitively', () => {
    const csv = `title,subject,dueDate
maths homework,mathematics,2026-10-20`;
    const { preview } = parseImportFile(csv, 'case.csv', existingHomework);
    expect(preview!.duplicates).toHaveLength(1);
    expect(preview!.unique).toHaveLength(0);
  });
});

describe('parseImportFile — JSON', () => {
  it('parses a valid JSON array', () => {
    const json = JSON.stringify([
      { title: 'Task A', subject: 'Math', dueDate: '2026-10-20', status: 'pending' },
      { title: 'Task B', subject: 'Science', dueDate: '2026-10-21', status: 'completed' },
    ]);
    const { preview, error } = parseImportFile(json, 'data.json', []);
    expect(error).toBeNull();
    expect(preview!.format).toBe('json');
    expect(preview!.recordCount).toBe(2);
    expect(preview!.records[0].title).toBe('Task A');
    expect(preview!.records[1].status).toBe('completed');
  });

  it('parses a JSON object with a homework array', () => {
    const json = JSON.stringify({
      homework: [{ title: 'Task A', subject: 'Math', dueDate: '2026-10-20' }],
    });
    const { preview, error } = parseImportFile(json, 'obj.json', []);
    expect(error).toBeNull();
    expect(preview!.records).toHaveLength(1);
  });

  it('parses a JSON object with a tasks array', () => {
    const json = JSON.stringify({ tasks: [{ title: 'Task A', subject: 'Math', dueDate: '2026-10-20' }] });
    const { preview, error } = parseImportFile(json, 'tasks.json', []);
    expect(error).toBeNull();
    expect(preview!.records).toHaveLength(1);
  });

  it('rejects invalid JSON', () => {
    const { preview, error } = parseImportFile('{not valid json', 'bad.json', []);
    expect(preview).toBeNull();
    expect(error).toContain('Invalid JSON');
  });

  it('rejects a JSON object without a known array key', () => {
    const json = JSON.stringify({ foo: [] });
    const { preview, error } = parseImportFile(json, 'bad.json', []);
    expect(preview).toBeNull();
    expect(error).toContain('homework');
  });

  it('validates field types and invalid dates in JSON', () => {
    const json = JSON.stringify([
      { title: 'OK', subject: 'Math', dueDate: '2026-10-20' },
      { title: '', subject: 'Math', dueDate: '2026-10-20' },
      { title: 'BadDate', subject: 'Math', dueDate: 'not-a-date' },
      { title: 'BadStatus', subject: 'Math', dueDate: '2026-10-20', status: 'floating' },
    ]);
    const { preview, error } = parseImportFile(json, 'types.json', []);
    expect(error).toBeNull();
    expect(preview!.records).toHaveLength(1);
    expect(preview!.records[0].title).toBe('OK');
    expect(preview!.errors.length).toBeGreaterThan(0);
  });
});

describe('detectDuplicates', () => {
  it('returns all unique when no duplicates exist', () => {
    const records = [
      { title: 'A', subject: 'Math', dueDate: '2026-10-20', source: 'file' as const },
    ];
    const { duplicates, unique } = detectDuplicates(records, []);
    expect(duplicates).toHaveLength(0);
    expect(unique).toHaveLength(1);
  });

  it('identifies duplicates by title+subject+dueDate', () => {
    const records = [
      { title: 'Maths Homework', subject: 'Mathematics', dueDate: '2026-10-20', source: 'file' as const },
      { title: 'New Task', subject: 'Science', dueDate: '2026-11-01', source: 'file' as const },
    ];
    const { duplicates, unique } = detectDuplicates(records, existingHomework);
    expect(duplicates).toHaveLength(1);
    expect(unique).toHaveLength(1);
  });
});

describe('applyImport', () => {
  it('merges valid records into existing homework without replacing anything', () => {
    const records: ImportedRecord[] = [
      { title: 'Imported Task', subject: 'Biology', dueDate: '2026-10-30', source: 'file' },
    ];
    const result = applyImport(records, existingHomework);
    expect(result.merged).toHaveLength(existingHomework.length + 1);
    expect(result.applied).toBe(1);
    expect(result.skipped).toBe(0);
    // Existing records untouched.
    expect(result.merged[0].title).toBe('Maths Homework');
    expect(result.merged[1].title).toBe('History Essay');
    // Imported record has a generated id and source 'file'.
    const imported = result.merged[2];
    expect(imported.id).not.toBeUndefined();
    expect(imported.source).toBe('file');
    expect(imported.title).toBe('Imported Task');
  });

  it('does not mutate the input existing array', () => {
    const before = existingHomework.length;
    applyImport([{ title: 'X', subject: 'Y', dueDate: '2026-10-30', source: 'file' }], existingHomework);
    expect(existingHomework).toHaveLength(before);
  });

  it('sets completedAt for completed/submitted imports', () => {
    const fixedNow = new Date('2026-10-15T12:00:00.000Z');
    const records: ImportedRecord[] = [
      { title: 'Done Task', subject: 'Math', dueDate: '2026-10-20', status: 'completed', source: 'file' },
      { title: 'Submitted Task', subject: 'Math', dueDate: '2026-10-20', status: 'submitted', source: 'file' },
    ];
    const result = applyImport(records, [], fixedNow);
    expect(result.merged[0].completedAt).toBe(fixedNow.toISOString());
    expect(result.merged[1].completedAt).toBe(fixedNow.toISOString());
  });

  it('leaves completedAt null for pending/overdue imports', () => {
    const records: ImportedRecord[] = [
      { title: 'Pending Task', subject: 'Math', dueDate: '2026-10-20', status: 'pending', source: 'file' },
    ];
    const result = applyImport(records, []);
    expect(result.merged[0].completedAt).toBeNull();
  });

  it('skips records missing required fields', () => {
    const records: ImportedRecord[] = [
      { title: '', subject: 'Math', dueDate: '2026-10-20', source: 'file' },
      { title: 'OK', subject: '', dueDate: '2026-10-20', source: 'file' },
      { title: 'OK2', subject: 'Math', dueDate: '', source: 'file' },
      { title: 'Valid', subject: 'Science', dueDate: '2026-11-01', source: 'file' },
    ];
    const result = applyImport(records, []);
    expect(result.applied).toBe(1);
    expect(result.skipped).toBe(3);
    expect(result.errors.length).toBe(3);
  });
});

describe('persistence — imported records survive serialization', () => {
  it('imported records serialize and deserialize correctly through the storage layer', () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: vi.fn((k: string) => (store.has(k) ? store.get(k)! : null)),
      setItem: vi.fn((k: string, v: string) => store.set(k, String(v))),
      removeItem: vi.fn(() => {}),
      clear: vi.fn(() => store.clear()),
    };
    vi.stubGlobal('localStorage', storage);

    const merged = applyImport(
      [{ title: 'Imported Essay', subject: 'English', dueDate: '2026-11-01', source: 'file' }],
      [baseHomework()],
    );
    const state: TimetableState = {
      subjects: [],
      sessions: [],
      homework: merged.merged,
      currentWeekStart: '2026-10-12T00:00:00.000Z',
      view: 'weekly',
      timeIncrement: 30,
      showWeekends: false,
      timeRange: { start: '08:00', end: '18:00' },
    };
    const json = timetableStateToJSON(state);
    localStorage.setItem('studyflow-timetable', json);

    const restored = JSON.parse(localStorage.getItem('studyflow-timetable')!);
    const imported = (restored.homework as HomeworkItem[]).find((h) => h.title === 'Imported Essay');
    expect(imported).toBeDefined();
    expect(imported!.source).toBe('file');
    expect(merged.merged.some((h) => h.source === 'file')).toBe(true);

    vi.unstubAllGlobals();
  });
});
