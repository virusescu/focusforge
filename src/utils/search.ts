import type { StrategicObjective } from '../types';
import { sortByDeadline } from './deadline';

export type SearchSortKey = 'title' | 'deadline';
export type SortDirection = 'asc' | 'desc';

// Filter value for "tasks without a category" (real category ids are positive)
export const NO_CATEGORY = -1;

export interface SearchFilters {
  query: string;
  inDetails: boolean;            // also match the task's details, not just its title
  categoryId: number | null;     // null = any; NO_CATEGORY = none set
  bucketId: number | null;       // null = any
  deadlineOnly: boolean;
  sortKey: SearchSortKey;
  direction: SortDirection;      // of sortKey
}

const compareTitles = (a: StrategicObjective, b: StrategicObjective): number =>
  a.text.localeCompare(b.text, undefined, { sensitivity: 'base', numeric: true }) || a.id - b.id;

// Open tasks matching every filter, in the chosen order. Every word of the query must appear (any case,
// any order) in the title, or in the title or details when `inDetails` is on.
export function searchObjectives(pool: StrategicObjective[], f: SearchFilters): StrategicObjective[] {
  const terms = f.query.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = pool.filter(o => {
    if (f.bucketId !== null && o.bucket_id !== f.bucketId) return false;
    if (f.categoryId === NO_CATEGORY ? o.category_id != null : f.categoryId !== null && o.category_id !== f.categoryId) return false;
    if (f.deadlineOnly && !o.deadline_at) return false;
    if (terms.length === 0) return true;
    const haystack = (f.inDetails ? `${o.text}\n${o.details ?? ''}` : o.text).toLowerCase();
    return terms.every(term => haystack.includes(term));
  });
  const byTitle = [...matches].sort(compareTitles);
  if (f.sortKey === 'title') return f.direction === 'asc' ? byTitle : byTitle.reverse();
  // Same deadline: by title. Tasks without a deadline go last in both directions.
  return sortByDeadline(byTitle, f.direction);
}
