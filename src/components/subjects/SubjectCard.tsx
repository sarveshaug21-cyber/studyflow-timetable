import { MoreVertical, Edit2, Trash2, Calendar } from 'lucide-react';
import { useTimetable } from '@/hooks/useTimetable';
import { Dropdown } from '@/components/ui';
import { ConfirmDialog } from '@/components/ui/Modal';
import { getContrastColor } from '@/utils/colors';
import type { Subject } from '@/types';
import { useState } from 'react';

interface SubjectCardProps {
  subject: Subject;
  sessionCount: number;
  onEdit: () => void;
}

export function SubjectCard({ subject, sessionCount, onEdit }: SubjectCardProps) {
  const { deleteSubject } = useTimetable();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const textColor = getContrastColor(subject.color);

  return (
    <>
      <div
        className="group relative rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 transition-all hover:shadow-md"
        style={{ borderTop: `4px solid ${subject.color}` }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-medium"
                style={{ backgroundColor: subject.color, color: textColor }}
              >
                {subject.code.slice(0, 3).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 truncate">{subject.name}</h3>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 truncate">{subject.code}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
              {subject.instructor && (
                <span className="flex items-center gap-1">
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  {subject.instructor}
                </span>
              )}
              {subject.room && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {subject.room}
                </span>
              )}
            </div>
          </div>
          <Dropdown
            trigger={
              <button className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all" aria-label="More options">
                <MoreVertical className="h-5 w-5 text-neutral-400" />
              </button>
            }
            items={[
              { label: 'Edit', value: 'edit', icon: <Edit2 className="h-4 w-4" /> },
              { label: 'Delete', value: 'delete', icon: <Trash2 className="h-4 w-4" />, destructive: true },
            ]}
            onSelect={(value) => {
              if (value === 'edit') onEdit();
              if (value === 'delete') setDeleteConfirmOpen(true);
            }}
          />
        </div>
        <div className="mt-4 flex items-center justify-between pt-3 border-t border-neutral-100 dark:border-neutral-800">
          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {sessionCount} session{sessionCount !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-2">
            <span
              className="h-3 w-3 rounded-full border"
              style={{ backgroundColor: subject.color, borderColor: subject.color }}
            />
            <span className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">{subject.color}</span>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={() => {
          deleteSubject(subject.id);
          setDeleteConfirmOpen(false);
        }}
        title="Delete Subject"
        message={`Are you sure you want to delete "${subject.name}"? This will also delete all associated sessions.`}
        confirmText="Delete"
        variant="destructive"
      />
    </>
  );
}