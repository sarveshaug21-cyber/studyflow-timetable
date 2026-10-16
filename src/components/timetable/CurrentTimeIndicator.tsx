import { useEffect, useState } from 'react';
import { useSettings } from '@/hooks/useSettings';
import { isToday, timeToMinutes } from '@/types';
import { getSessionTop } from '@/utils/date';
import { cn } from '@/utils/cn';

interface CurrentTimeIndicatorProps {
  day: 1 | 2 | 3 | 4 | 5 | 6 | 0;
  timeRange: { start: string; end: string };
  timeIncrement: 30 | 60;
}

export function CurrentTimeIndicator({ day, timeRange, timeIncrement }: CurrentTimeIndicatorProps) {
  const { settings: userSettings } = useSettings();
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    if (!userSettings.showCurrentTimeIndicator || !isToday(day)) return;

    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      setCurrentTime(`${hours}:${minutes}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, [day, userSettings.showCurrentTimeIndicator]);

  if (!currentTime || !isToday(day)) return null;

  const currentMinutes = timeToMinutes(currentTime);
  const startMinutes = timeToMinutes(timeRange.start);
  const endMinutes = timeToMinutes(timeRange.end);

  if (currentMinutes < startMinutes || currentMinutes > endMinutes) return null;

  const top = getSessionTop(currentTime, timeRange, timeIncrement);

  return (
    <div
      className={cn(
        'absolute left-0 right-0 h-0.5 z-20 pointer-events-none',
        'bg-red-500 animate-pulse-soft'
      )}
      style={{ top: `${top}%` } as React.CSSProperties}
      role="status"
      aria-label={`Current time: ${currentTime}`}
    >
      <div
        className="absolute -left-2 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-red-500"
        aria-hidden="true"
      />
      <div
        className="absolute right-0 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[10px] font-mono font-medium text-white bg-red-500 rounded-l"
        style={{ transform: 'translateY(-50%) translateX(100%)' } as React.CSSProperties}
      >
        {currentTime}
      </div>
    </div>
  );
}