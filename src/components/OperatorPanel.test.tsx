import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OperatorPanel } from './OperatorPanel';

let mockGame = {
  sessionsToday: 2,
  dailyBonusActive: false,
  currentStreakDays: 3,
  streakMultiplier: 1.5,
  totalCoinsEarned: 1500,
  prestigeTitles: [
    { unlock_threshold: 0 },
    { unlock_threshold: 1000 },
    { unlock_threshold: 5000 },
  ],
  currentTitle: { unlock_threshold: 1000 },
};

vi.mock('../contexts/UserContext', () => ({ useUser: () => ({ name: 'Ada', avatar: '' }) }));
vi.mock('../contexts/GameContext', () => ({ useGame: () => mockGame }));

describe('OperatorPanel', () => {
  it('shows the operator name, streak, daily progress and multiplier', () => {
    render(<OperatorPanel onOpenSettings={vi.fn()} />);
    expect(screen.getByText('Ada')).toBeInTheDocument();
    expect(screen.getByText('3/4')).toBeInTheDocument();
    expect(screen.getByText('2/3')).toBeInTheDocument();
    expect(screen.getByText('1.50x')).toBeInTheDocument();
  });

  it('shows progress to the next prestige threshold', () => {
    render(<OperatorPanel onOpenSettings={vi.fn()} />);
    expect(screen.getByText('500 / 4,000')).toBeInTheDocument();
  });

  it('doubles the multiplier and shows 2x while the daily bonus is active', () => {
    mockGame = { ...mockGame, dailyBonusActive: true };
    render(<OperatorPanel onOpenSettings={vi.fn()} />);
    expect(screen.getByText('2x')).toBeInTheDocument();
    expect(screen.getByText('3.00x')).toBeInTheDocument();
  });

  it('clicking the operator opens settings', () => {
    const onOpenSettings = vi.fn();
    render(<OperatorPanel onOpenSettings={onOpenSettings} />);
    fireEvent.click(screen.getByText('Ada'));
    expect(onOpenSettings).toHaveBeenCalledOnce();
  });
});
