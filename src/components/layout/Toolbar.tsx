import { ViewSwitcher } from './ViewSwitcher';
import { ExportMenu } from './ExportMenu';
import { SettingsPanel } from './SettingsPanel';
import { Button } from '@/components/ui';
import { Plus } from 'lucide-react';

interface ToolbarProps {
  onAddSession: () => void;
}

export function Toolbar({ onAddSession }: ToolbarProps) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
      <div className="flex items-center gap-3 flex-1">
        <ViewSwitcher />
        <ExportMenu />
        <SettingsPanel />
      </div>
      <div className="flex items-center gap-2">
        <Button onClick={onAddSession} className="gap-1.5">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Add Session</span>
        </Button>
      </div>
    </div>
  );
}