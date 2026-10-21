import type { Bucket } from '../types';

// Tasks live in custom buckets and Unsorted. Mission and Deadlines are views over tasks, never a task's bucket.
// The order Tab walks the panels in: the virtual ones (Mission, Deadlines) first, then the rest, each group by id
export function focusOrder(buckets: Bucket[]): Bucket[] {
  const rank = (b: Bucket) => (b.kind === 'mission' || b.kind === 'deadlines' ? 0 : 1);
  return [...buckets].sort((a, b) => rank(a) - rank(b) || a.id - b.id);
}

export const isHoldingBucket = (bucket: Bucket): boolean => bucket.kind === 'custom' || bucket.kind === 'unsorted';
