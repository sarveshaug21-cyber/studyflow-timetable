import { Header } from '@/components/layout';
import { Toolbar } from '@/components/layout/Toolbar';
import { FullCalendarView } from '@/components/calendar';
import { CalendarNav } from '@/components/calendar';
import { SubjectManager } from '@/components/subjects';
import { SessionEditor } from '@/components/sessions';
import { EmptyState } from '@/components/timetable/EmptyState';
import { HomeworkView } from '@/components/homework/HomeworkView';
import { ImportDialog } from '@/components/homework/ImportDialog';
import { FocusMode } from '@/components/focus/FocusMode';
import { ProgressDashboard } from '@/components/progress/ProgressDashboard';
import { StudyPlanner } from '@/components/planner/StudyPlanner';
import { ToastProvider } from '@/components/ui/Toast';
import { SkipLink } from '@/components/ui/SkipLink';
import { TimetableLayoutProvider } from '@/context/TimetableLayoutContext';
import { CalendarProvider } from '@/context/CalendarContext';
import { useTimetable } from '@/hooks/useTimetable';
import { useCalendar } from '@/hooks/useCalendar';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useState } from 'react';
import { Timer, BarChart3, CalendarClock } from 'lucide-react';
import { cn } from '@/utils/cn';

type AppTab = 'timetable' | 'homework' | 'focus' | 'progress' | 'planner' | 'subjects';

function AppContent() {
  const {
    state,
    dispatch,
    addSession,
    addHomework,
    updateHomework,
    removeHomework,
  } = useTimetable();
  const { goToToday, next, prev, setView } = useCalendar();
  const [sessionEditorOpen, setSessionEditorOpen] = useState(false);
  const [initialSessionData, setInitialSessionData] = useState<Partial<import('@/types').Session> | null>(null);
  const [activeTab, setActiveTab] = useState<AppTab>('timetable');
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  const handleAddSession = () => {
    setInitialSessionData(null);
    setSessionEditorOpen(true);
  };

  const handleSessionSubmit = (sessionData: Omit<import('@/types').Session, 'id' | 'createdAt' | 'updatedAt'>) => {
    addSession(sessionData);
    setSessionEditorOpen(false);
  };

  useKeyboardShortcuts({
    goToToday,
    next,
    prev,
    setView,
    onAddSession: handleAddSession,
  });

  const handleImportOpen = () => setImportDialogOpen(true);

  const handleImportClose = () => setImportDialogOpen(false);

  const handleImportApply = (mergedHomework: import('@/types').HomeworkItem[]) => {
    dispatch({ type: 'SET_STATE', payload: { ...state, homework: mergedHomework } });
    setImportDialogOpen(false);
  };

  const showMainContent = state.subjects.length > 0 || state.sessions.length > 0 || state.homework.length > 0;

  return (
    <div className="flex h-screen flex-col bg-neutral-50 dark:bg-neutral-950">
      <SkipLink />
      <Header />
      <CalendarNav />
      <Toolbar onAddSession={handleAddSession} onImport={handleImportOpen} />

      <div className="flex-1 flex overflow-hidden">
        <aside className="hidden lg:block w-72 border-r border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-auto">
<nav className="p-4 space-y-1" role="navigation" aria-label="Main navigation">
            <button
              onClick={() => setActiveTab('timetable')}
              className={cn(
                'w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                activeTab === 'timetable'
                  ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300'
                  : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              )}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Timetable
            </button>
            <button
              onClick={() => setActiveTab('homework')}
              className={cn(
                'w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                activeTab === 'homework'
                  ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300'
                  : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              )}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              Homework
            </button>
            <button
              onClick={() => setActiveTab('focus')}
              className={cn(
                'w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                activeTab === 'focus'
                  ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300'
                  : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              )}
            >
              <Timer className="h-5 w-5" aria-hidden="true" />
              Focus
            </button>
            <button
              onClick={() => setActiveTab('progress')}
              className={cn(
                'w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                activeTab === 'progress'
                  ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300'
                  : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              )}
            >
              <BarChart3 className="h-5 w-5" aria-hidden="true" />
              Progress
            </button>
            <button
              onClick={() => setActiveTab('planner')}
              className={cn(
                'w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                activeTab === 'planner'
                  ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300'
                  : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              )}
            >
              <CalendarClock className="h-5 w-5" aria-hidden="true" />
              Planner
            </button>
            <button
              onClick={() => setActiveTab('subjects')}
              className={cn(
                'w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                activeTab === 'subjects'
                  ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300'
                  : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              )}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477 4.5 1.253" />
              </svg>
              Subjects
            </button>
          </nav>
        </aside>

        <main id="main-content" className="flex-1 flex flex-col overflow-hidden">
          {activeTab === 'timetable' ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              {showMainContent ? (
                <FullCalendarView />
              ) : (
                <EmptyState />
              )}
            </div>
          ) : activeTab === 'homework' ? (
            <HomeworkView
              homework={state.homework}
              subjects={state.subjects}
              onImportClick={handleImportOpen}
              onAddHomework={addHomework}
              onUpdateHomework={updateHomework}
              onRemoveHomework={removeHomework}
            />
          ) : activeTab === 'focus' ? (
            <FocusMode />
          ) : activeTab === 'progress' ? (
            <ProgressDashboard />
          ) : activeTab === 'planner' ? (
            <div className="flex-1 overflow-auto p-4">
              <StudyPlanner />
            </div>
          ) : (
            <div className="flex-1 overflow-auto p-4">
              <SubjectManager />
            </div>
          )}
        </main>
      </div>

      <SessionEditor
        isOpen={sessionEditorOpen}
        onClose={() => setSessionEditorOpen(false)}
        onSubmit={handleSessionSubmit}
        initialData={initialSessionData || undefined}
        subjects={state.subjects}
      />

      <ImportDialog
        isOpen={importDialogOpen}
        onClose={handleImportClose}
        homework={state.homework}
        onImported={handleImportApply}
      />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <CalendarProvider>
        <TimetableLayoutProvider>
          <AppContent />
        </TimetableLayoutProvider>
      </CalendarProvider>
    </ToastProvider>
  );
}