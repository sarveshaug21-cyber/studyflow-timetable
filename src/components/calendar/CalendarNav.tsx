import { format, addDays } from 'date-fns';
import { useCalendar } from '@/hooks/useCalendar';
import type { ViewMode } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui';

const VIEW_LABELS: Record<ViewMode, string> = {
  weekly: 'Week',
  day: 'Day',
  month: 'Month',
  agenda: 'Agenda',
};

const VIEWS: ViewMode[] = Object.keys(VIEW_LABELS) as ViewMode[];

export function CalendarNav() {
  const {
    view,
    selectedDate,
    setView,
    setSelectedDate,
    goToToday,
    next,
    prev,
    weekStartISO,
    monthLabel,
  } = useCalendar();

  const handleView = (v: ViewMode) => () => {
    setView(v);
    setSelectedDate(selectedDate);
  };

  const isView = (v: ViewMode) => view === v;

  const label = (() => {
    switch (view) {
      case 'month':
        return monthLabel;
      case 'day':
        return format(new Date(`${selectedDate}T00:00:00`), 'EEEE, MMMM d');
      case 'weekly': {
        const start = new Date(`${weekStartISO}T00:00:00`);
        const end = addDays(start, 6);
        return `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`;
      }
      default:
        return 'Agenda';
    }
  })();

  return (
    <div className="flex items-center justify-between gap-4 p-4 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={prev} aria-label="Previous">
          <span className="hidden sm:inline">Previous</span>
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Button>
        <Button size="sm" variant="ghost" onClick={goToToday} aria-label="Today">
          Today
        </Button>
        <Button size="sm" variant="outline" onClick={next} aria-label="Next">
          <span className="hidden sm:inline">Next</span>
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <label
          htmlFor="calendar-date-picker"
          className="text-sm font-medium text-neutral-600 dark:text-neutral-400 hidden sm:inline"
        >
          Go to date:
        </label>
        <Input
          id="calendar-date-picker"
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="text-xs input w-32"
          aria-label="Go to date"
        />
      </div>
      <div className="flex items-center gap-1">
        <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">{label}</span>
      </div>

      <div className="flex items-center gap-1 ml-4">
        {VIEWS.map((v) => (
          <Button
            key={v}
            size="sm"
            variant={isView(v) ? 'primary' : 'outline'}
            onClick={handleView(v)}
            className="px-3"
            aria-pressed={isView(v)}
          >
            {VIEW_LABELS[v]}
          </Button>
        ))}
      </div>
    </div>
  );
}
