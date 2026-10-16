import { useState, useRef, useEffect } from 'react';
import { Download, FileJson, FileText, Calendar, Image, X } from 'lucide-react';
import { useTimetable } from '@/hooks/useTimetable';
import { exportToJSON, exportToCSV, exportToICS, exportToPNG, downloadFile, downloadBlob } from '@/utils/export';
import { Button, DropdownItem } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/utils/cn';

export function ExportMenu() {
  const { state } = useTimetable();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleExport = async (format: 'json' | 'csv' | 'ics' | 'png') => {
    setIsOpen(false);
    try {
      switch (format) {
        case 'json': {
          const content = exportToJSON(state);
          downloadFile(content, `timetable-${Date.now()}.json`, 'application/json');
          toast({ type: 'success', title: 'Exported', message: 'Timetable exported as JSON' });
          break;
        }
        case 'csv': {
          const content = exportToCSV(state);
          downloadFile(content, `timetable-${Date.now()}.csv`, 'text/csv');
          toast({ type: 'success', title: 'Exported', message: 'Timetable exported as CSV' });
          break;
        }
        case 'ics': {
          const content = await exportToICS(state);
          downloadFile(content, `timetable-${Date.now()}.ics`, 'text/calendar');
          toast({ type: 'success', title: 'Exported', message: 'Timetable exported as ICS calendar' });
          break;
        }
        case 'png': {
          const gridElement = document.querySelector('[data-timetable-grid]') as HTMLElement;
          if (gridElement) {
            const blob = await exportToPNG(gridElement);
            downloadBlob(blob, `timetable-${Date.now()}.png`);
            toast({ type: 'success', title: 'Exported', message: 'Timetable exported as PNG image' });
          } else {
            toast({ type: 'error', title: 'Export failed', message: 'Could not find timetable grid' });
          }
          break;
        }
      }
    } catch (error) {
      toast({ type: 'error', title: 'Export failed', message: error instanceof Error ? error.message : 'Unknown error' });
    }
  };

  const items: DropdownItem[] = [
    { label: 'JSON', value: 'json', icon: <FileJson className="h-4 w-4" />, shortcut: 'Ctrl+J' },
    { label: 'CSV', value: 'csv', icon: <FileText className="h-4 w-4" />, shortcut: 'Ctrl+Shift+C' },
    { label: 'ICS Calendar', value: 'ics', icon: <Calendar className="h-4 w-4" /> },
    { label: 'PNG Image', value: 'png', icon: <Image className="h-4 w-4" /> },
  ];

  return (
    <div ref={dropdownRef} className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="gap-1.5"
      >
        <Download className="h-4 w-4" />
        <span className="hidden sm:inline">Export</span>
        <X className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')} />
      </Button>
      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 min-w-[180px] rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-elevated overflow-hidden animate-slide-in">
          {items.map(item => (
            <button
              key={item.value}
              onClick={() => handleExport(item.value as 'json' | 'csv' | 'ics' | 'png')}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              role="menuitem"
              tabIndex={-1}
            >
              {item.icon && <span className="flex h-4 w-4">{item.icon}</span>}
              <span className="flex-1 text-left">{item.label}</span>
              {item.shortcut && (
                <kbd className="px-1.5 py-0.5 text-xs text-neutral-400 dark:text-neutral-500 bg-neutral-100 dark:bg-neutral-800 rounded">
                  {item.shortcut}
                </kbd>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}