import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BucketTag } from './BucketTag';
import type { Bucket } from '../types';

const WORK: Bucket = { id: 9, name: 'Work', color: '#3388ff', sort_order: 2, kind: 'custom', x: 0, y: 0, w: 300, h: 420 };

describe('BucketTag', () => {
  it('shows the bucket name in the bucket color with a matching dot', () => {
    render(<BucketTag bucket={WORK} />);
    const tag = screen.getByText('Work').closest('[data-bucket-tag]') as HTMLElement;
    expect(tag.getAttribute('data-bucket-tag')).toBe('9');
    // jsdom normalizes hex colors to rgb()
    expect(tag.style.color).toBe('rgb(51, 136, 255)');
    expect((tag.querySelector('[data-bucket-dot]') as HTMLElement).style.backgroundColor).toBe('rgb(51, 136, 255)');
  });

  it('renders nothing without a bucket', () => {
    const { container } = render(<BucketTag bucket={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });
});
