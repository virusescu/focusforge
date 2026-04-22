import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import AlarmOverlay from './AlarmOverlay';
import { AlarmProvider } from '../contexts/AlarmContext';

vi.mock('../utils/audio', () => ({
  playAlarmFile: vi.fn().mockResolvedValue({ pause: vi.fn(), currentTime: 0, volume: 1.0 }),
  soundEngine: {
    playChargeClick: vi.fn(),
    playNeutralizeChime: vi.fn(),
  },
}));

// Mock AuthContext for AlarmProvider
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    authUser: { id: 1 },
    loading: false,
  }),
}));

// Mock DB
vi.mock('../db', () => ({
  getAlarms: vi.fn().mockResolvedValue([]),
  addAlarm: vi.fn(),
  updateAlarm: vi.fn(),
  toggleAlarm: vi.fn(),
  deleteAlarm: vi.fn(),
}));

const mockAlarm = { id: 1, title: 'WAKE UP', time: '08:00', days_of_week: [1], is_active: true, user_id: 1 };

describe('AlarmOverlay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders alarm title', () => {
    const { getByText } = render(
      <AlarmProvider>
        <AlarmOverlay alarm={mockAlarm} onDismiss={vi.fn()} />
      </AlarmProvider>
    );
    expect(getByText('WAKE UP')).toBeDefined();
  });

  it('calls onDismiss after 5 clicks', async () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    const { container } = render(
      <AlarmProvider>
        <AlarmOverlay alarm={mockAlarm} onDismiss={onDismiss} />
      </AlarmProvider>
    );
    
    // The overlay is the first child (div className=overlay)
    const overlay = container.firstChild as HTMLElement;

    // Simulate 5 clicks
    for (let i = 0; i < 5; i++) {
      fireEvent.click(overlay);
    }

    // Advance timers for the setTimeout(() => onDismiss(), 600)
    await act(async () => {
      vi.advanceTimersByTime(601);
    });

    expect(onDismiss).toHaveBeenCalled();
    vi.useRealTimers();
  });
});
