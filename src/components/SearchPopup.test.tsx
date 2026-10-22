import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { SearchPopup } from './SearchPopup';
import type { Bucket, ObjectiveCategory, StrategicObjective } from '../types';

const mockSetObjectiveMission = vi.fn();
const mockUpdateObjective = vi.fn();
const mockDeleteObjective = vi.fn();
let mockViewedId: number | null = null;

const bucket = (id: number, name: string, color: string, kind: Bucket['kind']): Bucket =>
  ({ id, name, color, sort_order: id, kind, x: 0, y: 0, w: 1, h: 1 });
const BUCKETS = [bucket(1, 'Mission', '#00ff88', 'mission'), bucket(2, 'Unsorted', '#888888', 'unsorted'), bucket(9, 'Work', '#3388ff', 'custom')];
const CATEGORIES: ObjectiveCategory[] = [
  { id: 4, label: 'Hard', color: '#f44444', sort_order: 0, coin_bounty: 50 },
  { id: 5, label: 'Easy', color: '#44bb44', sort_order: 1, coin_bounty: 10 },
];

const task = (id: number, text: string, extra: Partial<StrategicObjective> = {}): StrategicObjective =>
  ({ id, text, created_at: '', is_mission: 0, bucket_id: 2, category_id: null, details: null, deadline_at: null, ...extra });
const POOL = [
  task(1, 'Write report', { bucket_id: 2, category_id: 4, details: 'Quarterly numbers', deadline_at: new Date(2030, 0, 5, 9).toISOString() }),
  task(2, 'Fix login bug', { bucket_id: 9, details: 'Safari only', is_mission: 1 }),
  task(3, 'Ship release', { bucket_id: 9, category_id: 5, deadline_at: new Date(2029, 5, 1, 9).toISOString() }),
];

vi.mock('../contexts/FocusContext', () => ({
  useFocus: () => ({
    objectivePool: POOL,
    buckets: BUCKETS,
    categories: CATEGORIES,
    viewedObjectiveId: mockViewedId,
    setObjectiveMission: mockSetObjectiveMission,
    updateObjective: mockUpdateObjective,
    deleteObjective: mockDeleteObjective,
    duplicateObjective: vi.fn(),
    moveObjectiveToBucket: vi.fn(),
    templates: [],
    addTemplate: vi.fn(),
  }),
}));
vi.mock('../utils/audio', () => ({ soundEngine: { playClick: vi.fn(), playHover: vi.fn(), playTab: vi.fn(), playNavSelect: vi.fn(), playEditStart: vi.fn() } }));

const onClose = vi.fn();
const onOpenDetails = vi.fn();
const onCloseDetails = vi.fn();

const renderPopup = (props: Partial<React.ComponentProps<typeof SearchPopup>> = {}) =>
  render(<SearchPopup onClose={onClose} onOpenDetails={onOpenDetails} onCloseDetails={onCloseDetails} detailsOpen={false} reservedRight={0} {...props} />);

const titles = () => Array.from(document.querySelectorAll('[data-objective-id]')).map(r => r.textContent?.replace('★', ''));
const row = (id: number) => document.querySelector(`[data-objective-id="${id}"]`) as HTMLElement;
const box = () => screen.getByLabelText('Search objectives', { selector: 'input' }) as HTMLInputElement;
const pick = (filterLabel: string, option: string) => {
  fireEvent.click(screen.getByLabelText(filterLabel));
  fireEvent.click(screen.getByRole('option', { name: option }));
};
const toggle = (name: string) => fireEvent.click(screen.getByRole('switch', { name: new RegExp(name) }));

