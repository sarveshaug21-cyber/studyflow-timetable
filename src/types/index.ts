export type DayOfWeek = 1 | 2 | 3 | 4 | 5 | 6 | 0;

export type TimeIncrement = 30 | 60;

export type SessionType = 'lecture' | 'lab' | 'tutorial' | 'seminar' | 'study';

export type ViewMode = 'weekly' | 'agenda' | 'day' | 'month';

export type HomeworkPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Subject {
  id: string;
  name: string;
  code: string;
  color: string;
  instructor?: string;
  room?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  id: string;
  subjectId: string;
  day: DayOfWeek;
  /** ISO date (yyyy-MM-dd) for one-off sessions; undefined for weekly-recurring ones. */
  date?: string;
  /** All-day event (startTime/endTime are not significant). */
  allDay?: boolean;
  startTime: string;
  endTime: string;
  type: SessionType;
  location?: string;
  notes?: string;
  recurring: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TimeRange {
  start: string;
  end: string;
}

export interface HomeworkItem {
  id: string;
  title: string;
  subject: string;
  teacher: string;
  group: string;
  type: string;
  dueDate: Date;
  status: 'pending' | 'submitted' | 'overdue' | 'completed';
  submissionType: 'online' | 'paper' | 'upload' | null;
  viewUrl?: string;
  hide: boolean;
  source: 'manual' | 'file';
  completedAt?: string | null;
  /**
   * Optional free-text description / notes for the homework. Not shown in the
   * compact list view but available on the record and editable through the
   * existing workflows.
   */
  description?: string;
  /**
   * User-adjustable priority used by the scheduling engine. Optional so older
   * records stay type-correct; treat `undefined` as 'medium' via
   * `DEFAULT_HOMEWORK_PRIORITY` / `normalizeHomeworkPlanningFields`.
   */
  priority?: HomeworkPriority;
  /**
   * User-overridable study estimate in minutes. Optional for the same reason;
   * when absent the engine estimates from type/status. Values are clamped to
   * `[MIN_ESTIMATED_MINUTES, MAX_ESTIMATED_MINUTES]` by the editor and by
   * `normalizeHomeworkPlanningFields`.
   */
  estimatedMinutes?: number;
}

export type FocusSessionStatus = 'completed' | 'cancelled' | 'interrupted';

export interface FocusSession {
  id: string;
  startedAt: string;
  endedAt: string;
  plannedDurationSec: number;
  actualDurationSec: number;
  status: FocusSessionStatus;
  homeworkId: string | null;
  homeworkTitle: string | null;
  subjectName: string | null;
  note?: string;
}

export interface ActiveFocusTimer {
  id: string;
  startedAt: string;
  endAt: string | null;
  pausedRemainingSec: number | null;
  plannedDurationSec: number;
  homeworkId: string | null;
  homeworkTitle: string | null;
  subjectName: string | null;
}

export interface FocusState {
  active: ActiveFocusTimer | null;
  history: FocusSession[];
}

export interface TimetableState {
  subjects: Subject[];
  sessions: Session[];
  homework: HomeworkItem[];
  currentWeekStart: string;
  view: ViewMode;
  timeIncrement: TimeIncrement;
  showWeekends: boolean;
  timeRange: TimeRange;
}

export interface SettingsState {
  theme: 'light' | 'dark' | 'system';
  timeIncrement: TimeIncrement;
  showWeekends: boolean;
  timeRange: TimeRange;
  autoSave: boolean;
  showCurrentTimeIndicator: boolean;
  compactMode: boolean;
  focusDuration: number;
  focusAutoStartBreaks: boolean;
  focusSoundEnabled: boolean;
}

export interface TimetableLayoutConfig {
  timeRange: TimeRange;
  timeIncrement: TimeIncrement;
  pixelsPerHour: number;
  headerHeight: number;
  timeAxisWidth: number;
}

export const DAYS_OF_WEEK: { value: DayOfWeek; label: string; shortLabel: string }[] = [
  { value: 1, label: 'Monday', shortLabel: 'Mon' },
  { value: 2, label: 'Tuesday', shortLabel: 'Tue' },
  { value: 3, label: 'Wednesday', shortLabel: 'Wed' },
  { value: 4, label: 'Thursday', shortLabel: 'Thu' },
  { value: 5, label: 'Friday', shortLabel: 'Fri' },
  { value: 6, label: 'Saturday', shortLabel: 'Sat' },
  { value: 0, label: 'Sunday', shortLabel: 'Sun' },
];

export const WEEKDAYS: DayOfWeek[] = [1, 2, 3, 4, 5];
export const ALL_DAYS: DayOfWeek[] = [1, 2, 3, 4, 5, 6, 0];

export const SESSION_TYPES: { value: SessionType; label: string; shortLabel: string }[] = [
  { value: 'lecture', label: 'Lecture', shortLabel: 'LEC' },
  { value: 'lab', label: 'Lab', shortLabel: 'LAB' },
  { value: 'tutorial', label: 'Tutorial', shortLabel: 'TUT' },
  { value: 'seminar', label: 'Seminar', shortLabel: 'SEM' },
  { value: 'study', label: 'Study', shortLabel: 'STU' },
];

export const HOMEWORK_PRIORITIES: { value: HomeworkPriority; label: string; description: string }[] = [
  { value: 'low', label: 'Low', description: 'Can slip if the week gets busy' },
  { value: 'medium', label: 'Normal', description: 'Default; plan around harder work' },
  { value: 'high', label: 'High', description: 'Plan before lower-priority work' },
  { value: 'urgent', label: 'Urgent', description: 'Scheduled first, ahead of everything' },
];

/** Applied wherever a stored/edited record is missing a priority. */
export const DEFAULT_HOMEWORK_PRIORITY: HomeworkPriority = 'medium';

/** Bounds for the user-entered study estimate, in minutes. */
export const MIN_ESTIMATED_MINUTES = 5;
export const MAX_ESTIMATED_MINUTES = 24 * 60;

/** Rank weight; higher = scheduled sooner. Order matters more than the numbers. */
export const PRIORITY_WEIGHT: Record<HomeworkPriority, number> = {
  low: 1,
  medium: 2,
  high: 3,
  urgent: 4,
};

const HOMEWORK_PRIORITY_VALUES = new Set<string>([
  'low',
  'medium',
  'high',
  'urgent',
]);

/**
 * Coerce any stored/edited value to a valid priority, falling back to
 * 'medium' for `undefined`, `null`, or anything unknown. This is what makes
 * legacy records (which predate the `priority` field) behave identically to
 * records the user has explicitly set to 'Normal'.
 */
export function normalizeHomeworkPriority(value: unknown): HomeworkPriority {
  return typeof value === 'string' && HOMEWORK_PRIORITY_VALUES.has(value)
    ? (value as HomeworkPriority)
    : DEFAULT_HOMEWORK_PRIORITY;
}

/**
 * Coerce any stored/edited value to a valid study estimate, or `undefined`
 * when there is no usable value. Non-finite numbers, negatives, and values
 * outside `[min, max]` all collapse to `undefined` so the scheduler falls back
 * to its transparent type/status heuristic rather than trusting bad data.
 */
export function normalizeEstimatedMinutes(
  value: unknown,
  min = MIN_ESTIMATED_MINUTES,
  max = MAX_ESTIMATED_MINUTES,
): number | undefined {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n)) return undefined;
  const rounded = Math.round(n);
  if (rounded < min || rounded > max) return undefined;
  return rounded;
}

