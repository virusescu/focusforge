import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { DeadlineBadge } from './DeadlineBadge';

const NOW = new Date(2026, 9, 21, 12, 0);
const at = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min).toISOString();

describe('DeadlineBadge', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it('shows just an icon by default, with the date in the tooltip', () => {
    const { container } = render(<DeadlineBadge deadline={at(2026, 12, 24, 14, 30)} />);
    expect(container.querySelector('svg')).not.toBeNull();
    expect(screen.queryByText('24 Dec 14:30')).toBeNull();
    expect(container.firstElementChild).toHaveAttribute('title', 'Deadline: 24 Dec 14:30');
  });

  it('shows the date when asked', () => {
    render(<DeadlineBadge deadline={at(2026, 12, 24, 14, 30)} showText />);
    expect(screen.getByText('24 Dec 14:30')).toBeInTheDocument();
  });

  it('is soon for today or tomorrow and overdue once passed', () => {
    const { container, rerender } = render(<DeadlineBadge deadline={at(2026, 10, 21, 18, 0)} />);
    expect(container.firstElementChild).toHaveAttribute('data-deadline-state', 'soon');
    rerender(<DeadlineBadge deadline={at(2026, 10, 21, 11, 0)} />);
    expect(container.firstElementChild).toHaveAttribute('data-deadline-state', 'overdue');
  });

  it('turns overdue by itself when the deadline passes while the app is open', () => {
    const { container } = render(<DeadlineBadge deadline={at(2026, 10, 21, 12, 30)} />);
    expect(container.firstElementChild).toHaveAttribute('data-deadline-state', 'soon');
    act(() => { vi.advanceTimersByTime(31 * 60_000); });
    expect(container.firstElementChild).toHaveAttribute('data-deadline-state', 'overdue');
  });
});
