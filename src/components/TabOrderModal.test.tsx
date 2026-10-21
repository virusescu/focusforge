import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TabOrderModal } from './TabOrderModal';
import type { Bucket } from '../types';

const bucket = (id: number, name: string, kind: Bucket['kind'], tab_order: number | null = null): Bucket =>
  ({ id, name, color: '#fff', sort_order: id, kind, x: 0, y: 0, w: 1, h: 1, tab_order });

let mockBuckets: Bucket[] = [];
const mockReorderBucketTabs = vi.fn();

vi.mock('../contexts/FocusContext', () => ({
  useFocus: () => ({ buckets: mockBuckets, reorderBucketTabs: mockReorderBucketTabs }),
}));
vi.mock('../utils/audio', () => ({ soundEngine: { playReorder: vi.fn(), playClick: vi.fn() } }));

const names = () => Array.from(document.querySelectorAll('[data-bucket-row]')).map(r => r.textContent?.replace(/^\d+/, ''));

describe('TabOrderModal', () => {
  it('lists the panels in the default Tab order: virtual ones first, then by id', () => {
    mockBuckets = [bucket(9, 'Work', 'custom'), bucket(3, 'Deadlines', 'deadlines'), bucket(2, 'Unsorted', 'unsorted'), bucket(1, 'Mission', 'mission')];
    render(<TabOrderModal onClose={vi.fn()} />);
    expect(names()).toEqual(['MISSION_OBJECTIVES', 'DEADLINES', 'Unsorted', 'Work']);
  });

  it('lists the panels in the order the user set', () => {
    mockBuckets = [bucket(1, 'Mission', 'mission', 2), bucket(2, 'Unsorted', 'unsorted', 1), bucket(9, 'Work', 'custom', 0)];
    render(<TabOrderModal onClose={vi.fn()} />);
    expect(names()).toEqual(['Work', 'Unsorted', 'MISSION_OBJECTIVES']);
  });

  it('numbers the rows and closes with the CLOSE button', () => {
    mockBuckets = [bucket(1, 'Mission', 'mission'), bucket(2, 'Unsorted', 'unsorted')];
    const onClose = vi.fn();
    render(<TabOrderModal onClose={onClose} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    screen.getByRole('button', { name: 'CLOSE' }).click();
    expect(onClose).toHaveBeenCalled();
  });
});
