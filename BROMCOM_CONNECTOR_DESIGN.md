# Bromcom Homework Connector Design

## Overview

This document describes the secure connector interface between a browser extension (reading the authenticated Bromcom VLE portal) and StudyFlow (the React/Vite web application).

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Bromcom VLE Portal                          │
│  (bromcomvle.com - Student authenticated session)               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Browser Extension (Content Script)                      │  │
│  │  • Reads authenticated homework table DOM                │  │
│  │  • No credentials/cookies extracted                      │  │
│  │  • Only own homework data accessed                       │  │
│  └─────────────────────────┬─────────────────────────────────┘  │
└────────────────────────────┼────────────────────────────────────┘
                             │ postMessage (structured data)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                        StudyFlow (Web App)                       │
│  (localhost:5173 - React/Vite)                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Message Listener (Window)                               │  │
│  │  • Validates origin (localhost:5173)                     │  │
│  │  • Validates message schema                              │  │
│  │  • Dispatches to TimetableContext                        │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Security Constraints

| Constraint | Implementation |
|------------|----------------|
| No password/MFA storage | Extension never accesses credentials |
| No cookie/token extraction | Extension only reads visible DOM |
| No SSO bypass | User must authenticate via Google/Microsoft SSO |
| Read-only access | Extension only reads, never writes |
| Own data only | Extension scoped to current user's homework table |
| Origin validation | StudyFlow validates `window.origin === 'http://localhost:5173'` |

## Message Protocol

### Extension → StudyFlow (postMessage)

```typescript
interface HomeworkSyncMessage {
  type: 'HOMEWORK_SYNC';
  version: 1;
  source: 'bromcom-extension';
  timestamp: string; // ISO 8601
  payload: {
    homework: HomeworkItem[];
    checksum: string; // SHA-256 of homework array for deduplication
  };
}
```

### StudyFlow → Extension (acknowledgment)

```typescript
interface SyncAckMessage {
  type: 'HOMEWORK_SYNC_ACK';
  version: 1;
  success: boolean;
  imported: number;
  duplicates: number;
  errors: string[];
}
```

## HomeworkItem Schema

```typescript
interface HomeworkItem {
  id: string;                    // Extension-generated UUID
  title: string;                 // From VLE table "Title" column
  subject: string;               // From VLE table "Subject" column
  teacher: string;               // From VLE table "Teacher" column
  group: string;                 // From VLE table "Group" column
  type: string;                  // From VLE table "Type" column
  dueDate: string;               // ISO 8601 from VLE "Due Date" (DD/MM/YYYY)
  status: 'pending' | 'submitted' | 'overdue' | 'completed';
  submissionType: 'online' | 'paper' | 'upload' | null;
  viewUrl?: string;              // VLE "View" link if present
  hide: boolean;                 // From VLE "Hide" checkbox
  source: 'bromcom';             // Fixed identifier
}
```

## VLE DOM Extraction Strategy

The extension runs as a content script on `https://www.bromcomvle.com/*` and:

1. **Detects homework page**: Checks for homework table (typically `#HomeworkTable` or similar)
2. **Extracts rows**: Iterates table rows, mapping columns by header text
3. **Normalizes dates**: Parses UK format (DD/MM/YYYY) to ISO 8601
4. **Computes status**: Compares due date with current date for overdue detection
5. **Generates checksum**: SHA-256 of sorted homework for deduplication

