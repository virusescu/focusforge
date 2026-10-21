// Deadlines are stored as ISO strings in UTC; everything shown or compared by calendar day uses local time.

export type DeadlineState = 'later' | 'soon' | 'overdue';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DEFAULT_HOUR = 19;

const startOfDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const pad = (n: number): string => String(n).padStart(2, '0');

// Past = overdue; today or tomorrow (calendar days) and not yet passed = soon; anything later = later
export function deadlineState(iso: string, now: Date): DeadlineState {
  const at = new Date(iso);
  if (at.getTime() < now.getTime()) return 'overdue';
  const dayAfterTomorrow = startOfDay(now);
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
  return at.getTime() < dayAfterTomorrow.getTime() ? 'soon' : 'later';
}

// "24 Dec 14:30"; the year is added when it is not the current one
export function formatDeadline(iso: string, now: Date): string {
  const at = new Date(iso);
  const year = at.getFullYear() === now.getFullYear() ? '' : ` ${at.getFullYear()}`;
  return `${at.getDate()} ${MONTHS[at.getMonth()]}${year} ${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

// The next working day (Monday to Friday) after today, at 19:00 local time
export function defaultDeadline(now: Date): string {
  const next = startOfDay(now);
  do {
    next.setDate(next.getDate() + 1);
  } while (next.getDay() === 0 || next.getDay() === 6);
  next.setHours(DEFAULT_HOUR, 0, 0, 0);
  return next.toISOString();
}

// The value format of <input type="datetime-local">: local time, "YYYY-MM-DDTHH:mm"
export function toInputValue(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Back to an ISO string, or null when the field is empty or not a date
export function fromInputValue(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// Soonest first, or latest first; tasks without a deadline go last
export function sortByDeadline<T extends { deadline_at?: string | null }>(items: T[], direction: 'asc' | 'desc'): T[] {
  const sign = direction === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => {
    if (!a.deadline_at || !b.deadline_at) return a.deadline_at ? -1 : b.deadline_at ? 1 : 0;
    return sign * (new Date(a.deadline_at).getTime() - new Date(b.deadline_at).getTime());
  });
}
