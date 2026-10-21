import type { Bucket, ObjectiveCategory } from '../types';
import { isHoldingBucket } from './buckets';

// The bucket and category last used to create a task. Local to this machine on purpose: not worth syncing.
const BUCKET_KEY = 'last_bucket_id';
const CATEGORY_KEY = 'last_category_id';

export interface LastPicks {
  bucketId: number | null;
  categoryId: number | null;
}

function readId(key: string): number | null {
  const raw = localStorage.getItem(key);
  if (raw === null || raw.trim() === '') return null;
  const value = Number(raw);
  return Number.isInteger(value) ? value : null;
}

function writeId(key: string, value: number | null): void {
  if (value === null) localStorage.removeItem(key);
  else localStorage.setItem(key, String(value));
}

export function loadLastPicks(): LastPicks {
  return { bucketId: readId(BUCKET_KEY), categoryId: readId(CATEGORY_KEY) };
}

export function saveLastPicks(picks: LastPicks): void {
  writeId(BUCKET_KEY, picks.bucketId);
  writeId(CATEGORY_KEY, picks.categoryId);
}

type Candidate = number | null | undefined;

// First candidate that is still a bucket tasks can live in (not the Mission or Deadlines panels), else Unsorted.
// null only while no buckets are loaded.
export function firstValidBucketId(candidates: Candidate[], buckets: Bucket[]): number | null {
  for (const id of candidates) {
    if (id != null && buckets.some(b => b.id === id && isHoldingBucket(b))) return id;
  }
  return buckets.find(b => b.kind === 'unsorted')?.id ?? null;
}

// First candidate that still exists, else no category
export function firstValidCategoryId(candidates: Candidate[], categories: ObjectiveCategory[]): number | null {
  for (const id of candidates) {
    if (id != null && categories.some(c => c.id === id)) return id;
  }
  return null;
}
