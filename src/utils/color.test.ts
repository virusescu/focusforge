import { describe, it, expect } from 'vitest';
import { readableOn } from './color';

describe('readableOn', () => {
  it('uses dark on light backgrounds', () => {
    expect(readableOn('#ffcc33')).toBe('#111111');
    expect(readableOn('#44cc88')).toBe('#111111');
  });

  it('uses white on dark backgrounds', () => {
    expect(readableOn('#3388ff')).toBe('#ffffff');
    expect(readableOn('#222222')).toBe('#ffffff');
  });

  it('falls back to dark for anything that is not #rrggbb', () => {
    expect(readableOn('red')).toBe('#111111');
  });
});