```javascript
// Example extraction logic (content script)
function extractHomework(): HomeworkItem[] {
  const table = document.querySelector('#HomeworkTable, table.homework-table');
  if (!table) return [];

  const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent?.trim().toLowerCase());
  const colMap = {
    title: headers.indexOf('title'),
    subject: headers.indexOf('subject'),
    teacher: headers.indexOf('teacher'),
    group: headers.indexOf('group'),
    type: headers.indexOf('type'),
    dueDate: headers.indexOf('due date'),
    status: headers.indexOf('status'),
    submissionType: headers.indexOf('submission type'),
    viewUrl: headers.indexOf('view'),
    hide: headers.indexOf('hide'),
  };

  return Array.from(table.querySelectorAll('tbody tr')).map(row => {
    const cells = row.querySelectorAll('td');
    return {
      id: crypto.randomUUID(),
      title: cells[colMap.title]?.textContent?.trim() || '',
      subject: cells[colMap.subject]?.textContent?.trim() || '',
      teacher: cells[colMap.teacher]?.textContent?.trim() || '',
      group: cells[colMap.group]?.textContent?.trim() || '',
      type: cells[colMap.type]?.textContent?.trim() || '',
      dueDate: parseUKDate(cells[colMap.dueDate]?.textContent?.trim() || ''),
      status: normalizeStatus(cells[colMap.status]?.textContent?.trim() || ''),
      submissionType: normalizeSubmissionType(cells[colMap.submissionType]?.textContent?.trim() || ''),
      viewUrl: cells[colMap.viewUrl]?.querySelector('a')?.href,
      hide: cells[colMap.hide]?.querySelector('input[type="checkbox"]')?.checked || false,
      source: 'bromcom',
    };
  }).filter(h => h.title && h.dueDate);
}
```

## StudyFlow Integration

StudyFlow listens for messages on the window:

```typescript
// In StudyFlow (e.g., in App.tsx or a dedicated hook)
useEffect(() => {
  const handleMessage = (event: MessageEvent) => {
    // Origin validation
    if (event.origin !== window.location.origin) return;
    if (event.data?.type !== 'HOMEWORK_SYNC') return;
    if (event.data.version !== 1) return;

    const { payload } = event.data;
    const imported = importHomework(payload.homework);

    // Send acknowledgment
    event.source?.postMessage({
      type: 'HOMEWORK_SYNC_ACK',
      version: 1,
      success: true,
      imported: imported.count,
      duplicates: imported.duplicates,
      errors: imported.errors,
    }, event.origin);
  };

  window.addEventListener('message', handleMessage);
  return () => window.removeEventListener('message', handleMessage);
}, []);
```

## Fixture-Based Testing

Since authenticated VLE access is unavailable, tests use realistic fixtures:

```typescript
// test/fixtures/bromcom-homework.json
{
  "homework": [
    {
      "id": "ext-1",
      "title": "Chapter 3 Exercises",
      "subject": "Mathematics",
      "teacher": "Mr. Smith",
      "group": "10A",
      "type": "Homework",
      "dueDate": "2026-10-20T00:00:00.000Z",
      "status": "pending",
      "submissionType": "online",
      "source": "bromcom"
    },
    {
      "id": "ext-2",
      "title": "Essay: Climate Change",
      "subject": "Geography",
      "teacher": "Ms. Jones",
      "group": "10A",
      "type": "Coursework",
      "dueDate": "2026-10-15T00:00:00.000Z",
      "status": "overdue",
      "submissionType": "online",
      "source": "bromcom"
    }
  ],
  "checksum": "sha256:..."
}
```

Tests verify:
- UK date parsing (DD/MM/YYYY → ISO 8601)
- Status normalization (Overdue/Pending/Submitted/Completed)
- Duplicate detection via checksum
- Partial updates (status changes)
- Empty state handling
- Invalid data rejection

## Extension Manifest (v3)

```json
{
  "name": "Bromcom Homework Sync",
  "version": "1.0.0",
  "manifest_version": 3,
  "permissions": ["activeTab", "scripting"],
  "host_permissions": ["https://www.bromcomvle.com/*"],
  "content_scripts": [{
    "matches": ["https://www.bromcomvle.com/*"],
    "js": ["content.js"],
    "run_at": "document_idle"
  }],
  "background": {
    "service_worker": "background.js"
  }
}
```

## Deployment Notes

1. **Extension Installation**: User installs extension from Chrome Web Store or loads unpacked
2. **First Sync**: User clicks "Import from Bromcom" in StudyFlow → opens VLE in new tab → extension detects homework → sends to StudyFlow
3. **Auto-sync**: On VLE homework page load, extension auto-sends if StudyFlow tab open
4. **Session Handling**: Relies on browser SSO session persistence; no re-auth needed while session valid

## Limitations

- No official VLE API → relies on DOM scraping (brittle to UI changes)
- Requires StudyFlow tab open for auto-sync
- No push notifications from VLE
- Checksum-based deduplication may miss structural changes
- Extension must be updated if VLE DOM structure changes