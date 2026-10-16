import { Calendar, ChevronLeft, ChevronRight, Sun, Moon, Monitor, LayoutDashboard } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { useTimetable } from '@/hooks/useTimetable';
import { formatWeekRange, getWeekStart } from '@/utils/date';
import { cn } from '@/utils/cn';

export function Header() {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();
  const { state, prevWeek, nextWeek, goToWeek } = useTimetable();

  const weekStart = new Date(state.currentWeekStart);
  const isCurrentWeek = getWeekStart().toISOString().split('T')[0] === weekStart.toISOString().split('T')[0];

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-950/80 backdrop-blur-md px-4">
      <div className="flex-1 flex items-center gap-4 min-w-0">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600">
            <LayoutDashboard className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">StudyFlow</span>
        </div>
        <div className="hidden sm:block w-px h-6 bg-neutral-200 dark:bg-neutral-800" />
        <div className="flex items-center gap-2">
          <button
            onClick={prevWeek}
            className="btn-ghost p-2 h-9 w-9"
            aria-label="Previous week"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 min-w-[200px] text-center">
            <Calendar className="h-4 w-4 text-neutral-500" />
            <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100 whitespace-nowrap">
              {formatWeekRange(weekStart)}
            </span>
          </div>
          <button
            onClick={nextWeek}
            className="btn-ghost p-2 h-9 w-9"
            aria-label="Next week"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <button
            onClick={() => goToWeek(new Date())}
            className={cn(
              'btn-ghost px-3 py-1.5 h-9 text-xs font-medium',
              isCurrentWeek && 'bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300'
            )}
            aria-label="Go to current week"
          >
            Today
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="hidden md:flex items-center gap-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 p-1">
          <button
            onClick={() => setTheme('light')}
            className={cn(
              'btn-ghost p-2 h-9 w-9 rounded-md',
              resolvedTheme === 'light' && 'bg-white dark:bg-neutral-900 shadow-sm'
            )}
            aria-label="Light mode"
            aria-pressed={resolvedTheme === 'light'}
          >
            <Sun className="h-5 w-5" />
          </button>
          <button
            onClick={() => setTheme('dark')}
            className={cn(
              'btn-ghost p-2 h-9 w-9 rounded-md',
              resolvedTheme === 'dark' && 'bg-white dark:bg-neutral-900 shadow-sm'
            )}
            aria-label="Dark mode"
            aria-pressed={resolvedTheme === 'dark'}
          >
            <Moon className="h-5 w-5" />
          </button>
          <button
            onClick={() => setTheme('system')}
            className={cn(
              'btn-ghost p-2 h-9 w-9 rounded-md',
              theme === 'system' && 'bg-white dark:bg-neutral-900 shadow-sm'
            )}
            aria-label="System theme"
            aria-pressed={theme === 'system'}
          >
            <Monitor className="h-5 w-5" />
          </button>
        </div>
        <button
          onClick={toggleTheme}
          className="md:hidden btn-ghost p-2 h-9 w-9"
          aria-label={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {resolvedTheme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
      </div>
    </header>
  );
}