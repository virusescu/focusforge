import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DeadlineControl } from './DeadlineControl';
import { toInputValue } from '../utils/deadline';

const mockSetObjectiveDeadline = vi.fn();

vi.mock('../contexts/FocusContext', () => ({
  useFocus: () => ({ setObjectiveDeadline: mockSetObjectiveDeadline }),
}));

vi.mock('../utils/audio', () => ({ soundEngine: { playClick: vi.fn() } }));

// Wednesday 21 Oct 2026, 12:00 local
const NOW = new Date(2026, 9, 21, 12, 0);
const at = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min).toISOString();

describe('DeadlineControl', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    mockSetObjectiveDeadline.mockClear();
  });
  afterEach(() => vi.useRealTimers());

  it('says there is no deadline until clicked', () => {
    render(<DeadlineControl objectiveId={5} deadline={null} />);
    expect(screen.getByText('NO_DEADLINE')).toBeInTheDocument();
    expect(screen.queryByLabelText('Remove deadline')).toBeNull();
  });

  it('clicking it saves the next working day at 19:00 at once', () => {
    render(<DeadlineControl objectiveId={5} deadline={null} />);
    fireEvent.click(screen.getByText('NO_DEADLINE'));
    expect(mockSetObjectiveDeadline).toHaveBeenCalledWith(5, at(2026, 10, 22, 19, 0));
  });

  it('on a Friday the default is Monday', () => {
    vi.setSystemTime(new Date(2026, 9, 23, 9, 0));
    render(<DeadlineControl objectiveId={5} deadline={null} />);
    fireEvent.click(screen.getByText('NO_DEADLINE'));
    expect(mockSetObjectiveDeadline).toHaveBeenCalledWith(5, at(2026, 10, 26, 19, 0));
  });

  it('shows the date like "24 Dec 14:30"', () => {
    render(<DeadlineControl objectiveId={5} deadline={at(2026, 12, 24, 14, 30)} />);
    expect(screen.getByText('24 Dec 14:30')).toBeInTheDocument();
  });

  it('is yellow for today or tomorrow, red once passed, plain otherwise', () => {
    const { rerender, container } = render(<DeadlineControl objectiveId={5} deadline={at(2026, 10, 22, 8, 0)} />);
    expect(container.querySelector('[data-deadline-state]')).toHaveAttribute('data-deadline-state', 'soon');
    rerender(<DeadlineControl objectiveId={5} deadline={at(2026, 10, 20, 8, 0)} />);
    expect(container.querySelector('[data-deadline-state]')).toHaveAttribute('data-deadline-state', 'overdue');
    rerender(<DeadlineControl objectiveId={5} deadline={at(2026, 12, 24, 8, 0)} />);
    expect(container.querySelector('[data-deadline-state]')).toHaveAttribute('data-deadline-state', 'later');
  });

  it('the picker saves the chosen date and time, past dates included', () => {
    render(<DeadlineControl objectiveId={5} deadline={at(2026, 12, 24, 14, 30)} />);
    const picker = screen.getByLabelText('Deadline date and time');
    expect(picker).toHaveValue(toInputValue(at(2026, 12, 24, 14, 30)));
    fireEvent.change(picker, { target: { value: '2026-01-02T03:04' } });
    expect(mockSetObjectiveDeadline).toHaveBeenCalledWith(5, at(2026, 1, 2, 3, 4));
  });

  it('clearing the picker field does not remove the deadline (the X does)', () => {
    render(<DeadlineControl objectiveId={5} deadline={at(2026, 12, 24, 14, 30)} />);
    fireEvent.change(screen.getByLabelText('Deadline date and time'), { target: { value: '' } });
    expect(mockSetObjectiveDeadline).not.toHaveBeenCalled();
  });

  it('the X removes the deadline', () => {
    render(<DeadlineControl objectiveId={5} deadline={at(2026, 12, 24, 14, 30)} />);
    fireEvent.click(screen.getByLabelText('Remove deadline'));
    expect(mockSetObjectiveDeadline).toHaveBeenCalledWith(5, null);
  });

  it('clicking the date opens the system picker', () => {
    render(<DeadlineControl objectiveId={5} deadline={at(2026, 12, 24, 14, 30)} />);
    const picker = screen.getByLabelText('Deadline date and time') as HTMLInputElement;
    picker.showPicker = vi.fn();
    fireEvent.click(screen.getByLabelText('Deadline 24 Dec 14:30'));
    expect(picker.showPicker).toHaveBeenCalledOnce();
  });
});
