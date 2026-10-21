import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { BucketPanel } from './BucketPanel';
import type { Bucket, StrategicObjective } from '../types';

const mockOpenDetails = vi.fn();
const mockSetObjectiveMission = vi.fn();

const DEADLINES: Bucket = { id: 3, name: 'Deadlines', color: '#ff5555', sort_order: 2, kind: 'deadlines', x: 700, y: 0, w: 300, h: 420 };
const WORK: Bucket = { id: 9, name: 'Work', color: '#3388ff', sort_order: 3, kind: 'custom', x: 0, y: 0, w: 300, h: 420 };

const at = (y: number, m: number, d: number, h = 0) => new Date(y, m - 1, d, h).toISOString();
const task = (id: number, text: string, deadline: string, extra: Partial<StrategicObjective> = {}): StrategicObjective => ({
  id, text, created_at: '2026-10-13T00:00:00Z', is_mission: 0, bucket_id: 9, bucket_sort_order: id, sort_order: id, category_id: null, deadline_at: deadline, ...extra,
});
const LATE = task(1, 'Late one', at(2027, 3, 1, 9));
const SOON = task(2, 'Soon one', at(2026, 12, 24, 9));
const MID = task(3, 'Mid one', at(2027, 1, 15, 9));

vi.mock('../contexts/FocusContext', () => ({
  useFocus: () => ({
    categories: [],
    buckets: [DEADLINES, WORK],
    viewedObjectiveId: null,
    addObjective: vi.fn(),
    updateBucket: vi.fn(),
    updateBucketGeometry: vi.fn(),
    bringBucketToFront: vi.fn(),
    deleteBucket: vi.fn(),
    updateObjective: vi.fn(),
    deleteObjective: vi.fn(),
    duplicateObjective: vi.fn(),
    updateObjectiveCategory: vi.fn(),
    setObjectiveMission: mockSetObjectiveMission,
    templates: [],
  }),
}));

vi.mock('../utils/audio', () => ({
  soundEngine: { playClick: vi.fn(), playHover: vi.fn(), playEditStart: vi.fn() },
}));

const renderPanel = (objectives: StrategicObjective[]) => render(
  <DndContext>
    <BucketPanel bucket={DEADLINES} objectives={objectives} zoom={1} zIndex={1} onOpenDetails={mockOpenDetails} onManageCategories={vi.fn()} />
  </DndContext>,
);

const order = () => screen.getAllByText(/ one$/).map(el => el.textContent);
const card = (id: number) => document.querySelector(`[data-objective-id="${id}"]`) as HTMLElement;

describe('Deadlines panel', () => {
  beforeEach(() => {
    localStorage.clear();
    mockOpenDetails.mockClear();
    mockSetObjectiveMission.mockClear();
  });

  it('is titled DEADLINES and has no add box or delete button', () => {
    renderPanel([SOON]);
    expect(screen.getByText('DEADLINES')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Add Objective...')).toBeNull();
    expect(screen.queryByTitle('Delete bucket')).toBeNull();
  });

  it('cannot be renamed or deleted: its header has no right-click menu', () => {
    renderPanel([SOON]);
    fireEvent.contextMenu(screen.getByText('DEADLINES'));
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('lists the soonest deadline first by default', () => {
    renderPanel([LATE, SOON, MID]);
    expect(order()).toEqual(['Soon one', 'Mid one', 'Late one']);
  });

  it('the header toggle flips the order and remembers it', () => {
    const { unmount } = renderPanel([LATE, SOON, MID]);
    fireEvent.click(screen.getByLabelText('Sort: soonest first'));
    expect(order()).toEqual(['Late one', 'Mid one', 'Soon one']);
    unmount();
    renderPanel([LATE, SOON, MID]);
    expect(order()).toEqual(['Late one', 'Mid one', 'Soon one']);
    fireEvent.click(screen.getByLabelText('Sort: latest first'));
    expect(order()).toEqual(['Soon one', 'Mid one', 'Late one']);
  });

  it('each card shows its deadline date', () => {
    renderPanel([SOON]);
    expect(screen.getByText(/24 Dec( 2026)? 09:00/)).toBeInTheDocument();
  });

  it('shows NO_DEADLINES when empty', () => {
    renderPanel([]);
    expect(screen.getByText('NO_DEADLINES')).toBeInTheDocument();
  });

  it('clicking a card opens its details', () => {
    renderPanel([SOON]);
    fireEvent.click(card(2));
    expect(mockOpenDetails).toHaveBeenCalledWith(2);
  });

  it('right-click offers Add to Mission', () => {
    renderPanel([SOON]);
    fireEvent.contextMenu(card(2));
    fireEvent.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Add to Mission' }));
    expect(mockSetObjectiveMission).toHaveBeenCalledWith(2, true);
  });

  it('cards are not draggable', () => {
    renderPanel([SOON]);
    expect(card(2)).not.toHaveAttribute('aria-roledescription');
    expect(card(2)).not.toHaveAttribute('tabindex');
  });
});
