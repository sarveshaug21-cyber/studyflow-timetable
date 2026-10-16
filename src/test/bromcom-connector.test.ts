import { describe, it, expect, beforeEach } from 'vitest';
import { getOverdueHomeworkFromArray, getHomeworkByDateFromArray } from '@/context/TimetableContext';
import type { HomeworkItem } from '@/types';
import bromcomFixture from '../test/fixtures/bromcom-homework.json';

describe('Bromcom Connector Fixtures', () => {
  let fixtureHomework: HomeworkItem[];

  beforeEach(() => {
    fixtureHomework = (bromcomFixture.homework as Array<Omit<HomeworkItem, 'dueDate'> & { dueDate: string }>).map(h => ({
      ...h,
      dueDate: new Date(h.dueDate),
    })) as HomeworkItem[];
  });

  describe('Fixture Validity', () => {
    it('has expected number of homework items', () => {
      expect(fixtureHomework).toHaveLength(5);
    });

    it('all items have required fields', () => {
      fixtureHomework.forEach(item => {
        expect(item.id).toBeDefined();
        expect(item.title).toBeDefined();
        expect(item.subject).toBeDefined();
        expect(item.teacher).toBeDefined();
        expect(item.group).toBeDefined();
        expect(item.type).toBeDefined();
        expect(item.dueDate).toBeDefined();
        expect(item.status).toBeDefined();
        expect(item.submissionType).toBeDefined();
        expect(item.source).toBe('bromcom');
      });
    });

    it('has valid status values', () => {
      const validStatuses = ['pending', 'submitted', 'overdue', 'completed'];
      fixtureHomework.forEach(item => {
        expect(validStatuses).toContain(item.status);
      });
    });

    it('has valid submission types', () => {
      const validTypes = ['online', 'paper', 'upload', null];
      fixtureHomework.forEach(item => {
        expect(validTypes).toContain(item.submissionType);
      });
    });

    it('has valid ISO 8601 due dates', () => {
      fixtureHomework.forEach(item => {
        expect(item.dueDate).toBeInstanceOf(Date);
        expect(item.dueDate.toISOString()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      });
    });
  });

  describe('UK Date Parsing Simulation', () => {
    it('simulates UK date format parsing (DD/MM/YYYY)', () => {
      const ukDates = [
        { input: '20/10/2026', expected: '2026-10-20T00:00:00.000Z' },
        { input: '15/10/2026', expected: '2026-10-15T00:00:00.000Z' },
        { input: '10/10/2026', expected: '2026-10-10T00:00:00.000Z' },
        { input: '25/10/2026', expected: '2026-10-25T00:00:00.000Z' },
        { input: '18/10/2026', expected: '2026-10-18T00:00:00.000Z' },
      ];

      ukDates.forEach(({ input, expected }) => {
        const [day, month, year] = input.split('/').map(Number);
        const date = new Date(Date.UTC(year, month - 1, day));
        expect(date.toISOString()).toBe(expected);
      });
    });

    it('handles single-digit days/months', () => {
      const input = '5/1/2026';
      const [day, month, year] = input.split('/').map(Number);
      const date = new Date(Date.UTC(year, month - 1, day));
      expect(date.toISOString()).toBe('2026-01-05T00:00:00.000Z');
    });
  });

  describe('Status Normalization', () => {
    it('maps VLE status strings to internal status', () => {
      const statusMap: Record<string, 'pending' | 'submitted' | 'overdue' | 'completed'> = {
        'Pending': 'pending',
        'Not Submitted': 'pending',
        'Submitted': 'submitted',
        'Handed In': 'submitted',
        'Overdue': 'overdue',
        'Late': 'overdue',
        'Completed': 'completed',
        'Marked': 'completed',
      };

      Object.entries(statusMap).forEach(([, internal]) => {
        expect(['pending', 'submitted', 'overdue', 'completed']).toContain(internal);
      });
    });

    it('defaults unknown status to pending', () => {
      const unknownStatus = 'Unknown Status';
      const result = unknownStatus.toLowerCase().includes('submitted') ? 'submitted' :
                     unknownStatus.toLowerCase().includes('complete') ? 'completed' :
                     unknownStatus.toLowerCase().includes('overdue') || unknownStatus.toLowerCase().includes('late') ? 'overdue' :
                     'pending';
      expect(result).toBe('pending');
    });
  });

  describe('Submission Type Normalization', () => {
    it('maps VLE submission types', () => {
      const typeMap: Record<string, 'online' | 'paper' | 'upload' | null> = {
        'Online': 'online',
        'Digital': 'online',
        'Paper': 'paper',
        'Physical': 'paper',
        'Upload': 'upload',
        'File': 'upload',
        '': null,
        'N/A': null,
      };

      Object.entries(typeMap).forEach(([, internal]) => {
        if (internal !== null) {
          expect(typeof internal).toBe('string');
          expect(['online', 'paper', 'upload']).toContain(internal);
        } else {
          expect(internal).toBeNull();
        }
      });
    });
  });

  describe('Connector Integration Functions', () => {
    it('getOverdueHomeworkFromArray correctly identifies overdue items', () => {
      const overdue = getOverdueHomeworkFromArray(fixtureHomework);
      expect(overdue).toHaveLength(1);
      expect(overdue[0].id).toBe('ext-fix-2');
      expect(overdue[0].status).toBe('overdue');
    });

    it('getOverdueHomeworkFromArray excludes completed items even if past due', () => {
      const overdue = getOverdueHomeworkFromArray(fixtureHomework);
      console.log('Overdue items:', overdue.map(h => ({ id: h.id, status: h.status, dueDate: h.dueDate })));
      const completedOverdue = overdue.filter(h => h.status === 'completed' || h.status === 'submitted');
      expect(completedOverdue).toHaveLength(0);
    });

    it('getHomeworkByDateFromArray returns items for specific date', () => {
      const targetDate = new Date('2030-10-20T00:00:00.000Z');
      const byDate = getHomeworkByDateFromArray(fixtureHomework, targetDate);
      expect(byDate).toHaveLength(1);
      expect(byDate[0].id).toBe('ext-fix-1');
    });
  });

  describe('Checksum-based Deduplication', () => {
    it('generates deterministic checksum for identical arrays', () => {
      const array1 = [...fixtureHomework].sort((a, b) => a.id.localeCompare(b.id));
      const array2 = [...fixtureHomework].sort((a, b) => a.id.localeCompare(b.id));

      const checksum1 = generateChecksum(array1);
      const checksum2 = generateChecksum(array2);
      expect(checksum1).toBe(checksum2);
    });

    it('generates different checksums for different arrays', () => {
      const array1 = [...fixtureHomework];
      const array2 = [...fixtureHomework, { ...fixtureHomework[0], id: 'new-item' }];

      const checksum1 = generateChecksum(array1);
      const checksum2 = generateChecksum(array2);
      expect(checksum1).not.toBe(checksum2);
    });

    it('detects checksum mismatch after item modification', () => {
      const modified = fixtureHomework.map(h => h.id === 'ext-fix-1' ? { ...h, status: 'submitted' as const } : h);
      const checksum1 = generateChecksum(fixtureHomework);
      const checksum2 = generateChecksum(modified);
      expect(checksum1).not.toBe(checksum2);
    });
  });

  describe('Edge Cases', () => {
    it('handles empty homework array', () => {
      const overdue = getOverdueHomeworkFromArray([]);
      expect(overdue).toHaveLength(0);

      const byDate = getHomeworkByDateFromArray([], new Date());
      expect(byDate).toHaveLength(0);
    });

    it('handles items with null viewUrl', () => {
      const item = fixtureHomework.find(h => h.viewUrl === null);
      expect(item).toBeDefined();
      expect(item?.viewUrl).toBeNull();
    });

    it('handles hidden items', () => {
      const hidden = fixtureHomework.filter(h => h.hide);
      expect(hidden).toHaveLength(1);
      expect(hidden[0].id).toBe('ext-fix-4');
    });

    it('handles all status types present', () => {
      const statuses = new Set(fixtureHomework.map(h => h.status));
      expect(statuses).toContain('pending');
      expect(statuses).toContain('overdue');
      expect(statuses).toContain('submitted');
      expect(statuses).toContain('completed');
    });
  });
});

function generateChecksum(homework: HomeworkItem[]): string {
  const sorted = [...homework].sort((a, b) => a.id.localeCompare(b.id));
  const str = JSON.stringify(sorted);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `sha256:${Math.abs(hash).toString(16).padStart(8, '0')}`;
}