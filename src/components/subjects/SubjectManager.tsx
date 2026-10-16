import { useState } from 'react';
import { useTimetable } from '@/hooks/useTimetable';
import { SubjectCard } from './SubjectCard';
import { SubjectFormModal } from './SubjectFormModal';
import { Button } from '@/components/ui';
import { Plus, BookOpen } from 'lucide-react';

export function SubjectManager() {
  const { state, addSubject } = useTimetable();
  const [formOpen, setFormOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<typeof state.subjects[0] | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Subjects</h2>
        <Button onClick={() => { setEditingSubject(null); setFormOpen(true); }} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Add Subject
        </Button>
      </div>

      {state.subjects.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-200 dark:border-neutral-800 p-8 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-100 dark:bg-neutral-800 mx-auto">
            <BookOpen className="h-6 w-6 text-neutral-400" />
          </div>
          <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-1">No subjects yet</h3>
          <p className="text-neutral-500 dark:text-neutral-400 mb-4">Add your first subject to start building your timetable</p>
          <Button onClick={() => { setEditingSubject(null); setFormOpen(true); }} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Subject
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {state.subjects.map(subject => (
            <SubjectCard
              key={subject.id}
              subject={subject}
              sessionCount={state.sessions.filter(s => s.subjectId === subject.id).length}
              onEdit={() => { setEditingSubject(subject); setFormOpen(true); }}
            />
          ))}
        </div>
      )}

      <SubjectFormModal
        isOpen={formOpen}
        onClose={() => { setFormOpen(false); setEditingSubject(null); }}
        subject={editingSubject}
        onSubmit={(data) => {
          if (editingSubject) {
            // Update handled by form
          } else {
            addSubject(data);
          }
          setFormOpen(false);
          setEditingSubject(null);
        }}
      />
    </div>
  );
}