import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SidebarLeft } from './SidebarLeft';
import type { Bucket, Template } from '../types';

const mockAddObjective = vi.fn();
let mockTemplates: Template[] = [];

const bucket = (id: number, name: string, kind: Bucket['kind']): Bucket => ({ id, name, color: '#fff', sort_order: id, kind, x: 0, y: 0, w: 1, h: 1 });
const BUCKETS = [bucket(1, 'Mission', 'mission'), bucket(2, 'Unsorted', 'unsorted'), bucket(9, 'Work', 'custom')];
const CATEGORIES = [
  { id: 4, label: 'Hard', color: '#f44', sort_order: 0, coin_bounty: 50 },
  { id: 5, label: 'Easy', color: '#888', sort_order: 1, coin_bounty: 10 },
];

vi.mock('../contexts/FocusContext', () => ({
  useFocus: () => ({
    objectivePool: [],
    missionObjectives: [],
    activeObjectiveId: null,
    viewedObjectiveId: null,
    addObjective: mockAddObjective,
    deleteObjective: vi.fn(),
    duplicateObjective: vi.fn(),
    updateObjective: vi.fn(),
    updateObjectiveCategory: vi.fn(),
    setActiveObjective: vi.fn(),
    setViewedObjective: vi.fn(),
    reorderObjectives: vi.fn(),
    setObjectiveMission: vi.fn(),
    categories: CATEGORIES,
    addCategory: vi.fn(),
    updateCategory: vi.fn(),
    deleteCategory: vi.fn(),
    reorderCategories: vi.fn(),
    addTemplate: vi.fn(),
    buckets: BUCKETS,
    templates: mockTemplates,
  }),
}));
vi.mock('../utils/audio', () => ({
  soundEngine: { playClick: vi.fn(), playHover: vi.fn(), playEditStart: vi.fn(), playReorder: vi.fn(), playNavSelect: vi.fn() },
  playStartSound: vi.fn(),
}));
vi.mock('./AlarmsModal', () => ({ AlarmsModal: () => null }));

const renderSidebar = () => render(<SidebarLeft onOpenDetails={vi.fn()} onViewBuckets={vi.fn()} />);
const input = () => screen.getByPlaceholderText('Add Objective...');
const bucketSelect = () => screen.getByLabelText('Bucket for new objective') as HTMLSelectElement;
const add = (text: string, init: KeyboardEventInit = { key: 'Enter' }) => {
  fireEvent.change(input(), { target: { value: text } });
  fireEvent.keyDown(input(), init);
  if (!init.shiftKey) fireEvent.submit(input().closest('form') as HTMLFormElement);
};

describe('SidebarLeft add box', () => {
  beforeEach(() => {
    localStorage.clear();
    mockAddObjective.mockReset().mockResolvedValue(undefined);
    mockTemplates = [];
  });

  it('offers the buckets that can hold tasks, starting on Unsorted', () => {
    renderSidebar();
    expect(Array.from(bucketSelect().options).map(o => o.text)).toEqual(['Unsorted', 'Work']);
    expect(bucketSelect()).toHaveValue('2');
  });

  it('adds into the chosen bucket and defaults to the first category', async () => {
    renderSidebar();
    fireEvent.change(bucketSelect(), { target: { value: '9' } });
    add('Write report');
    await waitFor(() => expect(mockAddObjective).toHaveBeenCalledWith('Write report', 4, false, { bucketId: 9 }));
  });

  it('Shift+Enter still adds to the top, in the chosen bucket', async () => {
    renderSidebar();
    fireEvent.change(bucketSelect(), { target: { value: '9' } });
    add('Urgent', { key: 'Enter', shiftKey: true });
    await waitFor(() => expect(mockAddObjective).toHaveBeenCalledWith('Urgent', 4, true, { bucketId: 9 }));
  });

  it('keeps the bucket after an add and remembers it for next time', async () => {
    renderSidebar();
    fireEvent.change(bucketSelect(), { target: { value: '9' } });
    add('One');
    await waitFor(() => expect(mockAddObjective).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(localStorage.getItem('last_bucket_id')).toBe('9'));
    expect(bucketSelect()).toHaveValue('9');
    expect(input()).toHaveValue('');
    add('Two');
    await waitFor(() => expect(mockAddObjective).toHaveBeenLastCalledWith('Two', 4, false, { bucketId: 9 }));
  });

  it('starts from the bucket and category remembered on this machine', async () => {
    localStorage.setItem('last_bucket_id', '9');
    localStorage.setItem('last_category_id', '5');
    renderSidebar();
    expect(bucketSelect()).toHaveValue('9');
    add('Remembered');
    await waitFor(() => expect(mockAddObjective).toHaveBeenCalledWith('Remembered', 5, false, { bucketId: 9 }));
  });

  it('falls back to Unsorted and the first category when the remembered ones are gone', async () => {
    localStorage.setItem('last_bucket_id', '77');
    localStorage.setItem('last_category_id', '99');
    renderSidebar();
    expect(bucketSelect()).toHaveValue('2');
    add('Fallback');
    await waitFor(() => expect(mockAddObjective).toHaveBeenCalledWith('Fallback', 4, false, { bucketId: 2 }));
  });

  it('shows no template row without templates, and one button per template with them', () => {
    const { unmount } = renderSidebar();
    expect(screen.queryByRole('button', { name: 'Bug' })).toBeNull();
    unmount();
    mockTemplates = [{ id: 1, name: 'Bug', title: '$t', details: '', color: '#f44', category_id: null, sort_order: 0 }];
    renderSidebar();
    expect(screen.getByRole('button', { name: 'Bug' })).toBeInTheDocument();
  });

  it('a template opened here starts with Add to Mission checked', () => {
    mockTemplates = [{ id: 1, name: 'Bug', title: '$t', details: '', color: '#f44', category_id: null, sort_order: 0 }];
    renderSidebar();
    fireEvent.click(screen.getByRole('button', { name: 'Bug' }));
    expect(screen.getByLabelText('ADD_TO_MISSION')).toBeChecked();
  });
});
