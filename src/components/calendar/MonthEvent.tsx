import { getContrastColor } from '@/utils/colors';
import type { Session, Subject } from '@/types';
import { cn } from '@/utils/cn';

interface MonthEventProps {
  session: Session;
  subject: Subject;
  isAllDay?: boolean;
  onClick?: (e: React.MouseEvent) => void;
}

export function MonthEvent({ session, subject, isAllDay = false, onClick }: MonthEventProps) {
  const textColor = getContrastColor(subject.color);
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-1.5 px-1.5 py-0.5 rounded border text-[10px] font-medium leading-none',
        isAllDay ? 'border-transparent bg-neutral-200 dark:bg-neutral-700' : undefined,
      )}
      style={{
        backgroundColor: isAllDay ? undefined : subject.color,
        color: textColor,
        borderColor: isAllDay ? subject.color : 'transparent',
      }}
      title={`${subject.code}: ${subject.name}${session.location ? ` • ${session.location}` : ''}`}
      aria-label={`${subject.code}: ${subject.name}${session.startTime && !isAllDay ? `, ${session.startTime}` : ''}${session.location ? `, ${session.location}` : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (!onClick) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(e as unknown as React.MouseEvent);
        }
      }}
    >
      <span className="truncate min-w-0">{subject.code}</span>
      {!isAllDay && session.endTime && (
        <span className="text-[9px] opacity-80">{session.startTime}</span>
      )}
    </div>
  );
}
