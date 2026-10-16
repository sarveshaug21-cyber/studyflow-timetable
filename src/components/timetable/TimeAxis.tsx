import { useTimetableLayout } from '@/context/TimetableLayoutContext';
import { cn } from '@/utils/cn';

export function TimeAxis() {
  const { config, getHourLabel } = useTimetableLayout();
  const totalHeight = config.pixelsPerHour * 24;

  return (
    <div
      className={cn(
        'flex flex-col',
        'border-r border-neutral-200 dark:border-neutral-800',
        'bg-neutral-50 dark:bg-neutral-900'
      )}
      style={{
        width: config.timeAxisWidth,
        height: totalHeight + config.headerHeight,
        flexShrink: 0,
      } as React.CSSProperties}
      role="rowheader"
      aria-label="Time axis"
    >
      <div className="flex h-10 items-center justify-center px-2 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900">
        <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Time</span>
      </div>
      <div
        className="relative flex flex-col"
        style={{ height: totalHeight } as React.CSSProperties}
        role="rowheader"
        aria-label="Time axis"
      >
        {Array.from({ length: 24 }, (_, hour) => (
          <div
            key={hour}
            className="relative flex items-start justify-end px-1 border-b border-neutral-200 dark:border-neutral-800"
            style={{
              height: config.pixelsPerHour,
              minHeight: config.pixelsPerHour,
            } as React.CSSProperties}
          >
            <span className="text-xs font-mono text-neutral-500 dark:text-neutral-400 pr-1">
              {getHourLabel(hour)}
            </span>
            {hour < 23 && (
              <div className="absolute bottom-0 left-0 right-0 border-b border-dashed border-neutral-200 dark:border-neutral-700" />
            )}
          </div>
        ))}
        <span className="absolute bottom-0 right-1 pr-1 text-xs font-mono text-neutral-500 dark:text-neutral-400">
          {getHourLabel(24)}
        </span>
      </div>
    </div>
  );
}