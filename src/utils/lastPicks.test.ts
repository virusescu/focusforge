import { describe, it, expect, beforeEach } from 'vitest';
import { loadLastPicks, saveLastPicks, firstValidBucketId, firstValidCategoryId } from './lastPicks';
import type { Bucket, ObjectiveCategory } from '../types';

const bucket = (id: number, kind: Bucket['kind']): Bucket => ({ id, name: `b${id}`, color: '#fff', sort_order: id, kind, x: 0, y: 0, w: 1, h: 1 });
const BUCKETS = [bucket(1, 'mission'), bucket(2, 'unsorted'), bucket(9, 'custom')];
const cat = (id: number): ObjectiveCategory => ({ id, label: `c${id}`, color: '#fff', sort_order: id, coin_bounty: 25 });
const CATEGORIES = [cat(4), cat(5)];

describe('lastPicks storage', () => {
  beforeEach(() => localStorage.clear());

  it('returns nothing remembered on a fresh machine', () => {
    expect(loadLastPicks()).toEqual({ bucketId: null, categoryId: null });
  });

  it('round-trips a bucket and a category', () => {
    saveLastPicks({ bucketId: 9, categoryId: 5 });
    expect(loadLastPicks()).toEqual({ bucketId: 9, categoryId: 5 });
  });

  it('remembers "no category" as nothing', () => {
    saveLastPicks({ bucketId: 9, categoryId: 5 });
    saveLastPicks({ bucketId: 9, categoryId: null });
    expect(loadLastPicks()).toEqual({ bucketId: 9, categoryId: null });
  });

  it('ignores garbage in storage', () => {
    localStorage.setItem('last_bucket_id', 'abc');
    localStorage.setItem('last_category_id', '');
    expect(loadLastPicks()).toEqual({ bucketId: null, categoryId: null });
  });
});

describe('firstValidBucketId', () => {
  it('uses the first candidate that is a real, task-holding bucket', () => {
    expect(firstValidBucketId([null, 9, 2], BUCKETS)).toBe(9);
  });

  it('skips the Mission pseudo-bucket and buckets that no longer exist', () => {
    expect(firstValidBucketId([1, 77, 9], BUCKETS)).toBe(9);
  });

  it('falls back to Unsorted when nothing is valid', () => {
    expect(firstValidBucketId([77, undefined, null], BUCKETS)).toBe(2);
  });

  it('returns null when there are no buckets at all (not loaded yet)', () => {
    expect(firstValidBucketId([9], [])).toBeNull();
  });
});

describe('firstValidCategoryId', () => {
  it('uses the first candidate that still exists', () => {
    expect(firstValidCategoryId([99, 5, 4], CATEGORIES)).toBe(5);
  });

  it('falls back to no category', () => {
    expect(firstValidCategoryId([99, null, undefined], CATEGORIES)).toBeNull();
  });
});
