import { describe, it, expect } from 'vitest';
import { focusOrder, isHoldingBucket } from './buckets';
import type { Bucket } from '../types';

const bucket = (id: number, kind: Bucket['kind']): Bucket => ({ id, name: `b${id}`, color: '#fff', sort_order: 0, kind, x: 0, y: 0, w: 1, h: 1 });

describe('focusOrder', () => {
  it('puts Mission and Deadlines first, then everything else by id', () => {
    const all = [bucket(9, 'custom'), bucket(3, 'deadlines'), bucket(2, 'unsorted'), bucket(12, 'custom'), bucket(1, 'mission')];
    expect(focusOrder(all).map(b => b.id)).toEqual([1, 3, 2, 9, 12]);
  });

  it('follows the order the user set; panels not placed yet come after, in the default order', () => {
    const all = [
      { ...bucket(1, 'mission'), tab_order: 2 },
      { ...bucket(9, 'custom'), tab_order: 0 },
      { ...bucket(2, 'unsorted'), tab_order: 1 },
      bucket(3, 'deadlines'),
      bucket(12, 'custom'),
    ];
    expect(focusOrder(all).map(b => b.id)).toEqual([9, 2, 1, 3, 12]);
  });

  it('does not change the list it is given', () => {
    const all = [bucket(9, 'custom'), bucket(1, 'mission')];
    focusOrder(all);
    expect(all.map(b => b.id)).toEqual([9, 1]);
  });
});

describe('isHoldingBucket', () => {
  it('is true for custom and Unsorted only', () => {
    expect(isHoldingBucket(bucket(1, 'custom'))).toBe(true);
    expect(isHoldingBucket(bucket(2, 'unsorted'))).toBe(true);
    expect(isHoldingBucket(bucket(3, 'mission'))).toBe(false);
    expect(isHoldingBucket(bucket(4, 'deadlines'))).toBe(false);
  });
});
