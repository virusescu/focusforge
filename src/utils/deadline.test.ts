import { describe, it, expect } from 'vitest';
import { deadlineState, formatDeadline, defaultDeadline, toInputValue, fromInputValue, sortByDeadline } from './deadline';

// Local-time dates, so the tests hold in any time zone
const local = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min);
const NOW = local(2026, 10, 21, 12, 0); // a Wednesday

describe('deadlineState', () => {
  it('is overdue once the time has passed, even by a minute', () => {
    expect(deadlineState(local(2026, 10, 21, 11, 59).toISOString(), NOW)).toBe('overdue');
    expect(deadlineState(local(2020, 1, 1).toISOString(), NOW)).toBe('overdue');
  });

  it('is soon for later today and for tomorrow, up to the end of tomorrow', () => {
    expect(deadlineState(local(2026, 10, 21, 12, 1).toISOString(), NOW)).toBe('soon');
    expect(deadlineState(local(2026, 10, 22, 23, 59).toISOString(), NOW)).toBe('soon');
  });

  it('is later from the day after tomorrow on (calendar days, not 48 hours)', () => {
    expect(deadlineState(local(2026, 10, 23, 0, 0).toISOString(), NOW)).toBe('later');
    expect(deadlineState(local(2026, 12, 24).toISOString(), NOW)).toBe('later');
  });

  it('counts calendar days late in the evening too', () => {
    const lateEvening = local(2026, 10, 21, 23, 30);
    expect(deadlineState(local(2026, 10, 22, 8, 0).toISOString(), lateEvening)).toBe('soon');
    expect(deadlineState(local(2026, 10, 23, 8, 0).toISOString(), lateEvening)).toBe('later');
  });
});

describe('formatDeadline', () => {
  it('shows day, month and 24h time', () => {
    expect(formatDeadline(local(2026, 12, 24, 14, 30).toISOString(), NOW)).toBe('24 Dec 14:30');
    expect(formatDeadline(local(2026, 1, 5, 9, 5).toISOString(), NOW)).toBe('5 Jan 09:05');
  });

  it('adds the year only when it is not the current one', () => {
    expect(formatDeadline(local(2027, 3, 1, 8, 0).toISOString(), NOW)).toBe('1 Mar 2027 08:00');
    expect(formatDeadline(local(2025, 3, 1, 8, 0).toISOString(), NOW)).toBe('1 Mar 2025 08:00');
  });
});

describe('defaultDeadline', () => {
  it('is tomorrow at 19:00 on a Monday to Thursday', () => {
    expect(new Date(defaultDeadline(NOW)).getTime()).toBe(local(2026, 10, 22, 19, 0).getTime());
  });

  it('skips the weekend: Friday, Saturday and Sunday all give Monday', () => {
    const monday = local(2026, 10, 26, 19, 0).getTime();
    for (const day of [23, 24, 25]) {
      expect(new Date(defaultDeadline(local(2026, 10, day, 10, 0))).getTime()).toBe(monday);
    }
  });

  it('is the next day even when it is already past 19:00', () => {
    expect(new Date(defaultDeadline(local(2026, 10, 21, 23, 0))).getTime()).toBe(local(2026, 10, 22, 19, 0).getTime());
  });
});

describe('input value conversion', () => {
  it('round-trips through the datetime-local format', () => {
    const iso = local(2026, 12, 24, 14, 30).toISOString();
    expect(toInputValue(iso)).toBe('2026-12-24T14:30');
    expect(fromInputValue('2026-12-24T14:30')).toBe(iso);
  });

  it('returns null for an empty or invalid field', () => {
    expect(fromInputValue('')).toBeNull();
    expect(fromInputValue('nonsense')).toBeNull();
  });
});

describe('sortByDeadline', () => {
  const a = { id: 1, deadline_at: local(2026, 11, 1).toISOString() };
  const b = { id: 2, deadline_at: local(2026, 10, 1).toISOString() };
  const none = { id: 3, deadline_at: null };

  it('puts the soonest first, or the latest first', () => {
    expect(sortByDeadline([a, b], 'asc').map(x => x.id)).toEqual([2, 1]);
    expect(sortByDeadline([a, b], 'desc').map(x => x.id)).toEqual([1, 2]);
  });

  it('keeps tasks without a deadline last in both directions and does not mutate', () => {
    const input = [none, a, b];
    expect(sortByDeadline(input, 'asc').map(x => x.id)).toEqual([2, 1, 3]);
    expect(sortByDeadline(input, 'desc').map(x => x.id)).toEqual([1, 2, 3]);
    expect(input.map(x => x.id)).toEqual([3, 1, 2]);
  });
});
