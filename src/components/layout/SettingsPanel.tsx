import { useState } from 'react';
import { useTimetable } from '@/hooks/useTimetable';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { Button, Input, Select, SelectOption } from '@/components/ui';
import { Badge, Card, Section, SectionHeader } from '@/components/ui';
import { Modal } from '@/components/ui/Modal';

export function SettingsPanel() {
  const { settings, updateSettings } = useSettings();
  const { theme, setTheme } = useTheme();
  const { setTimeIncrement, setShowWeekends, setTimeRange, clearAllData, loadSampleData } = useTimetable();
  const [isOpen, setIsOpen] = useState(false);
  const [timeRangeStart, setTimeRangeStart] = useState(settings.timeRange.start);
  const [timeRangeEnd, setTimeRangeEnd] = useState(settings.timeRange.end);
  const [showDangerZone, setShowDangerZone] = useState(false);

  const themeOptions: SelectOption[] = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'system', label: 'System' },
  ];

  const incrementOptions: SelectOption[] = [
    { value: '30', label: '30 minutes' },
    { value: '60', label: '60 minutes' },
  ];

  const handleTimeRangeChange = () => {
    setTimeRange({ start: timeRangeStart, end: timeRangeEnd });
    updateSettings({ timeRange: { start: timeRangeStart, end: timeRangeEnd } });
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="gap-1.5"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span className="hidden sm:inline">Settings</span>
      </Button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Settings"
        description="Customize your timetable preferences"
        size="lg"
      >
        <Section padded={false}>
          <SectionHeader title="Appearance" description="Choose how StudyFlow looks." />
          <Card variant="elevated" className="p-6">
            <Select
              label="Theme"
              value={theme}
              onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'system')}
              options={themeOptions}
              placeholder="Select theme"
            />
          </Card>
          <Badge variant="brand" size="sm">
            {theme === 'system' ? 'Following system' : theme.charAt(0).toUpperCase() + theme.slice(1)} mode
          </Badge>
        </Section>

        <Section padded={false}>
          <SectionHeader title="Timetable" description="Adjust how your timetable is displayed." />
          <Card variant="elevated" className="p-6 grid gap-4 sm:grid-cols-2">
            <Select
              label="Time Increment"
              value={String(settings.timeIncrement)}
              onChange={(value) => {
                const inc = Number(value) as 30 | 60;
                setTimeIncrement(inc);
                updateSettings({ timeIncrement: inc });
              }}
              options={incrementOptions}
              placeholder="Select increment"
            />
            <div className="flex items-center">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.showWeekends}
                  onChange={(e) => {
                    setShowWeekends(e.target.checked);
                    updateSettings({ showWeekends: e.target.checked });
                  }}
                  className="h-4 w-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
                />
                <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Show weekends (Sat/Sun)
                </span>
              </label>
            </div>
            <div className="col-span-2 grid gap-4 sm:grid-cols-2">
              <Input
                label="Start Time"
                type="time"
                value={timeRangeStart}
                onChange={(e) => setTimeRangeStart(e.target.value)}
              />
              <Input
                label="End Time"
                type="time"
                value={timeRangeEnd}
                onChange={(e) => setTimeRangeEnd(e.target.value)}
              />
            </div>
          </Card>
        </Section>

        <Section padded={false}>
          <SectionHeader title="Data" description="Import, export, or reset your data." />
          <Card variant="elevated" className="p-6">
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={loadSampleData}>
                Load Sample Data
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowDangerZone(true);
                  setIsOpen(false);
                }}
              >
                Danger Zone
              </Button>
            </div>
          </Card>
        </Section>

        <div className="flex justify-end gap-3 pt-4 border-t border-neutral-200 dark:border-neutral-800">
          <Button variant="secondary" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => {
            handleTimeRangeChange();
            setIsOpen(false);
          }}>
            Save Changes
          </Button>
        </div>
      </Modal>

      {showDangerZone && (
        <Modal
          isOpen={showDangerZone}
          onClose={() => setShowDangerZone(false)}
          title="Danger Zone"
          description="These actions are irreversible"
          size="md"
        >
          <div className="space-y-4">
            <div className="p-4 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950">
              <Badge variant="error" size="sm">Danger Zone</Badge>
              <h4 className="font-medium text-amber-900 dark:text-amber-100 mt-1">Clear All Data</h4>
              <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
                This will permanently delete all subjects, sessions, and settings. This cannot be undone.
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowDangerZone(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={() => {
                clearAllData();
                setShowDangerZone(false);
              }}>
                Clear All Data
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
