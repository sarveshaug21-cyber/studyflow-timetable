import { CalendarPlus, BookOpen, Plus } from 'lucide-react';
import { useTimetable } from '@/hooks/useTimetable';
import { Button } from '@/components/ui';
import { cn } from '@/utils/cn';

interface EmptyStateProps {
  className?: string;
}

export function EmptyState({ className }: EmptyStateProps) {
  const { loadSampleData, addSubject, state } = useTimetable();
  const hasSubjects = state.subjects.length > 0;

  return (
    <div className={cn('flex flex-col items-center justify-center p-12 text-center', className)}>
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-100 dark:bg-brand-900/30">
        <CalendarPlus className="h-8 w-8 text-brand-600 dark:text-brand-400" />
      </div>
      <h3 className="mb-2 text-xl font-semibold text-neutral-900 dark:text-neutral-100">
        No sessions yet
      </h3>
      <p className="mb-6 max-w-sm text-neutral-500 dark:text-neutral-400">
        {hasSubjects
          ? 'Click "Add Session" or drag on the grid to create your first class.'
          : 'Add a subject first, then create sessions for your timetable.'
        }
      </p>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        {!hasSubjects && (
          <Button variant="outline" onClick={() => addSubject({ name: '', code: '', color: '#3b82f6' })} className="gap-2">
            <BookOpen className="h-4 w-4" />
            Add Subject First
          </Button>
        )}
        <Button onClick={loadSampleData} className="gap-2">
          <Plus className="h-4 w-4" />
          Load Sample Timetable
        </Button>
      </div>
    </div>
  );
}