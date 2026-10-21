import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react';
import { SidebarLeft } from './SidebarLeft';
import type { Bucket, Template } from '../types';

const mockAddObjective = vi.fn();
let mockTemplates: Template[] = [];
let mockActiveId: number | null = null;
let mockDeadline: string | null = null;
const mockDeleteObjective = vi.fn();
const mockSetObjectiveMission = vi.fn();
const mockMoveObjectiveToBucket = vi.fn();
const MISSION_OBJ = { id: 7, text: 'Ship it', created_at: '2026-10-13T00:00:00Z', is_mission: 1, bucket_id: 2, bucket_sort_order: 0, sort_order: 0, category_id: null };

const bucket = (id: number, name: string, kind: Bucket['kind']): Bucket => ({ id, name, color: '#fff', sort_order: id, kind, x: 0, y: 0, w: 1, h: 1 });
const BUCKETS = [bucket(1, 'Mission', 'mission'), bucket(2, 'Unsorted', 'unsorted'), bucket(9, 'Work', 'custom')];
const CATEGORIES = [
  { id: 4, label: 'Hard', color: '#f44', sort_order: 0, coin_bounty: 50 },
  { id: 5, label: 'Easy', color: '#888', sort_order: 1, coin_bounty: 10 },
];

vi.mock('../contexts/FocusContext', () => ({
  useFocus: () => ({
    objectivePool: [],
    missionObjectives: [{ ...MISSION_OBJ, deadline_at: mockDeadline }],
    activeObjectiveId: mockActiveId,
    viewedObjectiveId: null,
    addObjective: mockAddObjective,
    deleteObjective: mockDeleteObjective,
    duplicateObjective: vi.fn(),
    moveObjectiveToBucket: mockMoveObjectiveToBucket,
    updateObjective: vi.fn(),
    updateObjectiveCategory: vi.fn(),
    setActiveObjective: vi.fn(),
    setViewedObjective: vi.fn(),
    reorderObjectives: vi.fn(),
    setObjectiveMission: mockSetObjectiveMission,
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
const bucketSelect = () => screen.getByLabelText('Bucket for new objective');
const pickBucket = (name: string) => {
  fireEvent.click(bucketSelect());
  fireEvent.click(screen.getByRole('option', { name }));
};
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
    expect(bucketSelect()).toHaveTextContent('Unsorted');
    fireEvent.click(bucketSelect());
    expect(screen.getAllByRole('option').map(o => o.textContent)).toEqual(['Unsorted', 'Work']);
  });

  it('adds into the chosen bucket and defaults to the first category', async () => {
    renderSidebar();
    pickBucket('Work');
    add('Write report');
    await waitFor(() => expect(mockAddObjective).toHaveBeenCalledWith('Write report', 4, false, { bucketId: 9 }));
  });

  it('Shift+Enter still adds to the top, in the chosen bucket', async () => {
    renderSidebar();
    pickBucket('Work');
    add('Urgent', { key: 'Enter', shiftKey: true });
    await waitFor(() => expect(mockAddObjective).toHaveBeenCalledWith('Urgent', 4, true, { bucketId: 9 }));
  });

  it('keeps the bucket after an add and remembers it for next time', async () => {
    renderSidebar();
    pickBucket('Work');
    add('One');
    await waitFor(() => expect(mockAddObjective).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(localStorage.getItem('last_bucket_id')).toBe('9'));
    expect(bucketSelect()).toHaveTextContent('Work');
    expect(input()).toHaveValue('');
    add('Two');
    await waitFor(() => expect(mockAddObjective).toHaveBeenLastCalledWith('Two', 4, false, { bucketId: 9 }));
  });

  it('starts from the bucket and category remembered on this machine', async () => {
    localStorage.setItem('last_bucket_id', '9');
    localStorage.setItem('last_category_id', '5');
    renderSidebar();
    expect(bucketSelect()).toHaveTextContent('Work');
    add('Remembered');
    await waitFor(() => expect(mockAddObjective).toHaveBeenCalledWith('Remembered', 5, false, { bucketId: 9 }));
  });

  it('falls back to Unsorted and the first category when the remembered ones are gone', async () => {
    localStorage.setItem('last_bucket_id', '77');
    localStorage.setItem('last_category_id', '99');
    renderSidebar();
    expect(bucketSelect()).toHaveTextContent('Unsorted');
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

describe('SidebarLeft task rows', () => {
  const row = () => screen.getByText('Ship it').closest('[data-bucket-id]') as HTMLElement;

  beforeEach(() => {
    mockActiveId = null;
    mockDeadline = null;
    mockDeleteObjective.mockClear();
    mockSetObjectiveMission.mockClear();
  });

  it('shows no deadline icon on a task without a deadline', () => {
    renderSidebar();
    expect(row().querySelector('[data-deadline-state]')).toBeNull();
  });

  it('shows only the deadline icon (no date) on a task that has one, red once it has passed', () => {
    mockDeadline = new Date(2020, 0, 1, 9, 0).toISOString();
    renderSidebar();
    expect(row().querySelector('[data-deadline-state="overdue"]')).not.toBeNull();
    expect(within(row()).queryByText(/Jan/)).toBeNull();
  });

  it('has no buttons; rename, remove-from-mission and delete are in the right-click menu', () => {
    renderSidebar();
    expect(row().querySelectorAll('button')).toHaveLength(0);
    fireEvent.contextMenu(row());
    expect(screen.getAllByRole('menuitem').map(i => i.textContent)).toEqual([
      'Rename', 'Move to bucket', 'Remove from Mission', 'Duplicate', 'Copy text', 'Create template from task', 'Delete',
    ]);
  });

  it('Move to bucket offers Unsorted and the other task buckets (never Mission) and moves the task', () => {
    renderSidebar();
    fireEvent.contextMenu(row());
    fireEvent.click(screen.getByRole('menuitem', { name: 'Move to bucket' }));
    const list = within(screen.getAllByRole('menu')[1]);
    expect(list.getAllByRole('menuitem').map(i => i.textContent)).toEqual(['Unsorted', 'Work']);
    fireEvent.click(list.getByRole('menuitem', { name: 'Work' }));
    expect(mockMoveObjectiveToBucket).toHaveBeenCalledWith(7, 9);
  });

  it('Rename in the menu starts inline rename', () => {
    renderSidebar();
    const el = row();
    fireEvent.contextMenu(el);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));
    expect(within(el).getByDisplayValue('Ship it')).toBeInTheDocument();
  });

  it('shows the active tab only on the active row, in the bucket color', () => {
    renderSidebar();
    expect(row().className).not.toMatch(/activeObjective/);
    expect(screen.queryByRole('img', { name: 'Active objective' })).toBeNull();
    cleanup();
    mockActiveId = 7;
    renderSidebar();
    expect(row().className).toMatch(/activeObjective/);
    expect(within(row()).getByRole('img', { name: 'Active objective' })).toBeInTheDocument();
    const tab = within(row()).getByTestId('active-tab');
    expect(tab.style.backgroundColor).toMatch(/rgb\(255, 255, 255\)|#fff/i);
    expect(tab.style.color).toMatch(/rgb\(17, 17, 17\)|#111111/i);
  });

  it('keeps the bucket-colored border on every row', () => {
    renderSidebar();
    expect(row().style.borderColor).toMatch(/rgb\(255, 255, 255\)|#fff/i);
  });

  it('tints the row with its bucket color', () => {
    renderSidebar();
    expect(row().style.background).toContain('color-mix');
  });

  it('Remove from Mission in the menu takes the task off the list without deleting it', () => {
    renderSidebar();
    fireEvent.contextMenu(row());
    fireEvent.click(screen.getByRole('menuitem', { name: 'Remove from Mission' }));
    expect(mockSetObjectiveMission).toHaveBeenCalledWith(7, false);
    expect(mockDeleteObjective).not.toHaveBeenCalled();
  });

  it('Delete in the menu deletes the task', () => {
    renderSidebar();
    fireEvent.contextMenu(row());
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(mockDeleteObjective).toHaveBeenCalledWith(7);
  });

  it('Escape closes the category picker without reaching the page', () => {
    const pageKey = vi.fn();
    window.addEventListener('keydown', pageKey);
    renderSidebar();
    fireEvent.click(row().querySelector('span') as HTMLElement); // category bullet
    expect(screen.getByTitle('Manage Categories')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTitle('Manage Categories')).toBeNull();
    expect(pageKey).not.toHaveBeenCalled();
    window.removeEventListener('keydown', pageKey);
  });

  it('has no Add button beside the add box', () => {
    renderSidebar();
    expect(input().parentElement?.querySelector('button[type="submit"]')).toBeNull();
  });
});
