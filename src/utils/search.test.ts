import { describe, it, expect } from 'vitest';
import { searchObjectives, NO_CATEGORY, type SearchFilters } from './search';
import type { StrategicObjective } from '../types';

const task = (id: number, text: string, extra: Partial<StrategicObjective> = {}): StrategicObjective =>
  ({ id, text, created_at: '', is_mission: 0, bucket_id: 2, category_id: null, details: null, deadline_at: null, ...extra });

const POOL = [
  task(1, 'Write report', { bucket_id: 2, category_id: 4, details: 'Quarterly numbers for finance', deadline_at: '2026-12-01T10:00:00.000Z' }),
  task(2, 'fix login bug', { bucket_id: 9, category_id: null, details: 'Happens on Safari only' }),
  task(3, 'Ship release 10', { bucket_id: 9, category_id: 5, deadline_at: '2026-11-01T10:00:00.000Z' }),
  task(4, 'Ship release 2', { bucket_id: 2, category_id: 4 }),
];

const base: SearchFilters = { query: '', inDetails: false, categoryId: null, bucketId: null, deadlineOnly: false, sortKey: 'title', direction: 'asc' };
const ids = (f: Partial<SearchFilters>) => searchObjectives(POOL, { ...base, ...f }).map(o => o.id);

describe('searchObjectives', () => {
  it('returns everything, by title, when nothing is filtered', () => {
    expect(ids({})).toEqual([2, 4, 3, 1]); // "fix", "Ship release 2" before "Ship release 10" (numeric), "Write"
  });

  it('matches the title in any case', () => {
    expect(ids({ query: 'SHIP' })).toEqual([4, 3]);
  });

  it('needs every word, in any order', () => {
    expect(ids({ query: 'release ship' })).toEqual([4, 3]);
    expect(ids({ query: 'ship report' })).toEqual([]);
  });

  it('ignores the details unless asked to look in them', () => {
    expect(ids({ query: 'safari' })).toEqual([]);
    expect(ids({ query: 'safari', inDetails: true })).toEqual([2]);
    expect(ids({ query: 'finance report', inDetails: true })).toEqual([1]);
  });

  it('filters by bucket and by category, and they combine', () => {
    expect(ids({ bucketId: 9 })).toEqual([2, 3]);
    expect(ids({ categoryId: 4 })).toEqual([4, 1]);
    expect(ids({ bucketId: 2, categoryId: 4 })).toEqual([4, 1]);
    expect(ids({ bucketId: 9, categoryId: 4 })).toEqual([]);
  });

  it('can pick the tasks with no category', () => {
    expect(ids({ categoryId: NO_CATEGORY })).toEqual([2]);
  });

  it('can show only tasks with a deadline', () => {
    expect(ids({ deadlineOnly: true })).toEqual([3, 1]);
  });

  it('sorts by title in both directions', () => {
    expect(ids({ direction: 'desc' })).toEqual([1, 3, 4, 2]);
  });

  it('sorts by deadline, soonest or latest first, and tasks without one go last', () => {
    expect(ids({ sortKey: 'deadline', direction: 'asc' })).toEqual([3, 1, 2, 4]);
    expect(ids({ sortKey: 'deadline', direction: 'desc' })).toEqual([1, 3, 2, 4]);
  });

  it('does not change the pool it is given', () => {
    const before = POOL.map(o => o.id);
    searchObjectives(POOL, { ...base, direction: 'desc' });
    expect(POOL.map(o => o.id)).toEqual(before);
  });
});
