import { LayoutGrid, List } from 'lucide-react';
import { useTimetable } from '@/hooks/useTimetable';
import { Button } from '@/components/ui';

export function ViewSwitcher() {
  const { state, setView } = useTimetable();

  return (
    <div className="flex items-center gap-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 p-1" role="group" aria-label="View mode">
      <Button
        variant={state.view === 'weekly' ? 'secondary' : 'ghost'}
        size="sm"
        onClick={() => setView('weekly')}
        aria-pressed={state.view === 'weekly'}
        className="gap-1.5"
      >
        <LayoutGrid className="h-4 w-4" />
        <span className="hidden sm:inline">Weekly Grid</span>
      </Button>
      <Button
        variant={state.view === 'agenda' ? 'secondary' : 'ghost'}
        size="sm"
        onClick={() => setView('agenda')}
        aria-pressed={state.view === 'agenda'}
        className="gap-1.5"
      >
        <List className="h-4 w-4" />
        <span className="hidden sm:inline">Agenda</span>
      </Button>
    </div>
  );
}