# Homework Import — CSV & JSON

StudyFlow is **local-first**: all data stays in your browser (`localStorage`),
nothing is uploaded, and there is no cloud sync or remote API. Homework can be
imported from a local `.csv` or `.json` file through the **Import from File**
button in the Homework view.

## How to import

1. Open the **Homework** view.
2. Click **Import from File**.
3. Choose a `.csv` or `.json` file from your computer.
4. Review the preview: detected format, record count, sample rows, validation
   errors, and likely duplicates.
5. Click **Import** to add the valid, non-duplicate records to your list.
6. Click **Done** to close the dialog.

## Supported file formats

### CSV (`.csv`)

The first row must be headers. Quoted fields, commas inside quotes, and escaped
quotes are handled correctly (parsed with a proper CSV parser — never a naive
comma split).

Supported columns (aliases accepted, case-insensitive):

| Column | Aliases | Required? | Notes |
|--------|---------|-----------|-------|
| title | `title`, `name`, `task` | Yes | Homework title |
| subject | `subject`, `class` | Yes | Subject name |
| dueDate | `duedate`, `due_date`, `deadline`, `due` | Yes | Any parseable date (e.g. `2026-10-20`) |
| teacher | `teacher` | No | Teacher name |
| group | `group` | No | Class/group |
| type | `type`, `tasktype`, `task_type` | No | Task type (defaults to `Homework`) |
| status | `status` | No | `pending`, `submitted`, `completed`, or `overdue` (defaults to `pending`) |
| priority | `priority` | No | `low`, `medium`, `high`, or `urgent` (defaults to `medium`) |
| estimatedMinutes | `estimatedminutes`, `estimated_minutes`, `estimate`, `minutes` | No | Whole minutes, 5–1440 (blank = auto-estimate) |
| description | `description`, `notes` | No | Free-text description |

**Sample:** see `docs/samples/sample-homework.csv`.

### JSON (`.json`)

Accepts either:
- An array of record objects: `[{ ... }, { ... }]`
- An object with a `homework` or `tasks` array: `{ "homework": [ ... ] }`

Supported fields match the CSV columns above. Unknown fields are safely
ignored.

**Sample:** see `docs/samples/sample-homework.json`.

## Validation

Each record is validated before import:

- **Title** and **subject** are required.
- **Due date** is required and must be a valid date.
- **Status** must be one of: `pending`, `submitted`, `completed`, `overdue`.
- **Priority** must be one of: `low`, `medium`, `high`, `urgent`.
- **Estimated minutes** must be a whole number between 5 and 1440 (blank is
  valid and means "auto-estimate").

Invalid rows are reported by row number and field, and are skipped. Valid rows
from the same file are still imported.

## Duplicate detection

A record is treated as a likely **duplicate** when its title, subject, and due
date all match an existing homework item (case-insensitive). Duplicates are
skipped by default so nothing is imported twice. Duplicate records are shown in
the preview before you confirm.

## Merge behaviour

Imported records are **merged (added)** into your existing homework list:

- Existing records are **never modified, replaced, or deleted**.
- New records get a generated ID and `source: "file"`.
- Records with status `completed` or `submitted` get a `completedAt` timestamp.

Nothing is silently overwritten. Applying the import is an explicit action —
you can cancel at any time.

## Limits

- Maximum file size: **5 MB**
- Maximum records per file: **1,000**

## Backup and restore

All data is stored in your browser's `localStorage` under the key
`studyflow-timetable`. To back up your data, use the **Export** button in the
Homework view to download a JSON file of your current homework. To restore,
import that JSON file back through the Import from File dialog.

Browser data is **not** shared across devices or browsers — it lives only in
the browser where it was created. Export regularly to keep backups.
