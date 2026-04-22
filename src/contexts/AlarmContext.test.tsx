import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { AlarmProvider, useAlarms } from './AlarmContext';
import type { ReactNode } from 'react';

// Mock DB
const mockGetAlarms = vi.fn();
const mockAddAlarm = vi.fn();
const mockUpdateAlarm = vi.fn();
const mockToggleAlarm = vi.fn();
const mockDeleteAlarm = vi.fn();

vi.mock('../db', () => ({
  getAlarms: (userId: number) => mockGetAlarms(userId),
  addAlarm: (...args: any[]) => mockAddAlarm(...args),
  updateAlarm: (...args: any[]) => mockUpdateAlarm(...args),
  toggleAlarm: (...args: any[]) => mockToggleAlarm(...args),
  deleteAlarm: (...args: any[]) => mockDeleteAlarm(...args),
}));

// Mock AuthContext
vi.mock('./AuthContext', () => ({
  useAuth: () => ({
    authUser: { id: 1 },
    loading: false,
  }),
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <AlarmProvider>{children}</AlarmProvider>
);

describe('AlarmContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAlarms.mockResolvedValue([]);
  });

  it('should load alarms on mount', async () => {
    const mockAlarms = [{ id: 1, title: 'Wake Up', time: '08:00', days_of_week: [1, 2, 3, 4, 5], is_active: true }];
    mockGetAlarms.mockResolvedValue(mockAlarms);

    const { result } = renderHook(() => useAlarms(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.alarms).toEqual(mockAlarms);
  });

  it('addAlarm should call DB and refresh list', async () => {
    const { result } = renderHook(() => useAlarms(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const newAlarm = { id: 2, title: 'Gym', time: '18:00', days_of_week: [1, 3, 5], is_active: true };
    mockAddAlarm.mockResolvedValue(2);
    mockGetAlarms.mockResolvedValue([newAlarm]);

    await act(async () => {
      await result.current.addAlarm('Gym', '18:00', [1, 3, 5]);
    });

    expect(mockAddAlarm).toHaveBeenCalledWith(1, 'Gym', '18:00', [1, 3, 5]);
    expect(result.current.alarms).toEqual([newAlarm]);
  });

  describe('Timer-based Triggers', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    
    afterEach(() => {
      vi.useRealTimers();
    });

    it('should trigger activeAlarm when time matches', async () => {
      const alarmTime = '09:00';
      const mockAlarms = [{ id: 1, title: 'Meeting', time: alarmTime, days_of_week: [0, 1, 2, 3, 4, 5, 6], is_active: true }];
      mockGetAlarms.mockResolvedValue(mockAlarms);

      const now = new Date();
      now.setHours(8, 59, 55, 0);
      vi.setSystemTime(now);

      const { result } = renderHook(() => useAlarms(), { wrapper });
      
      // Advance to allow refreshAlarms to finish
      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      expect(result.current.activeAlarm).toBeNull();

      // Advance to 09:00:05
      await act(async () => {
        vi.advanceTimersByTime(10000);
      });

      expect(result.current.activeAlarm).not.toBeNull();
      expect(result.current.activeAlarm?.title).toBe('Meeting');
    });

    it('snoozeAlarm should clear activeAlarm, increment count, and re-trigger later', async () => {
      const alarmTime = '10:00';
      const mockAlarms = [{ id: 1, title: 'Snooze Test', time: alarmTime, days_of_week: [0, 1, 2, 3, 4, 5, 6], is_active: true }];
      mockGetAlarms.mockResolvedValue(mockAlarms);

      const now = new Date();
      now.setHours(10, 0, 0, 0);
      vi.setSystemTime(now);

      const { result } = renderHook(() => useAlarms(), { wrapper });
      
      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      // Initial trigger (at 10:00:05 after 5s interval)
      await act(async () => { vi.advanceTimersByTime(10000); });
      expect(result.current.activeAlarm).not.toBeNull();
      expect(result.current.getSnoozeCount(1)).toBe(0);

      await act(async () => {
        result.current.snoozeAlarm(1, 5);
      });

      expect(result.current.activeAlarm).toBeNull();
      expect(result.current.getSnoozeCount(1)).toBe(1);

      // Advance 4 minutes - should NOT re-trigger
      await act(async () => {
        vi.advanceTimersByTime(4 * 60 * 1000);
      });
      expect(result.current.activeAlarm).toBeNull();

      // Advance 1 more minute - SHOULD re-trigger
      await act(async () => {
        vi.advanceTimersByTime(60 * 1000 + 5000);
      });

      expect(result.current.activeAlarm).not.toBeNull();
      expect(result.current.getSnoozeCount(1)).toBe(1); 
    });

    it('updateAlarm should reset snooze count', async () => {
      const alarmTime = '10:00';
      const mockAlarm = { id: 1, title: 'Snooze Test', time: alarmTime, days_of_week: [0, 1, 2, 3, 4, 5, 6], is_active: true };
      mockGetAlarms.mockResolvedValue([mockAlarm]);

      const now = new Date();
      now.setHours(10, 0, 0, 0);
      vi.setSystemTime(now);

      const { result } = renderHook(() => useAlarms(), { wrapper });
      await act(async () => { vi.advanceTimersByTime(100); });

      // Trigger and snooze
      await act(async () => { vi.advanceTimersByTime(10000); });
      await act(async () => { result.current.snoozeAlarm(1, 5); });
      expect(result.current.getSnoozeCount(1)).toBe(1);

      // Update alarm
      await act(async () => {
        await result.current.updateAlarm(1, 'New Title', '11:00', [1, 2]);
      });

      expect(result.current.getSnoozeCount(1)).toBe(0);
    });
  });
});
