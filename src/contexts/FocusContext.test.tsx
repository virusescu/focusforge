import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { FocusProvider, useFocus } from './FocusContext';
import type { ReactNode } from 'react';

// Mock audio
vi.mock('../utils/audio', () => ({
  soundEngine: {
    playClick: vi.fn(),
    playHover: vi.fn(),
    playPowerOn: vi.fn(),
    playPowerOff: vi.fn(),
    playTick: vi.fn(),
    playAlarm: vi.fn(),
    playGlitch: vi.fn(),
    playObjectiveAdded: vi.fn(),
  },
  playNeutralizeChime: vi.fn(),
  playObjectiveComplete: vi.fn(),
}));

// Mock DB
const mockSaveSession = vi.fn();
const mockAddObjective = vi.fn();
const mockDeleteObjective = vi.fn();
const mockGetObjectives = vi.fn().mockResolvedValue([]);

vi.mock('../db', () => ({
  getRecentSessions: vi.fn().mockResolvedValue([]),
  getDailyFocusStats: vi.fn().mockResolvedValue([]),
  getGlobalStats: vi.fn().mockResolvedValue({
    allTimeTotal: 0,
    allTimePeak: 0,
    weekTotal: 0,
    monthTotal: 0
  }),
  saveFocusSession: (start: string, dur: number) => mockSaveSession(start, dur),
  getObjectives: () => mockGetObjectives(),
  addObjective: (text: string) => mockAddObjective(text),
  deleteObjective: (id: number) => mockDeleteObjective(id)
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <FocusProvider>{children}</FocusProvider>
);

describe('FocusContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetObjectives.mockResolvedValue([]);
  });

  it('provides focus data and loading state', async () => {
    const { result } = renderHook(() => useFocus(), { wrapper });

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { timeout: 2000 });

    expect(result.current.recentSessions).toEqual([]);
    expect(result.current.dailyStats).toEqual([]);
    expect(result.current.objectivePool).toEqual([]);
  });

  it('populates objectivePool from DB on mount', async () => {
    const mockObjectives = [{ id: 1, text: 'Test Objective', created_at: '2023-01-01' }];
    mockGetObjectives.mockResolvedValueOnce(mockObjectives);

    const { result } = renderHook(() => useFocus(), { wrapper });

    await waitFor(() => {
      expect(result.current.objectivePool).toEqual(mockObjectives);
    }, { timeout: 2000 });
  });

  it('addObjective calls DB and refreshes state', async () => {
    const { result } = renderHook(() => useFocus(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const newObjective = { id: 2, text: 'New Objective', created_at: '2023-01-02' };
    mockGetObjectives.mockResolvedValue([newObjective]);

    await act(async () => {
      await result.current.addObjective('New Objective');
    });

    expect(mockAddObjective).toHaveBeenCalledWith('New Objective');
    expect(result.current.objectivePool).toEqual([newObjective]);
  });

  it('deleteObjective calls DB and refreshes state', async () => {
    const initialObjectives = [{ id: 1, text: 'Test Objective', created_at: '2023-01-01' }];
    mockGetObjectives.mockResolvedValueOnce(initialObjectives);

    const { result } = renderHook(() => useFocus(), { wrapper });
    await waitFor(() => expect(result.current.objectivePool).toEqual(initialObjectives));

    mockGetObjectives.mockResolvedValue([]);

    await act(async () => {
      await result.current.deleteObjective(1);
    });

    expect(mockDeleteObjective).toHaveBeenCalledWith(1);
    expect(result.current.objectivePool).toEqual([]);
  });

  it('setActiveObjective updates local state', async () => {
    const { result } = renderHook(() => useFocus(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setActiveObjective(42);
    });

    expect(result.current.activeObjectiveId).toBe(42);
  });

  it('neutralizeObjective triggers glitching and deletes objective', async () => {
    const { result } = renderHook(() => useFocus(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      // Don't await here because we want to check isGlitching immediately
      result.current.neutralizeObjective(1);
    });

    expect(result.current.isGlitching).toBe(true);
    expect(mockDeleteObjective).toHaveBeenCalledWith(1);
    
    // Wait for glitching to end (2800ms + some buffer)
    await waitFor(() => expect(result.current.isGlitching).toBe(false), { timeout: 4000 });
  });

  it('listens for timer-saved event and triggers save', async () => {
    const { result } = renderHook(() => useFocus(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      window.dispatchEvent(new CustomEvent('timer-saved', { 
        detail: { durationSeconds: 120 } 
      }));
    });

    await waitFor(() => {
      expect(mockSaveSession).toHaveBeenCalledWith(
        expect.any(String),
        120
      );
    });
  });

  it('does not save sessions under 60 seconds', async () => {
    const { result } = renderHook(() => useFocus(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      window.dispatchEvent(new CustomEvent('timer-saved', { 
        detail: { durationSeconds: 30 } 
      }));
    });

    // Wait a bit to ensure it WASN'T called
    await new Promise(r => setTimeout(r, 100));
    expect(mockSaveSession).not.toHaveBeenCalled();
  });
});
