import { useMemo, useState } from 'react';
import { HomeworkItem } from '@/types';
import { format } from 'date-fns';
import { AlertCircle, CheckCircle, Clock, Filter, ChevronDown, Download, Upload, Edit2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Dropdown } from '@/components/ui/Dropdown';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { getOverdueHomeworkFromArray } from '@/context/TimetableContext';
import { HomeworkEditor } from './HomeworkEditor';

type HomeworkFilter = 'all' | 'upcoming' | 'overdue' | 'completed';
type SortOrder = 'dueDate-asc' | 'dueDate-desc' | 'subject-asc' | 'subject-desc';

interface HomeworkViewProps {
  homework: HomeworkItem[];
  subjects: Array<{ id: string; name: string; color: string }>;
  onImportClick: () => void;
  onAddHomework: (item: Omit<HomeworkItem, 'id'>) => void;
  onUpdateHomework: (item: HomeworkItem) => void;
  onRemoveHomework: (id: string) => void;
}

const filterItems = [
  { label: 'All', value: 'all' as HomeworkFilter },
  { label: 'Upcoming', value: 'upcoming' as HomeworkFilter },
  { label: 'Overdue', value: 'overdue' as HomeworkFilter },
  { label: 'Completed', value: 'completed' as HomeworkFilter },
];

const sortItems = [
  { label: 'Due Date (Oldest First)', value: 'dueDate-asc' as SortOrder },
  { label: 'Due Date (Newest First)', value: 'dueDate-desc' as SortOrder },
  { label: 'Subject (A-Z)', value: 'subject-asc' as SortOrder },
  { label: 'Subject (Z-A)', value: 'subject-desc' as SortOrder },
];