/**
 * Fill in the planning fields on a homework item. Used when loading legacy
 * records and when the editor submits, so every code path that creates or
 * loads homework ends up with the same normalized shape.
 */
export function normalizeHomeworkPlanningFields<T extends HomeworkItem>(item: T): T {
  return {
    ...item,
    priority: normalizeHomeworkPriority(item.priority),
    estimatedMinutes: normalizeEstimatedMinutes(item.estimatedMinutes),
  };
}

export const SUBJECT_COLORS = [
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#ec4899',
  '#f43f5e', '#ef4444', '#f97316', '#f59e0b', '#eab308',
  '#84cc16', '#22c55e', '#10b981', '#14b8a6', '#06b6d4',
  '#0ea5e9', '#f472b6', '#fb923c', '#fde047', '#4ade80',
] as const;

export const DEFAULT_TIME_RANGE: TimeRange = { start: '08:00', end: '18:00' };
export const DEFAULT_SETTINGS: SettingsState = {
  theme: 'system',
  timeIncrement: 30,
  showWeekends: false,
  timeRange: DEFAULT_TIME_RANGE,
  autoSave: true,
  showCurrentTimeIndicator: true,
  compactMode: false,
  focusDuration: 25,
  focusAutoStartBreaks: false,
  focusSoundEnabled: true,
};

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function getDayLabel(day: DayOfWeek, short = false): string {
  const found = DAYS_OF_WEEK.find(d => d.value === day);
  return found ? (short ? found.shortLabel : found.label) : '';
}

export function getSessionTypeLabel(type: SessionType, short = false): string {
  const found = SESSION_TYPES.find(s => s.value === type);
  return found ? (short ? found.shortLabel : found.label) : '';
}

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

export function getTimeSlots(start: string, end: string, increment: TimeIncrement): string[] {
  const slots: string[] = [];
  let current = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);
  while (current < endMinutes) {
    slots.push(minutesToTime(current));
    current += increment;
  }
  return slots;
}

export function getSessionDuration(startTime: string, endTime: string): number {
  return timeToMinutes(endTime) - timeToMinutes(startTime);
}

export function formatTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

export function isToday(day: DayOfWeek): boolean {
  const today = new Date().getDay();
  return day === (today === 0 ? 0 : today);
}

export function getWeekStart(date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getWeekEnd(date = new Date()): Date {
  const start = getWeekStart(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

export function formatWeekRange(start: Date): string {
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}`;
}