describe('SearchPopup', () => {
  beforeEach(() => {
    localStorage.clear();
    mockViewedId = null;
    [onClose, onOpenDetails, onCloseDetails, mockSetObjectiveMission].forEach(f => f.mockClear());
  });

  it('starts with the input focused and every task listed by title', () => {
    renderPopup();
    expect(box()).toHaveFocus();
    expect(titles()).toEqual(['Fix login bug', 'Ship release', 'Write report']);
    expect(screen.getByLabelText('Matches')).toHaveTextContent('3 / 3');
  });

  it('typing filters by title only, until IN_DETAILS is switched on', () => {
    renderPopup();
    fireEvent.change(box(), { target: { value: 'safari' } });
    expect(titles()).toEqual([]);
    expect(screen.getByText('NO_MATCHES')).toBeInTheDocument();
    toggle('IN_DETAILS');
    expect(titles()).toEqual(['Fix login bug']);
    fireEvent.change(box(), { target: { value: 'ship' } });
    expect(titles()).toEqual(['Ship release']);
  });

  it('filters by category and by bucket (with an All entry that clears them)', () => {
    renderPopup();
    pick('Category filter', 'Hard');
    expect(titles()).toEqual(['Write report']);
    pick('Category filter', 'All categories');
    pick('Bucket filter', 'Work');
    expect(titles()).toEqual(['Fix login bug', 'Ship release']);
    fireEvent.click(screen.getByLabelText('Bucket filter'));
    expect(screen.getAllByRole('option').map(o => o.textContent)).toEqual(['All buckets', 'Unsorted', 'Work']);
  });

  it('WITH_DEADLINE shows only tasks that have one', () => {
    renderPopup();
    toggle('WITH_DEADLINE');
    expect(titles().map(t => t?.replace(/\d.*$/, '').trim())).toEqual(['Ship release', 'Write report']);
  });

  it('sorting: one of TITLE / DEADLINE is always on, and a click on the active one flips it', () => {
    renderPopup();
    const titleBtn = () => screen.getByRole('button', { name: /Sort by title/ });
    const deadlineBtn = () => screen.getByRole('button', { name: /Sort by deadline/ });
    expect(titleBtn()).toHaveAttribute('aria-pressed', 'true');
    expect(deadlineBtn()).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(titleBtn()); // flips to Z-A
    expect(titleBtn()).toHaveAttribute('aria-pressed', 'true');
    expect(titles()).toEqual(['Write report', 'Ship release', 'Fix login bug']);

    fireEvent.click(deadlineBtn()); // switches over; soonest first, no deadline last
    expect(titleBtn()).toHaveAttribute('aria-pressed', 'false');
    expect(deadlineBtn()).toHaveAttribute('aria-pressed', 'true');
    expect(titles().map(t => t?.replace(/\d.*$/, '').trim())).toEqual(['Ship release', 'Write report', 'Fix login bug']);

    fireEvent.click(deadlineBtn()); // latest first
    expect(titles().map(t => t?.replace(/\d.*$/, '').trim())).toEqual(['Write report', 'Ship release', 'Fix login bug']);

    fireEvent.click(titleBtn()); // back to title, in the direction it had (Z-A)
    expect(titles()).toEqual(['Write report', 'Ship release', 'Fix login bug']);
  });

  it('remembers the toggles and the sort, but not the text or the filters', () => {
    const { unmount } = renderPopup();
    toggle('IN_DETAILS');
    fireEvent.click(screen.getByRole('button', { name: /Sort by deadline/ }));
    fireEvent.change(box(), { target: { value: 'ship' } });
    pick('Category filter', 'Easy');
    unmount();
    renderPopup();
    expect(screen.getByRole('switch', { name: /IN_DETAILS/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('button', { name: /Sort by deadline/ })).toHaveAttribute('aria-pressed', 'true');
    expect(box()).toHaveValue('');
    expect(titles()).toHaveLength(3);
  });

  it('rows carry the bucket color, the category dot, a deadline icon and a star for Mission tasks', () => {
    renderPopup();
    expect(row(1).style.borderColor).toMatch(/#888888|rgb\(136, 136, 136\)/i);
    expect(row(1).style.background).toContain('color-mix');
    expect(row(1).querySelector('span')?.getAttribute('style')).toMatch(/background-color/);
    expect(row(1).querySelector('[data-deadline-state]')).not.toBeNull();
    expect(row(2).querySelector('[data-deadline-state]')).toBeNull();
    expect(within(row(2)).getByTitle('In Mission')).toBeInTheDocument();
    expect(within(row(1)).queryByTitle('In Mission')).toBeNull();
  });

  it('a click shows that task\'s details', () => {
    renderPopup();
    fireEvent.click(row(3));
    expect(onOpenDetails).toHaveBeenLastCalledWith(3);
  });

  it('a double-click toggles the task in Mission', () => {
    renderPopup();
    fireEvent.doubleClick(row(3));
    expect(mockSetObjectiveMission).toHaveBeenCalledWith(3, true);
    fireEvent.doubleClick(row(2)); // already in Mission
    expect(mockSetObjectiveMission).toHaveBeenLastCalledWith(2, false);
  });

  it('keeps clear of the details pane: it sits left of the reserved width', () => {
    const { rerender } = renderPopup({ reservedRight: 0 });
    const layer = () => screen.getByRole('dialog').parentElement as HTMLElement;
    expect(layer().style.right).toBe('0px');
    rerender(<SearchPopup onClose={onClose} onOpenDetails={onOpenDetails} onCloseDetails={onCloseDetails} detailsOpen reservedRight={420} />);
    expect(layer().style.right).toBe('420px');
  });

  it('is a details-pane barrier, so using it does not close an open pane', () => {
    renderPopup();
    expect(screen.getByRole('dialog')).toHaveAttribute('data-details-barrier');
  });

  describe('Escape', () => {
    it('closes the popup when no details pane is open', () => {
      renderPopup();
      fireEvent.keyDown(box(), { key: 'Escape' });
      expect(onClose).toHaveBeenCalledOnce();
      expect(onCloseDetails).not.toHaveBeenCalled();
    });

    it('closes the popup straight away, even with the details pane open', () => {
      renderPopup({ detailsOpen: true });
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledOnce();
    });

    it('leaves Escape to a right-click menu or a dialog opened from a result', () => {
      renderPopup();
      fireEvent.contextMenu(row(3));
      expect(screen.getByRole('menu')).toBeInTheDocument();
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(onClose).not.toHaveBeenCalled();
    });

    it('never reaches the page behind it', () => {
      const onWindowKey = vi.fn();
      window.addEventListener('keydown', onWindowKey);
      renderPopup();
      fireEvent.keyDown(box(), { key: 'Escape' });
      window.removeEventListener('keydown', onWindowKey);
      expect(onWindowKey).not.toHaveBeenCalled();
    });

    it('leaves Escape to another text box (the title or notes being edited in the pane)', () => {
      renderPopup({ detailsOpen: true });
      const other = document.createElement('textarea');
      document.body.appendChild(other);
      fireEvent.keyDown(other, { key: 'Escape' });
      other.remove();
      expect(onCloseDetails).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
    });

    it('lets an open drop-down close itself first', () => {
      renderPopup();
      fireEvent.click(screen.getByLabelText('Bucket filter'));
      fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' });
      expect(screen.queryByRole('listbox')).toBeNull();
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('highlight and details', () => {
    const current = () => Array.from(document.querySelectorAll('[data-objective-id]')).findIndex(r => /current/.test(r.className));

    it('starts with the first result highlighted and its details shown', () => {
      renderPopup();
      expect(current()).toBe(0);
      expect(onOpenDetails).toHaveBeenCalledWith(2); // "Fix login bug" is first by title
    });

    it('with nothing to show, the details pane stays open on the last task (no jumping)', () => {
      renderPopup({ detailsOpen: true });
      fireEvent.change(box(), { target: { value: 'zzz' } });
      expect(current()).toBe(-1);
      expect(onCloseDetails).not.toHaveBeenCalled();
    });

    it('closing the popup closes a pane that it opened, but not one that was open before', () => {
      const first = renderPopup({ detailsOpen: false });
      first.unmount();
      expect(onCloseDetails).toHaveBeenCalledOnce();
      onCloseDetails.mockClear();
      const second = renderPopup({ detailsOpen: true });
      second.unmount();
      expect(onCloseDetails).not.toHaveBeenCalled();
    });

    it('Up and Down move the highlight and show the details of the new task, stopping at the ends', () => {
      renderPopup();
      onOpenDetails.mockClear();
      fireEvent.keyDown(box(), { key: 'ArrowDown' });
      expect(current()).toBe(1);
      expect(onOpenDetails).toHaveBeenLastCalledWith(3);
      fireEvent.keyDown(box(), { key: 'ArrowDown' });
      fireEvent.keyDown(box(), { key: 'ArrowDown' });
      expect(current()).toBe(2);
      fireEvent.keyDown(box(), { key: 'ArrowUp' });
      expect(current()).toBe(1);
    });

    it('the arrows work with the keyboard on the page, not only in the box', () => {
      renderPopup();
      fireEvent.keyDown(document.body, { key: 'ArrowDown' });
      expect(current()).toBe(1);
    });

    it('keeps the highlight on the same task while the filter changes, by id', () => {
      renderPopup();
      fireEvent.keyDown(box(), { key: 'ArrowDown' }); // Ship release
      fireEvent.change(box(), { target: { value: 'i' } }); // Fix, Ship, Write all still match
      expect(row(3).className).toMatch(/current/);
      fireEvent.change(box(), { target: { value: 'ship' } }); // now it is the only one
      expect(row(3).className).toMatch(/current/);
    });

    it('jumps to the first result when the highlighted task is filtered out, and stays there', () => {
      renderPopup();
      fireEvent.keyDown(box(), { key: 'ArrowDown' });
      fireEvent.keyDown(box(), { key: 'ArrowDown' }); // Write report
      fireEvent.change(box(), { target: { value: 'fix' } });
      expect(row(2).className).toMatch(/current/);
      fireEvent.change(box(), { target: { value: '' } }); // Write report is back, but the highlight stays on Fix
      expect(row(2).className).toMatch(/current/);
    });

    it('Enter asks the details pane to start editing', () => {
      const onEdit = vi.fn();
      window.addEventListener('objective-details-edit', onEdit);
      renderPopup({ detailsOpen: true });
      fireEvent.keyDown(box(), { key: 'Enter' });
      window.removeEventListener('objective-details-edit', onEdit);
      expect(onEdit).toHaveBeenCalledOnce();
    });

    it('Shift+Enter and Ctrl+Enter toggle the highlighted task in Mission, and do not start editing', () => {
      const onEdit = vi.fn();
      window.addEventListener('objective-details-edit', onEdit);
      renderPopup({ detailsOpen: true });
      fireEvent.keyDown(box(), { key: 'Enter', shiftKey: true });  // Fix login bug is in Mission: removed
      expect(mockSetObjectiveMission).toHaveBeenLastCalledWith(2, false);
      fireEvent.keyDown(box(), { key: 'ArrowDown' });              // Ship release is not: added
      fireEvent.keyDown(box(), { key: 'Enter', ctrlKey: true });
      expect(mockSetObjectiveMission).toHaveBeenLastCalledWith(3, true);
      window.removeEventListener('objective-details-edit', onEdit);
      expect(onEdit).not.toHaveBeenCalled();
    });

    it('Ctrl+Enter does not reach the main screen\'s neutralize shortcut', () => {
      const onWindowKey = vi.fn();
      window.addEventListener('keydown', onWindowKey);
      renderPopup();
      fireEvent.keyDown(box(), { key: 'Enter', ctrlKey: true });
      window.removeEventListener('keydown', onWindowKey);
      expect(onWindowKey).not.toHaveBeenCalled();
    });
  });

  describe('right-click menu on a result', () => {
    it('offers the usual task options, with Add to Mission or Remove from Mission to match', () => {
      renderPopup();
      fireEvent.contextMenu(row(3)); // not in Mission
      expect(screen.getAllByRole('menuitem').map(i => i.textContent)).toEqual([
        'Rename', 'Move to bucket', 'Add to Mission', 'Duplicate', 'Copy text', 'Create template from task', 'Delete',
      ]);
      fireEvent.keyDown(window, { key: 'Escape' });
      fireEvent.contextMenu(row(2)); // in Mission
      expect(screen.getByRole('menuitem', { name: 'Remove from Mission' })).toBeInTheDocument();
    });

    it('right-clicking a result highlights it', () => {
      renderPopup();
      fireEvent.contextMenu(row(3));
      expect(row(3).className).toMatch(/current/);
    });

    it('Add to Mission in the menu adds the task', () => {
      renderPopup();
      fireEvent.contextMenu(row(3));
      fireEvent.click(screen.getByRole('menuitem', { name: 'Add to Mission' }));
      expect(mockSetObjectiveMission).toHaveBeenCalledWith(3, true);
    });

    it('Move to bucket lists the buckets tasks can live in', () => {
      renderPopup();
      fireEvent.contextMenu(row(3));
      fireEvent.click(screen.getByRole('menuitem', { name: 'Move to bucket' }));
      expect(within(screen.getAllByRole('menu')[1]).getAllByRole('menuitem').map(i => i.textContent)).toEqual(['Unsorted', 'Work']);
    });

    it('Rename turns the result into an input; Enter saves it', () => {
      renderPopup();
      fireEvent.contextMenu(row(3));
      fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));
      const input = within(row(3)).getByDisplayValue('Ship release');
      fireEvent.change(input, { target: { value: 'Ship it' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(mockUpdateObjective).toHaveBeenCalledWith(3, 'Ship it');
    });

    it('Escape in the rename box cancels the rename and keeps the popup open', () => {
      renderPopup();
      fireEvent.contextMenu(row(3));
      fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));
      fireEvent.keyDown(within(row(3)).getByDisplayValue('Ship release'), { key: 'Escape' });
      expect(within(row(3)).queryByDisplayValue('Ship release')).toBeNull();
      expect(onClose).not.toHaveBeenCalled();
    });

    it('Delete removes the task', () => {
      renderPopup();
      fireEvent.contextMenu(row(3));
      fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
      expect(mockDeleteObjective).toHaveBeenCalledWith(3);
    });
  });

  describe('keyboard focus', () => {
    it('darkens the whole window, with a hole exactly where the details pane is', () => {
      const pane = document.createElement('aside');
      pane.setAttribute('data-details-pane', '');
      pane.getBoundingClientRect = () => ({ left: 900, top: 60, right: 1300, bottom: 700, width: 400, height: 640 } as DOMRect);
      document.body.appendChild(pane);
      renderPopup({ detailsOpen: true, reservedRight: 400 });
      const scrim = document.querySelector('[class*="scrim"]') as HTMLElement;
      expect(scrim.getAttribute('data-hole')).toBe('900,60,1300,700');
      pane.remove();
    });

    it('with no details pane the scrim has no hole', () => {
      renderPopup();
      expect(document.querySelector('[class*="scrim"]')?.getAttribute('data-hole')).toBeNull();
    });

    it('Tab goes only between the box and the two drop-downs, and wraps (Shift+Tab goes back)', () => {
      renderPopup();
      const category = screen.getByLabelText('Category filter');
      const bucket = screen.getByLabelText('Bucket filter');
      fireEvent.keyDown(box(), { key: 'Tab' });
      expect(category).toHaveFocus();
      fireEvent.keyDown(category, { key: 'Tab' });
      expect(bucket).toHaveFocus();
      fireEvent.keyDown(bucket, { key: 'Tab' });
      expect(box()).toHaveFocus();
      fireEvent.keyDown(box(), { key: 'Tab', shiftKey: true });
      expect(bucket).toHaveFocus();
    });

    it('the switches and sort buttons are not tab stops', () => {
      renderPopup();
      for (const el of [...screen.getAllByRole('switch'), ...screen.getAllByRole('button', { name: /Sort by/ })]) {
        expect(el).toHaveAttribute('tabindex', '-1');
      }
    });

    it('Up and Down on a drop-down cycle its options even while it is closed, and leave the highlight alone', () => {
      renderPopup();
      const category = screen.getByLabelText('Category filter');
      category.focus();
      fireEvent.keyDown(category, { key: 'ArrowDown' }); // All -> No category
      expect(category).toHaveTextContent('No category');
      expect(screen.queryByRole('listbox')).toBeNull();
      expect(titles()).toEqual(['Fix login bug']); // the only task without a category
      fireEvent.keyDown(category, { key: 'ArrowUp' });
      expect(category).toHaveTextContent('All categories');
      fireEvent.keyDown(category, { key: 'ArrowUp' }); // wraps to the last
      expect(category).toHaveTextContent('Easy');
    });

    it('Backspace on the category drop-down picks All categories, on the bucket one All buckets', () => {
      renderPopup();
      pick('Category filter', 'Hard');
      pick('Bucket filter', 'Work');
      const category = screen.getByLabelText('Category filter');
      const bucket = screen.getByLabelText('Bucket filter');
      category.focus();
      fireEvent.keyDown(category, { key: 'Backspace' });
      expect(category).toHaveTextContent('All categories');
      expect(bucket).toHaveTextContent('Work');
      fireEvent.keyDown(bucket, { key: 'Backspace' });
      expect(bucket).toHaveTextContent('All buckets');
    });

    it('after opening a drop-down with Enter, the arrows pick options in its list, not in the page behind', () => {
      const onWindowKey = vi.fn();
      renderPopup();
      const bucket = screen.getByLabelText('Bucket filter');
      bucket.focus();
      fireEvent.keyDown(bucket, { key: 'Enter' });
      expect(screen.getByRole('listbox')).toHaveFocus();
      window.addEventListener('keydown', onWindowKey);
      fireEvent.keyDown(screen.getByRole('listbox'), { key: 'ArrowDown' });
      fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Enter' });
      window.removeEventListener('keydown', onWindowKey);
      expect(bucket).toHaveTextContent('Unsorted');
      expect(onWindowKey).not.toHaveBeenCalled();
    });

    it('Space on a drop-down opens it', () => {
      renderPopup();
      const bucket = screen.getByLabelText('Bucket filter');
      bucket.focus();
      fireEvent.keyDown(bucket, { key: ' ' });
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    it('keeps the main screen\'s shortcuts out while it holds the keyboard', () => {
      const onWindowKey = vi.fn();
      window.addEventListener('keydown', onWindowKey);
      renderPopup();
      fireEvent.keyDown(document.body, { key: ' ' });
      fireEvent.keyDown(document.body, { key: 'a' });
      fireEvent.keyDown(document.body, { key: 'ArrowDown' });
      window.removeEventListener('keydown', onWindowKey);
      expect(onWindowKey).not.toHaveBeenCalled();
    });
  });
});