export function HomeworkView({ 
  homework, 
  subjects, 
  onImportClick, 
  onAddHomework,
  onUpdateHomework,
  onRemoveHomework,
}: HomeworkViewProps) {
  const [filter, setFilter] = useState<HomeworkFilter>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('dueDate-asc');
  const [searchQuery, setSearchQuery] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<HomeworkItem | undefined>(undefined);
  const { toast } = useToast();

  const filteredHomework = useMemo(() => {
    let result = [...homework];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (h) =>
          h.title.toLowerCase().includes(query) ||
          h.subject.toLowerCase().includes(query) ||
          h.teacher.toLowerCase().includes(query)
      );
    }

    switch (filter) {
      case 'upcoming':
        result = result.filter((h) => h.status === 'pending' && new Date(h.dueDate) >= new Date());
        break;
      case 'overdue':
        result = getOverdueHomeworkFromArray(result);
        break;
      case 'completed':
        result = result.filter((h) => h.status === 'completed' || h.status === 'submitted');
        break;
    }

    result.sort((a, b) => {
      switch (sortOrder) {
        case 'dueDate-asc':
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        case 'dueDate-desc':
          return new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime();
        case 'subject-asc':
          return a.subject.localeCompare(b.subject);
        case 'subject-desc':
          return b.subject.localeCompare(a.subject);
        default:
          return 0;
      }
    });

    return result;
  }, [homework, filter, sortOrder, searchQuery]);

  const stats = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return {
      total: homework.length,
      upcoming: homework.filter((h) => h.status === 'pending' && new Date(h.dueDate) >= now).length,
      overdue: getOverdueHomeworkFromArray(homework).length,
      completed: homework.filter((h) => h.status === 'completed' || h.status === 'submitted').length,
    };
  }, [homework]);

  const getStatusBadge = (item: HomeworkItem) => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const dueDate = new Date(item.dueDate);
    dueDate.setHours(0, 0, 0, 0);
    const isOverdue = item.status !== 'completed' && item.status !== 'submitted' && dueDate < now;

    if (item.status === 'completed' || item.status === 'submitted') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 dark:bg-green-900/30 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
          <CheckCircle className="h-3 w-3" />
          {item.status === 'submitted' ? 'Submitted' : 'Completed'}
        </span>
      );
    }

    if (isOverdue) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/30 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:text-red-400">
          <AlertCircle className="h-3 w-3" />
          Overdue
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
        <Clock className="h-3 w-3" />
        Pending
      </span>
    );
  };

  const getSubjectColor = (subjectName: string) => {
    const subject = subjects.find((s) => s.name === subjectName);
    return subject?.color || '#6b7280';
  };

  const handleExport = () => {
    const data = JSON.stringify(filteredHomework, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `homework-${format(new Date(), 'yyyy-MM-dd')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ type: 'success', title: 'Exported', message: `${filteredHomework.length} homework items exported` });
  };

  const handleAddHomework = () => {
    setEditingItem(undefined);
    setEditorOpen(true);
  };

  const handleEditHomework = (item: HomeworkItem) => {
    setEditingItem(item);
    setEditorOpen(true);
  };

  const handleSaveHomework = (data: Omit<HomeworkItem, 'id'>) => {
    if (editingItem) {
      onUpdateHomework({ ...data, id: editingItem.id });
      toast({ type: 'success', title: 'Updated', message: 'Homework updated successfully' });
    } else {
      onAddHomework(data);
      toast({ type: 'success', title: 'Added', message: 'Homework added successfully' });
    }
  };

  const handleDeleteHomework = (id: string) => {
    onRemoveHomework(id);
    toast({ type: 'success', title: 'Deleted', message: 'Homework deleted successfully' });
  };

  const groupedHomework = useMemo(() => {
    const groups: Record<string, HomeworkItem[]> = {
      Overdue: [],
      Upcoming: [],
      Completed: [],
    };
    filteredHomework.forEach((item) => {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const dueDate = new Date(item.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      const isOverdue = item.status !== 'completed' && item.status !== 'submitted' && dueDate < now;

      let key: 'Overdue' | 'Upcoming' | 'Completed';
      if (item.status === 'completed' || item.status === 'submitted') {
        key = 'Completed';
      } else if (isOverdue) {
        key = 'Overdue';
      } else {
        key = 'Upcoming';
      }
      groups[key].push(item);
    });
    return groups;
  }, [filteredHomework]);

  return (
    <div className="flex-1 overflow-auto p-4 lg:p-6 space-y-6">
      <HomeworkEditor
        isOpen={editorOpen}
        onClose={() => { setEditorOpen(false); setEditingItem(undefined); }}
        onSave={handleSaveHomework}
        initialData={editingItem}
        subjects={subjects}
        isEditing={!!editingItem}
        onDelete={editingItem ? () => handleDeleteHomework(editingItem.id) : undefined}
      />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Homework</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            {stats.total} total • {stats.upcoming} upcoming • {stats.overdue} overdue • {stats.completed} completed
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={onImportClick} className="gap-2">
            <Upload className="h-4 w-4" />
            Import from File
          </Button>
          <Button variant="outline" onClick={handleAddHomework} className="gap-2">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Manually
          </Button>
          <Button variant="outline" onClick={handleExport} className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <Input
            placeholder="Search homework..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Dropdown
          trigger={
            <Button variant="outline" className="gap-2">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 12h13M3 20h13" />
              </svg>
              Filter: {filter.charAt(0).toUpperCase() + filter.slice(1)}
              <ChevronDown className="h-4 w-4" />
            </Button>
          }
          items={filterItems.map((f) => ({ label: f.label, value: f.value }))}
          onSelect={(value) => setFilter(value as HomeworkFilter)}
        />
        <Dropdown
          trigger={
            <Button variant="outline" className="gap-2">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 12h13M3 20h13" />
              </svg>
              Sort: {sortOrder.replace('-', ' ').replace('asc', '▲').replace('desc', '▼')}
              <ChevronDown className="h-4 w-4" />
            </Button>
          }
          items={sortItems.map((s) => ({ label: s.label, value: s.value }))}
          onSelect={(value) => setSortOrder(value as SortOrder)}
        />
      </div>

      {filteredHomework.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <svg className="h-16 w-16 text-neutral-300 dark:text-neutral-700 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100">No homework found</h3>
          <p className="text-neutral-500 dark:text-neutral-400 mt-1">
            {searchQuery ? 'Try adjusting your search or filters' : 'Import from file or add manually to get started'}
          </p>
          {!searchQuery && filter === 'all' && (
            <div className="mt-4 flex gap-2">
              <Button onClick={handleAddHomework} className="gap-2">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Homework
              </Button>
              <Button variant="outline" onClick={onImportClick} className="gap-2">
                <Upload className="h-4 w-4" />
                Import from File
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {(['Overdue', 'Upcoming', 'Completed'] as const).map((section) => {
            const items = groupedHomework[section];
            if (!items || items.length === 0) return null;

            return (
              <section key={section} className="rounded-xl border p-4">
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                    {section} ({items.length})
                  </h2>
                </div>
                <div className="space-y-2">
                  {items.map((item) => (
                    <article
                      key={item.id}
                      className="group flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:border-brand-300 dark:hover:border-brand-700 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-medium text-neutral-900 dark:text-neutral-100 truncate">{item.title}</h3>
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                            style={{ backgroundColor: `${getSubjectColor(item.subject)}20`, color: getSubjectColor(item.subject) }}
                          >
                            {item.subject}
                          </span>
                          {item.group && (
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                              {item.group}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            Due: {format(new Date(item.dueDate), 'EEE, MMM d, yyyy')}
                          </span>
                          <span className="flex items-center gap-1">
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            {item.teacher}
                          </span>
                          <span className="flex items-center gap-1">
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477 4.5 1.253" />
                            </svg>
                            {item.type}
                          </span>
                          {item.submissionType && (
                            <span className="flex items-center gap-1">
                              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                              </svg>
                              {item.submissionType.charAt(0).toUpperCase() + item.submissionType.slice(1)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {getStatusBadge(item)}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditHomework(item)}
                          className="p-1.5 text-neutral-500 hover:text-brand-600 dark:hover:text-brand-400"
                          aria-label="Edit homework"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteHomework(item.id)}
                          className="p-1.5 text-neutral-500 hover:text-red-600 dark:hover:text-red-400"
                          aria-label="Delete homework"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}