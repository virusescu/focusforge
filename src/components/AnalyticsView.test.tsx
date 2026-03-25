import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { AnalyticsView } from './AnalyticsView';
import { FocusProvider } from '../contexts/FocusContext';
import type { ReactNode } from 'react';

// Mock DB
const mockSessions = [
  { id: 1, start_time: '2026-03-24T12:00:00.000Z', duration_seconds: 3600, date: '2026-03-24' },
  { id: 2, start_time: '2026-03-24T16:30:00.000Z', duration_seconds: 1800, date: '2026-03-24' }
];

const mockDeleteFocusSession = vi.fn().mockResolvedValue(undefined);

vi.mock('../db', () => ({
  getSessionsForDay: vi.fn().mockImplementation(() => Promise.resolve(mockSessions)),
  deleteFocusSession: (id: number) => mockDeleteFocusSession(id),
  getRecentSessions: vi.fn().mockResolvedValue([]),
  getDailyFocusStats: vi.fn().mockResolvedValue([]),
  getGlobalStats: vi.fn().mockResolvedValue({
    allTimeTotal: 5400,
    allTimePeak: 3600,
    weekTotal: 5400,
    monthTotal: 5400
  }),
  getObjectives: vi.fn().mockResolvedValue([]),
  addObjective: vi.fn().mockResolvedValue(undefined),
  deleteObjective: vi.fn().mockResolvedValue(undefined)
}));

// Mock AudioContext which doesn't exist in JSDOM
// Using an object instead of a constructor since vitest has issues with constructor mocks in some environments
const mockAudioContext = vi.fn().mockImplementation(function(this: any) {
  this.resume = vi.fn().mockResolvedValue(undefined);
  this.createOscillator = vi.fn().mockReturnValue({
    type: '',
    frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn()
  });
  this.createGain = vi.fn().mockReturnValue({
    gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    connect: vi.fn()
  });
  this.destination = {};
  this.currentTime = 0;
  this.state = 'suspended';
});

vi.stubGlobal('AudioContext', mockAudioContext);

const wrapper = ({ children }: { children: ReactNode }) => (
  <FocusProvider>{children}</FocusProvider>
);

describe('AnalyticsView', () => {
  const onBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly and loads sessions', async () => {
    await act(async () => {
      render(<AnalyticsView onBack={onBack} />, { wrapper });
    });
    
    expect(screen.getByText('SYSTEM_ANALYTICS')).toBeInTheDocument();
    
    await waitFor(() => {
      // Find the labels to confirm structure is there
      expect(screen.getByText('TOTAL_TIME:')).toBeInTheDocument();
      expect(screen.getByText('SESSIONS:')).toBeInTheDocument();
      // Check for the value 2 (sessions count)
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  it('navigates to previous and next days', async () => {
    await act(async () => {
      render(<AnalyticsView onBack={onBack} />, { wrapper });
    });
    
    // Find nav buttons (ChevronLeft is first, ChevronRight is second)
    const navButtons = screen.getAllByRole('button');
    const prevBtn = navButtons[1];
    const nextBtn = navButtons[2];

    await act(async () => {
      fireEvent.click(prevBtn);
    });
    
    await waitFor(() => {
      expect(screen.getByText(/DAY:/)).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(nextBtn);
    });
    
    await waitFor(() => {
      expect(screen.getByText(/DAY:/)).toBeInTheDocument();
    });
  });

  it('calls onBack when back button is clicked', async () => {
    await act(async () => {
      render(<AnalyticsView onBack={onBack} />, { wrapper });
    });
    
    const backBtn = screen.getByText('BACK_TO_HUD').closest('button');
    if (backBtn) {
      await act(async () => {
        fireEvent.click(backBtn);
      });
    }
    
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('calls deleteFocusSession when delete button is clicked', async () => {
    await act(async () => {
      render(<AnalyticsView onBack={onBack} />, { wrapper });
    });
    
    await waitFor(() => {
      expect(screen.getAllByTitle('DELETE_RECORD').length).toBeGreaterThan(0);
    });

    const deleteBtn = screen.getAllByTitle('DELETE_RECORD')[0];
    
    await act(async () => {
      fireEvent.click(deleteBtn);
    });

    await waitFor(() => {
      expect(mockDeleteFocusSession).toHaveBeenCalledWith(1);
    });
  });

  it('renders crack marks inside session blocks when pause_times exist', async () => {
    const { getSessionsForDay } = await import('../db');
    vi.mocked(getSessionsForDay)
      .mockResolvedValueOnce([
        {
          id: 1,
          start_time: '2026-03-24T09:00:00.000Z',
          duration_seconds: 3600,
          date: '2026-03-24',
          pause_times: ['2026-03-24T09:15:00.000Z', '2026-03-24T09:45:00.000Z'],
        },
      ])
      .mockResolvedValueOnce([]);

    await act(async () => {
      render(<AnalyticsView onBack={onBack} initialDate={new Date('2026-03-24T12:00:00.000Z')} />, { wrapper });
    });

    await waitFor(() => {
      expect(screen.getAllByTestId('interruption-crack').length).toBe(2);
    });
  });

  it('renders no cracks when session has no pause_times', async () => {
    const { getSessionsForDay } = await import('../db');
    vi.mocked(getSessionsForDay)
      .mockResolvedValueOnce([
        { id: 1, start_time: '2026-03-24T09:00:00.000Z', duration_seconds: 3600, date: '2026-03-24' },
      ])
      .mockResolvedValueOnce([]);

    await act(async () => {
      render(<AnalyticsView onBack={onBack} initialDate={new Date('2026-03-24T12:00:00.000Z')} />, { wrapper });
    });

    await waitFor(() => {
      expect(screen.queryByTestId('interruption-crack')).not.toBeInTheDocument();
    });
  });
});
