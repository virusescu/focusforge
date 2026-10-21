import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ObjectiveDetails } from './ObjectiveDetails';

const mockUpdateObjective = vi.fn();

const OBJ = { id: 7, text: 'Ship the release', created_at: '2026-10-13T00:00:00Z', is_mission: 0, bucket_id: 2, details: null, deadline_at: null };

vi.mock('../contexts/FocusContext', () => ({
  useFocus: () => ({
    viewedObjectiveId: 7,
    objectivePool: [OBJ],
    buckets: [{ id: 2, name: 'Unsorted', color: '#888', sort_order: 1, kind: 'unsorted', x: 0, y: 0, w: 1, h: 1 }],
    updateObjectiveDetails: vi.fn(),
    updateObjective: mockUpdateObjective,
    setObjectiveDeadline: vi.fn(),
  }),
}));
vi.mock('../utils/audio', () => ({ soundEngine: { playClick: vi.fn(), playEditStart: vi.fn() } }));

const renderDetails = (onClose = vi.fn()) => render(<ObjectiveDetails onClose={onClose} />);
const startEdit = () => fireEvent.doubleClick(screen.getByText('Ship the release'));
const input = () => screen.getByLabelText('Task title') as HTMLInputElement;

describe('ObjectiveDetails title', () => {
  beforeEach(() => mockUpdateObjective.mockClear());

  it('shows the title as text, with no close button', () => {
    renderDetails();
    expect(screen.getByRole('heading', { name: 'Ship the release' })).toBeInTheDocument();
    expect(screen.queryByTitle(/Close/)).toBeNull();
  });

  it('double-clicking the title turns it into an input holding the current text', () => {
    renderDetails();
    startEdit();
    expect(input()).toHaveValue('Ship the release');
  });

  it('Enter saves the new title', () => {
    renderDetails();
    startEdit();
    fireEvent.change(input(), { target: { value: '  Ship it  ' } });
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(mockUpdateObjective).toHaveBeenCalledWith(7, 'Ship it');
    expect(screen.queryByLabelText('Task title')).toBeNull();
  });

  it('clicking away saves it too', () => {
    renderDetails();
    startEdit();
    fireEvent.change(input(), { target: { value: 'Renamed' } });
    fireEvent.blur(input());
    expect(mockUpdateObjective).toHaveBeenCalledWith(7, 'Renamed');
  });

  it('Escape cancels without saving, and does not reach the page', () => {
    const onWindowKey = vi.fn();
    window.addEventListener('keydown', onWindowKey);
    renderDetails();
    startEdit();
    fireEvent.change(input(), { target: { value: 'Nope' } });
    fireEvent.keyDown(input(), { key: 'Escape' });
    expect(screen.queryByLabelText('Task title')).toBeNull();
    expect(mockUpdateObjective).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Ship the release' })).toBeInTheDocument();
    expect(onWindowKey).not.toHaveBeenCalled();
    window.removeEventListener('keydown', onWindowKey);
  });

  it('an empty or unchanged title is not saved', () => {
    renderDetails();
    startEdit();
    fireEvent.change(input(), { target: { value: '   ' } });
    fireEvent.keyDown(input(), { key: 'Enter' });
    startEdit();
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(mockUpdateObjective).not.toHaveBeenCalled();
  });
});
