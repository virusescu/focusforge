import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { FocusProvider, useFocus } from './FocusContext';
import type { ReactNode } from 'react';

// Mock DB
const mockSaveSession = vi.fn();
vi.mock('../db', () => ({
  getRecentSessions: vi.fn().mockResolvedValue([]),
  getDailyFocusStats: vi.fn().mockResolvedValue([]),
  getGlobalStats: vi.fn().mockResolvedValue({
    allTimeTotal: 0,
    allTimePeak: 0,
    weekTotal: 0,
    monthTotal: 0
  }),
  saveFocusSession: (start: string, dur: number) => mockSaveSession(start, dur)
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <FocusProvider>{children}</FocusProvider>
);

describe('FocusContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('provides focus data and loading state', async () => {
    const { result } = renderHook(() => useFocus(), { wrapper });

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.recentSessions).toEqual([]);
    expect(result.current.dailyStats).toEqual([]);
  });

  it('listens for timer-saved event and triggers save', async () => {
    renderHook(() => useFocus(), { wrapper });

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
    renderHook(() => useFocus(), { wrapper });

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
